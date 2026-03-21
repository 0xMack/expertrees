import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, reactive, nextTick } from 'vue'
import { useSkillTree } from '../useSkillTree.js'
import type { SkillGraph, SkillTreeEvents } from '@expertrees/core'

// ─── Engine mock ──────────────────────────────────────────────────────────────
// Capture the `on` handlers passed to each SkillTreeEngine constructor so tests
// can simulate events (zoom, context:enter, node:click, etc.) directly.

let capturedHandlers: Partial<SkillTreeEvents> = {}

vi.mock('@expertrees/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@expertrees/core')>()
  return {
    ...actual,
    SkillTreeEngine: vi.fn().mockImplementation((opts: { on?: Partial<SkillTreeEvents> }) => {
      capturedHandlers = opts.on ?? {}
      return {
        dispose:             vi.fn(),
        setNodeState:        vi.fn(),
        addEvidence:         vi.fn(),
        removeEvidence:      vi.fn(),
        updateTheme:         vi.fn(),
        zoomIn:              vi.fn(),
        zoomOut:             vi.fn(),
        goBack:              vi.fn(),
        enterContext:        vi.fn(),
        jumpToNavDepth:      vi.fn(),
        getGraph:            vi.fn().mockReturnValue({ id: 'g', label: 'G', nodes: [], edges: [] }),
        getNavigationStack:  vi.fn().mockReturnValue([{ nodeId: null, label: 'G' }]),
      }
    }),
  }
})

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const testGraph: SkillGraph = {
  id: 'g',
  label: 'Test',
  nodes: [
    { id: 'bubble', label: 'Bubble', depth: 0, childIds: ['leaf'] },
    { id: 'leaf',   label: 'Leaf',   depth: 1, parentId: 'bubble' },
  ],
  edges: [],
}

// ─── Mount helper ─────────────────────────────────────────────────────────────
// Async: awaits a tick so the canvasRef watch fires and the engine is initialised
// before tests start making assertions or calling capturedHandlers.

