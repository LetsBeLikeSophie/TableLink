import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { fetchDiscoveredTables, fetchTablePreview, saveFilterableColumns } from './api'
import JoinGraphStep from './JoinGraphStep'
import DataPreviewTable from './DataPreviewTable'

const STEPS = ['테이블 확인', '관계도 & 조인', '필터 (세그먼트)', '결과']

function TableConfirmStep() {
  const [tables, setTables] = useState([])
  const [selectedName, setSelectedName] = useState(null)
  const [checked, setChecked] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(null)

  const loadTables = async (keepSelection) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDiscoveredTables()
      setTables(data)
      setSelectedName((prev) => (keepSelection && prev) || data[0]?.tableName || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTables(false)
  }, [])

  const selected = useMemo(
    () => tables.find((t) => t.tableName === selectedName) || null,
    [tables, selectedName],
  )

  useEffect(() => {
    if (!selected) return
    const initial = {}
    selected.availableColumns.forEach((c) => {
      initial[c.column] = selected.filterableColumns.some((fc) => fc.column === c.column)
    })
    setChecked(initial)
  }, [selected])

  useEffect(() => {
    if (!selected) return
    setPreviewLoading(true)
    setPreviewError(null)
    fetchTablePreview(selected.tableName)
      .then(setPreview)
      .catch((e) => setPreviewError(e.message))
      .finally(() => setPreviewLoading(false))
  }, [selected])

  const toggleColumn = (column) => {
    setChecked((prev) => ({ ...prev, [column]: !prev[column] }))
  }

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const filterableColumns = selected.availableColumns
        .filter((c) => checked[c.column])
        .map((c) => ({ column: c.column, valueType: c.valueType }))
      await saveFilterableColumns(selected.tableName, filterableColumns)
      await loadTables(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="panel">
        <h2>테이블 확인</h2>
        <div className="empty-box tall">불러오는 중...</div>
      </div>
    )
  }

  return (
    <div className="panel">
      <h2>테이블 확인</h2>
      <p className="hint">
        DB 스키마와 네이밍 컨벤션으로 타입/서브타입/FK가 자동 판정됩니다.
        필터에 노출할 컬럼만 필요하면 체크 해제하세요.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="table-confirm-layout">
        <ul className="table-list">
          {tables.map((t) => (
            <li key={t.tableName}>
              <button
                type="button"
                className={`table-list-item ${t.tableName === selectedName ? 'active' : ''}`}
                onClick={() => setSelectedName(t.tableName)}
              >
                <span>{t.tableName}</span>
                <span className={`badge ${t.filterableColumnsConfirmed ? 'badge-confirmed' : 'badge-default'}`}>
                  {t.filterableColumnsConfirmed ? '확인됨' : '기본값'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {selected && (
          <div className="table-detail">
            <div className="type-row">
              <span className="badge badge-type">{selected.type}</span>
              {selected.historySubType && (
                <span className="badge badge-subtype">{selected.historySubType}</span>
              )}
              <span className="muted">PK: {selected.primaryKey}</span>
              {selected.dateColumn && <span className="muted">날짜: {selected.dateColumn}</span>}
              {selected.endDateColumn && <span className="muted">종료일: {selected.endDateColumn}</span>}
            </div>

            {selected.foreignKeys.length > 0 && (
              <div className="fk-list">
                {selected.foreignKeys.map((fk) => (
                  <span key={fk.column} className="fk-chip">
                    {fk.column} → {fk.refTable}.{fk.refColumn}
                  </span>
                ))}
              </div>
            )}

            <div className="column-checklist">
              {selected.availableColumns.map((c) => (
                <label key={c.column} className="column-check-row">
                  <input
                    type="checkbox"
                    checked={!!checked[c.column]}
                    onChange={() => toggleColumn(c.column)}
                  />
                  <span>{c.column}</span>
                  <span className="muted">{c.valueType}</span>
                </label>
              ))}
            </div>

            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '확인'}
            </button>
          </div>
        )}

        <div className="data-preview-panel">
          <h3>데이터 미리보기</h3>
          {previewLoading && <div className="empty-box">불러오는 중...</div>}
          {previewError && <div className="error-banner">{previewError}</div>}
          {preview && !previewLoading && (
            <DataPreviewTable columns={preview.columns} rows={preview.rows} />
          )}
        </div>
      </div>
    </div>
  )
}

function PlaceholderStep({ title }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="empty-box tall">아직 구현되지 않음</div>
    </div>
  )
}

function App() {
  const [step, setStep] = useState(0)

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

      <main className="content">
        {step === 0 && <TableConfirmStep />}
        {step === 1 && <JoinGraphStep />}
        {step === 2 && <PlaceholderStep title="필터 (세그먼트)" />}
        {step === 3 && <PlaceholderStep title="결과" />}
      </main>
    </div>
  )
}

export default App
