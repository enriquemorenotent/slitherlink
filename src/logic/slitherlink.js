const createRange = (n) => Array.from({ length: n }, (_, i) => i);

const shuffleInPlace = (array) => {
	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
	return array;
};

export const buildGrid = (height, width) => {
	const vertexIndex = (row, col) => row * (width + 1) + col;
	const cellIndex = (row, col) => row * width + col;

	const vertices = createRange((height + 1) * (width + 1)).map((index) => ({
		index,
		edges: [],
	}));

	const cells = createRange(height * width).map((index) => ({
		index,
		edges: [],
	}));

	const horizontalEdges = Array.from(
		{ length: height + 1 },
		() => new Array(width)
	);
	const verticalEdges = Array.from(
		{ length: height },
		() => new Array(width + 1)
	);

	const edges = [];

	// Horizontal edges
	for (let row = 0; row <= height; row += 1) {
		for (let col = 0; col < width; col += 1) {
			const id = edges.length;
			const v1 = vertexIndex(row, col);
			const v2 = vertexIndex(row, col + 1);
			const cellsTouched = [];
			if (row > 0) cellsTouched.push(cellIndex(row - 1, col));
			if (row < height) cellsTouched.push(cellIndex(row, col));
			edges.push({
				id,
				type: 'H',
				row,
				col,
				vertices: [v1, v2],
				cells: cellsTouched,
			});
			vertices[v1].edges.push(id);
			vertices[v2].edges.push(id);
			cellsTouched.forEach((ci) => {
				cells[ci].edges.push(id);
			});
			horizontalEdges[row][col] = id;
		}
	}

	// Vertical edges
	for (let row = 0; row < height; row += 1) {
		for (let col = 0; col <= width; col += 1) {
			const id = edges.length;
			const v1 = vertexIndex(row, col);
			const v2 = vertexIndex(row + 1, col);
			const cellsTouched = [];
			if (col > 0) cellsTouched.push(cellIndex(row, col - 1));
			if (col < width) cellsTouched.push(cellIndex(row, col));
			edges.push({
				id,
				type: 'V',
				row,
				col,
				vertices: [v1, v2],
				cells: cellsTouched,
			});
			vertices[v1].edges.push(id);
			vertices[v2].edges.push(id);
			cellsTouched.forEach((ci) => {
				cells[ci].edges.push(id);
			});
			verticalEdges[row][col] = id;
		}
	}

	return {
		height,
		width,
		edges,
		vertices,
		cells,
		vertexIndex,
		cellIndex,
		horizontalEdges,
		verticalEdges,
	};
};

const buildAdjacency = (grid) => {
	const adj = grid.vertices.map(() => []);
	grid.edges.forEach((edge) => {
		const [a, b] = edge.vertices;
		adj[a].push({ to: b, edgeId: edge.id });
		adj[b].push({ to: a, edgeId: edge.id });
	});
	return adj;
};

const buildRandomSpanningTree = (grid, adjacency) => {
	const totalVertices = grid.vertices.length;
	const visited = new Array(totalVertices).fill(false);
	const parent = new Array(totalVertices).fill(-1);
	const parentEdge = new Array(totalVertices).fill(-1);

	const stack = [0];
	visited[0] = true;

	while (stack.length) {
		const v = stack.pop();
		const neighbors = shuffleInPlace([...adjacency[v]]);
		neighbors.forEach(({ to, edgeId }) => {
			if (!visited[to]) {
				visited[to] = true;
				parent[to] = v;
				parentEdge[to] = edgeId;
				stack.push(to);
			}
		});
	}

	// Handle disconnected leftovers (should not occur on grid, but safe guard)
	for (let v = 0; v < totalVertices; v += 1) {
		if (!visited[v]) {
			visited[v] = true;
			stack.push(v);
			while (stack.length) {
				const current = stack.pop();
				const neighbors = shuffleInPlace([...adjacency[current]]);
				neighbors.forEach(({ to, edgeId }) => {
					if (!visited[to]) {
						visited[to] = true;
						parent[to] = current;
						parentEdge[to] = edgeId;
						stack.push(to);
					}
				});
			}
		}
	}

	const treeEdgeSet = new Set();
	parentEdge.forEach((edgeId) => {
		if (edgeId >= 0) treeEdgeSet.add(edgeId);
	});

	return { parent, parentEdge, treeEdgeSet };
};

