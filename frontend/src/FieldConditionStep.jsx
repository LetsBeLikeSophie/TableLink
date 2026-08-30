import { useMemo, useRef, useState } from 'react'
import { fetchColumnDomain } from './api'

export const OPERATORS_BY_VALUE_TYPE = {
  CATEGORY: ['EQ', 'NEQ', 'IS_NULL', 'IS_NOT_NULL'],
  FREE_TEXT: ['EQ', 'NEQ', 'LIKE', 'IS_NULL', 'IS_NOT_NULL'],
  NUMBER: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL'],
  DATE: ['WITHIN_LAST_N_DAYS', 'OLDER_THAN_N_DAYS', 'EQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL'],
}

const NO_VALUE_OPERATORS = new Set(['IS_NULL', 'IS_NOT_NULL'])
const DAY_COUNT_OPERATORS = new Set(['WITHIN_LAST_N_DAYS', 'OLDER_THAN_N_DAYS'])
// A closed set small enough to comfortably show as a dropdown. The backend caps
// the query at 30 rows, so hitting that count means it's probably open-ended
// free text rather than genuinely categorical (see ColumnDomainDto).
const CLOSED_SET_MAX = 29

function fieldKey(tableName, column) {
  return `${tableName}.${column}`
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
              {domainState.data.values.length > CLOSED_SET_MAX ? '+' : ''}개):{' '}
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

function FieldConditionStep({ tables, conditions, onConditionsChange }) {
  const [query, setQuery] = useState('')
  const [domains, setDomains] = useState({})
  // Tracks which columns have already been fetched (or are in flight) so
  // re-hovering a field doesn't re-request its domain every time — domain
  // data doesn't change during a session, so once is enough.
  const requestedDomainsRef = useRef(new Set())

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

  const ensureDomain = (tableName, column) => {
    const key = fieldKey(tableName, column)
    if (requestedDomainsRef.current.has(key)) return
    requestedDomainsRef.current.add(key)
    setDomains((prev) => ({ ...prev, [key]: { loading: true } }))
    fetchColumnDomain(tableName, column)
      .then((data) => {
        setDomains((prev) => ({ ...prev, [key]: { loading: false, data } }))
        const isClosedSet = data.values && data.values.length > 0 && data.values.length <= CLOSED_SET_MAX
        if (isClosedSet) {
          const existing = conditions.find((c) => c.tableName === tableName && c.column === column)
          if (existing && existing.operator !== 'EQ' && existing.operator !== 'NEQ') {
            updateCondition(tableName, column, { operator: 'EQ', value: '' })
          }
        }
      })
      .catch((e) => {
        requestedDomainsRef.current.delete(key) // let a later hover retry after a transient failure
        setDomains((prev) => ({ ...prev, [key]: { loading: false, error: e.message } }))
      })
  }

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
                    <span className="badge badge-subtype">{f.valueType}</span>
                  </div>
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
            {conditions.map((c) => {
              const key = fieldKey(c.tableName, c.column)
              const domainState = domains[key]
              const domainValues = domainState?.data?.values
              const isClosedSet = domainValues && domainValues.length > 0 && domainValues.length <= CLOSED_SET_MAX
              const showDropdown = isClosedSet
              // A picked-from-a-list value is either a match or not — LIKE/NULL checks don't
              // apply once we know the exact closed set of values.
              const operatorChoices = isClosedSet ? ['EQ', 'NEQ'] : OPERATORS_BY_VALUE_TYPE[c.valueType]
              const rangeHint =
                domainState?.data?.min !== undefined && domainState?.data?.min !== null
                  ? `${domainState.data.min} ~ ${domainState.data.max}`
                  : '값'

              return (
                <li key={key} className="field-cart-row">
                  <div className="field-cart-row-header">
                    <span className="mono">
                      <span className="muted">{c.tableName}.</span>
                      {c.column}
                    </span>
                    <DomainHint domainState={domainState} onHover={() => ensureDomain(c.tableName, c.column)} />
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
                      {operatorChoices.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    {!NO_VALUE_OPERATORS.has(c.operator) &&
                      (showDropdown ? (
                        <select
                          value={c.value}
                          onChange={(e) => updateCondition(c.tableName, c.column, { value: e.target.value })}
                        >
                          <option value="">선택</option>
                          {domainValues.map((v) => (
                            <option key={v} value={v}>
                              {v}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder={DAY_COUNT_OPERATORS.has(c.operator) ? 'N일' : rangeHint}
                          value={c.value}
                          onChange={(e) => updateCondition(c.tableName, c.column, { value: e.target.value })}
                        />
                      ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
    </div>
  )
}

export default FieldConditionStep
