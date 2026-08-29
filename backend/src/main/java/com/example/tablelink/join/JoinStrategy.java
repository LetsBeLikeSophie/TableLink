package com.example.tablelink.join;

public interface JoinStrategy {
    String buildOnClause(JoinEdgeSpec spec);
}
