package com.example.tablelink.tablemeta;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.tablelink.tablemeta.dto.DiscoveredTableDto;
import com.example.tablelink.tablemeta.dto.FilterableColumnDto;
import com.example.tablelink.tablemeta.dto.FilterableColumnsUpdateRequest;
import com.example.tablelink.tablemeta.dto.ForeignKeyDto;
import com.example.tablelink.tablemeta.schema.ColumnInfo;
import com.example.tablelink.tablemeta.schema.ResolvedTable;
import com.example.tablelink.tablemeta.schema.TableSchemaResolver;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TableMetaService {

    private static final Set<String> DATE_SQL_TYPES = Set.of(
            "date", "timestamp without time zone", "timestamp with time zone");
    private static final Set<String> NUMBER_SQL_TYPES = Set.of(
            "bigint", "integer", "smallint", "numeric", "decimal", "double precision", "real");

    private final TableMetaRepository tableMetaRepository;
    private final TableSchemaResolver tableSchemaResolver;

    public List<DiscoveredTableDto> discoverTables() {
        return tableSchemaResolver.findTableNames().stream()
                .map(this::discoverTable)
                .toList();
    }

    @Transactional
    public DiscoveredTableDto updateFilterableColumns(String tableName, FilterableColumnsUpdateRequest request) {
        ResolvedTable table = tableSchemaResolver.resolve(tableName);
        if (table == null) {
            throw new TableMetaValidationException("존재하지 않는 테이블입니다: " + tableName);
        }
        Set<String> validColumns = table.columns().stream().map(ColumnInfo::name).collect(Collectors.toSet());
        for (FilterableColumnDto column : request.filterableColumns()) {
            if (!validColumns.contains(column.column())) {
                throw new TableMetaValidationException(
                        "테이블 " + tableName + "에 존재하지 않는 컬럼입니다: " + column.column());
            }
        }

        TableMeta entity = tableMetaRepository.findByTableName(tableName)
                .orElseGet(() -> {
                    TableMeta created = new TableMeta();
                    created.setTableName(tableName);
                    return created;
                });
        entity.setFilterableColumns(request.filterableColumns().stream()
                .map(dto -> new FilterableColumn(dto.column(), dto.valueType()))
                .collect(Collectors.toCollection(ArrayList::new)));
        tableMetaRepository.save(entity);

        return discoverTable(tableName);
    }

    private DiscoveredTableDto discoverTable(String tableName) {
        ResolvedTable table = tableSchemaResolver.resolve(tableName);

        List<ForeignKeyDto> foreignKeyDtos = table.foreignKeys().stream()
                .map(fk -> new ForeignKeyDto(fk.column(), fk.refTable(), fk.refColumn()))
                .toList();

        List<FilterableColumnDto> availableColumns = defaultFilterableColumns(table);

        var saved = tableMetaRepository.findByTableName(tableName);
        List<FilterableColumnDto> filterableColumns;
        boolean confirmed;
        if (saved.isPresent()) {
            filterableColumns = saved.get().getFilterableColumns().stream()
                    .map(fc -> new FilterableColumnDto(fc.getColumn(), fc.getValueType()))
                    .toList();
            confirmed = true;
        } else {
            filterableColumns = availableColumns;
            confirmed = false;
        }

        return new DiscoveredTableDto(table.tableName(), table.type(), table.historySubType(), table.primaryKey(),
                table.dateColumn(), table.endDateColumn(), foreignKeyDtos, availableColumns, filterableColumns,
                confirmed);
    }

    private List<FilterableColumnDto> defaultFilterableColumns(ResolvedTable table) {
        Set<String> foreignKeyColumns = table.foreignKeys().stream()
                .map(fk -> fk.column())
                .collect(Collectors.toSet());
        return table.columns().stream()
                .filter(c -> !c.name().equals(table.primaryKey()) && !foreignKeyColumns.contains(c.name()))
                .map(c -> new FilterableColumnDto(c.name(), inferValueType(c.sqlType())))
                .toList();
    }

    private FilterValueType inferValueType(String sqlType) {
        if (DATE_SQL_TYPES.contains(sqlType)) {
            return FilterValueType.DATE;
        }
        if (NUMBER_SQL_TYPES.contains(sqlType)) {
            return FilterValueType.NUMBER;
        }
        return FilterValueType.FREE_TEXT;
    }
}
