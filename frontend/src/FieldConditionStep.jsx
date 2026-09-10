import { useMemo, useState } from 'react'
import ConditionEditor, { OPERATORS_BY_VALUE_TYPE } from './ConditionEditor'

export { OPERATORS_BY_VALUE_TYPE }

function fieldKey(tableName, column) {
  return `${tableName}.${column}`
}

const VALUE_TYPE_LABEL = {
  FREE_TEXT: 'TEXT',
}

function valueTypeLabel(valueType) {
  return VALUE_TYPE_LABEL[valueType] ?? valueType
}

function DomainHint({ domainState, onHover }) {
  const [open, setOpen] = useState(false)

  return (
    <span
      className="domain-hint"
      onMouseEnter={() => {
        setOpen(true)
        onHover()
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="domain-hint-icon">i</span>
      {open && (
        <span className="domain-hint-popover">
          {!domainState || domainState.loading ? (
            '불러오는 중...'
          ) : domainState.error ? (
            '값을 불러오지 못했습니다'
          ) : domainState.data.min !== null && domainState.data.min !== undefined ? (
            <>범위: {domainState.data.min} ~ {domainState.data.max}</>
          ) : domainState.data.values && domainState.data.values.length > 0 ? (
            <>
              값 ({domainState.data.values.length}
              {domainState.data.values.length > 29 ? '+' : ''}개):{' '}
              {domainState.data.values.slice(0, 12).join(', ')}
              {domainState.data.values.length > 12 ? ' ...' : ''}
            </>
          ) : (
            '값 없음'
          )}
        </span>
      )}
    </span>
  )
}

function FieldConditionStep({ tables, conditions, onConditionsChange, domains, ensureDomain, highlight }) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

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
    ensureDomain(field.tableName, field.column)
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
    <div className="field-cart-column">
        <div className={`field-search-panel ${highlight ? 'onboarding-glow' : ''}`}>
          <button
            type="button"
            className="field-search-toggle"
            onClick={() => setSearchOpen((o) => !o)}
            aria-expanded={searchOpen}
          >
            <span>필드 목록 검색 ({allFields.length})</span>
            <span className="field-search-toggle-icon">{searchOpen ? '▲' : '▼'}</span>
          </button>
          <div className={`field-search-body ${searchOpen ? 'open' : ''}`}>
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
              const key = fieldKey(f.tableName, f.column)
              return (
                <li key={key}>
                  <div className={`field-search-item ${selected ? 'selected' : ''}`}>
                    <button
                      type="button"
                      className="field-search-item-button"
                      onClick={() => (selected ? removeField(f.tableName, f.column) : addField(f))}
                    >
                      <span className="field-search-item-name">
                        <span className="muted">{f.tableName}.</span>
                        {f.column}
                      </span>
                    </button>
                    <DomainHint domainState={domains[key]} onHover={() => ensureDomain(f.tableName, f.column)} />
                    <span className="badge badge-subtype">{valueTypeLabel(f.valueType)}</span>
                  </div>
                </li>
              )
            })}
            {filteredFields.length === 0 && <div className="empty-box">검색 결과가 없습니다.</div>}
          </ul>
          </div>
        </div>

        <div className="field-cart-panel">
          <h3>담은 조건 ({conditions.length})</h3>
          {conditions.length === 0 && (
            <div className="empty-box">위 필드 목록이나 미리보기 표의 컬럼을 클릭해서 담으세요.</div>
          )}
          <ul className="field-cart-list">
            {conditions.map((c) => {
              const key = fieldKey(c.tableName, c.column)
              return (
                <li key={key} className="field-cart-row">
                  <div className="field-cart-row-header">
                    <span className="mono">
                      <span className="muted">{c.tableName}.</span>
                      {c.column}
                    </span>
                    <DomainHint domainState={domains[key]} onHover={() => ensureDomain(c.tableName, c.column)} />
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => removeField(c.tableName, c.column)}
                    >
                      제거
                    </button>
                  </div>
                  <ConditionEditor
                    condition={c}
                    domainState={domains[key]}
                    onChange={(patch) => updateCondition(c.tableName, c.column, patch)}
                  />
                </li>
              )
            })}
          </ul>
        </div>
    </div>
  )
}

export default FieldConditionStep
