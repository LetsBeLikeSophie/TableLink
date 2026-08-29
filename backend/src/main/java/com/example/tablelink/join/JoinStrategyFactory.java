package com.example.tablelink.join;

import org.springframework.stereotype.Component;

import com.example.tablelink.tablemeta.TableType;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JoinStrategyFactory {

    private final StateStateJoinStrategy stateStateJoinStrategy;
    private final StateHistoryJoinStrategy stateHistoryJoinStrategy;
    private final HistoryHistoryJoinStrategy historyHistoryJoinStrategy;

    public JoinStrategy resolve(TableType leftType, TableType rightType, boolean sharedParent) {
        if (sharedParent) {
            return historyHistoryJoinStrategy;
        }
        if (leftType == TableType.STATE && rightType == TableType.STATE) {
            return stateStateJoinStrategy;
        }
        return stateHistoryJoinStrategy;
    }

    public JoinType typeOf(TableType leftType, TableType rightType, boolean sharedParent) {
        if (sharedParent) {
            return JoinType.HISTORY_HISTORY;
        }
        if (leftType == TableType.STATE && rightType == TableType.STATE) {
            return JoinType.STATE_STATE;
        }
        return JoinType.STATE_HISTORY;
    }
}
