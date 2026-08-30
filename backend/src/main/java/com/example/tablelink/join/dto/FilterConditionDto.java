package com.example.tablelink.join.dto;

import com.example.tablelink.filter.FilterOperator;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record FilterConditionDto(
        @NotBlank String tableName,
        @NotBlank String column,
        @NotNull FilterOperator operator,
        String value
) {
}
