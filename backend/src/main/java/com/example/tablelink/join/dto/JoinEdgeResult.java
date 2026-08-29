package com.example.tablelink.join.dto;

import com.example.tablelink.join.JoinType;

public record JoinEdgeResult(
        String fromTable,
        String toTable,
        JoinType joinType,
        boolean latestOnly,
        String onClause
) {
}
