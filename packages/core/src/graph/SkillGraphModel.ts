import Graph from 'graphology'
import type { SkillGraph, SkillNode, SkillEdge, NodeState, Evidence } from '../types/index.js'

type GraphEvents = {
  nodeStateChanged: { nodeId: string; state: NodeState }
  nodeAdded: { node: SkillNode }
  nodeRemoved: { nodeId: string }
  edgeAdded: { edge: SkillEdge }
  edgeRemoved: { edgeId: string }
  evidenceAdded: { nodeId: string; evidence: Evidence }
  evidenceRemoved: { nodeId: string; evidenceId: string }
  changed: void
}

type EventListener<T> = T extends void ? () => void : (payload: T) => void

export class SkillGraphModel {
  private _graph: Graph
  private _meta: SkillGraph['meta']
  private _label: string
  private _id: string
  private _listeners: Map<keyof GraphEvents, Set<EventListener<unknown>>> = new Map()

  constructor(data: SkillGraph) {
    this._id = data.id
    this._label = data.label
    this._meta = data.meta

    this._graph = new Graph({ multi: false, allowSelfLoops: false })

    for (const node of data.nodes) {
      this._graph.addNode(node.id, { ...node })
    }

    for (const edge of data.edges) {
      if (edge.directed) {
        this._graph.addDirectedEdge(edge.source, edge.target, { ...edge })
      } else {
        this._graph.addUndirectedEdge(edge.source, edge.target, { ...edge })
      }
    }
  }

  // ─── Accessors ──────────────────────────────────────────────────────────────

  get id() { return this._id }
  get label() { return this._label }
  get meta() { return this._meta }

  getNode(id: string): SkillNode | undefined {
    if (!this._graph.hasNode(id)) return undefined
    return this._graph.getNodeAttributes(id) as SkillNode
  }

  getEdge(id: string): SkillEdge | undefined {
    if (!this._graph.hasEdge(id)) return undefined
    return this._graph.getEdgeAttributes(id) as SkillEdge
  }

  getNodes(): SkillNode[] {
    return this._graph.nodes().map(id => this._graph.getNodeAttributes(id) as SkillNode)
  }

  getEdges(): SkillEdge[] {
    return this._graph.edges().map(id => this._graph.getEdgeAttributes(id) as SkillEdge)
  }

  getChildren(nodeId: string): SkillNode[] {
    const node = this.getNode(nodeId)
    if (!node?.childIds) return []
    return node.childIds.flatMap(id => {
      const child = this.getNode(id)
      return child ? [child] : []
    })
  }

  getNodesAtDepth(depth: number): SkillNode[] {
    return this.getNodes().filter(n => n.depth === depth)
  }

  getNodesUpToDepth(depth: number): SkillNode[] {
    return this.getNodes().filter(n => n.depth <= depth)
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  setNodeState(nodeId: string, state: NodeState): void {
    if (!this._graph.hasNode(nodeId)) return
    this._graph.mergeNodeAttributes(nodeId, { state })
    this._emit('nodeStateChanged', { nodeId, state })
    this._emit('changed', undefined)
  }

  addNode(node: SkillNode): void {
    this._graph.addNode(node.id, { ...node })
    this._emit('nodeAdded', { node })
    this._emit('changed', undefined)
  }

  removeNode(nodeId: string): void {
    if (!this._graph.hasNode(nodeId)) return
    this._graph.dropNode(nodeId)
    this._emit('nodeRemoved', { nodeId })
    this._emit('changed', undefined)
  }

  addEdge(edge: SkillEdge): void {
    if (edge.directed) {
      this._graph.addDirectedEdge(edge.source, edge.target, { ...edge })
    } else {
      this._graph.addUndirectedEdge(edge.source, edge.target, { ...edge })
    }
    this._emit('edgeAdded', { edge })
    this._emit('changed', undefined)
  }

  removeEdge(edgeId: string): void {
    if (!this._graph.hasEdge(edgeId)) return
    this._graph.dropEdge(edgeId)
    this._emit('edgeRemoved', { edgeId })
    this._emit('changed', undefined)
  }

  addEvidence(nodeId: string, evidence: Evidence): void {
    if (!this._graph.hasNode(nodeId)) return
    const node = this.getNode(nodeId)!
    const existing = node.evidence ?? []
    this._graph.mergeNodeAttributes(nodeId, { evidence: [...existing, evidence] })
    this._emit('evidenceAdded', { nodeId, evidence })
    this._emit('changed', undefined)
  }

  removeEvidence(nodeId: string, evidenceId: string): void {
    if (!this._graph.hasNode(nodeId)) return
    const node = this.getNode(nodeId)!
    const evidence = (node.evidence ?? []).filter(e => e.id !== evidenceId)
    this._graph.mergeNodeAttributes(nodeId, { evidence })
    this._emit('evidenceRemoved', { nodeId, evidenceId })
    this._emit('changed', undefined)
  }

  // ─── Serialization ──────────────────────────────────────────────────────────

  toJSON(): SkillGraph {
    const result: SkillGraph = {
      id: this._id,
      label: this._label,
      nodes: this.getNodes(),
      edges: this.getEdges(),
    }
    if (this._meta !== undefined) result.meta = this._meta
    return result
  }

  static fromJSON(data: SkillGraph): SkillGraphModel {
    return new SkillGraphModel(data)
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  on<K extends keyof GraphEvents>(event: K, listener: EventListener<GraphEvents[K]>): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set())
    }
    const set = this._listeners.get(event)!
    set.add(listener as EventListener<unknown>)
    return () => set.delete(listener as EventListener<unknown>)
  }

  private _emit<K extends keyof GraphEvents>(event: K, payload: GraphEvents[K]): void {
    const listeners = this._listeners.get(event)
    if (!listeners) return
    for (const listener of listeners) {
      if (payload === undefined) {
        (listener as () => void)()
      } else {
        (listener as (p: unknown) => void)(payload)
      }
    }
  }
}