const tracePathEdges = (from, to, parent, parentEdge) => {
	const visited = new Set();
	let current = from;
	while (current !== -1) {
		visited.add(current);
		current = parent[current];
	}

	let lca = to;
	const pathToLca = [];
	while (!visited.has(lca) && lca !== -1) {
		pathToLca.push(lca);
		lca = parent[lca];
	}

	const pathEdges = [];
	current = from;
	while (current !== lca) {
		pathEdges.push(parentEdge[current]);
		current = parent[current];
	}

	for (let i = pathToLca.length - 1; i >= 0; i -= 1) {
		const node = pathToLca[i];
		pathEdges.push(parentEdge[node]);
	}

	return pathEdges.filter((edgeId) => edgeId !== -1);
};

const buildCycleFromTree = (grid, treeInfo) => {
	const allEdges = grid.edges.map((edge) => edge.id);
	const nonTreeEdges = allEdges.filter((id) => !treeInfo.treeEdgeSet.has(id));
	shuffleInPlace(nonTreeEdges);

	for (let i = 0; i < nonTreeEdges.length; i += 1) {
		const extraEdgeId = nonTreeEdges[i];
		const extraEdge = grid.edges[extraEdgeId];
		const [a, b] = extraEdge.vertices;
		const pathEdges = tracePathEdges(
			a,
			b,
			treeInfo.parent,
			treeInfo.parentEdge
		);
		if (pathEdges.length + 1 < 4) {
			continue;
		}
		const cycle = new Set([...pathEdges, extraEdgeId]);
		return cycle;
	}
	return null;
};

export const generateRandomLoop = (grid, maxAttempts = 20) => {
	const adjacency = buildAdjacency(grid);
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const treeInfo = buildRandomSpanningTree(grid, adjacency);
		const cycle = buildCycleFromTree(grid, treeInfo, adjacency);
		if (cycle) return cycle;
	}
	throw new Error('Failed to generate loop');
};

export const computeClues = (grid, loopEdgeIds) => {
	const clues = new Array(grid.cells.length).fill(0);
	loopEdgeIds.forEach((edgeId) => {
		const edge = grid.edges[edgeId];
		edge.cells.forEach((cellId) => {
			clues[cellId] += 1;
		});
	});
	return clues;
};

const prepareSolverStructures = (grid, clues) => {
	const edgeStates = new Array(grid.edges.length).fill(-1);
	const cellStates = grid.cells.map((cell, index) => ({
		clue: clues[index] ?? null,
		onCount: 0,
		remaining: cell.edges.length,
	}));
	const vertexStates = grid.vertices.map((vertex) => ({
		onCount: 0,
		remaining: vertex.edges.length,
	}));

	return { edgeStates, cellStates, vertexStates };
};

const checkVertexConstraints = (vertex) => {
	if (vertex.onCount > 2) return false;
	if (vertex.onCount === 1 && vertex.remaining === 0) return false;
	if (vertex.onCount > 0 && vertex.onCount + vertex.remaining < 2)
		return false;
	return true;
};

const checkCellConstraints = (cell) => {
	if (cell.clue == null) return true;
	if (cell.onCount > cell.clue) return false;
	if (cell.onCount + cell.remaining < cell.clue) return false;
	if (cell.remaining === 0 && cell.onCount !== cell.clue) return false;
	return true;
};

const isSingleLoop = (grid, edgeStates) => {
	const activeEdges = [];
	edgeStates.forEach((state, edgeId) => {
		if (state === 1) activeEdges.push(edgeId);
	});
	if (activeEdges.length === 0) return false;

	const vertexDegrees = grid.vertices.map(() => 0);
	activeEdges.forEach((edgeId) => {
		const edge = grid.edges[edgeId];
		vertexDegrees[edge.vertices[0]] += 1;
		vertexDegrees[edge.vertices[1]] += 1;
	});

	for (let i = 0; i < vertexDegrees.length; i += 1) {
		const degree = vertexDegrees[i];
		if (degree !== 0 && degree !== 2) return false;
	}

	const startEdgeId = activeEdges[0];
	const visitedEdges = new Set();
	const visitedVertices = new Set();
	const stack = [startEdgeId];
	visitedEdges.add(startEdgeId);

	const edgeToEdges = new Map();
	activeEdges.forEach((edgeId) => {
		const edge = grid.edges[edgeId];
		edge.vertices.forEach((vertexId) => {
			if (!edgeToEdges.has(vertexId)) edgeToEdges.set(vertexId, []);
			edgeToEdges.get(vertexId).push(edgeId);
		});
	});

	while (stack.length) {
		const edgeId = stack.pop();
		const edge = grid.edges[edgeId];
		edge.vertices.forEach((vertexId) => {
			visitedVertices.add(vertexId);
			const connectedEdges = edgeToEdges.get(vertexId) || [];
			connectedEdges.forEach((nextEdgeId) => {
				if (!visitedEdges.has(nextEdgeId)) {
					visitedEdges.add(nextEdgeId);
					stack.push(nextEdgeId);
				}
			});
		});
	}

	if (visitedEdges.size !== activeEdges.length) return false;

	const verticesUsed = vertexDegrees.reduce(
		(acc, deg) => acc + (deg > 0 ? 1 : 0),
		0
	);
	if (verticesUsed !== activeEdges.length) return false;

	return true;
};

