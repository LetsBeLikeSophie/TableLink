package com.example.tablelink.tablemeta;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.tablelink.tablemeta.dto.DiscoveredTableDto;
import com.example.tablelink.tablemeta.dto.FilterableColumnsUpdateRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/tables")
@RequiredArgsConstructor
public class TableMetaController {

    private final TableMetaService tableMetaService;

    @GetMapping("/discover")
    public List<DiscoveredTableDto> discover() {
        return tableMetaService.discoverTables();
    }

    @PostMapping("/{tableName}/filterable-columns")
    public DiscoveredTableDto updateFilterableColumns(
            @PathVariable String tableName,
            @Valid @RequestBody FilterableColumnsUpdateRequest request) {
        return tableMetaService.updateFilterableColumns(tableName, request);
    }
}
