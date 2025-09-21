const createRange = (n) => Array.from({ length: n }, (_, i) => i)

const shuffleInPlace = (array) => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}

export const buildGrid = (height, width) => {
  const vertexIndex = (row, col) => row * (width + 1) + col
  const cellIndex = (row, col) => row * width + col

  const vertices = createRange((height + 1) * (width + 1)).map((index) => ({
    index,
    edges: [],
  }))

  const cells = createRange(height * width).map((index) => ({
    index,
    edges: [],
  }))

  const horizontalEdges = Array.from({ length: height + 1 }, () => new Array(width))
  const verticalEdges = Array.from({ length: height }, () => new Array(width + 1))

  const edges = []

  // Horizontal edges
  for (let row = 0; row <= height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const id = edges.length
      const v1 = vertexIndex(row, col)
      const v2 = vertexIndex(row, col + 1)
      const cellsTouched = []
      if (row > 0) cellsTouched.push(cellIndex(row - 1, col))
      if (row < height) cellsTouched.push(cellIndex(row, col))
      edges.push({
        id,
        type: 'H',
        row,
        col,
        vertices: [v1, v2],
        cells: cellsTouched,
      })
      vertices[v1].edges.push(id)
      vertices[v2].edges.push(id)
      cellsTouched.forEach((ci) => {
        cells[ci].edges.push(id)
      })
      horizontalEdges[row][col] = id
    }
  }

  // Vertical edges
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col <= width; col += 1) {
      const id = edges.length
      const v1 = vertexIndex(row, col)
      const v2 = vertexIndex(row + 1, col)
      const cellsTouched = []
      if (col > 0) cellsTouched.push(cellIndex(row, col - 1))
      if (col < width) cellsTouched.push(cellIndex(row, col))
      edges.push({
        id,
        type: 'V',
        row,
        col,
        vertices: [v1, v2],
        cells: cellsTouched,
      })
      vertices[v1].edges.push(id)
      vertices[v2].edges.push(id)
      cellsTouched.forEach((ci) => {
        cells[ci].edges.push(id)
      })
      verticalEdges[row][col] = id
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
  }
}

const buildAdjacency = (grid) => {
  const adj = grid.vertices.map(() => [])
  grid.edges.forEach((edge) => {
    const [a, b] = edge.vertices
    adj[a].push({ to: b, edgeId: edge.id })
    adj[b].push({ to: a, edgeId: edge.id })
  })
  return adj
}

const buildRandomSpanningTree = (grid, adjacency) => {
  const totalVertices = grid.vertices.length
  const visited = new Array(totalVertices).fill(false)
  const parent = new Array(totalVertices).fill(-1)
  const parentEdge = new Array(totalVertices).fill(-1)

  const stack = [0]
  visited[0] = true

  while (stack.length) {
    const v = stack.pop()
    const neighbors = shuffleInPlace([...adjacency[v]])
    neighbors.forEach(({ to, edgeId }) => {
      if (!visited[to]) {
        visited[to] = true
        parent[to] = v
        parentEdge[to] = edgeId
        stack.push(to)
      }
    })
  }

  // Handle disconnected leftovers (should not occur on grid, but safe guard)
  for (let v = 0; v < totalVertices; v += 1) {
    if (!visited[v]) {
      visited[v] = true
      stack.push(v)
      while (stack.length) {
        const current = stack.pop()
        const neighbors = shuffleInPlace([...adjacency[current]])
        neighbors.forEach(({ to, edgeId }) => {
          if (!visited[to]) {
            visited[to] = true
            parent[to] = current
            parentEdge[to] = edgeId
            stack.push(to)
          }
        })
      }
    }
  }

  const treeEdgeSet = new Set()
  parentEdge.forEach((edgeId) => {
    if (edgeId >= 0) treeEdgeSet.add(edgeId)
  })

  return { parent, parentEdge, treeEdgeSet }
}

const tracePathEdges = (from, to, parent, parentEdge) => {
  const visited = new Set()
  let current = from
  while (current !== -1) {
    visited.add(current)
    current = parent[current]
  }

  let lca = to
  const pathToLca = []
  while (!visited.has(lca) && lca !== -1) {
    pathToLca.push(lca)
    lca = parent[lca]
  }

  const pathEdges = []
  current = from
  while (current !== lca) {
    pathEdges.push(parentEdge[current])
    current = parent[current]
  }

  for (let i = pathToLca.length - 1; i >= 0; i -= 1) {
    const node = pathToLca[i]
    pathEdges.push(parentEdge[node])
  }

  return pathEdges.filter((edgeId) => edgeId !== -1)
}

