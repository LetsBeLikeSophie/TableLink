package com.example.tablelink.join;

import org.springframework.stereotype.Component;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.TableType;
import com.example.tablelink.tablemeta.schema.ResolvedTable;

/**
 * STATE-HISTORY: key join + optional "latest only" narrowing
 * (project-spec.md section 3). RANGE uses end_date IS NULL; POINT has no
 * end marker so "latest" means the max date per parent, via a correlated
 * subquery.
 */
@Component
public class StateHistoryJoinStrategy implements JoinStrategy {

    @Override
    public String buildOnClause(JoinEdgeSpec spec) {
        String base = spec.left().tableName() + "." + spec.leftJoinColumn()
                + " = " + spec.right().tableName() + "." + spec.rightJoinColumn();
        if (!spec.latestOnly()) {
            return base;
        }

        boolean leftIsHistory = spec.left().type() == TableType.HISTORY;
        ResolvedTable historyTable = leftIsHistory ? spec.left() : spec.right();
        String historyJoinColumn = leftIsHistory ? spec.leftJoinColumn() : spec.rightJoinColumn();
        ResolvedTable parentTable = leftIsHistory ? spec.right() : spec.left();
        String parentJoinColumn = leftIsHistory ? spec.rightJoinColumn() : spec.leftJoinColumn();

        if (historyTable.historySubType() == HistorySubType.RANGE) {
            return base + " AND " + historyTable.tableName() + "." + historyTable.endDateColumn() + " IS NULL";
        }

        String latestSubquery = "(SELECT MAX(" + historyTable.dateColumn() + ") FROM " + historyTable.tableName()
                + " WHERE " + historyJoinColumn + " = " + parentTable.tableName() + "." + parentJoinColumn + ")";
        return base + " AND " + historyTable.tableName() + "." + historyTable.dateColumn() + " = " + latestSubquery;
    }
}
