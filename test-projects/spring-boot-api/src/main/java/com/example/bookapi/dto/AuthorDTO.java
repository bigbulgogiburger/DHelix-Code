package com.example.bookapi.dto;

import com.example.bookapi.entity.Author;

public class AuthorDTO {
    private Long id;
    private String name;
    private String email;

    public AuthorDTO() {
    }

    public AuthorDTO(Long id, String name, String email) {
        this.id = id;
        this.name = name;
        this.email = email;
    }

    public static AuthorDTO fromEntity(Author author) {
        return new AuthorDTO(
            author.getId(),
            author.getName(),
            author.getEmail()
        );
    }

    // Getters and setters
    // ...
}
