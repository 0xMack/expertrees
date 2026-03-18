import type { SkillNode, Position } from '../types/index.js'
import { BUBBLE_WORLD_RADIUS } from './CanvasRenderer.js'

export interface InteractionState {
  pan: Position
  zoom: number
  hoveredNodeId: string | null
  selectedNodeId: string | null
}

export type InteractionEvent =
  | { type: 'node:click'; nodeId: string }
  | { type: 'node:hover'; nodeId: string }
  | { type: 'node:blur'; nodeId: string }
  | { type: 'zoom:change'; zoom: number }
  | { type: 'pan:change'; pan: Position }

export class InteractionController {
  private _canvas: HTMLCanvasElement
  private _state: InteractionState
  private _isPanning = false
  private _lastPan: Position = { x: 0, y: 0 }
  private _listeners: Set<(event: InteractionEvent) => void> = new Set()
  private _nodes: SkillNode[] = []
  private _positions: Map<string, Position> = new Map()
  private _nodeSize = 8
  private _dpr: number

  // Smooth zoom
  private _targetZoom: number = 1
  private _zoomAnchor: Position | null = null
  private readonly _zoomLerpAlpha = 0.14

  // Multi-touch tracking
  private _activePointers: Map<number, Position> = new Map()
  private _lastPinchDist: number | null = null
  // Separate from _lastPan (which is updated on every move) — used for drag vs click detection
  private _pointerDownPos: Position = { x: 0, y: 0 }

  private _onPointerDown: (e: PointerEvent) => void
  private _onPointerMove: (e: PointerEvent) => void
  private _onPointerUp: (e: PointerEvent) => void
  private _onPointerCancel: (e: PointerEvent) => void
  private _onWheel: (e: WheelEvent) => void

  constructor(canvas: HTMLCanvasElement) {
    this._canvas = canvas
    this._dpr = window.devicePixelRatio ?? 1
    this._state = {
      pan: { x: canvas.width / (2 * this._dpr), y: canvas.height / (2 * this._dpr) },
      zoom: 1,
      hoveredNodeId: null,
      selectedNodeId: null,
    }

    this._onPointerDown   = this._handlePointerDown.bind(this)
    this._onPointerMove   = this._handlePointerMove.bind(this)
    this._onPointerUp     = this._handlePointerUp.bind(this)
    this._onPointerCancel = this._handlePointerCancel.bind(this)
    this._onWheel         = this._handleWheel.bind(this)

    canvas.addEventListener('pointerdown',   this._onPointerDown)
    canvas.addEventListener('pointermove',   this._onPointerMove)
    canvas.addEventListener('pointerup',     this._onPointerUp)
    canvas.addEventListener('pointercancel', this._onPointerCancel)
    canvas.addEventListener('wheel',         this._onWheel, { passive: false })
  }

  get state(): Readonly<InteractionState> { return this._state }
  get targetZoom(): number { return this._targetZoom }
  get zoomAnchor(): Position | null { return this._zoomAnchor }

  setTargetZoom(value: number): void { this._targetZoom = value }

  /** Instantly snap zoom and pan to a new center — used on navigation transitions. */
  resetToCenter(zoom: number, cx: number, cy: number): void {
    this._targetZoom = zoom
    this._state.zoom = zoom
    this._state.pan  = { x: cx, y: cy }
    this._zoomAnchor = null
  }

  updateNodes(nodes: SkillNode[], positions: Map<string, Position>, nodeSize: number): void {
    this._nodes     = nodes
    this._positions = positions
    this._nodeSize  = nodeSize
  }

