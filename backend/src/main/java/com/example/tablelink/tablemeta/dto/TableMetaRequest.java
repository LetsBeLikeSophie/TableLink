package com.example.tablelink.tablemeta.dto;

import java.util.List;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.TableType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TableMetaRequest(
        @NotBlank String tableName,
        @NotNull TableType type,
        HistorySubType historySubType,
        @NotBlank String primaryKey,
        String dateColumn,
        String endDateColumn,
        @Valid List<ForeignKeyDto> foreignKeys,
        @Valid List<FilterableColumnDto> filterableColumns
) {
}
