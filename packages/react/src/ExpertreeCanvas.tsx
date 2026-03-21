import React, { forwardRef, useImperativeHandle, type CSSProperties } from 'react'
import type {
  SkillGraph,
  SkillNode,
  NodeState,
  Evidence,
  ThemeInput,
  LodThreshold,
  SkillTreeEvents,
  NavigationFrame,
} from '@expertrees/core'
import { useExpertree } from './useExpertree.js'

export interface ExpertreeCanvasProps {
  data: SkillGraph
  theme?: ThemeInput
  lod?: LodThreshold[]
  initialContextNodeId?: string
  width?: string
  height?: string
  style?: CSSProperties
  className?: string
  on?: Partial<SkillTreeEvents>
}

export interface ExpertreeCanvasHandle {
  setNodeState: (nodeId: string, state: NodeState) => void
  addEvidence: (nodeId: string, evidence: Evidence) => void
  removeEvidence: (nodeId: string, evidenceId: string) => void
  updateTheme: (theme: ThemeInput) => void
  zoomIn: () => void
  zoomOut: () => void
  goBack: () => void
  enterContext: (nodeId: string) => void
  jumpToNavDepth: (targetLength: number) => void
  getGraph: () => SkillGraph
  hoveredNode: SkillNode | null
  selectedNode: SkillNode | null
  zoom: number
  navigationStack: readonly NavigationFrame[]
  canGoBack: boolean
}

export const ExpertreeCanvas = forwardRef<ExpertreeCanvasHandle, ExpertreeCanvasProps>(
  function ExpertreeCanvas(props, ref) {
    const {
      data, theme, lod, initialContextNodeId,
      width = '100%', height = '100%',
      style, className, on,
    } = props

    const api = useExpertree({
      data,
      ...(theme !== undefined && { theme }),
      ...(lod !== undefined && { lod }),
      ...(initialContextNodeId !== undefined && { initialContextNodeId }),
      ...(on !== undefined && { on }),
    })

    useImperativeHandle(ref, () => ({
      setNodeState: api.setNodeState,
      addEvidence: api.addEvidence,
      removeEvidence: api.removeEvidence,
      updateTheme: api.updateTheme,
      zoomIn: api.zoomIn,
      zoomOut: api.zoomOut,
      goBack: api.goBack,
      enterContext: api.enterContext,
      jumpToNavDepth: api.jumpToNavDepth,
      getGraph: api.getGraph,
      get hoveredNode() { return api.hoveredNode },
      get selectedNode() { return api.selectedNode },
      get zoom() { return api.zoom },
      get navigationStack() { return api.navigationStack },
      get canGoBack() { return api.canGoBack },
    }), [api])

    return (
      <canvas
        ref={api.canvasRef}
        style={{ width, height, display: 'block', ...style }}
        className={className}
      />
    )
  }
)
