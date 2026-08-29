package com.example.tablelink.join;

import org.springframework.stereotype.Component;

import com.example.tablelink.tablemeta.HistorySubType;
import com.example.tablelink.tablemeta.schema.ResolvedTable;

/**
 * HISTORY-HISTORY: key join (usually a shared FK to a common STATE parent,
 * e.g. both reference vehicle_id) plus a temporal condition when one side is
 * RANGE and the other POINT: the point must fall inside the range
 * (project-spec.md section 3, BETWEEN example). When both sides are the same
 * subtype there's no documented rule, so this falls back to the plain key
 * join.
 */
@Component
public class HistoryHistoryJoinStrategy implements JoinStrategy {

    @Override
    public String buildOnClause(JoinEdgeSpec spec) {
        String base = spec.left().tableName() + "." + spec.leftJoinColumn()
                + " = " + spec.right().tableName() + "." + spec.rightJoinColumn();

        if (spec.left().historySubType() == HistorySubType.RANGE
                && spec.right().historySubType() == HistorySubType.POINT) {
            return base + " AND " + pointWithinRange(spec.right(), spec.left());
        }
        if (spec.right().historySubType() == HistorySubType.RANGE
                && spec.left().historySubType() == HistorySubType.POINT) {
            return base + " AND " + pointWithinRange(spec.left(), spec.right());
        }
        return base;
    }

    private String pointWithinRange(ResolvedTable pointTable, ResolvedTable rangeTable) {
        return pointTable.tableName() + "." + pointTable.dateColumn()
                + " BETWEEN " + rangeTable.tableName() + "." + rangeTable.dateColumn()
                + " AND COALESCE(" + rangeTable.tableName() + "." + rangeTable.endDateColumn() + ", CURRENT_DATE)";
    }
}
