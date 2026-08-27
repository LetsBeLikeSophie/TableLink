package com.example.tablelink.tablemeta;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TableMetaRepository extends JpaRepository<TableMeta, Long> {

    Optional<TableMeta> findByTableName(String tableName);

    boolean existsByTableName(String tableName);
}
