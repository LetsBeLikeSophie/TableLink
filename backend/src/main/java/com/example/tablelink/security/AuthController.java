package com.example.tablelink.security;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final RlsCountryContext rlsCountryContext;

    public record MeResponse(String username, String country) {
    }

    /** 401s automatically when not authenticated (see SecurityConfig's entry point). */
    @GetMapping("/me")
    public MeResponse me(Authentication authentication) {
        return new MeResponse(authentication.getName(), rlsCountryContext.currentCountry());
    }
}
