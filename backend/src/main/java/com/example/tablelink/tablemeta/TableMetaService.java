package com.example.tablelink.tablemeta;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.example.tablelink.tablemeta.dto.FilterableColumnDto;
import com.example.tablelink.tablemeta.dto.ForeignKeyDto;
import com.example.tablelink.tablemeta.dto.TableMetaRequest;
import com.example.tablelink.tablemeta.dto.TableMetaResponse;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TableMetaService {

    private final TableMetaRepository tableMetaRepository;

    @Transactional
    public TableMetaResponse register(TableMetaRequest request) {
        if (tableMetaRepository.existsByTableName(request.tableName())) {
            throw new TableMetaValidationException(
                    "이미 등록된 테이블입니다: " + request.tableName());
        }
        validateTypeConsistency(request);

        TableMeta entity = toEntity(request);
        TableMeta saved = tableMetaRepository.save(entity);
        return toResponse(saved);
    }

    public List<TableMetaResponse> findAll() {
        return tableMetaRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    private void validateTypeConsistency(TableMetaRequest request) {
        if (request.type() == TableType.STATE) {
            if (request.historySubType() != null) {
                throw new TableMetaValidationException("STATE 테이블은 historySubType을 가질 수 없습니다.");
            }
            if (StringUtils.hasText(request.dateColumn()) || StringUtils.hasText(request.endDateColumn())) {
                throw new TableMetaValidationException("STATE 테이블은 dateColumn/endDateColumn을 가질 수 없습니다.");
            }
            return;
        }

        // HISTORY
        if (request.historySubType() == null) {
            throw new TableMetaValidationException("HISTORY 테이블은 historySubType(POINT/RANGE)이 필수입니다.");
        }
        if (!StringUtils.hasText(request.dateColumn())) {
            throw new TableMetaValidationException("HISTORY 테이블은 dateColumn이 필수입니다.");
        }
        if (request.historySubType() == HistorySubType.RANGE
                && !StringUtils.hasText(request.endDateColumn())) {
            throw new TableMetaValidationException("RANGE 타입 HISTORY 테이블은 endDateColumn이 필수입니다.");
        }
        if (request.historySubType() == HistorySubType.POINT
                && StringUtils.hasText(request.endDateColumn())) {
            throw new TableMetaValidationException("POINT 타입 HISTORY 테이블은 endDateColumn을 가질 수 없습니다.");
        }
    }

    private TableMeta toEntity(TableMetaRequest request) {
        TableMeta entity = new TableMeta();
        entity.setTableName(request.tableName());
        entity.setType(request.type());
        entity.setHistorySubType(request.historySubType());
        entity.setPrimaryKey(request.primaryKey());
        entity.setDateColumn(request.dateColumn());
        entity.setEndDateColumn(request.endDateColumn());

        if (request.foreignKeys() != null) {
            entity.setForeignKeys(request.foreignKeys().stream()
                    .map(fk -> new ForeignKeyRef(fk.column(), fk.refTable(), fk.refColumn()))
                    .toList());
        }
        if (request.filterableColumns() != null) {
            entity.setFilterableColumns(request.filterableColumns().stream()
                    .map(fc -> new FilterableColumn(fc.column(), fc.valueType()))
                    .toList());
        }
        return entity;
    }

    private TableMetaResponse toResponse(TableMeta entity) {
        List<ForeignKeyDto> foreignKeys = entity.getForeignKeys().stream()
                .map(fk -> new ForeignKeyDto(fk.getColumn(), fk.getRefTable(), fk.getRefColumn()))
                .toList();
        List<FilterableColumnDto> filterableColumns = entity.getFilterableColumns().stream()
                .map(fc -> new FilterableColumnDto(fc.getColumn(), fc.getValueType()))
                .toList();

        return new TableMetaResponse(
                entity.getId(),
                entity.getTableName(),
                entity.getType(),
                entity.getHistorySubType(),
                entity.getPrimaryKey(),
                entity.getDateColumn(),
                entity.getEndDateColumn(),
                foreignKeys,
                filterableColumns
        );
    }
}
