import { useCallback, useEffect, useMemo, useState } from 'react'
import SlitherlinkBoard from './components/SlitherlinkBoard.jsx'
import { generatePuzzle } from './logic/slitherlink.js'
import './App.css'

const difficultyOptions = {
  easy: {
    label: 'Easy',
    removalRatio: 0.45,
    minClueRatio: 0.55,
    solverLimit: 45000,
    totalSolverBudget: 90000,
    stallThreshold: 3,
  },
  medium: {
    label: 'Medium',
    removalRatio: 0.63,
    minClueRatio: 0.34,
    solverLimit: 75000,
    totalSolverBudget: 180000,
    stallThreshold: 4,
  },
  hard: {
    label: 'Hard',
    removalRatio: 0.8,
    minClueRatio: 0.25,
    solverLimit: 110000,
    totalSolverBudget: 260000,
    stallThreshold: 5,
  },
}

const clampSize = (value) => {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 4
  const rounded = Math.round(numeric)
  return Math.min(6, Math.max(4, rounded))
}

function App() {
  const [height, setHeight] = useState(5)
  const [width, setWidth] = useState(5)
  const [difficulty, setDifficulty] = useState('medium')
  const [puzzle, setPuzzle] = useState(null)
  const [edgeStates, setEdgeStates] = useState([])
  const [feedback, setFeedback] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const baseCellCount = height * width

  const maxRemovalAttempts = useMemo(() => {
    const ratio = difficultyOptions[difficulty]?.removalRatio ?? 0.6
    const bounded = Math.min(1, Math.max(0, ratio))
    return Math.max(1, Math.floor(baseCellCount * bounded))
  }, [difficulty, baseCellCount])

  const minClues = useMemo(() => {
    const ratio = difficultyOptions[difficulty]?.minClueRatio ?? 0.3
    const bounded = Math.min(0.95, Math.max(0.05, ratio))
    const estimate = Math.ceil(baseCellCount * bounded)
    return Math.max(1, Math.min(baseCellCount - 1, estimate))
  }, [difficulty, baseCellCount])

  const solverLimit = useMemo(
    () => difficultyOptions[difficulty]?.solverLimit ?? 120000,
    [difficulty],
  )

  const totalSolverBudget = useMemo(
    () => difficultyOptions[difficulty]?.totalSolverBudget ?? solverLimit * 3,
    [difficulty, solverLimit],
  )

  const stallThreshold = useMemo(
    () => difficultyOptions[difficulty]?.stallThreshold ?? 4,
    [difficulty],
  )

  const resetBoardState = useCallback((grid) => {
    if (!grid) {
      setEdgeStates([])
      return
    }
    setEdgeStates(new Array(grid.edges.length).fill(0))
  }, [setEdgeStates])

  const generateNewPuzzle = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setFeedback(null)
    setError(null)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const nextPuzzle = generatePuzzle(height, width, {
        maxRemovalAttempts,
        ensureUnique: true,
        minClues,
        maxSolverSteps: solverLimit,
        maxTotalSolverSteps: totalSolverBudget,
        stallThreshold,
      })
      setPuzzle(nextPuzzle)
      resetBoardState(nextPuzzle.grid)
    } catch (err) {
      setError(err.message || 'Failed to build puzzle')
      setPuzzle(null)
      setEdgeStates([])
    } finally {
      setLoading(false)
    }
  }, [height, width, maxRemovalAttempts, minClues, solverLimit, totalSolverBudget, stallThreshold, loading, resetBoardState])

  useEffect(() => {
    generateNewPuzzle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCycleEdge = (edgeId) => {
    if (loading) return
    setEdgeStates((previous) => {
      if (!previous.length || edgeId >= previous.length) return previous
      const next = [...previous]
      const current = next[edgeId]
      let nextValue
      if (current === 1) nextValue = -1
      else if (current === -1) nextValue = 0
      else nextValue = 1
      next[edgeId] = nextValue
      return next
    })
    setFeedback(null)
  }

  const handleSetEdgeState = (edgeId, value) => {
    if (loading) return
    setEdgeStates((previous) => {
      if (!previous.length || edgeId >= previous.length) return previous
      const next = [...previous]
      next[edgeId] = value
      return next
    })
    setFeedback(null)
  }

  const handleResetBoard = () => {
    if (!puzzle || loading) return
    resetBoardState(puzzle.grid)
    setFeedback(null)
  }

  const handleRevealSolution = () => {
    if (!puzzle) return
    setEdgeStates([...puzzle.solutionEdgeStates])
    setFeedback({ status: 'revealed', message: 'Solution revealed.', wrong: new Set(), missing: new Set() })
  }

  const handleCheckSolution = () => {
    if (!puzzle) return
    const wrong = new Set()
    const missing = new Set()
    const solution = puzzle.solutionEdgeStates

    for (let i = 0; i < solution.length; i += 1) {
      const expected = solution[i]
      const actual = edgeStates[i]
      if (actual === 1 && expected !== 1) {
        wrong.add(i)
      } else if (expected === 1 && actual !== 1) {
        missing.add(i)
      }
    }

    if (wrong.size === 0 && missing.size === 0) {
      setFeedback({ status: 'success', message: 'Perfect loop! 🎉', wrong, missing })
      return
    }

    if (wrong.size === 0 && missing.size > 0) {
      setFeedback({ status: 'incomplete', message: 'The loop is incomplete.', wrong, missing })
      return
    }

    setFeedback({ status: 'error', message: 'Some edges are incorrect.', wrong, missing })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Slitherlink Generator</h1>
        <p>Create a unique puzzle, draw your loop, then check yourself. Left-click edges to cycle line → X → blank. Right-click to place/remove an X fast.</p>
      </header>

      <section className="controls">
        <div className="control-group">
          <label htmlFor="height-input">Rows</label>
          <input
            id="height-input"
            type="number"
            min="4"
            max="6"
            value={height}
            onChange={(event) => setHeight(clampSize(event.target.value))}
          />
        </div>
        <div className="control-group">
          <label htmlFor="width-input">Columns</label>
          <input
            id="width-input"
            type="number"
            min="4"
            max="6"
            value={width}
            onChange={(event) => setWidth(clampSize(event.target.value))}
          />
        </div>
        <div className="control-group">
          <label htmlFor="difficulty-select">Difficulty</label>
          <select
            id="difficulty-select"
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            {Object.entries(difficultyOptions).map(([key, option]) => (
              <option key={key} value={key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="primary" onClick={generateNewPuzzle} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Puzzle'}
        </button>
      </section>

      {error && <div className="status status-error">{error}</div>}
      {loading && !error && (
        <div className="status status-info" role="status" aria-live="polite">
          Building a fresh puzzle. Hang tight!
        </div>
      )}
      {feedback?.message && (
        <div
          className={`status ${
            feedback.status === 'success'
              ? 'status-success'
              : feedback.status === 'error'
                ? 'status-error'
                : 'status-info'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <main>
        <div className="board-shell">
          {puzzle ? (
            <SlitherlinkBoard
              grid={puzzle.grid}
              clues={puzzle.clues}
              edgeStates={edgeStates}
              feedback={feedback}
              onCycleEdge={handleCycleEdge}
              onSetEdgeState={handleSetEdgeState}
              disabled={loading}
            />
          ) : (
            <div className="placeholder" aria-live="polite">
              {loading ? 'Generating a puzzle...' : 'Generate a puzzle to get started.'}
            </div>
          )}
          {loading && (
            <div className="loading-overlay" role="status" aria-live="polite">
              <div className="spinner" />
              <span>Generating puzzle...</span>
            </div>
          )}
        </div>
      </main>

      <section className="actions">
        <button type="button" onClick={handleResetBoard} disabled={!puzzle || loading}>
          Clear Board
        </button>
        <button type="button" onClick={handleCheckSolution} disabled={!puzzle || loading}>
          Check Solution
        </button>
        <button type="button" onClick={handleRevealSolution} disabled={!puzzle || loading}>
          Reveal Solution
        </button>
      </section>

      {puzzle && (
        <footer className="puzzle-meta">
          <p>
            Generated {height}×{width} puzzle with {puzzle.clues.filter((clue) => clue != null).length} clues.
          </p>
        </footer>
      )}
    </div>
  )
}

export default App
