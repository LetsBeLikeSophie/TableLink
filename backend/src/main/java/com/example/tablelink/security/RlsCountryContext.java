package com.example.tablelink.security;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

/**
 * Bridges the logged-in user's country to Postgres row-level security.
 *
 * Must be called at the very start of a @Transactional method, on the same
 * connection the subsequent query runs on — set_config's third argument
 * (is_local=true) scopes the setting to the current transaction only, so it
 * can never leak to a different request that later reuses the same pooled
 * connection (see README caveats on RLS + HikariCP).
 */
@Component
@RequiredArgsConstructor
public class RlsCountryContext {

    private static final String AUTHORITY_PREFIX = "COUNTRY_";

    private final JdbcTemplate jdbcTemplate;

    public void applyCurrentUserCountry() {
        // set_config() returns the value it set, so this is a query, not an
        // update — JdbcTemplate#update rejects statements that return a result set.
        jdbcTemplate.queryForObject(
                "SELECT set_config('app.current_country', ?, true)", String.class, currentCountry());
    }

    public String currentCountry() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            throw new IllegalStateException("인증된 사용자가 없습니다.");
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .filter(a -> a.startsWith(AUTHORITY_PREFIX))
                .map(a -> a.substring(AUTHORITY_PREFIX.length()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("계정에 국가 권한이 없습니다: " + auth.getName()));
    }
}