async function mountWithComposable(options: Parameters<typeof useSkillTree>[0]) {
  let exposed: ReturnType<typeof useSkillTree> | undefined
  const Wrapper = defineComponent({
    setup() {
      const result = useSkillTree(options)
      exposed = result
      return () => h('canvas', { ref: result.canvasRef })
    },
  })
  const wrapper = mount(Wrapper, { attachTo: document.body })
  await nextTick()  // let the watch fire and SkillTreeEngine be constructed
  return { wrapper, exposed: exposed! }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useSkillTree', () => {
  beforeEach(() => {
    capturedHandlers = {}
  })

  describe('initial state', () => {
    it('exposes reactive refs with sensible defaults', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      expect(exposed.canvasRef).toBeDefined()
      expect(exposed.hoveredNode.value).toBeNull()
      expect(exposed.selectedNode.value).toBeNull()
      expect(exposed.zoom.value).toBe(1)
      expect(exposed.navigationStack.value).toHaveLength(1)
      expect(exposed.canGoBack.value).toBe(false)
    })

    it('exposes all imperative methods', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      for (const method of ['setNodeState', 'addEvidence', 'removeEvidence',
                            'updateTheme', 'zoomIn', 'zoomOut', 'goBack', 'getGraph']) {
        expect(typeof (exposed as unknown as Record<string, unknown>)[method]).toBe('function')
      }
    })

    it('getGraph returns data even before engine mounts', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const graph = exposed.getGraph()
      expect(graph).toBeDefined()
      expect(graph.id).toBeTruthy()
    })
  })

  describe('event → ref propagation', () => {
    it('zoom ref updates when engine emits zoom:change', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      capturedHandlers['zoom:change']?.(2.5)
      await nextTick()
      expect(exposed.zoom.value).toBe(2.5)
    })

    it('hoveredNode updates on node:hover and clears on node:blur', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const node = testGraph.nodes[0]!

      capturedHandlers['node:hover']?.(node)
      await nextTick()
      expect(exposed.hoveredNode.value?.id).toBe(node.id)

      capturedHandlers['node:blur']?.(node)
      await nextTick()
      expect(exposed.hoveredNode.value).toBeNull()
    })

    it('selectedNode toggles on node:click', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const node = testGraph.nodes[1]!

      capturedHandlers['node:click']?.(node)
      await nextTick()
      expect(exposed.selectedNode.value?.id).toBe(node.id)

      // Second click on same node deselects
      capturedHandlers['node:click']?.(node)
      await nextTick()
      expect(exposed.selectedNode.value).toBeNull()
    })
  })

  describe('navigation', () => {
    it('navigationStack updates on context:enter', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const bubble   = testGraph.nodes[0]!
      const newStack = [
        { nodeId: null, label: 'Test' },
        { nodeId: bubble.id, label: bubble.label },
      ]

      capturedHandlers['context:enter']?.(bubble, newStack)
      await nextTick()
      expect(exposed.navigationStack.value).toHaveLength(2)
      expect(exposed.canGoBack.value).toBe(true)
    })

    it('selectedNode is cleared on context:enter', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const leaf   = testGraph.nodes[1]!
      const bubble = testGraph.nodes[0]!

      capturedHandlers['node:click']?.(leaf)
      await nextTick()
      expect(exposed.selectedNode.value).not.toBeNull()

      capturedHandlers['context:enter']?.(bubble, [
        { nodeId: null, label: 'Test' },
        { nodeId: bubble.id, label: bubble.label },
      ])
      await nextTick()
      expect(exposed.selectedNode.value).toBeNull()
    })

    it('navigationStack shrinks on context:exit', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const bubble    = testGraph.nodes[0]!
      const rootFrame = { nodeId: null, label: 'Test' }

      capturedHandlers['context:enter']?.(bubble, [
        rootFrame,
        { nodeId: bubble.id, label: bubble.label },
      ])
      await nextTick()
      expect(exposed.navigationStack.value).toHaveLength(2)

      capturedHandlers['context:exit']?.({ nodeId: bubble.id, label: bubble.label }, [rootFrame])
      await nextTick()
      expect(exposed.navigationStack.value).toHaveLength(1)
      expect(exposed.canGoBack.value).toBe(false)
    })

    it('selectedNode is cleared on context:exit', async () => {
      const { exposed } = await mountWithComposable({ data: testGraph })
      const bubble    = testGraph.nodes[0]!
      const leaf      = testGraph.nodes[1]!
      const rootFrame = { nodeId: null, label: 'Test' }

      capturedHandlers['context:enter']?.(bubble, [rootFrame, { nodeId: bubble.id, label: bubble.label }])
      capturedHandlers['node:click']?.(leaf)
      await nextTick()
      expect(exposed.selectedNode.value).not.toBeNull()

      capturedHandlers['context:exit']?.({ nodeId: bubble.id, label: bubble.label }, [rootFrame])
      await nextTick()
      expect(exposed.selectedNode.value).toBeNull()
    })
  })

  describe('data reactivity', () => {
    it('reinitialises the engine when the data reference changes', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const options = reactive<Parameters<typeof useSkillTree>[0]>({ data: testGraph })
      await mountWithComposable(options)

      const callsBefore = EngineMock.mock.calls.length

      options.data = { ...testGraph, id: 'g2', label: 'Graph 2' }
      await nextTick()
      await nextTick()

      expect(EngineMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    it('disposes the old engine before creating the new one', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const options = reactive<Parameters<typeof useSkillTree>[0]>({ data: testGraph })
      await mountWithComposable(options)

      // Grab dispose spy from the engine that was just created
      const firstInstance = EngineMock.mock.results.at(-1)?.value as { dispose: ReturnType<typeof vi.fn> }

      options.data = { ...testGraph, id: 'g3', label: 'Graph 3' }
      await nextTick()
      await nextTick()

      expect(firstInstance.dispose).toHaveBeenCalled()
    })
  })

  describe('consumer event forwarding', () => {
    it('forwards node:click to the on handler', async () => {
      const onNodeClick = vi.fn()
      await mountWithComposable({ data: testGraph, on: { 'node:click': onNodeClick } })

      const node = testGraph.nodes[1]!
      capturedHandlers['node:click']?.(node)
      await nextTick()

      expect(onNodeClick).toHaveBeenCalledWith(node)
    })

    it('forwards zoom:change to the on handler', async () => {
      const onZoom = vi.fn()
      await mountWithComposable({ data: testGraph, on: { 'zoom:change': onZoom } })

      capturedHandlers['zoom:change']?.(3.0)
      await nextTick()

      expect(onZoom).toHaveBeenCalledWith(3.0)
    })
  })
})
