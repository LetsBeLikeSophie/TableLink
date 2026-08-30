package com.example.tablelink.join.dto;

import java.util.List;
import java.util.Map;

public record JoinChainResponse(
        List<JoinEdgeResult> edges,
        String sql,
        List<String> previewColumns,
        List<Map<String, Object>> previewRows
) {
}
