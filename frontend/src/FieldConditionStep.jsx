import { useMemo, useState } from 'react'

const OPERATORS_BY_VALUE_TYPE = {
  CATEGORY: ['EQ', 'NEQ', 'IS_NULL', 'IS_NOT_NULL'],
  FREE_TEXT: ['EQ', 'NEQ', 'LIKE', 'IS_NULL', 'IS_NOT_NULL'],
  NUMBER: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL'],
  DATE: ['WITHIN_LAST_N_DAYS', 'OLDER_THAN_N_DAYS', 'EQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL'],
}

const NO_VALUE_OPERATORS = new Set(['IS_NULL', 'IS_NOT_NULL'])
const DAY_COUNT_OPERATORS = new Set(['WITHIN_LAST_N_DAYS', 'OLDER_THAN_N_DAYS'])

function fieldKey(tableName, column) {
  return `${tableName}.${column}`
}

function FieldConditionStep({ tables, conditions, onConditionsChange }) {
  const [query, setQuery] = useState('')

  const allFields = useMemo(() => {
    const list = []
    tables.forEach((t) => {
      t.filterableColumns.forEach((c) => {
        list.push({ tableName: t.tableName, tableType: t.type, column: c.column, valueType: c.valueType })
      })
    })
    return list
  }, [tables])

  const filteredFields = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allFields
    return allFields.filter((f) => fieldKey(f.tableName, f.column).toLowerCase().includes(q))
  }, [allFields, query])

  const isSelected = (tableName, column) =>
    conditions.some((c) => c.tableName === tableName && c.column === column)

  const addField = (field) => {
    if (isSelected(field.tableName, field.column)) return
    const operator = OPERATORS_BY_VALUE_TYPE[field.valueType][0]
    onConditionsChange([...conditions, { ...field, operator, value: '' }])
  }

  const removeField = (tableName, column) => {
    onConditionsChange(conditions.filter((c) => !(c.tableName === tableName && c.column === column)))
  }

  const updateCondition = (tableName, column, patch) => {
    onConditionsChange(
      conditions.map((c) => (c.tableName === tableName && c.column === column ? { ...c, ...patch } : c)),
    )
  }

  return (
    <div className="panel">
      <h2>조건 선택</h2>
      <p className="hint">
        원하는 조건 필드를 검색해서 담으세요 (테이블 소속이 함께 표시됩니다). 다음 단계(관계도 &amp; 조인)로
        넘어가면 필요한 테이블이 자동으로 연결됩니다.
      </p>

      <div className="field-cart-layout">
        <div className="field-search-panel">
          <input
            type="text"
            className="field-search-input"
            placeholder="검색 (예: vehicle, service_date)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="field-search-list">
            {filteredFields.map((f) => {
              const selected = isSelected(f.tableName, f.column)
              return (
                <li key={fieldKey(f.tableName, f.column)}>
                  <button
                    type="button"
                    className={`field-search-item ${selected ? 'selected' : ''}`}
                    onClick={() => (selected ? removeField(f.tableName, f.column) : addField(f))}
                  >
                    <span className="field-search-item-name">
                      <span className="muted">{f.tableName}.</span>
                      {f.column}
                    </span>
                    <span className="badge badge-subtype">{f.valueType}</span>
                  </button>
                </li>
              )
            })}
            {filteredFields.length === 0 && <div className="empty-box">검색 결과가 없습니다.</div>}
          </ul>
        </div>

        <div className="field-cart-panel">
          <h3>담은 조건 ({conditions.length})</h3>
          {conditions.length === 0 && <div className="empty-box">왼쪽에서 필드를 클릭해서 담으세요.</div>}
          <ul className="field-cart-list">
            {conditions.map((c) => (
              <li key={fieldKey(c.tableName, c.column)} className="field-cart-row">
                <div className="field-cart-row-header">
                  <span className="mono">
                    <span className="muted">{c.tableName}.</span>
                    {c.column}
                  </span>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => removeField(c.tableName, c.column)}
                  >
                    제거
                  </button>
                </div>
                <div className="field-cart-row-inputs">
                  <select
                    value={c.operator}
                    onChange={(e) =>
                      updateCondition(c.tableName, c.column, { operator: e.target.value, value: '' })
                    }
                  >
                    {OPERATORS_BY_VALUE_TYPE[c.valueType].map((op) => (
                      <option key={op} value={op}>
                        {op}
                      </option>
                    ))}
                  </select>
                  {!NO_VALUE_OPERATORS.has(c.operator) && (
                    <input
                      type="text"
                      placeholder={DAY_COUNT_OPERATORS.has(c.operator) ? 'N일' : '값'}
                      value={c.value}
                      onChange={(e) => updateCondition(c.tableName, c.column, { value: e.target.value })}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default FieldConditionStep
