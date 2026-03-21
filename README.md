# expertrees

A framework-agnostic TypeScript library for building and visualizing hierarchical knowledge graphs — navigable like a star map or a perk tree from a video game.

Nodes represent skills or knowledge domains. Nodes with children render as glowing **bubbles**; leaf nodes render as **twinkling stars**. Click or zoom into a bubble to burst it and explore the sub-graph inside. Evidence — links, images, text, files — can be attached to any node.

Built on Canvas 2D with a force-directed layout, continuous animations, and full touch/pinch-to-zoom support.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@expertrees/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@expertrees/core)](https://www.npmjs.com/package/@expertrees/core) | Framework-agnostic engine |
| [`@expertrees/vue`](./packages/vue) | [![npm](https://img.shields.io/npm/v/@expertrees/vue)](https://www.npmjs.com/package/@expertrees/vue) | Vue 3 component + composable |
| [`@expertrees/react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@expertrees/react)](https://www.npmjs.com/package/@expertrees/react) | React hook + component |
| [`@expertrees/angular`](./packages/angular) | [![npm](https://img.shields.io/npm/v/@expertrees/angular)](https://www.npmjs.com/package/@expertrees/angular) | Angular standalone component |

---

## Quick start

### Vue 3 / Nuxt

```bash
npm add @expertrees/core @expertrees/vue
```

```vue
<script setup lang="ts">
import { SkillTree } from '@expertrees/vue'
import type { SkillGraph } from '@expertrees/core'

const graph: SkillGraph = {
  id: 'my-skills',
  label: 'My Skills',
  nodes: [
    { id: 'eng', label: 'Engineering', depth: 0, childIds: ['fe', 'be'] },
    { id: 'fe',  label: 'Frontend',    depth: 1, parentId: 'eng', childIds: ['vue'] },
    { id: 'be',  label: 'Backend',     depth: 1, parentId: 'eng' },
    { id: 'vue', label: 'Vue 3',       depth: 2, parentId: 'fe' },
  ],
  edges: [],
}
</script>

<template>
  <SkillTree :data="graph" style="width: 100%; height: 600px" @node:click="node => console.log(node)" />
</template>
```

### React

```bash
npm add @expertrees/core @expertrees/react
```

```tsx
import { ExpertreeCanvas } from '@expertrees/react'

export function App() {
  return (
    <ExpertreeCanvas
      data={graph}
      style={{ width: '100%', height: '600px' }}
      on={{ 'node:click': node => console.log(node) }}
    />
  )
}
```

### Angular

```bash
npm add @expertrees/core @expertrees/angular
```

```typescript
import { ExpertreeCanvasComponent } from '@expertrees/angular'

@Component({
  imports: [ExpertreeCanvasComponent],
  template: `<expertree-canvas [data]="graph" (nodeClick)="onNode($event)" />`,
})
export class AppComponent {
  graph = myGraph
  onNode(node: SkillNode) { console.log(node) }
}
```

---

## Data model

```ts
interface SkillGraph {
  id: string
  label: string
  nodes: SkillNode[]
  edges: SkillEdge[]
  theme?: ThemeInput
  meta?: Record<string, unknown>
}

interface SkillNode {
  id: string
  label: string
  description?: string
  depth: number             // 0 = root category; higher = more specific
  parentId?: string         // required on children inside a bubble
  childIds?: string[]       // present on bubble nodes; omit for leaf/star nodes
  position?: { x: number, y: number }  // optional manual layout override
  state?: NodeState
  evidence?: Evidence[]
  style?: Partial<NodeStyle>
  meta?: Record<string, unknown>
}

interface SkillEdge {
  id: string
  source: string            // must be at a different depth than target
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
  date?: string             // ISO 8601
  tags?: string[]
  thumbnail?: string
  meta?: Record<string, unknown>
}
```

### Node states

States control visual appearance and can be themed independently.

```ts
type NodeState = 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'
```

Set state at runtime:

```ts
// Vue
setNodeState('vue', 'unlocked')

// React (via ref)
canvasRef.current?.setNodeState('vue', 'unlocked')

// Core engine directly
engine.setNodeState('vue', 'unlocked')
```

---

## Navigation

Each bubble node defines a new **context**. Entering it hides the rest of the graph and shows the bubble's children as a fresh constellation. Navigation is stack-based — you can go arbitrarily deep.

| Gesture | Action |
|---------|--------|
| Scroll / pinch spread | Zoom in |
| Scroll / pinch close | Zoom out |
| Click a bubble | Enter context |
| Zoom out past threshold | Exit to parent context |
| Drag | Pan |

### Breadcrumbs

Use `navigationStack` to build a breadcrumb trail. The first frame is always the root.

```ts
// Vue
const { navigationStack, jumpToNavDepth } = useSkillTree({ data: graph })

// Jump directly to a specific depth (e.g. clicking a crumb)
// targetLength is the desired stack length after navigation
jumpToNavDepth(2)
```

`jumpToNavDepth` is atomic — it pops any number of levels in a single animation with no race conditions. Prefer it over calling `goBack()` in a loop.

---

## Events

| Event | Payload | When |
|-------|---------|------|
| `node:click` | `SkillNode` | User clicks a node |
| `node:hover` | `SkillNode` | Mouse enters a node |
| `node:blur` | `SkillNode` | Mouse leaves a node |
| `zoom:change` | `number` | Every zoom frame |
| `context:enter` | `(SkillNode, NavigationFrame[])` | Entering a bubble |
| `context:exit` | `(NavigationFrame, NavigationFrame[])` | Exiting a bubble |
| `graph:ready` | `SkillGraph` | Engine mounted and ready |

Pass event handlers via the `on` option (all frameworks) or as Vue template event listeners:

```vue
<SkillTree
  :data="graph"
  @node:click="onSelect"
  @context:enter="onEnter"
  @context:exit="onExit"
/>
```

---

## Theming

Pass a partial theme at the graph, engine, or component level. All fields are optional.

```ts
const theme: ThemeInput = {
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
    active:      { color: '#50fa7b', glowColor: '#50fa7b' },
    unlocked:    { color: '#50fa7b', glowColor: '#50fa7b' },
    locked:      { color: '#2a3a4a', opacity: 0.4 },
    highlighted: { color: '#ffb86c', glowColor: '#ffb86c' },
  },
}
```

Update theme at runtime:

```ts
updateTheme({ node: { color: '#ff79c6' } })
```

---

## Vue API

### `<SkillTree>` component

Props mirror `UseSkillTreeOptions`. Emits all events from the table above (kebab-case, e.g. `@node:click`).

```vue
<SkillTree
  :data="graph"
  :theme="theme"
  :lod="lodConfig"
  initialContextNodeId="eng"
  @graph:ready="onReady"
/>
```

### `useSkillTree` composable

```ts
const {
  canvasRef,
  hoveredNode,      // Ref<SkillNode | null>
  selectedNode,     // Ref<SkillNode | null>
  zoom,             // Ref<number>
  navigationStack,  // Ref<readonly NavigationFrame[]>
  canGoBack,        // ComputedRef<boolean>
  goBack,
  jumpToNavDepth,
  enterContext,
  setNodeState,
  addEvidence,
  removeEvidence,
  updateTheme,
  zoomIn,
  zoomOut,
  getGraph,
} = useSkillTree({ data: graph, on: { 'node:click': handler } })
```

Reactive to `data` changes — passing a new `SkillGraph` reference reinitializes the engine automatically.

| Return value | Type | Description |
|---|---|---|
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
| `removeEvidence(id, evId)` | `(string, string) => void` | Remove evidence from a node |
| `updateTheme(theme)` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn()` | `() => void` | Programmatic zoom in |
| `zoomOut()` | `() => void` | Programmatic zoom out |
| `getGraph()` | `() => SkillGraph` | Serialize current graph state |

---

## React API

### `<ExpertreeCanvas>` component

```tsx
import { useRef } from 'react'
import { ExpertreeCanvas, type ExpertreeCanvasHandle } from '@expertrees/react'

function App() {
  const ref = useRef<ExpertreeCanvasHandle>(null)

  return (
    <ExpertreeCanvas
      ref={ref}
      data={graph}
      theme={theme}
      on={{ 'node:click': node => console.log(node) }}
      style={{ width: '100%', height: '600px' }}
    />
  )
}
```

The `ref` exposes all imperative methods (`setNodeState`, `zoomIn`, `goBack`, `jumpToNavDepth`, etc.) plus read-only state properties (`hoveredNode`, `selectedNode`, `zoom`, `navigationStack`, `canGoBack`).

### `useExpertree` hook

```ts
const {
  canvasRef,       // callback ref — pass directly to <canvas ref={canvasRef}>
  hoveredNode,     // SkillNode | null
  selectedNode,    // SkillNode | null
  zoom,            // number
  navigationStack, // readonly NavigationFrame[]
  canGoBack,       // boolean
  goBack,
  jumpToNavDepth,
  enterContext,
  setNodeState,
  addEvidence,
  removeEvidence,
  updateTheme,
  zoomIn,
  zoomOut,
  getGraph,
} = useExpertree({ data: graph })
```

---

## Angular API

### `<expertree-canvas>` component

```typescript
import { ExpertreeCanvasComponent } from '@expertrees/angular'

@Component({
  imports: [ExpertreeCanvasComponent],
  template: `
    <expertree-canvas
      #tree
      [data]="graph"
      [theme]="theme"
      (nodeClick)="onNodeClick($event)"
      (contextEnter)="onEnter($event)"
    />
    <button (click)="tree.goBack()">Back</button>
  `,
})
export class AppComponent {
  graph = myGraph
  onNodeClick(node: SkillNode) { }
  onEnter([node, stack]: [SkillNode, NavigationFrame[]]) { }
}
```

**Inputs:** `data`, `theme`, `lod`, `initialContextNodeId`, `width`, `height`

**Outputs:** `nodeClick`, `nodeHover`, `nodeBlur`, `canvasClick`, `zoomChange`, `contextEnter`, `contextExit`, `graphReady`

**Template ref methods:** `setNodeState`, `addEvidence`, `removeEvidence`, `updateTheme`, `zoomIn`, `zoomOut`, `goBack`, `enterContext`, `jumpToNavDepth`, `getGraph`, `getNavigationStack`

---

## Core engine (framework-agnostic)

Use `@expertrees/core` directly to integrate with any framework or vanilla JS.

```ts
import { SkillTreeEngine } from '@expertrees/core'

const engine = new SkillTreeEngine({
  canvas: document.querySelector('canvas')!,
  data: graph,
  theme,
  on: {
    'node:click':    node        => console.log(node),
    'context:enter': (node, stack) => console.log('entered', node.label),
    'zoom:change':   zoom        => console.log(zoom),
  },
})

engine.setNodeState('vue', 'active')
engine.addEvidence('vue', { id: 'e1', type: 'link', label: 'Blog post' })
engine.jumpToNavDepth(1)   // jump back to root in one animation
engine.zoomIn()
engine.dispose()           // always call when unmounting — cancels the RAF loop
```

---

## Animations

| Element | Animation |
|---------|-----------|
| Background | 150 twinkling stars, screen-space |
| Bubble nodes | Slow breathing scale + rotating orbit dots |
| Leaf nodes | Two-sine-wave twinkle, deterministic phase per node ID |
| Edges | Travelling particles (when `animated: true`) |
| Selection | Pulsing radiating rings (leaf) / spinning dashed ring (bubble) |
| Context switch | Burst flash at cursor + fade-in of new context |

---

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
        LodController.ts          # zoom level → LOD threshold tracking
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
  react/
    src/
      useExpertree.ts             # hook
      ExpertreeCanvas.tsx         # forwardRef component
  angular/
    src/lib/
      expertree.component.ts      # standalone component
```

---

## Contributing

```bash
git clone https://github.com/0xMack/expertrees.git
cd expertrees
npm install
npm run build   # build all packages (Turborepo)
npm test        # Vitest, happy-dom
```

When making a change, add a changeset before opening a PR:

```bash
npx changeset   # select patch / minor / major and describe the change
git add .changeset/
```

Patch releases publish automatically when the Version PR is merged. Minor and major releases require manually merging the Version PR.

## License

MIT
