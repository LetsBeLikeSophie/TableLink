package com.example.tablelink.tablemeta.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record FilterableColumnsUpdateRequest(
        @NotNull @Valid List<FilterableColumnDto> filterableColumns
) {
}
