// In dev, Vite's own base ('/') means requests go straight to the proxy
// config below. In the production build (base: '/tablelink/'), requests
// need the '/tablelink/api' prefix that nginx strips before proxying to
// the backend — see the deploy notes in project-spec.md.
const API_BASE = import.meta.env.BASE_URL === '/' ? '' : `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`

function apiUrl(path) {
  return `${API_BASE}${path}`
}

// Every call needs the session cookie (Spring Security auth) sent along, and
// the app is behind auth entirely — a 401 anywhere means "not logged in",
// which App.jsx treats as a signal to show the login screen rather than an
// error banner.
async function apiFetch(path, options = {}) {
  const res = await fetch(apiUrl(path), { ...options, credentials: 'include' })
  if (res.status === 401) {
    const err = new Error('로그인이 필요합니다.')
    err.unauthorized = true
    throw err
  }
  return res
}

export async function login(username, password) {
  const res = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  })
  if (!res.ok) {
    throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.')
  }
}

export async function logout() {
  await fetch(apiUrl('/auth/logout'), { method: 'POST', credentials: 'include' })
}

/** Returns {username, country}, or null if not logged in. */
export async function fetchCurrentUser() {
  const res = await fetch(apiUrl('/auth/me'), { credentials: 'include' })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`로그인 상태 확인 실패 (HTTP ${res.status})`)
  return res.json()
}

export async function fetchDiscoveredTables() {
  const res = await apiFetch('/tables/discover')
  if (!res.ok) {
    throw new Error(`테이블 목록을 불러오지 못했습니다 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchTablePreview(tableName) {
  const res = await apiFetch(`/tables/${encodeURIComponent(tableName)}/preview`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `미리보기 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function fetchColumnDomain(tableName, column) {
  const res = await apiFetch(
    `/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(column)}/domain`,
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || `값 조회 실패 (HTTP ${res.status})`)
  }
  return res.json()
}

export async function buildJoinChain(rootTable, edges, filters = []) {
  const res = await apiFetch('/joins', {
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
  const res = await apiFetch('/segments', {
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
