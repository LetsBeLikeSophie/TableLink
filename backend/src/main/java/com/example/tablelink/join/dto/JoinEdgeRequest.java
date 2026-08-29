package com.example.tablelink.join.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinEdgeRequest(
        @NotBlank String fromTable,
        @NotBlank String toTable,
        Boolean latestOnly
) {
}