const chooseNextEdge = (grid, state) => {
	let bestEdge = -1;
	let bestScore = -Infinity;

	for (let edgeId = 0; edgeId < grid.edges.length; edgeId += 1) {
		if (state.edgeStates[edgeId] !== -1) continue;
		const edge = grid.edges[edgeId];
		let score = 0;
		edge.vertices.forEach((vertexId) => {
			const vertex = state.vertexStates[vertexId];
			if (vertex.onCount === 1) score += 5;
			score += 2 - vertex.remaining;
		});
		edge.cells.forEach((cellId) => {
			const cell = state.cellStates[cellId];
			if (cell.clue != null) {
				score += cell.onCount * 3;
				score += 4 - cell.remaining;
			}
		});
		const randomTiebreak = Math.random() * 0.01;
		score += randomTiebreak;
		if (score > bestScore) {
			bestScore = score;
			bestEdge = edgeId;
		}
	}
	return bestEdge;
};

const assignEdge = (grid, state, edgeId, value) => {
	state.edgeStates[edgeId] = value;
	const edge = grid.edges[edgeId];

	edge.vertices.forEach((vertexId) => {
		const vertex = state.vertexStates[vertexId];
		if (value === 1) vertex.onCount += 1;
		vertex.remaining -= 1;
	});

	edge.cells.forEach((cellId) => {
		const cell = state.cellStates[cellId];
		if (value === 1) cell.onCount += 1;
		cell.remaining -= 1;
	});

	for (let i = 0; i < edge.vertices.length; i += 1) {
		const vertex = state.vertexStates[edge.vertices[i]];
		if (!checkVertexConstraints(vertex)) return false;
	}
	for (let i = 0; i < edge.cells.length; i += 1) {
		const cell = state.cellStates[edge.cells[i]];
		if (!checkCellConstraints(cell)) return false;
	}
	return true;
};

const unassignEdge = (grid, state, edgeId, value) => {
	const edge = grid.edges[edgeId];

	edge.vertices.forEach((vertexId) => {
		const vertex = state.vertexStates[vertexId];
		if (value === 1) vertex.onCount -= 1;
		vertex.remaining += 1;
	});

	edge.cells.forEach((cellId) => {
		const cell = state.cellStates[cellId];
		if (value === 1) cell.onCount -= 1;
		cell.remaining += 1;
	});

	state.edgeStates[edgeId] = -1;
};

export const solveSlitherlink = (
	grid,
	clues,
	maxSolutions = 2,
	options = {}
) => {
	const { maxNodeVisits = 150000 } = options;
	const state = prepareSolverStructures(grid, clues);
	const solutions = [];
	let nodesVisited = 0;
	let exhausted = false;

	const dfs = () => {
		if (exhausted || solutions.length >= maxSolutions) return;
		if (nodesVisited >= maxNodeVisits) {
			exhausted = true;
			return;
		}
		nodesVisited += 1;

		const nextEdge = chooseNextEdge(grid, state);
		if (nextEdge === -1) {
			if (isSingleLoop(grid, state.edgeStates)) {
				solutions.push([...state.edgeStates]);
			}
			return;
		}

		// Try assigning 1 first for stronger pruning around high clues
		const order = [1, 0];
		for (let i = 0; i < order.length; i += 1) {
			const value = order[i];
			if (assignEdge(grid, state, nextEdge, value)) {
				dfs();
			}
			unassignEdge(grid, state, nextEdge, value);
			if (exhausted || solutions.length >= maxSolutions) return;
		}
	};

	dfs();

	solutions.exhausted = exhausted;
	solutions.visited = nodesVisited;

	return solutions;
};

