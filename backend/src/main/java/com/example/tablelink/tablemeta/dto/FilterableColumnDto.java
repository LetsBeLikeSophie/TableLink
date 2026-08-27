package com.example.tablelink.tablemeta.dto;

import com.example.tablelink.tablemeta.FilterValueType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record FilterableColumnDto(
        @NotBlank String column,
        @NotNull FilterValueType valueType
) {
}
