import type {
  SkillGraph,
  SkillNode,
  SkillEdge,
  NodeState,
  Evidence,
  ThemeInput,
  LodThreshold,
  SkillTreeEvents,
  InternalNodeState,
  Position,
  NavigationFrame,
} from './types/index.js'
import { SkillGraphModel } from './graph/SkillGraphModel.js'
import { NavigationController } from './graph/NavigationController.js'
import { LodController } from './lod/LodController.js'
import { ForceLayout } from './layout/ForceLayout.js'
import { CanvasRenderer, BUBBLE_WORLD_RADIUS } from './renderer/CanvasRenderer.js'
import { InteractionController } from './renderer/InteractionController.js'

const ENTER_ZOOM_THRESHOLD = 2.5  // zoom target must exceed this to enter a bubble
const EXIT_ZOOM_THRESHOLD  = 0.35 // zoom target must drop below this to exit context
const NAV_COOLDOWN_MS      = 700  // prevent rapid enter/exit toggling

export interface SkillTreeEngineOptions {
  canvas: HTMLCanvasElement
  data: SkillGraph
  theme?: ThemeInput
  lod?: LodThreshold[]
  on?: Partial<SkillTreeEvents>
  /** Silently start inside this bubble node's context — no burst or fade animation */
  initialContextNodeId?: string
}

export class SkillTreeEngine {
  private _model: SkillGraphModel
  private _nav: NavigationController
  private _lod: LodController
  private _layout: ForceLayout
  private _renderer: CanvasRenderer
  private _interaction: InteractionController
  private _positions: Map<string, Position> = new Map()
  private _internalStates: Map<string, InternalNodeState> = new Map()
  private _eventHandlers: Partial<SkillTreeEvents>
  private _rafId: number | null = null
  private _pendingEnter: ReturnType<typeof setTimeout> | null = null
  private _pendingExit:  ReturnType<typeof setTimeout> | null = null
  private _unsubscribers: Array<() => void> = []
  private _resizeObserver: ResizeObserver

  // Cached visible node/edge lists — rebuilt on navigation and model changes
  private _visibleNodes: SkillNode[] = []
  private _visibleEdges: SkillEdge[] = []

  // Context fade-in
  private _contextFadeAlpha = 1.0
  private _contextFadeStart = 0
  private readonly _contextFadeDuration = 400

  // Navigation cooldown
  private _navCooldownUntil = 0

