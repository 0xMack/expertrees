# @expertrees/core

Framework-agnostic engine for building and visualizing hierarchical knowledge graphs — navigable like a star map.

Nodes with children render as glowing **bubbles**. Leaf nodes render as **twinkling stars**. Click into a bubble to explore its sub-graph. Evidence (links, images, text, files) can be attached to any node.

Built on Canvas 2D with force-directed layout, continuous animations, and touch/pinch-to-zoom support.

> For framework-specific packages see [@expertrees/vue](https://www.npmjs.com/package/@expertrees/vue), [@expertrees/react](https://www.npmjs.com/package/@expertrees/react), [@expertrees/angular](https://www.npmjs.com/package/@expertrees/angular).

## Install

```bash
npm add @expertrees/core
```

## Basic usage

```ts
import { SkillTreeEngine } from '@expertrees/core'

const engine = new SkillTreeEngine({
  canvas: document.querySelector('canvas')!,
  data: {
    id: 'my-skills',
    label: 'My Skills',
    nodes: [
      { id: 'eng',    label: 'Engineering', depth: 0, childIds: ['fe', 'be'] },
      { id: 'fe',     label: 'Frontend',    depth: 1, parentId: 'eng', childIds: ['vue', 'react'] },
      { id: 'be',     label: 'Backend',     depth: 1, parentId: 'eng' },
      { id: 'vue',    label: 'Vue',         depth: 2, parentId: 'fe' },
      { id: 'react',  label: 'React',       depth: 2, parentId: 'fe' },
    ],
    edges: [],
  },
  on: {
    'node:click':    node        => console.log('clicked', node.label),
    'context:enter': (node, stack) => console.log('entered', node.label),
    'zoom:change':   zoom        => console.log('zoom', zoom),
  },
})

// Always call dispose when unmounting — cancels the animation loop
engine.dispose()
```

## API

### Constructor options

```ts
new SkillTreeEngine({
  canvas: HTMLCanvasElement   // required
  data: SkillGraph            // required
  theme?: ThemeInput          // optional visual overrides
  lod?: LodThreshold[]        // optional level-of-detail config
  initialContextNodeId?: string  // start inside a specific bubble
  on?: Partial<SkillTreeEvents>  // event handlers
})
```

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setNodeState` | `(id, NodeState) => void` | Update a node's semantic state |
| `addEvidence` | `(id, Evidence) => void` | Attach evidence to a node |
| `removeEvidence` | `(id, evidenceId) => void` | Remove evidence from a node |
| `updateTheme` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn` | `() => void` | Programmatic zoom in |
| `zoomOut` | `() => void` | Programmatic zoom out |
| `goBack` | `() => void` | Exit to parent context |
| `enterContext` | `(nodeId) => void` | Programmatically enter a bubble |
| `jumpToNavDepth` | `(targetLength) => void` | Jump to a stack depth in one animation |
| `getGraph` | `() => SkillGraph` | Serialize current graph state |
| `getNavigationStack` | `() => readonly NavigationFrame[]` | Current navigation stack |
| `dispose` | `() => void` | Cancel animation loop and clean up |

### Events

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
  depth: number            // 0 = root; higher = more specific
  parentId?: string        // required for children inside a bubble
  childIds?: string[]      // present on bubble nodes; omit for leaf/star nodes
  position?: { x: number, y: number }
  state?: NodeState        // 'default' | 'active' | 'locked' | 'unlocked' | 'highlighted'
  evidence?: Evidence[]
  style?: Partial<NodeStyle>
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

## Theming

All fields are optional and merge over built-in defaults.

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
    animated: true,
  },
  states: {
    active:      { color: '#50fa7b', glowColor: '#50fa7b' },
    unlocked:    { color: '#50fa7b', glowColor: '#50fa7b' },
    locked:      { color: '#2a3a4a', opacity: 0.4 },
    highlighted: { color: '#ffb86c', glowColor: '#ffb86c' },
  },
}

engine.updateTheme({ node: { color: '#ff79c6' } })
```

## License

MIT — [github.com/0xMack/expertrees](https://github.com/0xMack/expertrees)
