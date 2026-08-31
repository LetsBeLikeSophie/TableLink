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

    /**
     * sqlType is the column's real {@code information_schema.columns.data_type}
     * (e.g. "integer", "date"). JDBC sends every bind parameter here as text,
     * so without an explicit {@code ?::type} cast Postgres rejects comparisons
     * like {@code integer < character varying} against numeric/date columns.
     */
    public Fragment build(FilterCondition condition, String sqlType) {
        String col = condition.tableName() + "." + condition.column();
        String placeholder = "?::" + sqlType;
        return switch (condition.operator()) {
            case EQ -> new Fragment(col + " = " + placeholder, List.of(condition.value()));
            case NEQ -> new Fragment(col + " != " + placeholder, List.of(condition.value()));
            case GT -> new Fragment(col + " > " + placeholder, List.of(condition.value()));
            case GTE -> new Fragment(col + " >= " + placeholder, List.of(condition.value()));
            case LT -> new Fragment(col + " < " + placeholder, List.of(condition.value()));
            case LTE -> new Fragment(col + " <= " + placeholder, List.of(condition.value()));
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
