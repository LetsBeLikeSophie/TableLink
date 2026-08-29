package com.example.tablelink.tablemeta.dto;

import java.util.List;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.TableType;

public record DiscoveredTableDto(
        String tableName,
        TableType type,
        HistorySubType historySubType,
        String primaryKey,
        String dateColumn,
        String endDateColumn,
        List<ForeignKeyDto> foreignKeys,
        List<FilterableColumnDto> availableColumns,
        List<FilterableColumnDto> filterableColumns,
        boolean filterableColumnsConfirmed
) {
}
