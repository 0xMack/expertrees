import { describe, it, expect, vi } from 'vitest'
import { SkillGraphModel } from '../graph/SkillGraphModel.js'
import type { SkillGraph } from '../types/index.js'

const fixture: SkillGraph = {
  id: 'test-graph',
  label: 'Test Graph',
  nodes: [
    { id: 'a', label: 'Engineering', depth: 0 },
    { id: 'b', label: 'Frontend', depth: 1, parentId: 'a', childIds: ['d'] },
    { id: 'c', label: 'Backend', depth: 1, parentId: 'a' },
    { id: 'd', label: 'React', depth: 2, parentId: 'b' },
  ],
  edges: [
    { id: 'e1', source: 'b', target: 'c', directed: false },
  ],
}

describe('SkillGraphModel', () => {
  it('loads nodes and edges from JSON', () => {
    const model = new SkillGraphModel(fixture)
    expect(model.getNodes()).toHaveLength(4)
    expect(model.getEdges()).toHaveLength(1)
  })

  it('retrieves a node by id', () => {
    const model = new SkillGraphModel(fixture)
    const node = model.getNode('a')
    expect(node?.label).toBe('Engineering')
  })

  it('returns undefined for missing node id', () => {
    const model = new SkillGraphModel(fixture)
    expect(model.getNode('missing')).toBeUndefined()
  })

  it('returns nodes at a given depth', () => {
    const model = new SkillGraphModel(fixture)
    expect(model.getNodesAtDepth(1)).toHaveLength(2)
    expect(model.getNodesAtDepth(0)).toHaveLength(1)
  })

  it('returns nodes up to a given depth', () => {
    const model = new SkillGraphModel(fixture)
    expect(model.getNodesUpToDepth(1)).toHaveLength(3)
  })

  it('returns children of a node', () => {
    const model = new SkillGraphModel(fixture)
    const children = model.getChildren('b')
    expect(children).toHaveLength(1)
    expect(children[0]?.id).toBe('d')
  })

  it('sets node state and emits event', () => {
    const model = new SkillGraphModel(fixture)
    const listener = vi.fn()
    model.on('nodeStateChanged', listener)
    model.setNodeState('a', 'active')
    expect(listener).toHaveBeenCalledWith({ nodeId: 'a', state: 'active' })
    expect(model.getNode('a')?.state).toBe('active')
  })

  it('emits changed event on state change', () => {
    const model = new SkillGraphModel(fixture)
    const listener = vi.fn()
    model.on('changed', listener)
    model.setNodeState('a', 'locked')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does nothing when setting state on missing node', () => {
    const model = new SkillGraphModel(fixture)
    const listener = vi.fn()
    model.on('changed', listener)
    model.setNodeState('missing', 'active')
    expect(listener).not.toHaveBeenCalled()
  })

  it('adds and removes evidence', () => {
    const model = new SkillGraphModel(fixture)
    model.addEvidence('a', { id: 'ev1', type: 'link', label: 'My blog post' })
    expect(model.getNode('a')?.evidence).toHaveLength(1)

    model.removeEvidence('a', 'ev1')
    expect(model.getNode('a')?.evidence).toHaveLength(0)
  })

  it('emits evidenceAdded and changed events', () => {
    const model = new SkillGraphModel(fixture)
    const addedListener = vi.fn()
    const changedListener = vi.fn()
    model.on('evidenceAdded', addedListener)
    model.on('changed', changedListener)

    model.addEvidence('a', { id: 'ev1', type: 'text', label: 'Note' })
    expect(addedListener).toHaveBeenCalledWith({ nodeId: 'a', evidence: expect.objectContaining({ id: 'ev1' }) })
    expect(changedListener).toHaveBeenCalled()
  })

  it('adds and removes nodes', () => {
    const model = new SkillGraphModel(fixture)
    model.addNode({ id: 'new', label: 'New Node', depth: 3, parentId: 'd' })
    expect(model.getNode('new')).toBeDefined()

    model.removeNode('new')
    expect(model.getNode('new')).toBeUndefined()
  })

  it('unsubscribes from events', () => {
    const model = new SkillGraphModel(fixture)
    const listener = vi.fn()
    const unsub = model.on('changed', listener)
    unsub()
    model.setNodeState('a', 'active')
    expect(listener).not.toHaveBeenCalled()
  })

  it('serializes back to JSON', () => {
    const model = new SkillGraphModel(fixture)
    const json = model.toJSON()
    expect(json.id).toBe('test-graph')
    expect(json.nodes).toHaveLength(4)
  })

  it('round-trips via fromJSON', () => {
    const model = SkillGraphModel.fromJSON(fixture)
    expect(model.getNodes()).toHaveLength(4)
  })
})
