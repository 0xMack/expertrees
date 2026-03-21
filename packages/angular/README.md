# @expertrees/angular

Angular standalone component for [@expertrees/core](https://www.npmjs.com/package/@expertrees/core) — a hierarchical knowledge graph visualizer with a star map aesthetic.

## Install

```bash
npm add @expertrees/core @expertrees/angular
```

## Usage

```typescript
import { Component } from '@angular/core'
import { ExpertreeCanvasComponent } from '@expertrees/angular'
import type { SkillGraph, SkillNode, NavigationFrame } from '@expertrees/core'

const graph: SkillGraph = {
  id: 'my-skills',
  label: 'My Skills',
  nodes: [
    { id: 'eng',     label: 'Engineering', depth: 0, childIds: ['fe', 'be'] },
    { id: 'fe',      label: 'Frontend',    depth: 1, parentId: 'eng', childIds: ['ng'] },
    { id: 'be',      label: 'Backend',     depth: 1, parentId: 'eng' },
    { id: 'ng',      label: 'Angular',     depth: 2, parentId: 'fe' },
  ],
  edges: [],
}

@Component({
  standalone: true,
  imports: [ExpertreeCanvasComponent],
  template: `
    <expertree-canvas
      [data]="graph"
      width="100%"
      height="600px"
      (nodeClick)="onNodeClick($event)"
      (contextEnter)="onContextEnter($event)"
    />
  `,
})
export class AppComponent {
  graph = graph

  onNodeClick(node: SkillNode) {
    console.log('clicked', node.label)
  }

  onContextEnter({ node, stack }: { node: SkillNode; stack: readonly NavigationFrame[] }) {
    console.log('entered', node.label, stack)
  }
}
```

## Inputs

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `data` | `SkillGraph` | required | Graph data |
| `theme` | `ThemeInput` | — | Visual theme overrides |
| `lod` | `LodThreshold[]` | — | Level-of-detail config |
| `initialContextNodeId` | `string` | — | Start inside a specific bubble |
| `width` | `string` | `'100%'` | Canvas width (CSS) |
| `height` | `string` | `'100%'` | Canvas height (CSS) |

## Outputs

| Output | Payload | When |
|--------|---------|------|
| `nodeClick` | `SkillNode` | User clicks a node |
| `nodeHover` | `SkillNode` | Mouse enters a node |
| `nodeBlur` | `SkillNode` | Mouse leaves a node |
| `canvasClick` | `void` | Click on empty canvas |
| `zoomChange` | `number` | Every zoom frame |
| `contextEnter` | `{ node: SkillNode, stack: readonly NavigationFrame[] }` | Entering a bubble |
| `contextExit` | `{ frame: NavigationFrame, stack: readonly NavigationFrame[] }` | Exiting a bubble |
| `graphReady` | `SkillGraph` | Engine mounted and ready |

## Imperative API via template ref

Access engine methods directly through a template reference variable.

```typescript
@Component({
  standalone: true,
  imports: [ExpertreeCanvasComponent],
  template: `
    <expertree-canvas #tree [data]="graph" width="100%" height="600px" />

    <!-- Breadcrumbs -->
    <nav>
      <button
        *ngFor="let frame of navStack; let i = index"
        (click)="tree.jumpToNavDepth(i + 1)"
      >
        {{ frame.label }}
      </button>
    </nav>

    <button (click)="tree.setNodeState('ng', 'unlocked')">Unlock Angular</button>
    <button (click)="tree.goBack()">Back</button>
  `,
})
export class AppComponent {
  graph = graph
  navStack: NavigationFrame[] = []
}
```

### Template ref methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `setNodeState` | `(id, NodeState) => void` | Update a node's semantic state |
| `addEvidence` | `(id, Evidence) => void` | Attach evidence to a node |
| `removeEvidence` | `(id, evidenceId) => void` | Remove evidence |
| `updateTheme` | `(ThemeInput) => void` | Hot-swap the visual theme |
| `zoomIn` | `() => void` | Programmatic zoom in |
| `zoomOut` | `() => void` | Programmatic zoom out |
| `goBack` | `() => void` | Exit to parent context |
| `enterContext` | `(nodeId) => void` | Programmatically enter a bubble |
| `jumpToNavDepth` | `(targetLength) => void` | Jump to stack depth in one animation |
| `getGraph` | `() => SkillGraph` | Serialize current graph state |
| `getNavigationStack` | `() => readonly NavigationFrame[]` | Current navigation stack |

## NgModule setup

If you are not using standalone components, import via a module:

```typescript
import { NgModule } from '@angular/core'
import { ExpertreeCanvasComponent } from '@expertrees/angular'

@NgModule({
  imports: [ExpertreeCanvasComponent],
  // ...
})
export class AppModule {}
```

## License

MIT — [github.com/0xMack/expertrees](https://github.com/0xMack/expertrees)
