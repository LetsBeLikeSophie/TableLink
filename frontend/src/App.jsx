import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { fetchDiscoveredTables, fetchColumnDomain, fetchCurrentUser, logout } from './api'
import FieldConditionStep, { OPERATORS_BY_VALUE_TYPE } from './FieldConditionStep'
import JoinGraphStep from './JoinGraphStep'
import DataPreviewTable from './DataPreviewTable'
import ColumnFilterPopover from './ColumnFilterPopover'
import ResultsStep from './ResultsStep'
import LoginScreen from './LoginScreen'

const STEPS = ['조건 선택', '결과']

function fieldKey(tableName, column) {
  return `${tableName}.${column}`
}

function DataPreviewBar({ preview, filterableColumns, selectedColumns, openColumn, onColumnClick, highlight }) {
  return (
    <div className={`data-preview-bar ${highlight ? 'onboarding-glow' : ''}`}>
      <h3>{preview?.title ? `데이터 미리보기 · ${preview.title}` : '데이터 미리보기'}</h3>
      <div className="data-preview-bar-body">
        {!preview && <div className="empty-box">조건을 담아 테이블이 연결되면 표시됩니다.</div>}
        {preview?.loading && <div className="empty-box">불러오는 중...</div>}
        {preview?.error && <div className="error-banner">{preview.error}</div>}
        {preview && !preview.loading && !preview.error && preview.columns && (
          <>
            <p className="data-preview-hint">
              컬럼 이름을 클릭하면 그 자리에서 필터 조건을 설정할 수 있어요 (필터 가능한 컬럼만).
            </p>
            <DataPreviewTable
              columns={preview.columns}
              rows={preview.rows}
              selectedColumns={selectedColumns}
              clickableColumns={filterableColumns}
              openColumn={openColumn}
              onColumnClick={onColumnClick}
            />
          </>
        )}
      </div>
    </div>
  )
}