const deterministicAssignEdge = (grid, state, edgeId, value) => {
	if (state.edgeStates[edgeId] !== -1) {
		return false;
	}
	return assignEdge(grid, state, edgeId, value);
};

const runDeterministicLogic = (grid, clues) => {
	const state = prepareSolverStructures(grid, clues);
	let progress = true;
	let iterations = 0;
	let assignments = 0;

	const applyCellRules = () => {
		let changed = false;
		for (let cellIndex = 0; cellIndex < grid.cells.length; cellIndex += 1) {
			const cellState = state.cellStates[cellIndex];
			const clue = cellState.clue;
			if (clue == null) continue;
			const edges = grid.cells[cellIndex].edges;
			const unknownEdges = [];
			for (let i = 0; i < edges.length; i += 1) {
				const edgeId = edges[i];
				if (state.edgeStates[edgeId] === -1) unknownEdges.push(edgeId);
			}
			if (unknownEdges.length === 0) continue;
			if (cellState.onCount === clue) {
				for (let i = 0; i < unknownEdges.length; i += 1) {
					if (deterministicAssignEdge(grid, state, unknownEdges[i], 0)) {
						changed = true;
						assignments += 1;
					}
				}
				continue;
			}
			if (cellState.onCount + unknownEdges.length === clue) {
				for (let i = 0; i < unknownEdges.length; i += 1) {
					if (deterministicAssignEdge(grid, state, unknownEdges[i], 1)) {
						changed = true;
						assignments += 1;
					}
				}
			}
		}
		return changed;
	};

	const applyVertexRules = () => {
		let changed = false;
		for (let vertexIndex = 0; vertexIndex < grid.vertices.length; vertexIndex += 1) {
			const vertexState = state.vertexStates[vertexIndex];
			const edges = grid.vertices[vertexIndex].edges;
			const unknownEdges = [];
			for (let i = 0; i < edges.length; i += 1) {
				const edgeId = edges[i];
				if (state.edgeStates[edgeId] === -1) unknownEdges.push(edgeId);
			}
			if (unknownEdges.length === 0) continue;
			if (vertexState.onCount === 2) {
				for (let i = 0; i < unknownEdges.length; i += 1) {
					if (deterministicAssignEdge(grid, state, unknownEdges[i], 0)) {
						changed = true;
						assignments += 1;
					}
				}
				continue;
			}
			const needed = 2 - vertexState.onCount;
			if (needed <= 0) {
				for (let i = 0; i < unknownEdges.length; i += 1) {
					if (deterministicAssignEdge(grid, state, unknownEdges[i], 0)) {
						changed = true;
						assignments += 1;
					}
				}
				continue;
			}
			if (needed === unknownEdges.length) {
				for (let i = 0; i < unknownEdges.length; i += 1) {
					if (deterministicAssignEdge(grid, state, unknownEdges[i], 1)) {
						changed = true;
						assignments += 1;
					}
				}
			}
		}
		return changed;
	};

	while (progress) {
		progress = false;
		const cellProgress = applyCellRules();
		const vertexProgress = applyVertexRules();
		progress = cellProgress || vertexProgress;
		if (progress) iterations += 1;
	}

	const determined = state.edgeStates.reduce(
		(acc, value) => acc + (value !== -1 ? 1 : 0),
		0
	);
	return {
		determinedEdges: determined,
		totalEdges: grid.edges.length,
		iterations,
		assignments,
	};
};

const computeClueStats = (grid, clues) => {
	const stats = {
		total: 0,
		zero: 0,
		one: 0,
		two: 0,
		three: 0,
		nonZero: 0,
		interiorNonZero: 0,
		borderNonZero: 0,
		high: 0,
		interiorHigh: 0,
		borderZero: 0,
		interiorZero: 0,
	};

	for (let cellIndex = 0; cellIndex < grid.cells.length; cellIndex += 1) {
		const clue = clues[cellIndex];
		if (clue == null) continue;
		stats.total += 1;
		switch (clue) {
			case 0:
				stats.zero += 1;
				break;
			case 1:
				stats.one += 1;
				break;
			case 2:
				stats.two += 1;
				break;
			case 3:
				stats.three += 1;
				break;
			default:
				break;
		}
		if (clue > 0) stats.nonZero += 1;
		if (clue >= 2) stats.high += 1;
		const row = Math.floor(cellIndex / grid.width);
		const col = cellIndex % grid.width;
		const isInterior =
			row > 0 &&
			row < grid.height - 1 &&
			col > 0 &&
			col < grid.width - 1;
		if (isInterior) {
			if (clue === 0) stats.interiorZero += 1;
			if (clue > 0) stats.interiorNonZero += 1;
			if (clue >= 2) stats.interiorHigh += 1;
		} else {
			if (clue === 0) stats.borderZero += 1;
			if (clue > 0) stats.borderNonZero += 1;
		}
	}

	return stats;
};

