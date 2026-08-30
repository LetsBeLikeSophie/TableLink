import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { fetchDiscoveredTables } from './api'
import TableConfirmStep from './TableConfirmStep'
import FieldConditionStep from './FieldConditionStep'
import JoinGraphStep from './JoinGraphStep'
import DataPreviewTable from './DataPreviewTable'

const STEPS = ['테이블 확인', '조건 선택', '관계도 & 조인', '결과']

function PlaceholderStep({ title }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="empty-box tall">아직 구현되지 않음</div>
    </div>
  )
}

function PreviewSidebar({ step, preview }) {
  if (step === 1) {
    return (
      <aside className="preview-sidebar">
        <h3>데이터 미리보기</h3>
        <div className="empty-box">
          조건을 담고 다음 단계(관계도 &amp; 조인)로 넘어가면 조인 결과 미리보기가 여기 표시됩니다.
        </div>
      </aside>
    )
  }

  if (step === 3) {
    return (
      <aside className="preview-sidebar">
        <h3>데이터 미리보기</h3>
        <div className="empty-box">결과 화면 완성 후 표시됩니다.</div>
      </aside>
    )
  }

  return (
    <aside className="preview-sidebar">
      <h3>{preview?.title ? `데이터 미리보기 · ${preview.title}` : '데이터 미리보기'}</h3>
      {!preview && <div className="empty-box">테이블을 선택하면 표시됩니다.</div>}
      {preview?.loading && <div className="empty-box">불러오는 중...</div>}
      {preview?.error && <div className="error-banner">{preview.error}</div>}
      {preview && !preview.loading && !preview.error && preview.columns && (
        <>
          {preview.sql && <pre className="sql-preview">{preview.sql}</pre>}
          <DataPreviewTable columns={preview.columns} rows={preview.rows} />
        </>
      )}
    </aside>
  )
}

function App() {
  const [step, setStep] = useState(0)
  const [tables, setTables] = useState([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState(null)
  const [fieldConditions, setFieldConditions] = useState([])
  const [sidebarPreview, setSidebarPreview] = useState(null)

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

  const handlePreviewChange = useCallback((data) => setSidebarPreview(data), [])

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

      <main className="content-grid">
        <div className="step-body">
          {tablesLoading ? (
            <div className="panel">
              <div className="empty-box tall">불러오는 중...</div>
            </div>
          ) : (
            <>
              {step === 0 && (
                <TableConfirmStep
                  tables={tables}
                  refreshTables={refreshTables}
                  onPreviewChange={handlePreviewChange}
                />
              )}
              {step === 1 && (
                <FieldConditionStep
                  tables={tables}
                  conditions={fieldConditions}
                  onConditionsChange={setFieldConditions}
                />
              )}
              {step === 2 && (
                <JoinGraphStep
                  tables={tables}
                  initialTables={initialJoinTables}
                  onPreviewChange={handlePreviewChange}
                />
              )}
              {step === 3 && <PlaceholderStep title="결과" />}
            </>
          )}
        </div>

        <PreviewSidebar step={step} preview={sidebarPreview} />
      </main>
    </div>
  )
}

export default App
