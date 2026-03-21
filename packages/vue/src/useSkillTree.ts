import { ref, computed, shallowRef, onUnmounted, watch, type Ref, type ComputedRef } from 'vue'
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
} from '@skilltree/core'

export interface UseSkillTreeOptions {
  data: SkillGraph
  theme?: ThemeInput
  lod?: LodThreshold[]
  on?: Partial<SkillTreeEvents>
  initialContextNodeId?: string
}

export interface UseSkillTreeReturn {
  /** Attach this ref to the <canvas> element */
  canvasRef: Ref<HTMLCanvasElement | null>
  /** Currently hovered node */
  hoveredNode: Ref<SkillNode | null>
  /** Currently selected node */
  selectedNode: Ref<SkillNode | null>
  /** Current zoom level */
  zoom: Ref<number>
  /** Current navigation stack — last entry is the active context */
  navigationStack: Ref<readonly NavigationFrame[]>
  /** Whether the user can navigate back to a parent context */
  canGoBack: ComputedRef<boolean>
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
  /** Programmatically enter a bubble node's context (triggers burst + zoom) */
  enterContext: (nodeId: string) => void
}

export function useSkillTree(options: UseSkillTreeOptions): UseSkillTreeReturn {
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const engine = shallowRef<SkillTreeEngine | null>(null)

  const hoveredNode = ref<SkillNode | null>(null)
  const selectedNode = ref<SkillNode | null>(null)
  const zoom = ref(1)
  const navigationStack = ref<readonly NavigationFrame[]>([{ nodeId: null, label: options.data.label }])
  const canGoBack = computed(() => navigationStack.value.length > 1)

  watch([canvasRef, () => options.data], ([canvas]) => {
    engine.value?.dispose()
    engine.value = null

    if (!canvas) return

    engine.value = new SkillTreeEngine({
      canvas,
      data: options.data,
      ...(options.theme !== undefined && { theme: options.theme }),
      ...(options.lod !== undefined && { lod: options.lod }),
      ...(options.initialContextNodeId !== undefined && { initialContextNodeId: options.initialContextNodeId }),
      on: {
        ...options.on,
        'node:hover': (node) => {
          hoveredNode.value = node
          options.on?.['node:hover']?.(node)
        },
        'node:blur': (node) => {
          if (hoveredNode.value?.id === node.id) hoveredNode.value = null
          options.on?.['node:blur']?.(node)
        },
        'node:click': (node) => {
          selectedNode.value = selectedNode.value?.id === node.id ? null : node
          options.on?.['node:click']?.(node)
        },
        'canvas:click': () => {
          selectedNode.value = null
          options.on?.['canvas:click']?.()
        },
        'zoom:change': (z) => {
          zoom.value = z
          options.on?.['zoom:change']?.(z)
        },
        'context:enter': (node, stack) => {
          navigationStack.value = stack
          selectedNode.value = null
          options.on?.['context:enter']?.(node, stack)
        },
        'context:exit': (frame, stack) => {
          navigationStack.value = stack
          selectedNode.value = null
          options.on?.['context:exit']?.(frame, stack)
        },
        'graph:ready': (graph) => {
          options.on?.['graph:ready']?.(graph)
        },
      },
    })

    // Sync stack to reflect any silent initial context (e.g. initialContextNodeId)
    navigationStack.value = engine.value.getNavigationStack()
  })

  onUnmounted(() => {
    engine.value?.dispose()
  })

  const setNodeState = (nodeId: string, state: NodeState) =>
    engine.value?.setNodeState(nodeId, state)

  const addEvidence = (nodeId: string, evidence: Evidence) =>
    engine.value?.addEvidence(nodeId, evidence)

  const removeEvidence = (nodeId: string, evidenceId: string) =>
    engine.value?.removeEvidence(nodeId, evidenceId)

  const updateTheme = (theme: ThemeInput) =>
    engine.value?.updateTheme(theme)

  const zoomIn = () => engine.value?.zoomIn()
  const zoomOut = () => engine.value?.zoomOut()
  const goBack = () => engine.value?.goBack()
  const getGraph = () => engine.value?.getGraph() ?? options.data
  const enterContext = (nodeId: string) => engine.value?.enterContext(nodeId)

  return {
    canvasRef,
    hoveredNode,
    selectedNode,
    zoom,
    navigationStack,
    canGoBack,
    goBack,
    setNodeState,
    addEvidence,
    removeEvidence,
    updateTheme,
    zoomIn,
    zoomOut,
    getGraph,
    enterContext,
  }
}
