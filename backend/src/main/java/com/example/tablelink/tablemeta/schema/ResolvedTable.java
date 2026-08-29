package com.example.tablelink.tablemeta.schema;

import java.util.List;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.TableType;

public record ResolvedTable(
        String tableName,
        TableType type,
        HistorySubType historySubType,
        String primaryKey,
        String dateColumn,
        String endDateColumn,
        List<ColumnInfo> columns,
        List<ForeignKeyInfo> foreignKeys
) {
}
