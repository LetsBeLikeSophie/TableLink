package com.example.tablelink.join;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

import com.example.tablelink.common.query.PreviewQueryExecutor;
import com.example.tablelink.common.query.PreviewResult;
import com.example.tablelink.filter.FilterCondition;
import com.example.tablelink.filter.FilterConditionSqlBuilder;
import com.example.tablelink.filter.FilterValidationException;
import com.example.tablelink.join.dto.FilterConditionDto;
import com.example.tablelink.join.dto.JoinChainRequest;
import com.example.tablelink.join.dto.JoinChainResponse;
import com.example.tablelink.join.dto.JoinEdgeRequest;
import com.example.tablelink.join.dto.JoinEdgeResult;
import com.example.tablelink.tablemeta.schema.ColumnInfo;
import com.example.tablelink.tablemeta.schema.ForeignKeyInfo;
import com.example.tablelink.tablemeta.schema.ResolvedTable;
import com.example.tablelink.tablemeta.schema.TableSchemaResolver;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class JoinService {

    private static final int PREVIEW_ROW_LIMIT = 5;

    private final TableSchemaResolver tableSchemaResolver;
    private final JoinStrategyFactory joinStrategyFactory;
    private final PreviewQueryExecutor previewQueryExecutor;
    private final FilterConditionSqlBuilder filterConditionSqlBuilder;

    /**
     * left/right join columns for one edge, and whether the two tables share
     * a common FK parent rather than directly referencing each other
     * (the HISTORY-HISTORY case, e.g. service_history/ownership_history both
     * pointing at vehicle_id).
     */
    private record EdgeKey(String leftColumn, String rightColumn, boolean sharedParent) {
    }

    /** A validated, ordered join chain — tableOrder.get(0) is the root/FROM table. */
    public record ResolvedJoinChain(List<String> tableOrder, List<JoinEdgeResult> edges) {
    }

    public JoinChainResponse buildChain(JoinChainRequest request) {
        ResolvedJoinChain chain = resolveChain(request.rootTable(), request.edges());
        String sql = buildSelectAllSql(chain);

        List<Object> params = new ArrayList<>();
        String whereClause = buildWhereClause(chain.tableOrder(), request.filters(), params);
        String previewSql = whereClause.isEmpty() ? sql : sql + "\nWHERE " + whereClause;

        PreviewResult preview;
        try {
            preview = previewQueryExecutor.execute(previewSql, params, PREVIEW_ROW_LIMIT);
        } catch (DataAccessException e) {
            throw new JoinValidationException("조인 실행 중 오류가 발생했습니다: " + e.getMostSpecificCause().getMessage());
        }

        return new JoinChainResponse(chain.edges(), previewSql, preview.columns(), preview.rows());
    }

    /**
     * Validates and resolves a join chain starting from rootTable, following
     * edgeRequests in order. edgeRequests may be empty (a single, unjoined
     * root table is a valid — if trivial — chain).
     */
    public ResolvedJoinChain resolveChain(String rootTable, List<JoinEdgeRequest> edgeRequests) {
        if (tableSchemaResolver.resolve(rootTable) == null) {
            throw new JoinValidationException("존재하지 않는 테이블입니다: " + rootTable);
        }
        List<JoinEdgeResult> results = new ArrayList<>();
        List<String> tableOrder = new ArrayList<>();
        tableOrder.add(rootTable);

        if (edgeRequests == null) {
            return new ResolvedJoinChain(tableOrder, results);
        }

        for (JoinEdgeRequest edgeRequest : edgeRequests) {
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
            if (!tableOrder.contains(edgeRequest.toTable())) {
                tableOrder.add(edgeRequest.toTable());
            }
        }

        return new ResolvedJoinChain(tableOrder, results);
    }

    public String buildWhereClause(List<String> tableOrder, List<FilterConditionDto> filters, List<Object> params) {
        if (filters == null || filters.isEmpty()) {
            return "";
        }
        List<String> fragments = new ArrayList<>();
        for (FilterConditionDto filter : filters) {
            if (!tableOrder.contains(filter.tableName())) {
                throw new FilterValidationException(
                        "조인에 포함되지 않은 테이블은 필터할 수 없습니다: " + filter.tableName());
            }
            ResolvedTable table = tableSchemaResolver.resolve(filter.tableName());
            boolean validColumn = table.columns().stream().anyMatch(c -> c.name().equals(filter.column()));
            if (!validColumn) {
                throw new FilterValidationException(
                        "테이블 " + filter.tableName() + "에 존재하지 않는 컬럼입니다: " + filter.column());
            }
            FilterConditionSqlBuilder.Fragment fragment = filterConditionSqlBuilder.build(
                    new FilterCondition(filter.tableName(), filter.column(), filter.operator(), filter.value()));
            fragments.add(fragment.sql());
            params.addAll(fragment.params());
        }
        return String.join(" AND ", fragments);
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

    /** "FROM root\nJOIN b ON ...\nJOIN c ON ..." — no SELECT list. */
    public String buildFromJoinClause(ResolvedJoinChain chain) {
        StringBuilder sql = new StringBuilder("FROM ").append(chain.tableOrder().get(0));
        for (JoinEdgeResult edge : chain.edges()) {
            sql.append("\nJOIN ").append(edge.toTable()).append(" ON ").append(edge.onClause());
        }
        return sql.toString();
    }

    /**
     * Qualifies and aliases every column of every joined table as "table.column"
     * instead of SELECT *, since joined tables commonly share column names
     * (e.g. every table here has its own "vehicle_id") which would otherwise
     * silently collide in the result map.
     */
    public String buildSelectAllSql(ResolvedJoinChain chain) {
        List<String> selectColumns = new ArrayList<>();
        for (String tableName : chain.tableOrder()) {
            ResolvedTable table = tableSchemaResolver.resolve(tableName);
            for (ColumnInfo column : table.columns()) {
                String qualified = tableName + "." + column.name();
                selectColumns.add(qualified + " AS \"" + qualified + "\"");
            }
        }
        return "SELECT " + String.join(", ", selectColumns) + "\n" + buildFromJoinClause(chain);
    }
}