  constructor(options: SkillTreeEngineOptions) {
    const { canvas, data, theme, lod, on = {} } = options

    this._eventHandlers = on
    this._model = new SkillGraphModel(data)
    this._nav = new NavigationController({ nodeId: null, label: data.label })
    this._lod = new LodController(lod)
    this._layout = new ForceLayout()
    this._renderer = new CanvasRenderer(canvas, theme ?? data.theme)
    this._interaction = new InteractionController(canvas)

    if (options.initialContextNodeId) {
      const initNode = this._model.getNode(options.initialContextNodeId)
      if (initNode && this._isBubble(initNode)) {
        this._nav.push({ nodeId: initNode.id, label: initNode.label })
      }
    }

    this._rebuildVisibleCache()
    this._wireEvents()
    this._runLayout()
    this._startRenderLoop()

    this._resizeObserver = new ResizeObserver(() => {
      this._renderer.resize()
      this._runLayout()
    })
    this._resizeObserver.observe(canvas)

    this._eventHandlers['graph:ready']?.(data)
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  setNodeState(nodeId: string, state: NodeState): void {
    this._model.setNodeState(nodeId, state)
  }

  addEvidence(nodeId: string, evidence: Evidence): void {
    this._model.addEvidence(nodeId, evidence)
  }

  removeEvidence(nodeId: string, evidenceId: string): void {
    this._model.removeEvidence(nodeId, evidenceId)
  }

  updateTheme(theme: ThemeInput): void {
    this._renderer.updateTheme(theme)
  }

  zoomIn(): void {
    this._interaction.setTargetZoom(Math.min(20, this._interaction.targetZoom * 1.3))
  }

  zoomOut(): void {
    this._interaction.setTargetZoom(Math.max(0.05, this._interaction.targetZoom / 1.3))
  }

  goBack(): void {
    if (this._nav.canGoBack) this._exitWithAnimation()
  }

  /**
   * Atomically jump to a specific nav stack depth, firing a single animation.
   * `targetLength` is the desired `stack.length` after the jump.
   * Silently pops intermediate frames; plays one implode + fade transition.
   */
  jumpToNavDepth(targetLength: number): void {
    if (this._nav.stack.length <= targetLength) return

    // Cancel any in-flight transitions
    if (this._pendingEnter !== null) { clearTimeout(this._pendingEnter); this._pendingEnter = null }
    if (this._pendingExit  !== null) { clearTimeout(this._pendingExit);  this._pendingExit  = null }

    // Silently pop all excess frames; capture the last one for the event
    let lastPopped: NavigationFrame | undefined
    while (this._nav.stack.length > targetLength && this._nav.canGoBack) {
      lastPopped = this._nav.pop()
    }
    if (!lastPopped) return

    const canvas = this._renderer.canvas
    const rect   = canvas.getBoundingClientRect()
    const center = { x: rect.width / 2, y: rect.height / 2 }

    this._navCooldownUntil = Date.now() + NAV_COOLDOWN_MS
    this._rebuildVisibleCache()
    this._renderer.triggerImplode(center)
    this._interaction.resetToCenter(1.0, center.x, center.y)
    this._lod.setZoom(1.0)

    for (const n of this._visibleNodes) {
      this._positions.set(n.id, { x: (Math.random() - 0.5) * 80, y: (Math.random() - 0.5) * 80 })
    }

    this._contextFadeAlpha = 0
    this._contextFadeStart = performance.now()
    this._runLayout()
    this._eventHandlers['context:exit']?.(lastPopped, this._nav.stack)
  }

  private _exitWithAnimation(): void {
    if (!this._nav.canGoBack) return

    // Cancel any pending enter transition
    if (this._pendingEnter !== null) {
      clearTimeout(this._pendingEnter)
      this._pendingEnter = null
    }

    const canvas = this._renderer.canvas
    const rect = canvas.getBoundingClientRect()
    const center = { x: rect.width / 2, y: rect.height / 2 }
    const duration = 480

    // Ease-out: camera pulls back fast, then settles
    this._interaction.startTimedZoom(0.45, duration, undefined, 'out')

    this._pendingExit = setTimeout(() => {
      this._pendingExit = null
      this._renderer.triggerImplode(center)
      this._exitContext()
    }, duration)
  }

  enterContext(nodeId: string): void {
    const node = this._model.getNode(nodeId)
    if (!node || !this._isBubble(node)) return

    // Cancel any previous pending transition
    if (this._pendingEnter !== null) {
      clearTimeout(this._pendingEnter)
      this._pendingEnter = null
    }

    const canvas = this._renderer.canvas
    const rect = canvas.getBoundingClientRect()
    const burstPos = { x: rect.width / 2, y: rect.height / 2 }

    // Cubic ease-in zoom toward the node, then transition exactly when it peaks
    const nodePos = this._positions.get(nodeId)
    const anchor = nodePos ? (() => {
      const { zoom, pan } = this._interaction.state
      return { x: nodePos.x * zoom + pan.x, y: nodePos.y * zoom + pan.y }
    })() : undefined

    const duration = 480
    this._interaction.startTimedZoom(2.5, duration, anchor)

    this._pendingEnter = setTimeout(() => {
      this._pendingEnter = null
      this._enterContext(node, burstPos)
    }, duration)
  }

  getGraph(): SkillGraph { return this._model.toJSON() }

  getNavigationStack(): readonly NavigationFrame[] { return this._nav.stack }

  dispose(): void {
    if (this._rafId !== null) cancelAnimationFrame(this._rafId)
    if (this._pendingEnter !== null) clearTimeout(this._pendingEnter)
    if (this._pendingExit  !== null) clearTimeout(this._pendingExit)
    this._resizeObserver.disconnect()
    this._layout.stop()
    this._renderer.dispose()
    this._interaction.dispose()
    for (const unsub of this._unsubscribers) unsub()
  }

  // ─── Visible node cache ──────────────────────────────────────────────────────

  private _rebuildVisibleCache(): void {
    const currentId = this._nav.current.nodeId
    this._visibleNodes = this._model.getNodes().filter(n =>
      currentId === null ? !n.parentId : n.parentId === currentId
    )
    const ids = new Set(this._visibleNodes.map(n => n.id))
    this._visibleEdges = this._model.getEdges().filter(
      e => ids.has(e.source) && ids.has(e.target)
    )
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  private _isBubble(node: SkillNode): boolean {
    return !!(node.childIds && node.childIds.length > 0)
  }

  private _enterContext(node: SkillNode, burstCanvasPos: Position): void {
    this._nav.push({ nodeId: node.id, label: node.label })
    this._navCooldownUntil = Date.now() + NAV_COOLDOWN_MS
    this._rebuildVisibleCache()

    this._renderer.triggerBurst(burstCanvasPos, this._renderer.resolveNodeColor(node))

    // Reset zoom/pan to center
    const canvas = this._renderer.canvas
    const rect = canvas.getBoundingClientRect()
    this._interaction.resetToCenter(1.0, rect.width / 2, rect.height / 2)
    this._lod.setZoom(1.0)

    // Seed visible nodes near world origin
    for (const n of this._visibleNodes) {
      this._positions.set(n.id, {
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 80,
      })
    }

    this._contextFadeAlpha = 0
    this._contextFadeStart = performance.now()

    this._runLayout()
    this._eventHandlers['context:enter']?.(node, this._nav.stack)
  }

  private _exitContext(): void {
    const exited = this._nav.pop()
    if (!exited) return
    this._navCooldownUntil = Date.now() + NAV_COOLDOWN_MS
    this._rebuildVisibleCache()

    const canvas = this._renderer.canvas
    const rect = canvas.getBoundingClientRect()
    this._interaction.resetToCenter(1.0, rect.width / 2, rect.height / 2)
    this._lod.setZoom(1.0)

    for (const n of this._visibleNodes) {
      this._positions.set(n.id, {
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 80,
      })
    }

    this._contextFadeAlpha = 0
    this._contextFadeStart = performance.now()

    this._runLayout()
    this._eventHandlers['context:exit']?.(exited, this._nav.stack)
  }

  private _checkNavigation(): void {
    if (Date.now() < this._navCooldownUntil) return

    const targetZoom = this._interaction.targetZoom
    const anchor = this._interaction.zoomAnchor

    if (targetZoom > ENTER_ZOOM_THRESHOLD && anchor) {
      const { zoom, pan } = this._interaction.state
      const bubble = this._findBubbleAtCanvas(anchor, pan, zoom)
      if (bubble) {
        this._enterContext(bubble, anchor)
        return
      }
    }

    if (targetZoom < EXIT_ZOOM_THRESHOLD && this._nav.canGoBack) {
      this._exitContext()
    }
  }

  private _findBubbleAtCanvas(canvasPos: Position, pan: Position, zoom: number): SkillNode | null {
    const worldX = (canvasPos.x - pan.x) / zoom
    const worldY = (canvasPos.y - pan.y) / zoom

    for (const node of this._visibleNodes) {
      if (!this._isBubble(node)) continue
      const pos = this._positions.get(node.id)
      if (!pos) continue
      const dx = worldX - pos.x
      const dy = worldY - pos.y
      if (Math.sqrt(dx * dx + dy * dy) <= BUBBLE_WORLD_RADIUS * 1.3) {
        return node
      }
    }
    return null
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  private _wireEvents(): void {
    this._unsubscribers.push(
      this._model.on('changed', () => {
        this._rebuildVisibleCache()
      })
    )

    this._unsubscribers.push(
      this._interaction.onChange(event => {
        switch (event.type) {
          case 'zoom:change':
          case 'pan:change':
            break
          case 'node:hover': {
            this._internalStates.set(event.nodeId, 'hovered')
            const node = this._model.getNode(event.nodeId)
            if (node) this._eventHandlers['node:hover']?.(node)
            break
          }
          case 'node:blur': {
            const prev = this._internalStates.get(event.nodeId)
            if (prev === 'hovered') this._internalStates.set(event.nodeId, 'idle')
            const node = this._model.getNode(event.nodeId)
            if (node) this._eventHandlers['node:blur']?.(node)
            break
          }
          case 'canvas:click': {
            // Clear any selected node
            for (const [id, s] of this._internalStates) {
              if (s === 'selected') this._internalStates.set(id, 'idle')
            }
            this._eventHandlers['canvas:click']?.()
            break
          }

          case 'node:click': {
            const node = this._model.getNode(event.nodeId)
            if (!node) break

            // Toggle selection internal state for all nodes
            const prev = this._internalStates.get(event.nodeId)
            const isSelected = prev === 'selected'
            if (isSelected) {
              this._internalStates.set(event.nodeId, 'idle')
            } else {
              for (const [id, s] of this._internalStates) {
                if (s === 'selected') this._internalStates.set(id, 'idle')
              }
              this._internalStates.set(event.nodeId, 'selected')
            }

            this._eventHandlers['node:click']?.(node)
            break
          }
        }
      })
    )
  }

  // ─── Layout ─────────────────────────────────────────────────────────────────

  private _runLayout(): void {
    const rect = this._renderer.canvas.getBoundingClientRect()

    this._layout.run(this._visibleNodes, this._visibleEdges, {
      width: rect.width || 800,
      height: rect.height || 600,
      onTick: positions => {
        for (const [id, pos] of positions) this._positions.set(id, pos)
        this._interaction.updateNodes(this._visibleNodes, this._positions, 8)
      },
    })
  }

  // ─── Render loop ────────────────────────────────────────────────────────────

  private _startRenderLoop(): void {
    const loop = () => {
      const zooming = this._interaction.tick()
      if (zooming) {
        const z = this._interaction.state.zoom
        this._lod.setZoom(z)
        this._eventHandlers['zoom:change']?.(z)
      }

      if (this._contextFadeAlpha < 1) {
        const elapsed = performance.now() - this._contextFadeStart
        this._contextFadeAlpha = Math.min(1, elapsed / this._contextFadeDuration)
      }

      this._checkNavigation()
      this._draw()

      this._rafId = requestAnimationFrame(loop)
    }
    this._rafId = requestAnimationFrame(loop)
  }

  private _draw(): void {
    const { pan, zoom } = this._interaction.state

    this._renderer.render(this._visibleNodes, this._visibleEdges, {
      positions: this._positions,
      internalStates: this._internalStates,
      contextFadeAlpha: this._contextFadeAlpha,
      pan,
      zoom,
    })
  }
}
