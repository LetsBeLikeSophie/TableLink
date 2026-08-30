package com.example.tablelink.join.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

public record JoinChainRequest(
        @NotBlank String rootTable,
        @Valid List<JoinEdgeRequest> edges,
        @Valid List<FilterConditionDto> filters
) {
}
