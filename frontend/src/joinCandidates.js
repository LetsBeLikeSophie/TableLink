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
