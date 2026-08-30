export async function fetchDiscoveredTables() {
  const res = await fetch('/tables/discover')
  if (!res.ok) {
    throw new Error(`테이블 목록을 불러오지 못했습니다 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchTablePreview(tableName) {
  const res = await fetch(`/tables/${encodeURIComponent(tableName)}/preview`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `미리보기 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchColumnDomain(tableName, column) {
  const res = await fetch(`/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(column)}/domain`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `값 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function buildJoinChain(edges) {
  const res = await fetch('/joins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ edges }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `조인 체인 생성 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function saveFilterableColumns(tableName, filterableColumns) {
  const res = await fetch(`/tables/${encodeURIComponent(tableName)}/filterable-columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterableColumns }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `저장 실패 (HTTP ${res.status})`)
  }
  return res.json()
}
