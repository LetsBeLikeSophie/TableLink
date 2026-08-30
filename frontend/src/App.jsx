import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { fetchDiscoveredTables } from './api'
import FieldConditionStep from './FieldConditionStep'
import JoinGraphStep from './JoinGraphStep'
import DataPreviewTable from './DataPreviewTable'

const STEPS = ['조건 선택', '결과']

function PlaceholderStep({ title }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="empty-box tall">아직 구현되지 않음</div>
    </div>
  )
}

function DataPreviewBar({ preview }) {
  return (
    <div className="data-preview-bar">
      <h3>{preview?.title ? `데이터 미리보기 · ${preview.title}` : '데이터 미리보기'}</h3>
      {!preview && <div className="empty-box">조건을 담아 테이블이 연결되면 표시됩니다.</div>}
      {preview?.loading && <div className="empty-box">불러오는 중...</div>}
      {preview?.error && <div className="error-banner">{preview.error}</div>}
      {preview && !preview.loading && !preview.error && preview.columns && (
        <DataPreviewTable columns={preview.columns} rows={preview.rows} />
      )}
    </div>
  )
}

function App() {
  const [step, setStep] = useState(0)
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState(null)
  const [fieldConditions, setFieldConditions] = useState([])
  const [preview, setPreview] = useState(null)

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

  useEffect(() => {
    refreshTables()
  }, [refreshTables])

  const initialJoinTables = useMemo(
    () => [...new Set(fieldConditions.map((c) => c.tableName))],
    [fieldConditions],
  )

  const handlePreviewChange = useCallback((data) => setPreview(data), [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>TableLink</h1>
        <p className="muted">테이블 조인 &amp; 세그먼트 필터 도구</p>
      </header>

      <nav className="stepper">
        {STEPS.map((label, i) => (
          <button
            key={label}
            className={`step ${i === step ? 'active' : ''}`}
            onClick={() => setStep(i)}
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

                <DataPreviewBar preview={preview} />

                <div className="condition-join-row">
                  <FieldConditionStep
                    tables={tables}
                    conditions={fieldConditions}
                    onConditionsChange={setFieldConditions}
                  />
                  <JoinGraphStep
                    tables={tables}
                    initialTables={initialJoinTables}
                    conditions={fieldConditions}
                    onPreviewChange={handlePreviewChange}
                    embedded
                  />
                </div>
              </div>
            )}
            {step === 1 && <PlaceholderStep title="결과" />}
          </>
        )}
      </main>
    </div>
  )
}

export default App
