package com.example.tablelink.join;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.tablelink.join.dto.JoinChainRequest;
import com.example.tablelink.join.dto.JoinChainResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/joins")
@RequiredArgsConstructor
public class JoinController {

    private final JoinService joinService;

    @PostMapping
    public JoinChainResponse buildChain(@Valid @RequestBody JoinChainRequest request) {
        return joinService.buildChain(request);
    }
}
