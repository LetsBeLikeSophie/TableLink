package com.example.tablelink.tablemeta;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class FilterableColumn {

    @Column(name = "filter_column")
    private String column;

    @Enumerated(EnumType.STRING)
    @Column(name = "value_type")
    private FilterValueType valueType;
}
