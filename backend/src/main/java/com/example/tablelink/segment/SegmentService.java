package com.example.tablelink.segment;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.tablelink.common.query.PreviewQueryExecutor;
import com.example.tablelink.common.query.PreviewResult;
import com.example.tablelink.join.JoinService;
import com.example.tablelink.join.JoinValidationException;
import com.example.tablelink.join.dto.JoinChainRequest;
import com.example.tablelink.security.RlsCountryContext;
import com.example.tablelink.tablemeta.schema.ColumnInfo;
import com.example.tablelink.tablemeta.schema.ResolvedTable;
import com.example.tablelink.tablemeta.schema.TableSchemaResolver;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SegmentService {

    // Dummy-data scale (project-spec.md section 8) is small enough that this
    // is a safety cap, not real pagination.
    private static final int RESULT_ROW_LIMIT = 500;

    private final JoinService joinService;
    private final TableSchemaResolver tableSchemaResolver;
    private final PreviewQueryExecutor previewQueryExecutor;
    private final JdbcTemplate jdbcTemplate;
    private final RlsCountryContext rlsCountryContext;

    @Transactional
    public SegmentResultResponse run(JoinChainRequest request) {
        rlsCountryContext.applyCurrentUserCountry();
        JoinService.ResolvedJoinChain chain = joinService.resolveChain(request.rootTable(), request.edges());
        String rootTable = chain.tableOrder().get(0);
        ResolvedTable root = tableSchemaResolver.resolve(rootTable);

        List<Object> params = new ArrayList<>();
        String whereClause = joinService.buildWhereClause(chain.tableOrder(), request.filters(), params);
        String fromJoin = joinService.buildFromJoinClause(chain);
        String where = whereClause.isEmpty() ? "" : "\nWHERE " + whereClause;

        try {
            long totalCount = queryCount("SELECT COUNT(*) FROM " + rootTable, List.of());
            long matchedCount = queryCount(
                    "SELECT COUNT(DISTINCT " + rootTable + "." + root.primaryKey() + ")\n" + fromJoin + where,
                    params);

            String selectColumns = root.columns().stream()
                    .map(ColumnInfo::name)
                    .map(name -> rootTable + "." + name + " AS \"" + name + "\"")
                    .collect(Collectors.joining(", "));
            String dataSql = "SELECT DISTINCT " + selectColumns + "\n" + fromJoin + where;
            PreviewResult data = previewQueryExecutor.execute(dataSql, params, RESULT_ROW_LIMIT);

            double percentage = totalCount == 0 ? 0.0 : (matchedCount * 100.0 / totalCount);
            return new SegmentResultResponse(rootTable, data.columns(), data.rows(), matchedCount, totalCount,
                    percentage);
        } catch (DataAccessException e) {
            throw new JoinValidationException("세그먼트 조회 중 오류가 발생했습니다: " + e.getMostSpecificCause().getMessage());
        }
    }

    private long queryCount(String sql, List<Object> params) {
        Long count = jdbcTemplate.queryForObject(sql, params.toArray(), Long.class);
        return count == null ? 0 : count;
    }
}
