package com.example.tablelink.tablemeta;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Stores only the user-curated filterableColumns whitelist for a table.
 * type/historySubType/primaryKey/dateColumn/endDateColumn/foreignKeys are
 * derived live from the DB schema (see SchemaIntrospectionRepository) instead
 * of being persisted here.
 */
@Entity
@Table(name = "table_meta")
@Getter
@Setter
@NoArgsConstructor
public class TableMeta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "table_name", nullable = false, unique = true)
    private String tableName;

    @ElementCollection
    @CollectionTable(name = "table_meta_filterable_column", joinColumns = @JoinColumn(name = "table_meta_id"))
    private List<FilterableColumn> filterableColumns = new ArrayList<>();
}
