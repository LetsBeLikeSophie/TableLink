package com.example.tablelink.join.dto;

import java.util.List;

public record JoinChainResponse(
        List<JoinEdgeResult> edges,
        String sql
) {
}
