package com.brindix.tables;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "bar_tables")
@Getter
@Setter
public class BarTable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String name;
    /** Token publico del QR: /m/{code}. Se puede regenerar si alguien lo copia. */
    private String code;
    private String zone;
    private int seats = 4;
    private int sortOrder;
    private boolean active = true;
    /** Eliminada por el administrador: no se lista, su QR no sirve y su historial se conserva. */
    private boolean archived;
}
