package com.example.tablelink.tablemeta;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ForeignKeyRef {

    @Column(name = "fk_column")
    private String column;

    @Column(name = "ref_table")
    private String refTable;

    @Column(name = "ref_column")
    private String refColumn;
}
