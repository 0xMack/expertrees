import {
  Component,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  SimpleChanges,
} from '@angular/core'
import {
  SkillTreeEngine,
  type SkillGraph,
  type SkillNode,
  type NodeState,
  type Evidence,
  type ThemeInput,
  type LodThreshold,
  type NavigationFrame,
} from '@expertrees/core'

@Component({
  selector: 'expertree-canvas',
  standalone: true,
  template: `<canvas #canvas [style.width]="width" [style.height]="height" style="display:block"></canvas>`,
})
export class ExpertreeCanvasComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() data!: SkillGraph
  @Input() theme?: ThemeInput
  @Input() lod?: LodThreshold[]
  @Input() initialContextNodeId?: string
  @Input() width = '100%'
  @Input() height = '100%'

  @Output() nodeClick = new EventEmitter<SkillNode>()
  @Output() nodeHover = new EventEmitter<SkillNode>()
  @Output() nodeBlur = new EventEmitter<SkillNode>()
  @Output() canvasClick = new EventEmitter<void>()
  @Output() zoomChange = new EventEmitter<number>()
  @Output() contextEnter = new EventEmitter<{ node: SkillNode; stack: readonly NavigationFrame[] }>()
  @Output() contextExit = new EventEmitter<{ frame: NavigationFrame; stack: readonly NavigationFrame[] }>()
  @Output() graphReady = new EventEmitter<SkillGraph>()

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>

  private engine: SkillTreeEngine | null = null

  ngAfterViewInit(): void {
    this._createEngine()
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].firstChange) {
      this._createEngine()
    }
  }

  ngOnDestroy(): void {
    this.engine?.dispose()
  }

  setNodeState(nodeId: string, state: NodeState): void {
    this.engine?.setNodeState(nodeId, state)
  }

  addEvidence(nodeId: string, evidence: Evidence): void {
    this.engine?.addEvidence(nodeId, evidence)
  }

  removeEvidence(nodeId: string, evidenceId: string): void {
    this.engine?.removeEvidence(nodeId, evidenceId)
  }

  updateTheme(theme: ThemeInput): void {
    this.engine?.updateTheme(theme)
  }

  zoomIn(): void { this.engine?.zoomIn() }
  zoomOut(): void { this.engine?.zoomOut() }
  goBack(): void { this.engine?.goBack() }
  enterContext(nodeId: string): void { this.engine?.enterContext(nodeId) }
  jumpToNavDepth(targetLength: number): void { this.engine?.jumpToNavDepth(targetLength) }
  getGraph(): SkillGraph { return this.engine?.getGraph() ?? this.data }
  getNavigationStack(): readonly NavigationFrame[] { return this.engine?.getNavigationStack() ?? [] }

  private _createEngine(): void {
    this.engine?.dispose()
    const canvas = this.canvasRef?.nativeElement
    if (!canvas) return

    this.engine = new SkillTreeEngine({
      canvas,
      data: this.data,
      ...(this.theme !== undefined && { theme: this.theme }),
      ...(this.lod !== undefined && { lod: this.lod }),
      ...(this.initialContextNodeId !== undefined && { initialContextNodeId: this.initialContextNodeId }),
      on: {
        'node:click': (node) => this.nodeClick.emit(node),
        'node:hover': (node) => this.nodeHover.emit(node),
        'node:blur': (node) => this.nodeBlur.emit(node),
        'canvas:click': () => this.canvasClick.emit(),
        'zoom:change': (zoom) => this.zoomChange.emit(zoom),
        'context:enter': (node, stack) => this.contextEnter.emit({ node, stack }),
        'context:exit': (frame, stack) => this.contextExit.emit({ frame, stack }),
        'graph:ready': (graph) => this.graphReady.emit(graph),
      },
    })
  }
}
