package com.example.tablelink.join.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

public record JoinChainRequest(
        @NotEmpty @Valid List<JoinEdgeRequest> edges
) {
}
