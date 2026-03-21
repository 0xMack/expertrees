<script setup lang="ts">
import { computed } from 'vue'
import type {
  SkillGraph,
  SkillNode,
  NodeState,
  ThemeInput,
  LodThreshold,
  SkillTreeEvents,
  NavigationFrame,
} from '@skilltree/core'
import { useSkillTree } from './useSkillTree.js'

const props = defineProps<{
  data: SkillGraph
  theme?: ThemeInput
  lod?: LodThreshold[]
  width?: string
  height?: string
  initialContextNodeId?: string
}>()

const emit = defineEmits<{
  'node:click': [node: SkillNode]
  'node:hover': [node: SkillNode]
  'node:blur': [node: SkillNode]
  'canvas:click': []
  'zoom:change': [zoom: number]
  'context:enter': [node: SkillNode, stack: readonly NavigationFrame[]]
  'context:exit': [frame: NavigationFrame, stack: readonly NavigationFrame[]]
  'graph:ready': [graph: SkillGraph]
}>()

const {
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
  jumpToNavDepth,
} = useSkillTree({
  data: props.data,
  ...(props.theme !== undefined && { theme: props.theme }),
  ...(props.lod !== undefined && { lod: props.lod }),
  ...(props.initialContextNodeId !== undefined && { initialContextNodeId: props.initialContextNodeId }),
  on: {
    'node:click': (node) => emit('node:click', node),
    'node:hover': (node) => emit('node:hover', node),
    'node:blur': (node) => emit('node:blur', node),
    'canvas:click': () => emit('canvas:click'),
    'zoom:change': (z) => emit('zoom:change', z),
    'context:enter': (node, stack) => emit('context:enter', node, stack),
    'context:exit': (frame, stack) => emit('context:exit', frame, stack),
    'graph:ready': (graph) => emit('graph:ready', graph),
  },
})

// Expose imperative API to parent via template ref
defineExpose({
  setNodeState,
  addEvidence,
  removeEvidence,
  updateTheme,
  zoomIn,
  zoomOut,
  goBack,
  enterContext,
  jumpToNavDepth,
  getGraph,
  hoveredNode,
  selectedNode,
  zoom,
  navigationStack,
  canGoBack,
})

const canvasStyle = computed(() => ({
  width: props.width ?? '100%',
  height: props.height ?? '100%',
  display: 'block',
}))
</script>

<template>
  <canvas ref="canvasRef" :style="canvasStyle" />
</template>
