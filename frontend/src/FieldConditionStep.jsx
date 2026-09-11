import { useMemo, useState } from 'react'
import { OPERATORS_BY_VALUE_TYPE } from './ConditionEditor'

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

function FieldConditionStep({ tables, conditions, domains, ensureDomain, highlight, onFieldClick, openColumn }) {
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

  return (
    <div className="field-search-panel">
      <button
        type="button"
        className={`field-search-toggle ${highlight ? 'onboarding-glow' : ''}`}
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
          {filteredFields.map((f, i) => {
            const selected = isSelected(f.tableName, f.column)
            const key = fieldKey(f.tableName, f.column)
            const open = openColumn === key
            return (
              <li key={key}>
                <div className={`field-search-item ${selected ? 'selected' : ''} ${open ? 'open' : ''}`}>
                  <button
                    type="button"
                    className={`field-search-item-button ${highlight && i === 0 ? 'onboarding-glow' : ''}`}
                    onClick={(e) => onFieldClick(key, e.currentTarget.getBoundingClientRect(), e.currentTarget)}
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
  )
}

export default FieldConditionStep
