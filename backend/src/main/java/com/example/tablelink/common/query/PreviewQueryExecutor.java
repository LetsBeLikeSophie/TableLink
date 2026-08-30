package com.example.tablelink.common.query;

import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import java.sql.Date;
import java.sql.Timestamp;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Runs a read-only SELECT with a row limit and returns column names + rows,
 * reading column names from ResultSetMetaData so an empty result still
 * reports the shape (not just an empty list).
 */
@Component
@RequiredArgsConstructor
public class PreviewQueryExecutor {

    private final JdbcTemplate jdbcTemplate;

    public PreviewResult execute(String sql, int limit) {
        return execute(sql, List.of(), limit);
    }

    public PreviewResult execute(String sql, List<Object> params, int limit) {
        String limited = sql + " LIMIT " + limit;
        return jdbcTemplate.query(
                limited,
                ps -> {
                    for (int i = 0; i < params.size(); i++) {
                        ps.setObject(i + 1, params.get(i));
                    }
                },
                rs -> {
                    ResultSetMetaData meta = rs.getMetaData();
                    int columnCount = meta.getColumnCount();
                    List<String> columns = new ArrayList<>();
                    for (int i = 1; i <= columnCount; i++) {
                        columns.add(meta.getColumnLabel(i));
                    }

                    List<Map<String, Object>> rows = new ArrayList<>();
                    while (rs.next()) {
                        Map<String, Object> row = new LinkedHashMap<>();
                        for (int i = 1; i <= columnCount; i++) {
                            row.put(meta.getColumnLabel(i), normalize(rs.getObject(i)));
                        }
                        rows.add(row);
                    }
                    return new PreviewResult(columns, rows);
                });
    }

    /**
     * java.sql.Date/Timestamp serialize as shifted UTC instants (a day off in
     * timezones ahead of UTC) when Jackson treats them as java.util.Date.
     * Converting to LocalDate/LocalDateTime keeps the wall-clock value as-is.
     */
    private Object normalize(Object value) {
        if (value instanceof Date date) {
            return date.toLocalDate();
        }
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        return value;
    }
}
