package com.example.tablelink.filter;

public record FilterCondition(String tableName, String column, FilterOperator operator, String value) {
}
