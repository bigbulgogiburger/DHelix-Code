package com.example.bookapi.dto;

import java.util.List;

public class CreateBookDTO {
    private String title;
    private String isbn;
    private Integer publishedYear;
    private String description;
    private List<Long> authorIds;

    public CreateBookDTO() {
    }

    public CreateBookDTO(String title, String isbn, Integer publishedYear, String description, List<Long> authorIds) {
        this.title = title;
        this.isbn = isbn;
        this.publishedYear = publishedYear;
        this.description = description;
        this.authorIds = authorIds;
    }

    // Getters and setters
    // ...
}
