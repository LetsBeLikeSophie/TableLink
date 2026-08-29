package com.example.tablelink.join;

import com.example.tablelink.tablemeta.schema.ResolvedTable;

/**
 * Everything a JoinStrategy needs to build the ON clause for one edge.
 * left/right correspond 1:1 to the request's fromTable/toTable; leftJoinColumn
 * and rightJoinColumn are the two columns being equated (already resolved,
 * whichever side actually owns the FK — see JoinService#resolveEdgeKey).
 */
public record JoinEdgeSpec(
        ResolvedTable left,
        String leftJoinColumn,
        ResolvedTable right,
        String rightJoinColumn,
        boolean latestOnly
) {
}
