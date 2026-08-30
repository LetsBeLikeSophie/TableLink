package com.example.tablelink.segment;

import java.util.List;
import java.util.Map;

public record SegmentResultResponse(
        String rootTable,
        List<String> columns,
        List<Map<String, Object>> rows,
        long matchedCount,
        long totalCount,
        double matchedPercentage
) {
}
