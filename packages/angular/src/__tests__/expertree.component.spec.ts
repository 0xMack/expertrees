import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TestBed, type ComponentFixture } from '@angular/core/testing'
import { Component } from '@angular/core'
import { ExpertreeCanvasComponent } from '../lib/expertree.component'
import type { SkillGraph, SkillTreeEvents } from '@expertrees/core'

// ─── Engine mock ──────────────────────────────────────────────────────────────

let capturedHandlers: Partial<SkillTreeEvents> = {}

vi.mock('@expertrees/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@expertrees/core')>()
  return {
    ...actual,
    SkillTreeEngine: vi.fn().mockImplementation((opts: { on?: Partial<SkillTreeEvents> }) => {
      capturedHandlers = opts.on ?? {}
      return {
        dispose:            vi.fn(),
        setNodeState:       vi.fn(),
        addEvidence:        vi.fn(),
        removeEvidence:     vi.fn(),
        updateTheme:        vi.fn(),
        zoomIn:             vi.fn(),
        zoomOut:            vi.fn(),
        goBack:             vi.fn(),
        enterContext:       vi.fn(),
        jumpToNavDepth:     vi.fn(),
        getGraph:           vi.fn().mockReturnValue({ id: 'g', label: 'G', nodes: [], edges: [] }),
        getNavigationStack: vi.fn().mockReturnValue([{ nodeId: null, label: 'G' }]),
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

@Component({
  standalone: true,
  imports: [ExpertreeCanvasComponent],
  template: `<expertree-canvas [data]="data" />`,
})
class HostComponent {
  data = testGraph
}

async function createFixture(data = testGraph): Promise<{
  fixture: ComponentFixture<ExpertreeCanvasComponent>
  component: ExpertreeCanvasComponent
}> {
  await TestBed.configureTestingModule({
    imports: [ExpertreeCanvasComponent],
  }).compileComponents()

  const fixture = TestBed.createComponent(ExpertreeCanvasComponent)
  // Use setInput so Angular tracks the firstChange — required for subsequent setInput calls
  // to have firstChange: false and properly trigger ngOnChanges
  fixture.componentRef.setInput('data', data)
  fixture.detectChanges()
  await fixture.whenStable()

  return { fixture, component: fixture.componentInstance }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExpertreeCanvasComponent', () => {
  beforeEach(() => {
    capturedHandlers = {}
    TestBed.resetTestingModule()
  })

  describe('lifecycle', () => {
    it('creates the engine on AfterViewInit', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)
      const callsBefore = EngineMock.mock.calls.length

      await createFixture()

      expect(EngineMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    it('disposes the engine on destroy', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const { fixture } = await createFixture()
      const instance = EngineMock.mock.results.at(-1)?.value as { dispose: ReturnType<typeof vi.fn> }

      fixture.destroy()

      expect(instance.dispose).toHaveBeenCalled()
    })

    it('reinitialises the engine when data input changes', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const { fixture } = await createFixture()
      const callsBefore = EngineMock.mock.calls.length

      // setInput properly triggers ngOnChanges, unlike direct property assignment
      fixture.componentRef.setInput('data', { ...testGraph, id: 'g2', label: 'Graph 2' })
      fixture.detectChanges()
      await fixture.whenStable()

      expect(EngineMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })

    it('disposes old engine before creating a new one on data change', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const { fixture } = await createFixture()
      const firstInstance = EngineMock.mock.results.at(-1)?.value as { dispose: ReturnType<typeof vi.fn> }

      fixture.componentRef.setInput('data', { ...testGraph, id: 'g3', label: 'Graph 3' })
      fixture.detectChanges()
      await fixture.whenStable()

      expect(firstInstance.dispose).toHaveBeenCalled()
    })
  })

  describe('imperative API', () => {
    it('delegates setNodeState to the engine', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const { component } = await createFixture()
      const instance = EngineMock.mock.results.at(-1)?.value as { setNodeState: ReturnType<typeof vi.fn> }

      component.setNodeState('leaf', 'active')

      expect(instance.setNodeState).toHaveBeenCalledWith('leaf', 'active')
    })

    it('delegates zoomIn to the engine', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const { component } = await createFixture()
      const instance = EngineMock.mock.results.at(-1)?.value as { zoomIn: ReturnType<typeof vi.fn> }

      component.zoomIn()

      expect(instance.zoomIn).toHaveBeenCalled()
    })

    it('delegates jumpToNavDepth to the engine', async () => {
      const { SkillTreeEngine } = await import('@expertrees/core')
      const EngineMock = vi.mocked(SkillTreeEngine)

      const { component } = await createFixture()
      const instance = EngineMock.mock.results.at(-1)?.value as { jumpToNavDepth: ReturnType<typeof vi.fn> }

      component.jumpToNavDepth(1)

      expect(instance.jumpToNavDepth).toHaveBeenCalledWith(1)
    })

    it('getGraph returns data from the engine', async () => {
      const { component } = await createFixture()
      const graph = component.getGraph()
      expect(graph).toBeDefined()
      expect(graph.id).toBeTruthy()
    })
  })

  describe('event forwarding', () => {
    it('emits nodeClick when engine fires node:click', async () => {
      const { component } = await createFixture()
      const node = testGraph.nodes[1]!
      const emitted: typeof node[] = []
      component.nodeClick.subscribe((n: typeof node) => emitted.push(n))

      capturedHandlers['node:click']?.(node)

      expect(emitted).toHaveLength(1)
      expect(emitted[0]!.id).toBe(node.id)
    })

    it('emits zoomChange when engine fires zoom:change', async () => {
      const { component } = await createFixture()
      const emitted: number[] = []
      component.zoomChange.subscribe((z: number) => emitted.push(z))

      capturedHandlers['zoom:change']?.(2.5)

      expect(emitted).toHaveLength(1)
      expect(emitted[0]).toBe(2.5)
    })

    it('emits contextEnter when engine fires context:enter', async () => {
      const { component } = await createFixture()
      const bubble = testGraph.nodes[0]!
      const stack   = [{ nodeId: null, label: 'Test' }, { nodeId: bubble.id, label: bubble.label }]
      const emitted: unknown[] = []
      component.contextEnter.subscribe((e: unknown) => emitted.push(e))

      capturedHandlers['context:enter']?.(bubble, stack)

      expect(emitted).toHaveLength(1)
      expect((emitted[0] as { node: typeof bubble }).node.id).toBe(bubble.id)
    })

    it('emits nodeHover and nodeBlur on hover/blur events', async () => {
      const { component } = await createFixture()
      const node = testGraph.nodes[0]!
      const hovered: unknown[] = []
      const blurred: unknown[] = []
      component.nodeHover.subscribe((n: unknown) => hovered.push(n))
      component.nodeBlur.subscribe((n: unknown) => blurred.push(n))

      capturedHandlers['node:hover']?.(node)
      capturedHandlers['node:blur']?.(node)

      expect(hovered).toHaveLength(1)
      expect(blurred).toHaveLength(1)
    })
  })
})
