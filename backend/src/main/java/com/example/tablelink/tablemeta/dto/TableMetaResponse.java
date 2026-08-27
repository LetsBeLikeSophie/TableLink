package com.example.tablelink.tablemeta.dto;

import java.util.List;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.TableType;

public record TableMetaResponse(
        Long id,
        String tableName,
        TableType type,
        HistorySubType historySubType,
        String primaryKey,
        String dateColumn,
        String endDateColumn,
        List<ForeignKeyDto> foreignKeys,
        List<FilterableColumnDto> filterableColumns
) {
}
