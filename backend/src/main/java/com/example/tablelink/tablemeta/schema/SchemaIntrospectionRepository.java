package com.example.tablelink.tablemeta.schema;

import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import lombok.RequiredArgsConstructor;

/**
 * Reads table/column/key metadata directly from Postgres' information_schema,
 * so TableMeta type/subtype/FK can be derived from the live schema instead of
 * manual registration (see project-spec.md section 2, "자동 판정 컨벤션").
 */
@Repository
@RequiredArgsConstructor
public class SchemaIntrospectionRepository {

    private static final String SCHEMA = "public";

    private final JdbcTemplate jdbcTemplate;

    public List<String> findTableNames() {
        return jdbcTemplate.queryForList(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = ? AND table_type = 'BASE TABLE'
                  AND table_name NOT LIKE 'table\\_meta%' ESCAPE '\\'
                ORDER BY table_name
                """,
                String.class, SCHEMA);
    }

    public List<ColumnInfo> findColumns(String tableName) {
        return jdbcTemplate.query(
                """
                SELECT column_name, data_type FROM information_schema.columns
                WHERE table_schema = ? AND table_name = ?
                ORDER BY ordinal_position
                """,
                (rs, rowNum) -> new ColumnInfo(rs.getString("column_name"), rs.getString("data_type")),
                SCHEMA, tableName);
    }

    public String findPrimaryKeyColumn(String tableName) {
        List<String> pk = jdbcTemplate.queryForList(
                """
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = ? AND tc.table_name = ?
                """,
                String.class, SCHEMA, tableName);
        return pk.isEmpty() ? null : pk.get(0);
    }

    public List<ForeignKeyInfo> findForeignKeys(String tableName) {
        return jdbcTemplate.query(
                """
                SELECT kcu.column_name AS fk_column, ccu.table_name AS ref_table, ccu.column_name AS ref_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = ? AND tc.table_name = ?
                """,
                (rs, rowNum) -> new ForeignKeyInfo(
                        rs.getString("fk_column"), rs.getString("ref_table"), rs.getString("ref_column")),
                SCHEMA, tableName);
    }
}
