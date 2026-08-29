package com.example.tablelink.tablemeta.schema;

import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.TableType;

import lombok.RequiredArgsConstructor;

/**
 * Derives TableMeta type/historySubType/dateColumn/endDateColumn from the live
 * DB schema + naming convention (see project-spec.md section 2, "자동 판정 컨벤션").
 * Shared by table discovery and the join engine so both use the same rules.
 */
@Component
@RequiredArgsConstructor
public class TableSchemaResolver {

    private static final String HISTORY_SUFFIX = "_history";
    private static final String END_DATE_COLUMN = "end_date";

    private static final Set<String> DATE_SQL_TYPES = Set.of(
            "date", "timestamp without time zone", "timestamp with time zone");

    private final SchemaIntrospectionRepository schemaIntrospectionRepository;

    public List<String> findTableNames() {
        return schemaIntrospectionRepository.findTableNames();
    }

    public ResolvedTable resolve(String tableName) {
        List<ColumnInfo> columns = schemaIntrospectionRepository.findColumns(tableName);
        if (columns.isEmpty()) {
            return null;
        }
        String primaryKey = schemaIntrospectionRepository.findPrimaryKeyColumn(tableName);
        List<ForeignKeyInfo> foreignKeys = schemaIntrospectionRepository.findForeignKeys(tableName);

        TableType type = tableName.endsWith(HISTORY_SUFFIX) ? TableType.HISTORY : TableType.STATE;
        HistorySubType historySubType = null;
        String dateColumn = null;
        String endDateColumn = null;

        if (type == TableType.HISTORY) {
            List<String> dateColumnNames = columns.stream()
                    .filter(c -> DATE_SQL_TYPES.contains(c.sqlType()))
                    .map(ColumnInfo::name)
                    .toList();
            boolean hasEndDate = dateColumnNames.contains(END_DATE_COLUMN);
            if (hasEndDate) {
                historySubType = HistorySubType.RANGE;
                endDateColumn = END_DATE_COLUMN;
                dateColumn = dateColumnNames.stream()
                        .filter(name -> !name.equals(END_DATE_COLUMN))
                        .findFirst()
                        .orElse(null);
            } else {
                historySubType = HistorySubType.POINT;
                dateColumn = dateColumnNames.stream().findFirst().orElse(null);
            }
        }

        return new ResolvedTable(tableName, type, historySubType, primaryKey, dateColumn, endDateColumn,
                columns, foreignKeys);
    }
}
