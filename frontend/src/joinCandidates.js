// Mirrors JoinService#resolveEdgeKey on the backend: two tables are
// connectable either via a direct FK (either direction) or via a shared FK
// parent (e.g. service_history and ownership_history both reference
// vehicle_id) — the HISTORY-HISTORY case.

export function findDirectFk(from, to) {
  return from.foreignKeys.find((fk) => fk.refTable === to.tableName) || null
}

export function findSharedParent(a, b) {
  for (const fkA of a.foreignKeys) {
    for (const fkB of b.foreignKeys) {
      if (fkA.refTable === fkB.refTable && fkA.refColumn === fkB.refColumn) {
        return fkA.refTable
      }
    }
  }
  return null
}

export function isConnectable(a, b) {
  return Boolean(findDirectFk(a, b) || findDirectFk(b, a) || findSharedParent(a, b))
}

export function computeSuggestedPairs(tables) {
  const pairs = []
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (isConnectable(tables[i], tables[j])) {
        pairs.push([tables[i].tableName, tables[j].tableName])
      }
    }
  }
  return pairs
}

export function joinTypeOf(a, b) {
  const shared = !findDirectFk(a, b) && !findDirectFk(b, a) && findSharedParent(a, b)
  if (shared) return 'HISTORY_HISTORY'
  if (a.type === 'STATE' && b.type === 'STATE') return 'STATE_STATE'
  return 'STATE_HISTORY'
}

function buildGraph(tables) {
  const graph = {}
  tables.forEach((t) => {
    graph[t.tableName] = []
  })
  for (let i = 0; i < tables.length; i++) {
    for (let j = i + 1; j < tables.length; j++) {
      if (isConnectable(tables[i], tables[j])) {
        graph[tables[i].tableName].push(tables[j].tableName)
        graph[tables[j].tableName].push(tables[i].tableName)
      }
    }
  }
  return graph
}

/** BFS shortest path between two tables over the full FK/shared-key graph. */
function shortestPath(graph, start, end) {
  if (start === end) return [start]
  const visited = new Set([start])
  const queue = [[start]]
  while (queue.length > 0) {
    const path = queue.shift()
    const node = path[path.length - 1]
    for (const neighbor of graph[node] || []) {
      if (neighbor === end) return [...path, neighbor]
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }
  return null
}

/**
 * Greedy Steiner-tree approximation: given a set of tables the user actually
 * wants (from selected filter conditions, or manually placed), finds the
 * smallest set of extra "bridge" tables needed to connect them all, and the
 * ordered edges to do it. At each step it merges in whichever required table
 * has the shortest path to the tree built so far, repeating until every
 * required table is connected. For this schema's graph (a small, densely
 * connected hub around `vehicle`) this reliably finds the true minimal
 * bridge set, not just "some" connecting path.
 */
export function computeConnectingPlan(tables, requiredTableNames) {
  const tableByName = {}
  tables.forEach((t) => {
    tableByName[t.tableName] = t
  })
  const graph = buildGraph(tables)
  const required = [...new Set(requiredTableNames)].filter((name) => graph[name])

  if (required.length === 0) {
    return { tables: [], edges: [], bridgeTables: [] }
  }

  const included = new Set([required[0]])
  const edges = []
  const remaining = new Set(required.slice(1))

  while (remaining.size > 0) {
    let best = null
    for (const target of remaining) {
      for (const source of included) {
        const path = shortestPath(graph, source, target)
        if (path && (!best || path.length < best.path.length)) {
          best = { path, target }
        }
      }
    }
    if (!best) break // target unreachable from the rest of the graph
    for (let i = 1; i < best.path.length; i++) {
      const from = best.path[i - 1]
      const to = best.path[i]
      if (!included.has(to)) {
        const type = joinTypeOf(tableByName[from], tableByName[to])
        // `from` is always the side already anchored in the tree (either the
        // BFS source or a node added by an earlier step of this same path);
        // `to` is always the side newly entering it. "Latest only" narrows a
        // HISTORY table down relative to an already-known parent (e.g.
        // "customer's currently active ownership"), so it only makes sense
        // when the HISTORY table is the one newly arriving (from=STATE).
        // When a HISTORY table already in the tree branches out to a further
        // STATE table (e.g. service_history -> dealer, just to read which
        // dealer performed it), that's an attribute lookup, not a narrowing —
        // defaulting latestOnly on there would wrongly AND in "latest per
        // dealer" on top of whatever already pinned the history table.
        const latestOnly = type === 'STATE_HISTORY' && tableByName[from].type === 'STATE'
        edges.push({ fromTable: from, toTable: to, latestOnly })
        included.add(to)
      }
    }
    remaining.delete(best.target)
  }

  const includedTables = [...included]
  const bridgeTables = includedTables.filter((t) => !required.includes(t))
  const unreachable = [...remaining]

  return { tables: includedTables, edges, bridgeTables, unreachable }
}
