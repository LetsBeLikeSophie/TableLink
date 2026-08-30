package com.example.tablelink.filter;

import java.util.List;

import org.springframework.stereotype.Component;

/**
 * Builds a single "table.column OP ?" fragment + bind params for one filter
 * condition. Column names are interpolated (never bindable in JDBC) so
 * callers must validate them against the real schema first — see
 * TableSchemaResolver — this class only shapes the SQL, it doesn't validate.
 */
@Component
public class FilterConditionSqlBuilder {

    public record Fragment(String sql, List<Object> params) {
    }

    public Fragment build(FilterCondition condition) {
        String col = condition.tableName() + "." + condition.column();
        return switch (condition.operator()) {
            case EQ -> new Fragment(col + " = ?", List.of(condition.value()));
            case NEQ -> new Fragment(col + " != ?", List.of(condition.value()));
            case GT -> new Fragment(col + " > ?", List.of(condition.value()));
            case GTE -> new Fragment(col + " >= ?", List.of(condition.value()));
            case LT -> new Fragment(col + " < ?", List.of(condition.value()));
            case LTE -> new Fragment(col + " <= ?", List.of(condition.value()));
            case LIKE -> new Fragment(col + " LIKE ?", List.of("%" + condition.value() + "%"));
            case IS_NULL -> new Fragment(col + " IS NULL", List.of());
            case IS_NOT_NULL -> new Fragment(col + " IS NOT NULL", List.of());
            case WITHIN_LAST_N_DAYS ->
                    new Fragment(col + " >= CURRENT_DATE - ?", List.of(parseDays(condition.value())));
            case OLDER_THAN_N_DAYS ->
                    new Fragment(col + " < CURRENT_DATE - ?", List.of(parseDays(condition.value())));
        };
    }

    private int parseDays(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException | NullPointerException e) {
            throw new FilterValidationException("일수(N)는 정수여야 합니다: " + value);
        }
    }
}
