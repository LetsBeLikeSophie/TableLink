package com.example.tablelink.common.query;

import java.util.List;
import java.util.Map;

public record PreviewResult(List<String> columns, List<Map<String, Object>> rows) {
}
