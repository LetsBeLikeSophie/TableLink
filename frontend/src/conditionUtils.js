import { NO_VALUE_OPERATORS, DAY_COUNT_OPERATORS, OPERATOR_LABEL } from './ConditionEditor'

/** Conditions ready to send to the backend — drops any with no value entered
 * yet, since IS_NULL/IS_NOT_NULL are the only operators that don't need one. */
export function toActiveFilters(conditions) {
  return (conditions || [])
    .filter((c) => NO_VALUE_OPERATORS.has(c.operator) || (c.value !== undefined && c.value !== ''))
    .map((c) => ({ tableName: c.tableName, column: c.column, operator: c.operator, value: c.value }))
}

/** One filter as a short readable phrase, e.g. "customer.name = 민" or
 * "customer.joined_at 최근 30일 이내" — for summarizing active filters in prose. */
export function formatConditionPhrase(c) {
  const field = `${c.tableName}.${c.column}`
  if (NO_VALUE_OPERATORS.has(c.operator)) {
    return `${field} ${OPERATOR_LABEL[c.operator]}`
  }
  if (DAY_COUNT_OPERATORS.has(c.operator)) {
    const label = c.operator === 'WITHIN_LAST_N_DAYS' ? `최근 ${c.value}일 이내` : `${c.value}일 이전`
    return `${field} ${label}`
  }
  return `${field} ${OPERATOR_LABEL[c.operator]} ${c.value}`
}