const buildCycleFromTree = (grid, treeInfo, adjacency) => {
  const allEdges = grid.edges.map((edge) => edge.id)
  const nonTreeEdges = allEdges.filter((id) => !treeInfo.treeEdgeSet.has(id))
  shuffleInPlace(nonTreeEdges)

  for (let i = 0; i < nonTreeEdges.length; i += 1) {
    const extraEdgeId = nonTreeEdges[i]
    const extraEdge = grid.edges[extraEdgeId]
    const [a, b] = extraEdge.vertices
    const pathEdges = tracePathEdges(a, b, treeInfo.parent, treeInfo.parentEdge)
    if (pathEdges.length + 1 < 4) {
      continue
    }
    const cycle = new Set([...pathEdges, extraEdgeId])
    return cycle
  }
  return null
}

export const generateRandomLoop = (grid, maxAttempts = 20) => {
  const adjacency = buildAdjacency(grid)
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const treeInfo = buildRandomSpanningTree(grid, adjacency)
    const cycle = buildCycleFromTree(grid, treeInfo, adjacency)
    if (cycle) return cycle
  }
  throw new Error('Failed to generate loop')
}

export const computeClues = (grid, loopEdgeIds) => {
  const clues = new Array(grid.cells.length).fill(0)
  loopEdgeIds.forEach((edgeId) => {
    const edge = grid.edges[edgeId]
    edge.cells.forEach((cellId) => {
      clues[cellId] += 1
    })
  })
  return clues
}

const prepareSolverStructures = (grid, clues) => {
  const edgeStates = new Array(grid.edges.length).fill(-1)
  const cellStates = grid.cells.map((cell, index) => ({
    clue: clues[index] ?? null,
    onCount: 0,
    remaining: cell.edges.length,
  }))
  const vertexStates = grid.vertices.map((vertex) => ({
    onCount: 0,
    remaining: vertex.edges.length,
  }))

  return { edgeStates, cellStates, vertexStates }
}

const checkVertexConstraints = (vertex) => {
  if (vertex.onCount > 2) return false
  if (vertex.onCount === 1 && vertex.remaining === 0) return false
  if (vertex.onCount > 0 && vertex.onCount + vertex.remaining < 2) return false
  return true
}

const checkCellConstraints = (cell) => {
  if (cell.clue == null) return true
  if (cell.onCount > cell.clue) return false
  if (cell.onCount + cell.remaining < cell.clue) return false
  if (cell.remaining === 0 && cell.onCount !== cell.clue) return false
  return true
}

const isSingleLoop = (grid, edgeStates) => {
  const activeEdges = []
  edgeStates.forEach((state, edgeId) => {
    if (state === 1) activeEdges.push(edgeId)
  })
  if (activeEdges.length === 0) return false

  const vertexDegrees = grid.vertices.map(() => 0)
  activeEdges.forEach((edgeId) => {
    const edge = grid.edges[edgeId]
    vertexDegrees[edge.vertices[0]] += 1
    vertexDegrees[edge.vertices[1]] += 1
  })

  for (let i = 0; i < vertexDegrees.length; i += 1) {
    const degree = vertexDegrees[i]
    if (degree !== 0 && degree !== 2) return false
  }

  const startEdgeId = activeEdges[0]
  const visitedEdges = new Set()
  const visitedVertices = new Set()
  const stack = [startEdgeId]
  visitedEdges.add(startEdgeId)

  const edgeToEdges = new Map()
  activeEdges.forEach((edgeId) => {
    const edge = grid.edges[edgeId]
    edge.vertices.forEach((vertexId) => {
      if (!edgeToEdges.has(vertexId)) edgeToEdges.set(vertexId, [])
      edgeToEdges.get(vertexId).push(edgeId)
    })
  })

  while (stack.length) {
    const edgeId = stack.pop()
    const edge = grid.edges[edgeId]
    edge.vertices.forEach((vertexId) => {
      visitedVertices.add(vertexId)
      const connectedEdges = edgeToEdges.get(vertexId) || []
      connectedEdges.forEach((nextEdgeId) => {
        if (!visitedEdges.has(nextEdgeId)) {
          visitedEdges.add(nextEdgeId)
          stack.push(nextEdgeId)
        }
      })
    })
  }

  if (visitedEdges.size !== activeEdges.length) return false

  const verticesUsed = vertexDegrees.reduce((acc, deg) => acc + (deg > 0 ? 1 : 0), 0)
  if (verticesUsed !== activeEdges.length) return false

  return true
}

