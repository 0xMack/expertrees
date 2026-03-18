import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force'
import type { SkillNode, SkillEdge, Position } from '../types/index.js'

export interface LayoutNode extends SimulationNodeDatum {
  id: string
  depth: number
  x: number
  y: number
}

export interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  id: string
}

export interface ForceLayoutOptions {
  width: number
  height: number
  /** Charge strength — negative = repulsion */
  chargeStrength?: number
  /** Collision radius multiplier relative to node size */
  collisionPadding?: number
  alphaDecay?: number
  onTick?: (positions: Map<string, Position>) => void
  onEnd?: (positions: Map<string, Position>) => void
}

export class ForceLayout {
  private _simulation: Simulation<LayoutNode, LayoutLink> | null = null

  run(nodes: SkillNode[], edges: SkillEdge[], options: ForceLayoutOptions): void {
    this.stop()

    const { width, height, chargeStrength = -200, collisionPadding = 16, alphaDecay = 0.02 } = options

    const layoutNodes: LayoutNode[] = nodes.map(n => ({
      id: n.id,
      depth: n.depth,
      // Seed from manual position if provided, else random near world origin.
      // World (0,0) maps to canvas center given the initial pan of (width/2, height/2).
      x: n.position?.x ?? (Math.random() - 0.5) * 100,
      y: n.position?.y ?? (Math.random() - 0.5) * 100,
    }))

    const nodeIndex = new Map(layoutNodes.map(n => [n.id, n]))

    const layoutLinks: LayoutLink[] = []

    // Parent-child edges for layout purposes
    for (const node of nodes) {
      if (node.parentId) {
        const source = nodeIndex.get(node.parentId)
        const target = nodeIndex.get(node.id)
        if (source && target) {
          layoutLinks.push({ id: `${node.parentId}->${node.id}`, source, target })
        }
      }
    }

    // Explicit cross-depth edges
    for (const edge of edges) {
      const source = nodeIndex.get(edge.source)
      const target = nodeIndex.get(edge.target)
      if (source && target) {
        layoutLinks.push({ id: edge.id, source, target })
      }
    }

    const emit = (positions: Map<string, Position>) => {
      options.onTick?.(positions)
    }

    this._simulation = forceSimulation<LayoutNode, LayoutLink>(layoutNodes)
      .alphaDecay(alphaDecay)
      .force('link', forceLink<LayoutNode, LayoutLink>(layoutLinks)
        .id(d => d.id)
        .distance(d => {
          const s = d.source as LayoutNode
          const t = d.target as LayoutNode
          // Deeper nodes cluster closer
          return 80 + (Math.abs(s.depth - t.depth) * 20)
        })
        .strength(0.4)
      )
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('center', forceCenter(0, 0))
      .force('collide', forceCollide<LayoutNode>().radius(collisionPadding))
      .on('tick', () => {
        const positions = this._collectPositions(layoutNodes)
        emit(positions)
      })
      .on('end', () => {
        const positions = this._collectPositions(layoutNodes)
        options.onEnd?.(positions)
      })
  }

  stop(): void {
    this._simulation?.stop()
    this._simulation = null
  }

  reheat(): void {
    this._simulation?.alpha(0.3).restart()
  }

  private _collectPositions(nodes: LayoutNode[]): Map<string, Position> {
    const positions = new Map<string, Position>()
    for (const n of nodes) {
      positions.set(n.id, { x: n.x, y: n.y })
    }
    return positions
  }
}
