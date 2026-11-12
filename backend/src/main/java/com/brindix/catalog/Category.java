package com.brindix.catalog;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "categories")
@Getter
@Setter
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long venueId;
    private String name;
    private String icon;
    /** Ilustracion por defecto para productos sin foto: beer, cocktail, spirit, shot, soft, food, coffee, wine. */
    private String art;
    private int sortOrder;
    private boolean active = true;
}
