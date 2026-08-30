package com.example.tablelink.segment;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.tablelink.join.dto.JoinChainRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/segments")
@RequiredArgsConstructor
public class SegmentController {

    private final SegmentService segmentService;

    @PostMapping
    public SegmentResultResponse run(@Valid @RequestBody JoinChainRequest request) {
        return segmentService.run(request);
    }
}
