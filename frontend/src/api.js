// In dev, Vite's own base ('/') means requests go straight to the proxy
// config below. In the production build (base: '/tablelink/'), requests
// need the '/tablelink/api' prefix that nginx strips before proxying to
// the backend — see the deploy notes in project-spec.md.
const API_BASE = import.meta.env.BASE_URL === '/' ? '' : `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`

function apiUrl(path) {
  return `${API_BASE}${path}`
}

export async function fetchDiscoveredTables() {
  const res = await fetch(apiUrl('/tables/discover'))
  if (!res.ok) {
    throw new Error(`테이블 목록을 불러오지 못했습니다 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchTablePreview(tableName) {
  const res = await fetch(apiUrl(`/tables/${encodeURIComponent(tableName)}/preview`))
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `미리보기 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchColumnDomain(tableName, column) {
  const res = await fetch(
    apiUrl(`/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(column)}/domain`),
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `값 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function buildJoinChain(rootTable, edges, filters = []) {
  const res = await fetch(apiUrl('/joins'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rootTable, edges, filters }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `조인 체인 생성 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function runSegment(rootTable, edges, filters = []) {
  const res = await fetch(apiUrl('/segments'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rootTable, edges, filters }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `세그먼트 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function saveFilterableColumns(tableName, filterableColumns) {
  const res = await fetch(apiUrl(`/tables/${encodeURIComponent(tableName)}/filterable-columns`), {
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
