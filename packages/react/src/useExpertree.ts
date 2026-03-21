import { useState, useEffect, useCallback, useRef } from 'react'
import {
  SkillTreeEngine,
  type SkillGraph,
  type SkillNode,
  type NodeState,
  type Evidence,
  type ThemeInput,
  type LodThreshold,
  type SkillTreeEvents,
  type NavigationFrame,
} from '@expertrees/core'

export interface UseExpertreeOptions {
  data: SkillGraph
  theme?: ThemeInput
  lod?: LodThreshold[]
  on?: Partial<SkillTreeEvents>
  initialContextNodeId?: string
}

export interface UseExpertreeReturn {
  /** Attach to the <canvas> element via the ref callback */
  canvasRef: (el: HTMLCanvasElement | null) => void
  /** Currently hovered node */
  hoveredNode: SkillNode | null
  /** Currently selected node */
  selectedNode: SkillNode | null
  /** Current zoom level */
  zoom: number
  /** Current navigation stack — last entry is the active context */
  navigationStack: readonly NavigationFrame[]
  /** Whether the user can navigate back to a parent context */
  canGoBack: boolean
  /** Navigate back to the parent context */
  goBack: () => void
  /** Set a node's semantic state */
  setNodeState: (nodeId: string, state: NodeState) => void
  /** Add evidence to a node */
  addEvidence: (nodeId: string, evidence: Evidence) => void
  /** Remove evidence from a node */
  removeEvidence: (nodeId: string, evidenceId: string) => void
  /** Update the visual theme */
  updateTheme: (theme: ThemeInput) => void
  /** Programmatic zoom in */
  zoomIn: () => void
  /** Programmatic zoom out */
  zoomOut: () => void
  /** Get serialized graph state */
  getGraph: () => SkillGraph
  /** Programmatically enter a bubble node's context */
  enterContext: (nodeId: string) => void
  /** Atomically jump to a specific nav stack depth */
  jumpToNavDepth: (targetLength: number) => void
}

export function useExpertree(options: UseExpertreeOptions): UseExpertreeReturn {
  const engineRef = useRef<SkillTreeEngine | null>(null)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const [hoveredNode, setHoveredNode] = useState<SkillNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<SkillNode | null>(null)
  const [zoom, setZoom] = useState(1)
  const [navigationStack, setNavigationStack] = useState<readonly NavigationFrame[]>([
    { nodeId: null, label: options.data.label },
  ])

  const canvasRef = useCallback((el: HTMLCanvasElement | null) => setCanvas(el), [])

  useEffect(() => {
    engineRef.current?.dispose()
    engineRef.current = null

    if (!canvas) return

    const engine = new SkillTreeEngine({
      canvas,
      data: options.data,
      ...(options.theme !== undefined && { theme: options.theme }),
      ...(options.lod !== undefined && { lod: options.lod }),
      ...(options.initialContextNodeId !== undefined && { initialContextNodeId: options.initialContextNodeId }),
      on: {
        ...options.on,
        'node:hover': (node) => {
          setHoveredNode(node)
          options.on?.['node:hover']?.(node)
        },
        'node:blur': (node) => {
          setHoveredNode(prev => prev?.id === node.id ? null : prev)
          options.on?.['node:blur']?.(node)
        },
        'node:click': (node) => {
          setSelectedNode(prev => prev?.id === node.id ? null : node)
          options.on?.['node:click']?.(node)
        },
        'canvas:click': () => {
          setSelectedNode(null)
          options.on?.['canvas:click']?.()
        },
        'zoom:change': (z) => {
          setZoom(z)
          options.on?.['zoom:change']?.(z)
        },
        'context:enter': (node, stack) => {
          setNavigationStack([...stack])
          setSelectedNode(null)
          options.on?.['context:enter']?.(node, stack)
        },
        'context:exit': (frame, stack) => {
          setNavigationStack([...stack])
          setSelectedNode(null)
          options.on?.['context:exit']?.(frame, stack)
        },
        'graph:ready': (graph) => {
          options.on?.['graph:ready']?.(graph)
        },
      },
    })

    engineRef.current = engine
    setNavigationStack([...engine.getNavigationStack()])

    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [canvas, options.data])

  const setNodeState = useCallback((nodeId: string, state: NodeState) =>
    engineRef.current?.setNodeState(nodeId, state), [])

  const addEvidence = useCallback((nodeId: string, evidence: Evidence) =>
    engineRef.current?.addEvidence(nodeId, evidence), [])

  const removeEvidence = useCallback((nodeId: string, evidenceId: string) =>
    engineRef.current?.removeEvidence(nodeId, evidenceId), [])

  const updateTheme = useCallback((theme: ThemeInput) =>
    engineRef.current?.updateTheme(theme), [])

  const zoomIn = useCallback(() => engineRef.current?.zoomIn(), [])
  const zoomOut = useCallback(() => engineRef.current?.zoomOut(), [])
  const goBack = useCallback(() => engineRef.current?.goBack(), [])
  const getGraph = useCallback(() => engineRef.current?.getGraph() ?? options.data, [options.data])
  const enterContext = useCallback((nodeId: string) => engineRef.current?.enterContext(nodeId), [])
  const jumpToNavDepth = useCallback((targetLength: number) => engineRef.current?.jumpToNavDepth(targetLength), [])

  return {
    canvasRef,
    hoveredNode,
    selectedNode,
    zoom,
    navigationStack,
    canGoBack: navigationStack.length > 1,
    goBack,
    setNodeState,
    addEvidence,
    removeEvidence,
    updateTheme,
    zoomIn,
    zoomOut,
    getGraph,
    enterContext,
    jumpToNavDepth,
  }
}