const attemptPuzzleGeneration = (height, width, options) => {
	const {
		maxRemovalAttempts,
		ensureUnique,
		minClues,
		maxSolverSteps,
		maxTotalSolverSteps,
		stallThreshold,
		targetClues,
		minDifficultyVisits = 0,
		maxLogicSolvedFraction = null,
	} = options;

	const grid = buildGrid(height, width);
	const loop = generateRandomLoop(grid);
	const clues = computeClues(grid, loop);
	const puzzleClues = [...clues];
	const clueCountTotal = puzzleClues.reduce(
		(acc, clue) => acc + (clue != null ? 1 : 0),
		0
	);
	const minClueLimit = Math.max(1, Math.min(grid.cells.length - 1, minClues));
	const targetLimit = Math.max(
		minClueLimit,
		Math.min(grid.cells.length - 1, targetClues ?? minClues)
	);
	let clueCount = clueCountTotal;
	let stalls = 0;
	let attempts = 0;
	let solverBudget = Math.max(maxSolverSteps, maxTotalSolverSteps);
	let solverStepsUsed = 0;

	const tryRemoveFactory = () => {
		return (cellId) => {
			if (puzzleClues[cellId] == null) return false;
			const backup = puzzleClues[cellId];
			puzzleClues[cellId] = null;
			const limit = Math.min(maxSolverSteps, solverBudget);
			const solutions = solveSlitherlink(grid, puzzleClues, 2, {
				maxNodeVisits: limit,
			});
			const visited = solutions.visited || 0;
			solverBudget -= visited;
			solverStepsUsed += visited;
			const unique = !solutions.exhausted && solutions.length === 1;
			if (!unique) {
				puzzleClues[cellId] = backup;
				stalls += 1;
				return false;
			}
			clueCount -= 1;
			stalls = 0;
			return true;
		};
	};

	const tryRemove = tryRemoveFactory();

	const buildPrioritizedOrder = () => {
		const groups = [[], [], [], [], []];
		for (let cellId = 0; cellId < puzzleClues.length; cellId += 1) {
			const clue = puzzleClues[cellId];
			if (clue == null) continue;
			const key = clue >= 0 && clue <= 3 ? clue : 4;
			groups[key].push(cellId);
		}
		const order = [];
		for (let value = 0; value <= 4; value += 1) {
			if (groups[value].length === 0) continue;
			shuffleInPlace(groups[value]);
			order.push(...groups[value]);
		}
		return order;
	};

	if (ensureUnique) {

		const effectiveMaxAttempts = Math.max(
			maxRemovalAttempts ?? grid.cells.length,
			grid.cells.length * 6
		);
		const effectiveStallLimit = Math.max(
			stallThreshold ?? 6,
			grid.cells.length * 2
		);

		while (
			clueCount > targetLimit &&
			attempts < effectiveMaxAttempts &&
			solverBudget > 0 &&
			stalls < effectiveStallLimit
		) {
			const pass = buildPrioritizedOrder();
			let removedThisPass = 0;
			for (let i = 0; i < pass.length; i += 1) {
				if (
					clueCount <= targetLimit ||
					attempts >= effectiveMaxAttempts ||
					solverBudget <= 0 ||
					stalls >= effectiveStallLimit
				)
					break;
				if (tryRemove(pass[i])) removedThisPass += 1;
				attempts += 1;
			}
			if (removedThisPass === 0) stalls += 1;
		}
	}

	let finalDifficultyVisits = 0;
	{
		const limit = Math.max(
			maxSolverSteps,
			Math.floor(maxSolverSteps * 1.5)
		);
		const check = solveSlitherlink(grid, puzzleClues, 1, {
			maxNodeVisits: limit,
		});
		finalDifficultyVisits = check.visited || 0;
	}

	if (
		ensureUnique &&
		minDifficultyVisits > 0 &&
		finalDifficultyVisits < minDifficultyVisits
	) {
		const floor = minClueLimit;
		const canToughen = () => clueCount > floor;

		const tryOneMorePass = () => {
			const pass = buildPrioritizedOrder();
			let removed = 0;
			for (let i = 0; i < pass.length; i += 1) {
				if (!canToughen()) break;
				if (solverBudget <= 0) break;
				if (tryRemove(pass[i])) removed += 1;
				attempts += 1;
			}
			return removed;
		};

		while (
			canToughen() &&
			solverBudget > 0 &&
			attempts < (maxRemovalAttempts ?? grid.cells.length) * 10
		) {
			const removed = tryOneMorePass();
			const limit = Math.max(
				maxSolverSteps,
				Math.floor(maxSolverSteps * 1.5)
			);
			const recheck = solveSlitherlink(grid, puzzleClues, 1, {
				maxNodeVisits: limit,
			});
			finalDifficultyVisits = recheck.visited || 0;
			if (removed === 0 || finalDifficultyVisits >= minDifficultyVisits)
				break;
		}
	}

	let logicAnalysisRaw = runDeterministicLogic(grid, puzzleClues);
	if (
		ensureUnique &&
		Number.isFinite(maxLogicSolvedFraction) &&
		maxLogicSolvedFraction >= 0
	) {
		let guard = 0;
		let logicFraction =
			logicAnalysisRaw.totalEdges === 0
				? 0
				: logicAnalysisRaw.determinedEdges / logicAnalysisRaw.totalEdges;
		while (
			logicFraction > maxLogicSolvedFraction &&
			guard < 6 &&
			clueCount > minClueLimit &&
			solverBudget > 0
		) {
			const pass = buildPrioritizedOrder();
			let removed = 0;
			for (let i = 0; i < pass.length; i += 1) {
				if (clueCount <= minClueLimit) break;
				if (solverBudget <= 0) break;
				if (tryRemove(pass[i])) removed += 1;
			}
			if (removed === 0) break;
			logicAnalysisRaw = runDeterministicLogic(grid, puzzleClues);
			logicFraction =
				logicAnalysisRaw.totalEdges === 0
					? 0
					: logicAnalysisRaw.determinedEdges / logicAnalysisRaw.totalEdges;
			guard += 1;
		}
	}

	const logicMetrics = {
		determinedEdges: logicAnalysisRaw.determinedEdges,
		totalEdges: logicAnalysisRaw.totalEdges,
		solvedFraction:
			logicAnalysisRaw.totalEdges === 0
				? 0
				: logicAnalysisRaw.determinedEdges / logicAnalysisRaw.totalEdges,
		iterations: logicAnalysisRaw.iterations,
		assignments: logicAnalysisRaw.assignments,
	};
	const clueStats = computeClueStats(grid, puzzleClues);

	return {
		grid,
		clues: puzzleClues,
		solutionEdges: loop,
		solutionEdgeStates: (() => {
			const states = new Array(grid.edges.length).fill(0);
			loop.forEach((edgeId) => {
				states[edgeId] = 1;
			});
			return states;
		})(),
		fullClues: clues,
		remainingClueCount: clueCount,
		generatorMeta: {
			removalAttempts: attempts,
			stalls,
			solverStepsUsed,
			finalDifficultyVisits,
		},
		difficultyMetrics: {
			logic: logicMetrics,
			clueStats,
		},
	};
};