  onChange(listener: (event: InteractionEvent) => void): () => void {
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  /**
   * Lerp current zoom toward target. Called every RAF frame by the engine.
   * Returns true while the animation is still in progress.
   */
  tick(): boolean {
    const dz = this._targetZoom - this._state.zoom
    if (Math.abs(dz) < 0.0001) {
      this._zoomAnchor = null
      return false
    }

    const prevZoom = this._state.zoom
    this._state.zoom += dz * this._zoomLerpAlpha

    // Keep the zoom anchor point fixed in world space
    if (this._zoomAnchor) {
      const { x: ax, y: ay } = this._zoomAnchor
      this._state.pan = {
        x: ax - (ax - this._state.pan.x) * (this._state.zoom / prevZoom),
        y: ay - (ay - this._state.pan.y) * (this._state.zoom / prevZoom),
      }
    }

    return true
  }

  dispose(): void {
    this._canvas.removeEventListener('pointerdown',   this._onPointerDown)
    this._canvas.removeEventListener('pointermove',   this._onPointerMove)
    this._canvas.removeEventListener('pointerup',     this._onPointerUp)
    this._canvas.removeEventListener('pointercancel', this._onPointerCancel)
    this._canvas.removeEventListener('wheel',         this._onWheel)
  }

  // ─── Canvas → world coordinate transform ────────────────────────────────────

  canvasToWorld(canvasX: number, canvasY: number): Position {
    return {
      x: (canvasX - this._state.pan.x) / this._state.zoom,
      y: (canvasY - this._state.pan.y) / this._state.zoom,
    }
  }

  private _getCanvasPos(e: MouseEvent): Position {
    const rect = this._canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  private _hitTest(worldPos: Position): string | null {
    let closest: string | null = null
    let closestDist = Infinity

    for (const node of this._nodes) {
      const pos = this._positions.get(node.id)
      if (!pos) continue
      const isBubble = !!(node.childIds && node.childIds.length > 0)
      // Bubbles: match visual radius. Stars: generous touch target covering label.
      const hitRadius = isBubble ? BUBBLE_WORLD_RADIUS * 1.3 : this._nodeSize * 4
      const dx = worldPos.x - pos.x
      const dy = worldPos.y - pos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < hitRadius && dist < closestDist) {
        closestDist = dist
        closest = node.id
      }
    }
    return closest
  }

  private _emit(event: InteractionEvent): void {
    for (const listener of this._listeners) listener(event)
  }

  // ─── Pointer handlers ────────────────────────────────────────────────────────

  private _handlePointerDown(e: PointerEvent): void {
    this._canvas.setPointerCapture(e.pointerId)
    const pos = this._getCanvasPos(e)
    this._activePointers.set(e.pointerId, pos)

    if (this._activePointers.size === 1) {
      // Single pointer — prepare for pan or click
      this._isPanning      = true
      this._lastPan        = pos
      this._pointerDownPos = pos  // fixed reference for drag vs click detection
    } else {
      // Second finger arrived — switch to pinch mode
      this._isPanning      = false
      this._lastPinchDist  = null
    }
  }

  private _handlePointerMove(e: PointerEvent): void {
    const canvasPos = this._getCanvasPos(e)
    this._activePointers.set(e.pointerId, canvasPos)

    // ── Pinch zoom (two fingers) ──────────────────────────────────────────────
    if (this._activePointers.size >= 2) {
      const pts  = [...this._activePointers.values()]
      const dist = Math.hypot(pts[1]!.x - pts[0]!.x, pts[1]!.y - pts[0]!.y)

      if (this._lastPinchDist !== null && dist > 0) {
        const scale = dist / this._lastPinchDist
        const midX  = (pts[0]!.x + pts[1]!.x) / 2
        const midY  = (pts[0]!.y + pts[1]!.y) / 2
        this._targetZoom = Math.max(0.05, Math.min(20, this._targetZoom * scale))
        this._zoomAnchor = { x: midX, y: midY }
        this._emit({ type: 'zoom:change', zoom: this._targetZoom })
      }
      this._lastPinchDist = dist
      return
    }

    // ── Single-pointer pan ───────────────────────────────────────────────────
    if (this._isPanning) {
      const dx = canvasPos.x - this._lastPan.x
      const dy = canvasPos.y - this._lastPan.y
      this._lastPan     = canvasPos
      this._state.pan   = { x: this._state.pan.x + dx, y: this._state.pan.y + dy }
      this._emit({ type: 'pan:change', pan: this._state.pan })
      return
    }

    // ── Hover detection (mouse / stylus, not bare touch) ─────────────────────
    if (e.pointerType !== 'touch') {
      const worldPos = this.canvasToWorld(canvasPos.x, canvasPos.y)
      const hit      = this._hitTest(worldPos)
      if (hit !== this._state.hoveredNodeId) {
        if (this._state.hoveredNodeId) {
          this._emit({ type: 'node:blur', nodeId: this._state.hoveredNodeId })
        }
        this._state.hoveredNodeId = hit
        if (hit) this._emit({ type: 'node:hover', nodeId: hit })
      }
    }
  }

  private _handlePointerUp(e: PointerEvent): void {
    const canvasPos       = this._getCanvasPos(e)
    const wasMultiTouch   = this._activePointers.size >= 2
    const dragOrigin      = this._pointerDownPos  // original down position, not the moving _lastPan
    this._activePointers.delete(e.pointerId)
    this._lastPinchDist = null

    if (wasMultiTouch) {
      // Came back to single touch — resume pan from current remaining finger
      if (this._activePointers.size === 1) {
        this._isPanning = true
        this._lastPan   = [...this._activePointers.values()][0]!
      }
      return
    }

    this._isPanning = false

    // Fire click if pointer didn't travel (not a drag)
    const dx = Math.abs(canvasPos.x - dragOrigin.x)
    const dy = Math.abs(canvasPos.y - dragOrigin.y)
    if (dx < 4 && dy < 4) {
      const worldPos = this.canvasToWorld(canvasPos.x, canvasPos.y)
      const hit      = this._hitTest(worldPos)
      if (hit) {
        this._state.selectedNodeId = hit === this._state.selectedNodeId ? null : hit
        this._emit({ type: 'node:click', nodeId: hit })
      }
    }
  }

  private _handlePointerCancel(e: PointerEvent): void {
    this._activePointers.delete(e.pointerId)
    this._lastPinchDist = null
    if (this._activePointers.size === 0) {
      this._isPanning = false
    }
  }

  // ── Wheel (mouse / trackpad) ─────────────────────────────────────────────────

  private _handleWheel(e: WheelEvent): void {
    e.preventDefault()
    const canvasPos      = this._getCanvasPos(e)
    const factor         = e.deltaY < 0 ? 1.1 : 1 / 1.1
    this._targetZoom     = Math.max(0.05, Math.min(20, this._targetZoom * factor))
    this._zoomAnchor     = canvasPos
    this._emit({ type: 'zoom:change', zoom: this._targetZoom })
  }
}
