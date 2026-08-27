package com.example.tablelink.tablemeta;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.tablelink.tablemeta.dto.TableMetaRequest;
import com.example.tablelink.tablemeta.dto.TableMetaResponse;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/tables")
@RequiredArgsConstructor
public class TableMetaController {

    private final TableMetaService tableMetaService;

    @PostMapping
    public ResponseEntity<TableMetaResponse> register(@Valid @RequestBody TableMetaRequest request) {
        TableMetaResponse response = tableMetaService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public List<TableMetaResponse> findAll() {
        return tableMetaService.findAll();
    }
}
