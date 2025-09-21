import { useMemo } from 'react'

const buildTemplate = (count, vertexSizeVar, edgeSizeVar) => {
  const template = []
  for (let i = 0; i < count; i += 1) {
    template.push(`var(${vertexSizeVar})`)
    template.push(`var(${edgeSizeVar})`)
  }
  template.push(`var(${vertexSizeVar})`)
  return template.join(' ')
}

const SlitherlinkBoard = ({
  grid,
  clues,
  edgeStates,
  onCycleEdge,
  onSetEdgeState,
  feedback,
  disabled = false,
}) => {
  const columnTemplate = useMemo(
    () => buildTemplate(grid.width, '--vertex-size', '--edge-length'),
    [grid.width],
  )
  const rowTemplate = useMemo(
    () => buildTemplate(grid.height, '--vertex-size', '--edge-length'),
    [grid.height],
  )

  const wrongEdges = feedback?.wrong ?? new Set()
  const missingEdges = feedback?.missing ?? new Set()

  const renderCell = (r, c) => {
    const isVertex = r % 2 === 0 && c % 2 === 0
    const isHorizontalEdge = r % 2 === 0 && c % 2 === 1
    const isVerticalEdge = r % 2 === 1 && c % 2 === 0

    if (isVertex) {
      return <div key={`${r}-${c}`} className="vertex" />
    }

    if (isHorizontalEdge) {
      const row = r / 2
      const col = (c - 1) / 2
      const edgeId = grid.horizontalEdges[row][col]
      const state = edgeStates[edgeId]
      const classes = ['edge', 'edge-horizontal']
      if (state === 1) classes.push('edge-on')
      if (state === -1) classes.push('edge-cross')
      if (wrongEdges.has(edgeId)) classes.push('edge-wrong')
      if (missingEdges.has(edgeId)) classes.push('edge-missing')

      const handleClick = () => {
        if (!disabled) onCycleEdge?.(edgeId)
      }
      const handleContextMenu = (event) => {
        event.preventDefault()
        if (disabled) return
        const nextState = state === -1 ? 0 : -1
        onSetEdgeState?.(edgeId, nextState)
      }

      return (
        <button
          key={`${r}-${c}`}
          type="button"
          className={classes.join(' ')}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <span className="edge-decoration" />
        </button>
      )
    }

    if (isVerticalEdge) {
      const row = (r - 1) / 2
      const col = c / 2
      const edgeId = grid.verticalEdges[row][col]
      const state = edgeStates[edgeId]
      const classes = ['edge', 'edge-vertical']
      if (state === 1) classes.push('edge-on')
      if (state === -1) classes.push('edge-cross')
      if (wrongEdges.has(edgeId)) classes.push('edge-wrong')
      if (missingEdges.has(edgeId)) classes.push('edge-missing')

      const handleClick = () => {
        if (!disabled) onCycleEdge?.(edgeId)
      }
      const handleContextMenu = (event) => {
        event.preventDefault()
        if (disabled) return
        const nextState = state === -1 ? 0 : -1
        onSetEdgeState?.(edgeId, nextState)
      }

      return (
        <button
          key={`${r}-${c}`}
          type="button"
          className={classes.join(' ')}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        >
          <span className="edge-decoration" />
        </button>
      )
    }

    const cellRow = (r - 1) / 2
    const cellCol = (c - 1) / 2
    const cellIndex = grid.cellIndex(cellRow, cellCol)
    const clue = clues[cellIndex]

    return (
      <div key={`${r}-${c}`} className="clue">
        {clue != null ? clue : ''}
      </div>
    )
  }

  const rows = []
  for (let r = 0; r < grid.height * 2 + 1; r += 1) {
    for (let c = 0; c < grid.width * 2 + 1; c += 1) {
      rows.push(renderCell(r, c))
    }
  }

  return (
    <div
      className="slitherlink-board"
      style={{ gridTemplateColumns: columnTemplate, gridTemplateRows: rowTemplate }}
    >
      {rows}
    </div>
  )
}

export default SlitherlinkBoard

