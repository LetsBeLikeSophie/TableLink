package com.example.tablelink.tablemeta;

import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "table_type", nullable = false)
    private TableType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "history_sub_type")
    private HistorySubType historySubType;

    @Column(name = "primary_key_column", nullable = false)
    private String primaryKey;

    @Column(name = "date_column")
    private String dateColumn;

    @Column(name = "end_date_column")
    private String endDateColumn;

    @ElementCollection
    @CollectionTable(name = "table_meta_foreign_key", joinColumns = @JoinColumn(name = "table_meta_id"))
    private List<ForeignKeyRef> foreignKeys = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "table_meta_filterable_column", joinColumns = @JoinColumn(name = "table_meta_id"))
    private List<FilterableColumn> filterableColumns = new ArrayList<>();
}