function App() {
  // undefined = still checking session, null = not logged in, object = logged in
  const [user, setUser] = useState(undefined)
  const [step, setStep] = useState(0)
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState(null)
  const [fieldConditions, setFieldConditions] = useState([])
  const [preview, setPreview] = useState(null)
  const [chain, setChain] = useState(null) // { rootTable, edges } from the join graph, for /segments
  const [domains, setDomains] = useState({})
  const [openColumn, setOpenColumn] = useState(null) // { qualified, rect } | null
  const [showOnboarding, setShowOnboarding] = useState(true)
  const requestedDomainsRef = useRef(new Set())

  // First real interaction (either entry point) dismisses the onboarding hint.
  useEffect(() => {
    if (fieldConditions.length > 0) setShowOnboarding(false)
  }, [fieldConditions])

  useEffect(() => {
    fetchCurrentUser().then(setUser)
  }, [])

  const refreshTables = useCallback(async () => {
    setTablesError(null)
    try {
      const data = await fetchDiscoveredTables()
      setTables(data)
    } catch (e) {
      setTablesError(e.message)
    } finally {
      setTablesLoading(false)
    }
  }, [])

  // Only fetch data once a session is confirmed — otherwise every table/domain
  // fetch would 401 before the login screen even has a chance to show.
  useEffect(() => {
    if (user) refreshTables()
  }, [user, refreshTables])

  const initialJoinTables = useMemo(
    () => [...new Set(fieldConditions.map((c) => c.tableName))],
    [fieldConditions],
  )

  const handlePreviewChange = useCallback((data) => setPreview(data), [])
  const handleChainChange = useCallback((data) => setChain(data), [])

  // Fetched at most once per column per session — domain data doesn't change
  // during a session, so a cached hit should never trigger another request.
  const ensureDomain = useCallback((tableName, column) => {
    const key = fieldKey(tableName, column)
    if (requestedDomainsRef.current.has(key)) return
    requestedDomainsRef.current.add(key)
    setDomains((prev) => ({ ...prev, [key]: { loading: true } }))
    fetchColumnDomain(tableName, column)
      .then((data) => setDomains((prev) => ({ ...prev, [key]: { loading: false, data } })))
      .catch((e) => {
        requestedDomainsRef.current.delete(key)
        setDomains((prev) => ({ ...prev, [key]: { loading: false, error: e.message } }))
      })
  }, [])

  // "table.column" -> valueType, for every column any table allows filtering on.
  // Lets the preview table know which of its columns are clickable and what
  // default operator/valueType to attach when one is picked.
  const filterableColumnMeta = useMemo(() => {
    const map = new Map()
    tables.forEach((t) => {
      t.filterableColumns.forEach((c) => {
        map.set(fieldKey(t.tableName, c.column), { tableName: t.tableName, column: c.column, valueType: c.valueType })
      })
    })
    return map
  }, [tables])

  const selectedColumns = useMemo(
    () => new Set(fieldConditions.map((c) => fieldKey(c.tableName, c.column))),
    [fieldConditions],
  )

  const updateCondition = useCallback((tableName, column, patch) => {
    setFieldConditions((prev) =>
      prev.map((c) => (c.tableName === tableName && c.column === column ? { ...c, ...patch } : c)),
    )
  }, [])

  const removeCondition = useCallback((tableName, column) => {
    setFieldConditions((prev) => prev.filter((c) => !(c.tableName === tableName && c.column === column)))
  }, [])

  const handleColumnClick = useCallback(
    (qualified, rect) => {
      if (openColumn?.qualified === qualified) {
        setOpenColumn(null)
        return
      }
      const meta = filterableColumnMeta.get(qualified)
      if (!meta) return
      if (!selectedColumns.has(qualified)) {
        const operator = OPERATORS_BY_VALUE_TYPE[meta.valueType][0]
        setFieldConditions((prev) => [...prev, { ...meta, operator, value: '' }])
      }
      ensureDomain(meta.tableName, meta.column)
      setOpenColumn({ qualified, rect })
    },
    [openColumn, filterableColumnMeta, selectedColumns, ensureDomain],
  )

  const openCondition = openColumn ? fieldConditions.find((c) => fieldKey(c.tableName, c.column) === openColumn.qualified) : null

  if (user === undefined) {
    return <div className="empty-box tall">불러오는 중...</div>
  }
  if (user === null) {
    return <LoginScreen onLoggedIn={() => fetchCurrentUser().then(setUser)} />
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>TableLink</h1>
          <p className="muted">테이블 조인 &amp; 세그먼트 필터 도구</p>
        </div>
        <div className="user-badge">
          <span className="badge badge-type">{user.country}</span>
          <span className="muted">{user.username}</span>
          <button
            type="button"
            className="link-button"
            onClick={() => logout().then(() => setUser(null))}
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="stepper">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`step ${i === step ? 'active' : ''}`}
            onClick={() => {
              setStep(i)
              setOpenColumn(null)
            }}
          >
            <span className="step-num">{i + 1}</span>
            {label}
          </button>
        ))}
      </nav>

      {tablesError && <div className="error-banner content-error">{tablesError}</div>}

      <main className="content">
        {tablesLoading ? (
          <div className="panel">
            <div className="empty-box tall">불러오는 중...</div>
          </div>
        ) : (
          <>
            {step === 0 && (
              <div className="panel">
                <h2>조건 선택</h2>
                <p className="hint">
                  원하는 조건 필드를 검색해서 담으세요 (테이블 소속이 함께 표시됩니다). 필요한
                  테이블은 관계도에 자동으로 연결됩니다. (i) 아이콘에 마우스를 올리면 그 컬럼에
                  실제로 어떤 값이 있는지 볼 수 있어요.
                </p>

                {showOnboarding && (
                  <div className="onboarding-tip">
                    <span>
                      💡 아래 필드 목록을 클릭하거나, 위 미리보기 표의 컬럼 이름을 눌러서 조건을
                      담아보세요.
                    </span>
                    <button type="button" className="link-button" onClick={() => setShowOnboarding(false)}>
                      닫기
                    </button>
                  </div>
                )}

                <DataPreviewBar
                  preview={preview}
                  filterableColumns={filterableColumnMeta}
                  selectedColumns={selectedColumns}
                  openColumn={openColumn?.qualified}
                  onColumnClick={handleColumnClick}
                  highlight={showOnboarding}
                />

                <div className="condition-join-row">
                  <FieldConditionStep
                    tables={tables}
                    conditions={fieldConditions}
                    onConditionsChange={setFieldConditions}
                    domains={domains}
                    ensureDomain={ensureDomain}
                    highlight={showOnboarding}
                  />
                  <JoinGraphStep
                    tables={tables}
                    initialTables={initialJoinTables}
                    conditions={fieldConditions}
                    onPreviewChange={handlePreviewChange}
                    onChainChange={handleChainChange}
                    embedded
                  />
                </div>
              </div>
            )}
            {step === 1 && <ResultsStep chain={chain} conditions={fieldConditions} />}
          </>
        )}
      </main>

      {openColumn && openCondition && (
        <ColumnFilterPopover
          anchorRect={openColumn.rect}
          condition={openCondition}
          domainState={domains[openColumn.qualified]}
          onChange={(patch) => updateCondition(openCondition.tableName, openCondition.column, patch)}
          onRemove={() => {
            removeCondition(openCondition.tableName, openCondition.column)
            setOpenColumn(null)
          }}
          onClose={() => setOpenColumn(null)}
        />
      )}
    </div>
  )
}

export default App
