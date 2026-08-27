package com.example.tablelink.tablemeta.dto;

import jakarta.validation.constraints.NotBlank;

public record ForeignKeyDto(
        @NotBlank String column,
        @NotBlank String refTable,
        @NotBlank String refColumn
) {
}
