import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
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

    const { width, height, collisionPadding = 16, alphaDecay = 0.02 } = options

    // Scale forces to the canvas so nodes fill the available space.
    // Use sqrt(area) relative to a 300px baseline (where the original defaults work well).
    const areaScale = Math.sqrt(width * height) / 300
    const chargeStrength = options.chargeStrength ?? -(200 * areaScale * areaScale)
    const baseLinkDistance = 80 * areaScale

    // Soft bounds: nodes are clamped to this region each tick so they stay visible.
    // 70% of the half-dimension keeps bubble nodes (radius 40) clear of the canvas edge.
    const halfW = (width  / 2) * 0.70
    const halfH = (height / 2) * 0.70

    const layoutNodes: LayoutNode[] = nodes.map(n => ({
      id: n.id,
      depth: n.depth,
      // Seed near centre so nodes spread outward under repulsion rather than
      // starting near the boundary and immediately flying off screen.
      x: n.position?.x ?? (Math.random() - 0.5) * width  * 0.25,
      y: n.position?.y ?? (Math.random() - 0.5) * height * 0.25,
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
          return baseLinkDistance + (Math.abs(s.depth - t.depth) * 20 * areaScale)
        })
        .strength(0.4)
      )
      .force('charge', forceManyBody().strength(chargeStrength))
      .force('center', forceCenter(0, 0))
      .force('gravX', forceX(0).strength(0.04))
      .force('gravY', forceY(0).strength(0.04))
      .force('collide', forceCollide<LayoutNode>().radius(collisionPadding))
      // Soft elliptical boundary — pushes back smoothly once a node exceeds
      // 80% of the half-dimension in elliptical radius, growing quadratically
      // toward the hard limit. No straight walls, so the layout stays organic.
      .force('softBound', (alpha: number) => {
        const threshold = 0.80
        for (const node of layoutNodes) {
          const ex = node.x / halfW
          const ey = node.y / halfH
          const r  = Math.sqrt(ex * ex + ey * ey)
          if (r > threshold) {
            const excess   = (r - threshold) / (1 - threshold)  // 0→1 in the push zone
            const strength = excess * excess * alpha * 6
            node.vx = (node.vx ?? 0) - ex * strength
            node.vy = (node.vy ?? 0) - ey * strength
          }
        }
      })
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
