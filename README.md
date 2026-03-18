# skilltree

A framework-agnostic TypeScript library for building and visualizing skill graphs — navigable like a star map or a perk tree from a video game.

Nodes represent skills or knowledge domains. Nodes with children render as glowing **bubbles**; leaf nodes render as **twinkling stars**. Zoom into a bubble to burst it and explore the sub-graph inside. Evidence — links, images, text, files — can be attached to any node.

The visualization is built on Canvas 2D with a force-directed layout, continuous animations, and full touch/pinch-to-zoom support.

## Packages

| Package | Description |
|---------|-------------|
| [`@skilltree/core`](./packages/core) | Framework-agnostic engine: graph model, layout, renderer, navigation |
| [`@skilltree/vue`](./packages/vue) | Vue 3 component and composable |

## Quick start (Vue 3 / Nuxt)

```bash
npm add @skilltree/core @skilltree/vue
```

```vue
<script setup lang="ts">
import { SkillTree } from '@skilltree/vue'
import type { SkillGraph } from '@skilltree/core'

const graph: SkillGraph = {
  id: 'my-skills',
  label: 'My Skills',
  nodes: [
    { id: 'eng', label: 'Engineering', depth: 0, childIds: ['fe', 'be'] },
    { id: 'fe',  label: 'Frontend',    depth: 1, parentId: 'eng', childIds: ['vue'] },
    { id: 'be',  label: 'Backend',     depth: 1, parentId: 'eng' },
    { id: 'vue', label: 'Vue 3',       depth: 2, parentId: 'fe',
      evidence: [{ id: 'e1', type: 'link', label: 'This very library' }] },
  ],
  edges: [],
}
</script>

<template>
  <SkillTree
    :data="graph"
    style="width: 100%; height: 600px"
    @node:click="node => console.log(node)"
  />
</template>
```

### Using the composable directly

```vue
<script setup lang="ts">
import { useSkillTree } from '@skilltree/vue'
import type { SkillGraph } from '@skilltree/core'

declare const graph: SkillGraph

const {
  canvasRef,
  hoveredNode,
  selectedNode,
  zoom,
  navigationStack,
  canGoBack,
  goBack,
  setNodeState,
} = useSkillTree({ data: graph })
</script>

<template>
  <canvas ref="canvasRef" style="width: 100%; height: 600px" />
  <p v-if="hoveredNode">Hovering: {{ hoveredNode.label }}</p>
  <p v-if="selectedNode">Selected: {{ selectedNode.label }}</p>
  <button v-if="canGoBack" @click="goBack">← Back</button>
</template>
```

## Navigation

Graphs have two levels of navigation:

- **Root context** — shows all nodes with no `parentId`. Nodes with `childIds` are rendered as bubbles.
- **Bubble context** — entered by clicking or zooming into a bubble. Shows only the direct children of that node as a new constellation.

| Gesture | Action |
|---------|--------|
| Scroll / pinch spread | Zoom in |
| Scroll / pinch close | Zoom out |
| Click or zoom into bubble | Enter bubble context |
| Zoom out past threshold | Exit to parent context |
| Click back button | Exit to parent context |
| Click leaf node | Select / deselect |
| Drag | Pan |

## Data model

```ts
interface SkillGraph {
  id: string
  label: string
  nodes: SkillNode[]
  edges: SkillEdge[]
  theme?: ThemeInput       // optional per-graph theme overrides
  meta?: Record<string, unknown>
}

interface SkillNode {
  id: string
  label: string
  depth: number            // 0 = root category; higher = more specific
  parentId?: string        // set on children inside a bubble
  childIds?: string[]      // set on bubble nodes; determines bubble vs star rendering
  state?: NodeState        // 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'
  evidence?: Evidence[]
  style?: Partial<NodeStyle>
  meta?: Record<string, unknown>
}

interface SkillEdge {
  id: string
  source: string
  target: string
  directed: boolean
  style?: Partial<EdgeStyle>
  meta?: Record<string, unknown>
}

interface Evidence {
  id: string
  type: 'link' | 'text' | 'image' | 'video' | 'file'
  label: string
  description?: string
  date?: string            // ISO 8601
  tags?: string[]
  thumbnail?: string
  meta?: Record<string, unknown>
}
```

### Node states

States control the visual appearance of a node and can be themed independently.

```ts
type NodeState = 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'
```

Set state at runtime via the engine API or the Vue composable:

```ts
setNodeState('vue', 'unlocked')
```

## Theming

Pass a partial theme at the graph, engine, or component level. All fields are optional and merge over the built-in defaults.

