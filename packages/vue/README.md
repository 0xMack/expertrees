# @expertrees/vue

Vue 3 component and composable for [@expertrees/core](https://www.npmjs.com/package/@expertrees/core) — a hierarchical knowledge graph visualizer with a star map aesthetic.

## Install

```bash
npm add @expertrees/core @expertrees/vue
```

## Component usage

```vue
<script setup lang="ts">
import { SkillTree } from '@expertrees/vue'
import type { SkillGraph } from '@expertrees/core'

const graph: SkillGraph = {
  id: 'my-skills',
  label: 'My Skills',
  nodes: [
    { id: 'eng',   label: 'Engineering', depth: 0, childIds: ['fe', 'be'] },
    { id: 'fe',    label: 'Frontend',    depth: 1, parentId: 'eng', childIds: ['vue'] },
    { id: 'be',    label: 'Backend',     depth: 1, parentId: 'eng' },
    { id: 'vue',   label: 'Vue 3',       depth: 2, parentId: 'fe' },
  ],
  edges: [],
}
</script>

<template>
  <SkillTree
    :data="graph"
    style="width: 100%; height: 600px"
    @node:click="node => console.log(node)"
    @context:enter="(node, stack) => console.log('entered', node.label)"
  />
</template>
```

### Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `SkillGraph` | required | Graph data |
| `theme` | `ThemeInput` | — | Visual theme overrides |
| `lod` | `LodThreshold[]` | — | Level-of-detail config |
| `initialContextNodeId` | `string` | — | Start inside a specific bubble |

### Component events

| Event | Payload | When |
|-------|---------|------|
| `node:click` | `SkillNode` | User clicks a node |
| `node:hover` | `SkillNode` | Mouse enters a node |
| `node:blur` | `SkillNode` | Mouse leaves a node |
| `canvas:click` | — | Click on empty canvas |
| `zoom:change` | `number` | Every zoom frame |
| `context:enter` | `(SkillNode, NavigationFrame[])` | Entering a bubble |
| `context:exit` | `(NavigationFrame, NavigationFrame[])` | Exiting a bubble |
| `graph:ready` | `SkillGraph` | Engine mounted and ready |

### Imperative ref API

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SkillTree } from '@expertrees/vue'

const tree = ref()

function unlock() {
  tree.value.setNodeState('vue', 'unlocked')
}
</script>

<template>
  <SkillTree ref="tree" :data="graph" style="width: 100%; height: 600px" />
  <button @click="unlock">Unlock Vue</button>
</template>
```

---

## Composable usage

Use `useSkillTree` directly for full control over the canvas and layout.

```vue
<script setup lang="ts">
import { useSkillTree } from '@expertrees/vue'
import type { SkillGraph } from '@expertrees/core'

declare const graph: SkillGraph

const {
  canvasRef,
  hoveredNode,
  selectedNode,
  zoom,
  navigationStack,
  canGoBack,
  goBack,
  jumpToNavDepth,
  setNodeState,
  enterContext,
} = useSkillTree({
  data: graph,
  on: {
    'node:click': node => console.log(node),
  },
})
</script>

<template>
  <div style="position: relative; width: 100%; height: 600px">
    <canvas ref="canvasRef" style="width: 100%; height: 100%" />

    <!-- Breadcrumbs -->
    <nav style="position: absolute; top: 8px; left: 8px">
      <button
        v-for="(frame, i) in navigationStack"
        :key="frame.nodeId ?? 'root'"
        @click="jumpToNavDepth(i + 1)"
      >
        {{ frame.label }}
      </button>
    </nav>

    <!-- Side panel -->
    <aside v-if="hoveredNode" style="position: absolute; right: 0; top: 0">
      <h3>{{ hoveredNode.label }}</h3>
    </aside>
  </div>
</template>
```

### `useSkillTree` return values

| Name | Type | Description |
|------|------|-------------|
| `canvasRef` | `Ref<HTMLCanvasElement \| null>` | Bind to `<canvas ref="canvasRef">` |
| `hoveredNode` | `Ref<SkillNode \| null>` | Currently hovered node |
| `selectedNode` | `Ref<SkillNode \| null>` | Currently selected node |
| `zoom` | `Ref<number>` | Current zoom level |
| `navigationStack` | `Ref<readonly NavigationFrame[]>` | Full nav stack; last entry is active context |
| `canGoBack` | `ComputedRef<boolean>` | Whether a parent context exists |
| `goBack()` | `() => void` | Exit to parent context |
| `jumpToNavDepth(n)` | `(number) => void` | Jump to stack depth `n` in one animation |
| `enterContext(id)` | `(string) => void` | Programmatically enter a bubble |
| `setNodeState(id, state)` | `(string, NodeState) => void` | Update a node's semantic state |
| `addEvidence(id, ev)` | `(string, Evidence) => void` | Attach evidence to a node |
| `removeEvidence(id, evId)` | `(string, string) => void` | Remove evidence |
| `updateTheme(theme)` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn()` | `() => void` | Programmatic zoom in |
| `zoomOut()` | `() => void` | Programmatic zoom out |
| `getGraph()` | `() => SkillGraph` | Serialize current graph state |

The composable is **reactive to `data` changes** — passing a new `SkillGraph` reference reinitializes the engine automatically.

## License

MIT — [github.com/0xMack/expertrees](https://github.com/0xMack/expertrees)
