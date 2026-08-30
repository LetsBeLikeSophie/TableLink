import { useEffect, useMemo, useState } from 'react'
import { fetchTablePreview, saveFilterableColumns } from './api'

function TableConfirmStep({ tables, refreshTables, onPreviewChange }) {
  const [selectedName, setSelectedName] = useState(null)
  const [checked, setChecked] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setSelectedName((prev) => prev || tables[0]?.tableName || null)
  }, [tables])

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
    if (!selected || !onPreviewChange) return
    onPreviewChange({ title: selected.tableName, loading: true, error: null, columns: null, rows: null })
    fetchTablePreview(selected.tableName)
      .then((res) => onPreviewChange({ title: selected.tableName, loading: false, error: null, ...res }))
      .catch((e) =>
        onPreviewChange({ title: selected.tableName, loading: false, error: e.message, columns: null, rows: null }),
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      await refreshTables()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
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
      </div>
    </div>
  )
}

export default TableConfirmStep
