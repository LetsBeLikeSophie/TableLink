package com.example.tablelink.join;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.example.tablelink.join.dto.JoinChainRequest;
import com.example.tablelink.join.dto.JoinChainResponse;
import com.example.tablelink.join.dto.JoinEdgeRequest;
import com.example.tablelink.join.dto.JoinEdgeResult;
import com.example.tablelink.tablemeta.schema.ForeignKeyInfo;
import com.example.tablelink.tablemeta.schema.ResolvedTable;
import com.example.tablelink.tablemeta.schema.TableSchemaResolver;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class JoinService {

    private final TableSchemaResolver tableSchemaResolver;
    private final JoinStrategyFactory joinStrategyFactory;

    /**
     * left/right join columns for one edge, and whether the two tables share
     * a common FK parent rather than directly referencing each other
     * (the HISTORY-HISTORY case, e.g. service_history/ownership_history both
     * pointing at vehicle_id).
     */
    private record EdgeKey(String leftColumn, String rightColumn, boolean sharedParent) {
    }

    public JoinChainResponse buildChain(JoinChainRequest request) {
        List<JoinEdgeResult> results = new ArrayList<>();

        for (JoinEdgeRequest edgeRequest : request.edges()) {
            ResolvedTable left = tableSchemaResolver.resolve(edgeRequest.fromTable());
            if (left == null) {
                throw new JoinValidationException("존재하지 않는 테이블입니다: " + edgeRequest.fromTable());
            }
            ResolvedTable right = tableSchemaResolver.resolve(edgeRequest.toTable());
            if (right == null) {
                throw new JoinValidationException("존재하지 않는 테이블입니다: " + edgeRequest.toTable());
            }

            EdgeKey key = resolveEdgeKey(left, right).orElseThrow(() -> new JoinValidationException(
                    "FK로 연결되지 않은 테이블입니다: " + edgeRequest.fromTable() + " - " + edgeRequest.toTable()));

            boolean latestOnly = edgeRequest.latestOnly() == null || edgeRequest.latestOnly();
            JoinStrategy strategy = joinStrategyFactory.resolve(left.type(), right.type(), key.sharedParent());
            JoinType joinType = joinStrategyFactory.typeOf(left.type(), right.type(), key.sharedParent());

            JoinEdgeSpec spec = new JoinEdgeSpec(left, key.leftColumn(), right, key.rightColumn(), latestOnly);
            String onClause = strategy.buildOnClause(spec);

            results.add(new JoinEdgeResult(edgeRequest.fromTable(), edgeRequest.toTable(), joinType, latestOnly,
                    onClause));
        }

        String sql = buildCombinedSql(request.edges().get(0).fromTable(), results);
        return new JoinChainResponse(results, sql);
    }

    private Optional<EdgeKey> resolveEdgeKey(ResolvedTable left, ResolvedTable right) {
        Optional<ForeignKeyInfo> leftOwnsFk = left.foreignKeys().stream()
                .filter(fk -> fk.refTable().equals(right.tableName()))
                .findFirst();
        if (leftOwnsFk.isPresent()) {
            return Optional.of(new EdgeKey(leftOwnsFk.get().column(), leftOwnsFk.get().refColumn(), false));
        }

        Optional<ForeignKeyInfo> rightOwnsFk = right.foreignKeys().stream()
                .filter(fk -> fk.refTable().equals(left.tableName()))
                .findFirst();
        if (rightOwnsFk.isPresent()) {
            return Optional.of(new EdgeKey(rightOwnsFk.get().refColumn(), rightOwnsFk.get().column(), false));
        }

        for (ForeignKeyInfo leftFk : left.foreignKeys()) {
            for (ForeignKeyInfo rightFk : right.foreignKeys()) {
                if (leftFk.refTable().equals(rightFk.refTable()) && leftFk.refColumn().equals(rightFk.refColumn())) {
                    return Optional.of(new EdgeKey(leftFk.column(), rightFk.column(), true));
                }
            }
        }

        return Optional.empty();
    }

    private String buildCombinedSql(String rootTable, List<JoinEdgeResult> edges) {
        StringBuilder sql = new StringBuilder("SELECT * FROM ").append(rootTable);
        for (JoinEdgeResult edge : edges) {
            sql.append("\nJOIN ").append(edge.toTable()).append(" ON ").append(edge.onClause());
        }
        return sql.toString();
    }
}
