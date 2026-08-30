export const OPERATORS_BY_VALUE_TYPE = {
  CATEGORY: ['EQ', 'NEQ', 'IS_NULL', 'IS_NOT_NULL'],
  FREE_TEXT: ['EQ', 'NEQ', 'LIKE', 'IS_NULL', 'IS_NOT_NULL'],
  NUMBER: ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL'],
  DATE: ['WITHIN_LAST_N_DAYS', 'OLDER_THAN_N_DAYS', 'EQ', 'GT', 'GTE', 'LT', 'LTE', 'IS_NULL', 'IS_NOT_NULL'],
}

export const NO_VALUE_OPERATORS = new Set(['IS_NULL', 'IS_NOT_NULL'])
export const DAY_COUNT_OPERATORS = new Set(['WITHIN_LAST_N_DAYS', 'OLDER_THAN_N_DAYS'])
// A closed set small enough to comfortably show as a dropdown. The backend caps
// the query at 30 rows, so hitting that count means it's probably open-ended
// free text rather than genuinely categorical (see ColumnDomainDto).
export const CLOSED_SET_MAX = 29

export function isClosedSetDomain(domainState) {
  const values = domainState?.data?.values
  return Boolean(values && values.length > 0 && values.length <= CLOSED_SET_MAX)
}

/** Operator + value inputs for one condition — shared by the cart row and the
 * inline preview-column popover so both stay in sync automatically. */
function ConditionEditor({ condition, domainState, onChange }) {
  const closedSet = isClosedSetDomain(domainState)
  const domainValues = domainState?.data?.values
  // A picked-from-a-list value is either a match or not — LIKE/NULL checks
  // don't apply once we know the exact closed set of values.
  const operatorChoices = closedSet ? ['EQ', 'NEQ'] : OPERATORS_BY_VALUE_TYPE[condition.valueType]
  const rangeHint =
    domainState?.data?.min !== undefined && domainState?.data?.min !== null
      ? `${domainState.data.min} ~ ${domainState.data.max}`
      : '값'

  return (
    <div className="condition-editor-inputs">
      <select value={condition.operator} onChange={(e) => onChange({ operator: e.target.value, value: '' })}>
        {operatorChoices.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      {!NO_VALUE_OPERATORS.has(condition.operator) &&
        (closedSet ? (
          <select value={condition.value} onChange={(e) => onChange({ value: e.target.value })}>
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
            placeholder={DAY_COUNT_OPERATORS.has(condition.operator) ? 'N일' : rangeHint}
            value={condition.value}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        ))}
    </div>
  )
}

export default ConditionEditor
