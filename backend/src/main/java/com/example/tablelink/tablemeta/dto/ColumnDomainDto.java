package com.example.tablelink.tablemeta.dto;

import java.util.List;

import com.example.tablelink.tablemeta.FilterValueType;

public record ColumnDomainDto(
        FilterValueType valueType,
        List<String> values,
        String min,
        String max
) {
}
