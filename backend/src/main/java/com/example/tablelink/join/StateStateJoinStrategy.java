package com.example.tablelink.join;

import org.springframework.stereotype.Component;

/** STATE-STATE: plain key join, no extra condition (project-spec.md section 3). */
@Component
public class StateStateJoinStrategy implements JoinStrategy {

    @Override
    public String buildOnClause(JoinEdgeSpec spec) {
        return spec.left().tableName() + "." + spec.leftJoinColumn()
                + " = " + spec.right().tableName() + "." + spec.rightJoinColumn();
    }
}
