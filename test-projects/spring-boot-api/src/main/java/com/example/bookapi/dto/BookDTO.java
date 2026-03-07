package com.example.bookapi.dto;

import com.example.bookapi.entity.Book;
import java.util.List;
import java.util.stream.Collectors;

public class BookDTO {
    private Long id;
    private String title;
    private String isbn;
    private Integer publishedYear;
    private String description;
    private List<String> authorNames;

    public BookDTO() {
    }

    public BookDTO(Long id, String title, String isbn, Integer publishedYear, String description, List<String> authorNames) {
        this.id = id;
        this.title = title;
        this.isbn = isbn;
        this.publishedYear = publishedYear;
        this.description = description;
        this.authorNames = authorNames;
    }

    public static BookDTO fromEntity(Book book) {
        return new BookDTO(
            book.getId(),
            book.getTitle(),
            book.getIsbn(),
            book.getPublishedYear(),
            book.getDescription(),
            book.getAuthors().stream().map(author -> author.getName()).collect(Collectors.toList())
        );
    }

    // Getters and setters
    // ...
}