export const generatePuzzle = (height, width, options = {}) => {
	const {
		maxRemovalAttempts = height * width,
		ensureUnique = true,
		minClues = Math.ceil(height * width * 0.25),
		maxSolverSteps = 150000,
		maxTotalSolverSteps = maxSolverSteps * 4,
		stallThreshold = 6,
		targetClues = minClues,
		minDifficultyVisits = 0,
		maxPuzzleRetries = 1,
		logicSolvedRange = { min: 0, max: 1 },
		minNonZeroClues = 0,
		minInteriorNonZeroClues = 0,
		minHighClues = 0,
		minInteriorHighClues = 0,
		maxZeroClues = Infinity,
		maxBorderZeroClues = Infinity,
	} = options;

	const attempts = Math.max(1, maxPuzzleRetries * 3);
	let bestPuzzle = null;
	let bestScore = Infinity;

	const clampRange = (value, range) => {
		const { min, max } = range;
		const lo = Number.isFinite(min) ? min : -Infinity;
		const hi = Number.isFinite(max) ? max : Infinity;
		if (value < lo) return lo;
		if (value > hi) return hi;
		return value;
	};

	const evaluateScore = (puzzle) => {
		const logicMetrics = puzzle.difficultyMetrics?.logic;
		const clueStats = puzzle.difficultyMetrics?.clueStats;
		const solvedFraction = logicMetrics?.solvedFraction ?? 1;
		const targetFractionMid =
			((logicSolvedRange.min ?? 0) + (logicSolvedRange.max ?? 1)) / 2;
		const clamped = clampRange(solvedFraction, logicSolvedRange);
		const logicPenalty = Math.abs(solvedFraction - clamped);
		const logicMidPenalty = Math.abs(solvedFraction - targetFractionMid);
		const cluePenalty = Math.max(
			0,
			(minNonZeroClues ?? 0) - (clueStats?.nonZero ?? 0)
		);
		const interiorPenalty = Math.max(
			0,
			(minInteriorNonZeroClues ?? 0) - (clueStats?.interiorNonZero ?? 0)
		);
		const highPenalty = Math.max(0, (minHighClues ?? 0) - (clueStats?.high ?? 0));
		const interiorHighPenalty = Math.max(
			0,
			(minInteriorHighClues ?? 0) - (clueStats?.interiorHigh ?? 0)
		);
		const zeroLimit = Number.isFinite(maxZeroClues) ? maxZeroClues : Infinity;
		const borderZeroLimit = Number.isFinite(maxBorderZeroClues)
			? maxBorderZeroClues
			: Infinity;
		const zeroPenalty =
			zeroLimit === Infinity
				? 0
				: Math.max(0, (clueStats?.zero ?? 0) - zeroLimit);
		const borderZeroPenalty =
			borderZeroLimit === Infinity
				? 0
				: Math.max(0, (clueStats?.borderZero ?? 0) - borderZeroLimit);
		const targetPenalty = Math.max(0, puzzle.remainingClueCount - targetClues);
		return (
			logicPenalty * 10 +
			logicMidPenalty * 5 +
			cluePenalty * 2 +
			interiorPenalty * 3 +
			highPenalty * 2 +
			interiorHighPenalty * 3 +
			zeroPenalty * 1.5 +
			borderZeroPenalty * 2 +
			targetPenalty
		);
	};

	for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex += 1) {
		const puzzle = attemptPuzzleGeneration(height, width, {
			maxRemovalAttempts,
			ensureUnique,
			minClues,
			maxSolverSteps,
			maxTotalSolverSteps,
			stallThreshold,
			targetClues,
			minDifficultyVisits,
			maxLogicSolvedFraction: logicSolvedRange.max,
		});

		const logicMetrics = puzzle.difficultyMetrics?.logic;
		const clueStats = puzzle.difficultyMetrics?.clueStats;
		const solvedFraction = logicMetrics?.solvedFraction ?? 1;
		const withinLogicRange =
			solvedFraction >= (logicSolvedRange.min ?? 0) &&
			solvedFraction <= (logicSolvedRange.max ?? 1);
		const meetsClueCounts =
			(clueStats?.nonZero ?? 0) >= (minNonZeroClues ?? 0) &&
			(clueStats?.interiorNonZero ?? 0) >=
				(minInteriorNonZeroClues ?? 0) &&
			(clueStats?.high ?? 0) >= (minHighClues ?? 0) &&
			(clueStats?.interiorHigh ?? 0) >= (minInteriorHighClues ?? 0);
		const meetsZeroLimits =
			(clueStats?.zero ?? 0) <= (maxZeroClues ?? Infinity) &&
			(clueStats?.borderZero ?? 0) <= (maxBorderZeroClues ?? Infinity);

		const puzzleScore = evaluateScore(puzzle);

		if (!bestPuzzle || puzzleScore < bestScore) {
			bestPuzzle = puzzle;
			bestScore = puzzleScore;
		}

		if (
			puzzle.remainingClueCount <= targetClues &&
			(puzzle.generatorMeta?.finalDifficultyVisits || 0) >=
				minDifficultyVisits &&
			withinLogicRange &&
			meetsClueCounts &&
			meetsZeroLimits
		) {
			return puzzle;
		}
	}

	return bestPuzzle;
};
