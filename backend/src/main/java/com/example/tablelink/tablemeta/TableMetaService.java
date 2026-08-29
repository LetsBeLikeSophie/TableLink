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
import com.example.tablelink.tablemeta.schema.ForeignKeyInfo;
import com.example.tablelink.tablemeta.schema.SchemaIntrospectionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TableMetaService {

    private static final String HISTORY_SUFFIX = "_history";
    private static final String END_DATE_COLUMN = "end_date";

    private static final Set<String> DATE_SQL_TYPES = Set.of(
            "date", "timestamp without time zone", "timestamp with time zone");
    private static final Set<String> NUMBER_SQL_TYPES = Set.of(
            "bigint", "integer", "smallint", "numeric", "decimal", "double precision", "real");

    private final TableMetaRepository tableMetaRepository;
    private final SchemaIntrospectionRepository schemaIntrospectionRepository;

    public List<DiscoveredTableDto> discoverTables() {
        return schemaIntrospectionRepository.findTableNames().stream()
                .map(this::discoverTable)
                .toList();
    }

    @Transactional
    public DiscoveredTableDto updateFilterableColumns(String tableName, FilterableColumnsUpdateRequest request) {
        Set<String> validColumns = schemaIntrospectionRepository.findColumns(tableName).stream()
                .map(ColumnInfo::name)
                .collect(Collectors.toSet());
        if (validColumns.isEmpty()) {
            throw new TableMetaValidationException("존재하지 않는 테이블입니다: " + tableName);
        }
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
        List<ColumnInfo> columns = schemaIntrospectionRepository.findColumns(tableName);
        String primaryKey = schemaIntrospectionRepository.findPrimaryKeyColumn(tableName);
        List<ForeignKeyInfo> foreignKeys = schemaIntrospectionRepository.findForeignKeys(tableName);
        Set<String> foreignKeyColumns = foreignKeys.stream()
                .map(ForeignKeyInfo::column)
                .collect(Collectors.toSet());

        TableType type = tableName.endsWith(HISTORY_SUFFIX) ? TableType.HISTORY : TableType.STATE;
        HistorySubType historySubType = null;
        String dateColumn = null;
        String endDateColumn = null;

        if (type == TableType.HISTORY) {
            List<String> dateColumnNames = columns.stream()
                    .filter(c -> DATE_SQL_TYPES.contains(c.sqlType()))
                    .map(ColumnInfo::name)
                    .toList();
            boolean hasEndDate = dateColumnNames.contains(END_DATE_COLUMN);
            if (hasEndDate) {
                historySubType = HistorySubType.RANGE;
                endDateColumn = END_DATE_COLUMN;
                dateColumn = dateColumnNames.stream()
                        .filter(name -> !name.equals(END_DATE_COLUMN))
                        .findFirst()
                        .orElse(null);
            } else {
                historySubType = HistorySubType.POINT;
                dateColumn = dateColumnNames.stream().findFirst().orElse(null);
            }
        }

        List<ForeignKeyDto> foreignKeyDtos = foreignKeys.stream()
                .map(fk -> new ForeignKeyDto(fk.column(), fk.refTable(), fk.refColumn()))
                .toList();

        List<FilterableColumnDto> availableColumns = defaultFilterableColumns(columns, primaryKey, foreignKeyColumns);

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

        return new DiscoveredTableDto(tableName, type, historySubType, primaryKey, dateColumn, endDateColumn,
                foreignKeyDtos, availableColumns, filterableColumns, confirmed);
    }

    private List<FilterableColumnDto> defaultFilterableColumns(
            List<ColumnInfo> columns, String primaryKey, Set<String> foreignKeyColumns) {
        return columns.stream()
                .filter(c -> !c.name().equals(primaryKey) && !foreignKeyColumns.contains(c.name()))
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
