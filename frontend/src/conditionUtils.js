import { NO_VALUE_OPERATORS } from './ConditionEditor'

/** Conditions ready to send to the backend — drops any with no value entered
 * yet, since IS_NULL/IS_NOT_NULL are the only operators that don't need one. */
export function toActiveFilters(conditions) {
  return (conditions || [])
    .filter((c) => NO_VALUE_OPERATORS.has(c.operator) || (c.value !== undefined && c.value !== ''))
    .map((c) => ({ tableName: c.tableName, column: c.column, operator: c.operator, value: c.value }))
}