const chooseNextEdge = (grid, state) => {
  let bestEdge = -1
  let bestScore = -Infinity

  for (let edgeId = 0; edgeId < grid.edges.length; edgeId += 1) {
    if (state.edgeStates[edgeId] !== -1) continue
    const edge = grid.edges[edgeId]
    let score = 0
    edge.vertices.forEach((vertexId) => {
      const vertex = state.vertexStates[vertexId]
      if (vertex.onCount === 1) score += 5
      score += 2 - vertex.remaining
    })
    edge.cells.forEach((cellId) => {
      const cell = state.cellStates[cellId]
      if (cell.clue != null) {
        score += (cell.onCount * 3)
        score += 4 - cell.remaining
      }
    })
    const randomTiebreak = Math.random() * 0.01
    score += randomTiebreak
    if (score > bestScore) {
      bestScore = score
      bestEdge = edgeId
    }
  }
  return bestEdge
}

const assignEdge = (grid, state, edgeId, value) => {
  state.edgeStates[edgeId] = value
  const edge = grid.edges[edgeId]

  edge.vertices.forEach((vertexId) => {
    const vertex = state.vertexStates[vertexId]
    if (value === 1) vertex.onCount += 1
    vertex.remaining -= 1
  })

  edge.cells.forEach((cellId) => {
    const cell = state.cellStates[cellId]
    if (value === 1) cell.onCount += 1
    cell.remaining -= 1
  })

  for (let i = 0; i < edge.vertices.length; i += 1) {
    const vertex = state.vertexStates[edge.vertices[i]]
    if (!checkVertexConstraints(vertex)) return false
  }
  for (let i = 0; i < edge.cells.length; i += 1) {
    const cell = state.cellStates[edge.cells[i]]
    if (!checkCellConstraints(cell)) return false
  }
  return true
}

const unassignEdge = (grid, state, edgeId, value) => {
  const edge = grid.edges[edgeId]

  edge.vertices.forEach((vertexId) => {
    const vertex = state.vertexStates[vertexId]
    if (value === 1) vertex.onCount -= 1
    vertex.remaining += 1
  })

  edge.cells.forEach((cellId) => {
    const cell = state.cellStates[cellId]
    if (value === 1) cell.onCount -= 1
    cell.remaining += 1
  })

  state.edgeStates[edgeId] = -1
}

export const solveSlitherlink = (grid, clues, maxSolutions = 2) => {
  const state = prepareSolverStructures(grid, clues)
  const solutions = []

  const dfs = () => {
    if (solutions.length >= maxSolutions) return
    const nextEdge = chooseNextEdge(grid, state)
    if (nextEdge === -1) {
      if (isSingleLoop(grid, state.edgeStates)) {
        solutions.push([...state.edgeStates])
      }
      return
    }

    // Try assigning 1 first for stronger pruning around high clues
    const order = [1, 0]
    for (let i = 0; i < order.length; i += 1) {
      const value = order[i]
      if (assignEdge(grid, state, nextEdge, value)) {
        dfs()
      }
      unassignEdge(grid, state, nextEdge, value)
      if (solutions.length >= maxSolutions) return
    }
  }

  dfs()

  return solutions
}

export const generatePuzzle = (height, width, options = {}) => {
  const { maxRemovalAttempts = height * width, ensureUnique = true } = options
  const grid = buildGrid(height, width)
  const loop = generateRandomLoop(grid)
  const clues = computeClues(grid, loop)
  const puzzleClues = [...clues]

  if (ensureUnique) {
    const cellsOrder = shuffleInPlace(createRange(grid.cells.length))
    let attempts = 0
    for (let i = 0; i < cellsOrder.length; i += 1) {
      if (attempts >= maxRemovalAttempts) break
      const cellId = cellsOrder[i]
      if (puzzleClues[cellId] == null) continue
      const backup = puzzleClues[cellId]
      puzzleClues[cellId] = null
      const solutions = solveSlitherlink(grid, puzzleClues, 2)
      if (solutions.length !== 1) {
        puzzleClues[cellId] = backup
      }
      attempts += 1
    }
  }

  return {
    grid,
    clues: puzzleClues,
    solutionEdges: loop,
    solutionEdgeStates: (() => {
      const states = new Array(grid.edges.length).fill(0)
      loop.forEach((edgeId) => {
        states[edgeId] = 1
      })
      return states
    })(),
    fullClues: clues,
  }
}

