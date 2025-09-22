import { useCallback, useEffect, useMemo, useState } from 'react';
import SlitherlinkBoard from './components/SlitherlinkBoard.jsx';
import { generatePuzzle } from './logic/slitherlink.js';
import './App.css';

const difficultyOptions = {
	easy: {
		label: 'Easy',
		removalRatio: 0.4,
		minClueRatio: 0.68,
		targetClueRatio: 0.7,
		solverLimit: 35000,
		totalSolverBudget: 90000,
		stallThreshold: 2,
		maxPuzzleRetries: 1,
		minDifficultyVisits: 1500,
		minNonZeroRatio: 0.18,
		minInteriorNonZeroRatio: 0.08,
		minHighRatio: 0.08,
		minInteriorHighRatio: 0.04,
		maxZeroRatio: 0.5,
		maxBorderZeroRatio: 0.55,
		logicRange: { min: 0.6, max: 1 },
	},
	medium: {
		label: 'Medium',
		removalRatio: 0.58,
		minClueRatio: 0.42,
		targetClueRatio: 0.38,
		solverLimit: 90000,
		totalSolverBudget: 220000,
		stallThreshold: 4,
		maxPuzzleRetries: 3,
		minDifficultyVisits: 15000,
		minNonZeroRatio: 0.34,
		minInteriorNonZeroRatio: 0.18,
		minHighRatio: 0.18,
		minInteriorHighRatio: 0.12,
		maxZeroRatio: 0.32,
		maxBorderZeroRatio: 0.4,
		logicRange: { min: 0.35, max: 0.65 },
	},
	hard: {
		label: 'Hard',
		removalRatio: 0.86,
		minClueRatio: 0.22,
		targetClueRatio: 0.2,
		solverLimit: 90000,
		totalSolverBudget: 240000,
		stallThreshold: 5,
		maxPuzzleRetries: 10,
		minDifficultyVisits: 25000,
		minNonZeroRatio: 0.46,
		minInteriorNonZeroRatio: 0.26,
		minHighRatio: 0.28,
		minInteriorHighRatio: 0.2,
		maxZeroRatio: 0.22,
		maxBorderZeroRatio: 0.3,
		logicRange: { min: 0, max: 0.35 },
	},
};

const clampSize = (value) => {
	const numeric = Number(value);
	if (Number.isNaN(numeric)) return 4;
	const rounded = Math.round(numeric);
	return Math.min(15, Math.max(4, rounded));
};

