package com.example.tablelink.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Three hardcoded demo accounts — see README "유저·국가별 데이터 격리". The
 * country lives as a granted authority (COUNTRY_KR / COUNTRY_US / COUNTRY_ALL)
 * rather than a separate lookup table, since with only a handful of static
 * accounts a real users table would be pure ceremony. COUNTRY_ALL is the
 * admin escape hatch — see the matching "OR ... = 'ALL'" clause on every RLS
 * policy in schema.sql.
 */
@Configuration
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public InMemoryUserDetailsManager userDetailsService(PasswordEncoder encoder) {
        UserDetails krUser = User.withUsername("kr_user")
                .password(encoder.encode("tablelink1234"))
                .authorities("COUNTRY_KR")
                .build();
        UserDetails usUser = User.withUsername("us_user")
                .password(encoder.encode("tablelink1234"))
                .authorities("COUNTRY_US")
                .build();
        UserDetails admin = User.withUsername("admin")
                .password(encoder.encode("tablelink1234"))
                .authorities("COUNTRY_ALL")
                .build();
        return new InMemoryUserDetailsManager(krUser, usUser, admin);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                // Session-cookie auth with no state-changing endpoints besides
                // login/logout itself; CSRF token plumbing across the two-hop
                // nginx proxy isn't worth it for a demo (see README caveats).
                .csrf(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                .formLogin(form -> form
                        .loginProcessingUrl("/auth/login")
                        .successHandler((req, res, authentication) -> res.setStatus(200))
                        .failureHandler((req, res, ex) -> res.setStatus(401))
                        .permitAll())
                .logout(logout -> logout
                        .logoutUrl("/auth/logout")
                        .logoutSuccessHandler((req, res, authentication) -> res.setStatus(200)))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, authException) -> res.sendError(401)));
        return http.build();
    }
}