```ts
const theme = {
  background: '#050a1a',
  node: {
    color:      '#4a9eff',
    glowColor:  '#4a9eff',
    glowRadius: 12,
    size:       8,
    shape:      'circle',  // 'circle' | 'star' | 'hexagon' | 'diamond'
  },
  edge: {
    color:    '#4a9eff',
    width:    1,
    opacity:  0.4,
    animated: true,        // travelling particles along edges
  },
  states: {
    active:    { color: '#50fa7b', glowColor: '#50fa7b' },
    unlocked:  { color: '#50fa7b', glowColor: '#50fa7b' },
    locked:    { color: '#2a3a4a', opacity: 0.4 },
    highlighted: { color: '#ffb86c', glowColor: '#ffb86c' },
  },
}
```

```vue
<SkillTree :data="graph" :theme="theme" />
```

Update the theme at runtime:

```ts
updateTheme({ node: { color: '#ff79c6' } })
```

## Events

| Event | Payload | When |
|-------|---------|------|
| `node:click` | `SkillNode` | User clicks a leaf node |
| `node:hover` | `SkillNode` | Mouse enters a node |
| `node:blur` | `SkillNode` | Mouse leaves a node |
| `zoom:change` | `number` | Every zoom frame |
| `context:enter` | `(SkillNode, NavigationFrame[])` | Entering a bubble |
| `context:exit` | `(NavigationFrame, NavigationFrame[])` | Exiting a bubble |
| `graph:ready` | `SkillGraph` | Engine mounted and ready |

```vue
<SkillTree
  :data="graph"
  @node:click="onSelect"
  @context:enter="onEnter"
  @context:exit="onExit"
  @zoom:change="z => (currentZoom = z)"
/>
```

## Vue composable API

`useSkillTree` returns:

| Name | Type | Description |
|------|------|-------------|
| `canvasRef` | `Ref<HTMLCanvasElement \| null>` | Bind to `<canvas ref="canvasRef">` |
| `hoveredNode` | `Ref<SkillNode \| null>` | Currently hovered node |
| `selectedNode` | `Ref<SkillNode \| null>` | Currently selected leaf node |
| `zoom` | `Ref<number>` | Current zoom level (continuous) |
| `navigationStack` | `Ref<NavigationFrame[]>` | Full navigation stack; last entry is active context |
| `canGoBack` | `ComputedRef<boolean>` | Whether a parent context exists |
| `goBack()` | `() => void` | Navigate to parent context |
| `setNodeState()` | `(id, NodeState) => void` | Update a node's semantic state |
| `addEvidence()` | `(id, Evidence) => void` | Attach evidence to a node |
| `removeEvidence()` | `(id, evidenceId) => void` | Remove evidence from a node |
| `updateTheme()` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn()` | `() => void` | Programmatic zoom in |
| `zoomOut()` | `() => void` | Programmatic zoom out |
| `getGraph()` | `() => SkillGraph` | Serialize current graph state |

The composable is **reactive to `data` changes** — passing a new `SkillGraph` reference reinitializes the engine automatically.

## Core engine (framework-agnostic)

```ts
import { SkillTreeEngine } from '@skilltree/core'

const engine = new SkillTreeEngine({
  canvas: document.querySelector('canvas')!,
  data: graph,
  theme,
  on: {
    'node:click':     node  => console.log(node),
    'context:enter':  (node, stack) => console.log('entered', node.label),
    'zoom:change':    zoom  => console.log(zoom),
  },
})

// Imperative API
engine.setNodeState('vue', 'active')
engine.addEvidence('vue', { id: 'e2', type: 'link', label: 'Blog post' })
engine.zoomIn()
engine.goBack()
engine.dispose()   // always call when done to cancel the RAF loop
```

## Animations

All animations run every frame — no dirty-flag gating.

| Element | Animation |
|---------|-----------|
| Background | 150 twinkling stars, screen-space |
| Bubble nodes | Slow breathing scale + rotating orbit dots |
| Leaf nodes | Two-sine-wave twinkle, deterministic phase per node ID |
| Edges | Travelling particles (when `animated: true`) |
| Selection | Pulsing radiating rings (leaf) / spinning dashed ring (bubble) |
| Context switch | Burst flash at cursor + 400 ms fade-in of new context |

## Architecture

```
packages/
  core/
    src/
      graph/
        SkillGraphModel.ts        # graphology wrapper, typed events
        NavigationController.ts   # stack-based bubble navigation
      layout/
        ForceLayout.ts            # d3-force layout, runs per-context
      lod/
        LodController.ts          # zoom level tracking
      renderer/
        CanvasRenderer.ts         # all drawing: bubbles, stars, edges, bursts
        InteractionController.ts  # pointer/wheel/touch/pinch events
      theme/
        default.ts
        merge.ts
      SkillTreeEngine.ts          # orchestrator
      types/index.ts
  vue/
    src/
      useSkillTree.ts             # composable
      SkillTree.vue               # thin canvas wrapper
```

## Development

```bash
npm install
npm run build   # build all packages via Turborepo
npm test        # run all tests (Vitest, happy-dom)
```

## License

MIT