function App() {
	const [height, setHeight] = useState(5);
	const [width, setWidth] = useState(5);
	const [difficulty, setDifficulty] = useState('medium');
	const [puzzle, setPuzzle] = useState(null);
	const [edgeStates, setEdgeStates] = useState([]);
	const [feedback, setFeedback] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);

	const baseCellCount = height * width;
	const scaleFrom5x5 = Math.max(1, baseCellCount / 25); // 5×5 is baseline
	const clampNum = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

	const maxRemovalAttempts = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.removalRatio ?? 0.6;
		const bounded = Math.min(1, Math.max(0, ratio));
		return Math.max(1, Math.floor(baseCellCount * bounded));
	}, [difficulty, baseCellCount]);

	const minClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.minClueRatio ?? 0.3;
		const bounded = Math.min(0.95, Math.max(0.05, ratio));
		const estimate = Math.ceil(baseCellCount * bounded);
		return Math.max(1, Math.min(baseCellCount - 1, estimate));
	}, [difficulty, baseCellCount]);

	const targetClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.targetClueRatio ?? null;
		if (ratio == null) return minClues;
		const bounded = Math.min(0.95, Math.max(0.05, ratio));
		const estimate = Math.ceil(baseCellCount * bounded);
		return Math.max(minClues, Math.min(baseCellCount - 1, estimate));
	}, [difficulty, baseCellCount, minClues]);

	const minNonZeroClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.minNonZeroRatio ?? 0;
		const estimate = Math.round(baseCellCount * ratio);
		return Math.max(0, estimate);
	}, [difficulty, baseCellCount]);

	const minInteriorNonZeroClues = useMemo(() => {
		const ratio =
			difficultyOptions[difficulty]?.minInteriorNonZeroRatio ?? 0;
		const interiorCells = Math.max(0, (height - 2) * (width - 2));
		const estimate = Math.round(interiorCells * ratio);
		return Math.max(0, estimate);
	}, [difficulty, height, width]);

	const minHighClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.minHighRatio ?? 0;
		const estimate = Math.round(baseCellCount * ratio);
		return Math.max(0, estimate);
	}, [difficulty, baseCellCount]);

	const minInteriorHighClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.minInteriorHighRatio ?? 0;
		const interiorCells = Math.max(0, (height - 2) * (width - 2));
		const estimate = Math.round(interiorCells * ratio);
		return Math.max(0, estimate);
	}, [difficulty, height, width]);

	const maxZeroClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.maxZeroRatio ?? null;
		if (ratio == null) return Number.POSITIVE_INFINITY;
		return Math.max(0, Math.floor(baseCellCount * ratio));
	}, [difficulty, baseCellCount]);

	const maxBorderZeroClues = useMemo(() => {
		const ratio = difficultyOptions[difficulty]?.maxBorderZeroRatio ?? null;
		if (ratio == null) return Number.POSITIVE_INFINITY;
		const interiorCells = Math.max(0, (height - 2) * (width - 2));
		const borderCells = Math.max(0, baseCellCount - interiorCells);
		return Math.max(0, Math.floor(borderCells * ratio));
	}, [difficulty, baseCellCount, height, width]);

	const logicRange = useMemo(
		() => difficultyOptions[difficulty]?.logicRange ?? { min: 0, max: 1 },
		[difficulty]
	);

	// Base budgets from difficulty
	const baseSolverLimit = useMemo(
		() => difficultyOptions[difficulty]?.solverLimit ?? 120000,
		[difficulty]
	);
	const baseTotalSolverBudget = useMemo(
		() =>
			difficultyOptions[difficulty]?.totalSolverBudget ??
			baseSolverLimit * 3,
		[difficulty, baseSolverLimit]
	);
	const stallThreshold = useMemo(
		() => difficultyOptions[difficulty]?.stallThreshold ?? 4,
		[difficulty]
	);
	const maxPuzzleRetries = useMemo(
		() => difficultyOptions[difficulty]?.maxPuzzleRetries ?? 1,
		[difficulty]
	);
	const minDifficultyVisitsBase = useMemo(
		() => difficultyOptions[difficulty]?.minDifficultyVisits ?? 0,
		[difficulty]
	);

	// Scale budgets with board size (gentle caps to avoid browser lockups)
	const solverLimit = useMemo(
		() =>
			Math.floor(
				clampNum(
					baseSolverLimit * scaleFrom5x5,
					baseSolverLimit,
					2_000_000
				)
			),
		[baseSolverLimit, scaleFrom5x5]
	);
	const totalSolverBudget = useMemo(
		() =>
			Math.floor(
				clampNum(
					baseTotalSolverBudget * scaleFrom5x5,
					baseTotalSolverBudget,
					6_000_000
				)
			),
		[baseTotalSolverBudget, scaleFrom5x5]
	);
	// Difficulty floor scales sublinearly so 15×15 doesn’t become impossible
	const minDifficultyVisits = useMemo(
		() => Math.floor(minDifficultyVisitsBase * Math.sqrt(scaleFrom5x5)),
		[minDifficultyVisitsBase, scaleFrom5x5]
	);

	const resetBoardState = useCallback(
		(grid) => {
			if (!grid) {
				setEdgeStates([]);
				return;
			}
			setEdgeStates(new Array(grid.edges.length).fill(0));
		},
		[setEdgeStates]
	);

	const generateNewPuzzle = useCallback(async () => {
		if (loading) return;
		setLoading(true);
		setFeedback(null);
		setError(null);
		try {
			await new Promise((resolve) => setTimeout(resolve, 0));
			const nextPuzzle = generatePuzzle(height, width, {
				maxRemovalAttempts,
				ensureUnique: true,
				minClues,
				maxSolverSteps: solverLimit,
				maxTotalSolverSteps: totalSolverBudget,
				stallThreshold,
				targetClues,
				maxPuzzleRetries,
				minDifficultyVisits,
				minNonZeroClues,
				minInteriorNonZeroClues,
				minHighClues,
				minInteriorHighClues,
				maxZeroClues,
				maxBorderZeroClues,
				logicSolvedRange: logicRange,
			});
			setPuzzle(nextPuzzle);
			resetBoardState(nextPuzzle.grid);
		} catch (err) {
			setError(err.message || 'Failed to build puzzle');
			setPuzzle(null);
			setEdgeStates([]);
		} finally {
			setLoading(false);
		}
	}, [
		height,
		width,
		maxRemovalAttempts,
		minClues,
		targetClues,
		solverLimit,
		totalSolverBudget,
		stallThreshold,
		maxPuzzleRetries,
		minDifficultyVisits,
		minNonZeroClues,
		minInteriorNonZeroClues,
		minHighClues,
		minInteriorHighClues,
		maxZeroClues,
		maxBorderZeroClues,
		logicRange,
		loading,
		resetBoardState,
	]);

	useEffect(() => {
		generateNewPuzzle();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleCycleEdge = (edgeId) => {
		if (loading) return;
		setEdgeStates((previous) => {
			if (!previous.length || edgeId >= previous.length) return previous;
			const next = [...previous];
			const current = next[edgeId];
			let nextValue;
			if (current === 1) nextValue = -1;
			else if (current === -1) nextValue = 0;
			else nextValue = 1;
			next[edgeId] = nextValue;
			return next;
		});
		setFeedback(null);
	};

	const handleSetEdgeState = (edgeId, value) => {
		if (loading) return;
		setEdgeStates((previous) => {
			if (!previous.length || edgeId >= previous.length) return previous;
			const next = [...previous];
			next[edgeId] = value;
			return next;
		});
		setFeedback(null);
	};

	const handleResetBoard = () => {
		if (!puzzle || loading) return;
		resetBoardState(puzzle.grid);
		setFeedback(null);
	};

	const handleRevealSolution = () => {
		if (!puzzle) return;
		setEdgeStates([...puzzle.solutionEdgeStates]);
		setFeedback({
			status: 'revealed',
			message: 'Solution revealed.',
			wrong: new Set(),
			missing: new Set(),
		});
	};

	const handleCheckSolution = () => {
		if (!puzzle) return;
		const wrong = new Set();
		const missing = new Set();
		const solution = puzzle.solutionEdgeStates;

		for (let i = 0; i < solution.length; i += 1) {
			const expected = solution[i];
			const actual = edgeStates[i];
			if (actual === 1 && expected !== 1) {
				wrong.add(i);
			} else if (expected === 1 && actual !== 1) {
				missing.add(i);
			}
		}

		if (wrong.size === 0 && missing.size === 0) {
			setFeedback({
				status: 'success',
				message: 'Perfect loop! 🎉',
				wrong,
				missing,
			});
			return;
		}

		if (wrong.size === 0 && missing.size > 0) {
			setFeedback({
				status: 'incomplete',
				message: 'The loop is incomplete.',
				wrong,
				missing,
			});
			return;
		}

		setFeedback({
			status: 'error',
			message: 'Some edges are incorrect.',
			wrong,
			missing,
		});
	};

	return (
		<div className="app">
			<header className="app-header">
				<h1>Slitherlink Generator</h1>
				<p>
					Create a unique puzzle, draw your loop, then check yourself.
					Left-click edges to cycle line → X → blank. Right-click to
					place/remove an X fast.
				</p>
			</header>

			<section className="controls">
				<div className="control-group">
					<label htmlFor="height-input">Rows</label>
					<input
						id="height-input"
						type="number"
						min="4"
						max="15"
						value={height}
						onChange={(event) =>
							setHeight(clampSize(event.target.value))
						}
					/>
				</div>
				<div className="control-group">
					<label htmlFor="width-input">Columns</label>
					<input
						id="width-input"
						type="number"
						min="4"
						max="15"
						value={width}
						onChange={(event) =>
							setWidth(clampSize(event.target.value))
						}
					/>
				</div>
				<div className="control-group">
					<label htmlFor="difficulty-select">Difficulty</label>
					<select
						id="difficulty-select"
						value={difficulty}
						onChange={(event) => setDifficulty(event.target.value)}
					>
						{Object.entries(difficultyOptions).map(
							([key, option]) => (
								<option key={key} value={key}>
									{option.label}
								</option>
							)
						)}
					</select>
				</div>
				<button
					type="button"
					className="primary"
					onClick={generateNewPuzzle}
					disabled={loading}
				>
					{loading ? 'Generating...' : 'Generate Puzzle'}
				</button>
			</section>

			{error && <div className="status status-error">{error}</div>}
			{loading && !error && (
				<div
					className="status status-info"
					role="status"
					aria-live="polite"
				>
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
							{loading
								? 'Generating a puzzle...'
								: 'Generate a puzzle to get started.'}
						</div>
					)}
					{loading && (
						<div
							className="loading-overlay"
							role="status"
							aria-live="polite"
						>
							<div className="spinner" />
							<span>Generating puzzle...</span>
						</div>
					)}
				</div>
			</main>

			<section className="actions">
				<button
					type="button"
					onClick={handleResetBoard}
					disabled={!puzzle || loading}
				>
					Clear Board
				</button>
				<button
					type="button"
					onClick={handleCheckSolution}
					disabled={!puzzle || loading}
				>
					Check Solution
				</button>
				<button
					type="button"
					onClick={handleRevealSolution}
					disabled={!puzzle || loading}
				>
					Reveal Solution
				</button>
			</section>

			{puzzle && (
				<footer className="puzzle-meta">
					<p>
						Generated {height}×{width} puzzle with{' '}
						{puzzle.remainingClueCount ??
							puzzle.clues.filter((clue) => clue != null)
								.length}{' '}
						clues remaining.
					</p>
					{puzzle.generatorMeta && (
						<p className="puzzle-meta-secondary">
							Solver explored ~
							{puzzle.generatorMeta.solverStepsUsed ?? 0} branches
							across {puzzle.generatorMeta.removalAttempts ?? 0}{' '}
							removals. Difficulty visits:{' '}
							{puzzle.generatorMeta.finalDifficultyVisits ?? 0}.
						</p>
					)}
					{puzzle.difficultyMetrics && (
						<p className="puzzle-meta-secondary">
							Logic pass settled{' '}
							{Math.round(
								(puzzle.difficultyMetrics.logic?.solvedFraction ?? 0) * 100
							)}
							% of edges in {puzzle.difficultyMetrics.logic?.iterations ?? 0}
								passes. Non-zero clues:{' '}
							{puzzle.difficultyMetrics.clueStats?.nonZero ?? 0} (interior{' '}
							{puzzle.difficultyMetrics.clueStats?.interiorNonZero ?? 0}). High clues ≥2:{' '}
							{puzzle.difficultyMetrics.clueStats?.high ?? 0} (interior{' '}
							{puzzle.difficultyMetrics.clueStats?.interiorHigh ?? 0}). Zero clues:{' '}
							{puzzle.difficultyMetrics.clueStats?.zero ?? 0} (border{' '}
							{puzzle.difficultyMetrics.clueStats?.borderZero ?? 0}).
						</p>
					)}
				</footer>
			)}
		</div>
	);
}

export default App;
