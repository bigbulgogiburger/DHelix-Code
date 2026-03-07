package com.example.bookapi.dto;

import com.example.bookapi.entity.Book;
import com.example.bookapi.entity.Author;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

public class CreateBookDTO {
    private String title;
    private String isbn;
    private Integer publishedYear;
    private String description;
    private List<Long> authorIds;

    public static Book toEntity(CreateBookDTO dto, Set<Author> authors) {
        Book book = new Book();
        book.setTitle(dto.getTitle());
        book.setIsbn(dto.getIsbn());
        book.setPublishedYear(dto.getPublishedYear());
        book.setDescription(dto.getDescription());
        book.setAuthors(authors);
        return book;
    }

    // Getters and setters
    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getIsbn() {
        return isbn;
    }

    public void setIsbn(String isbn) {
        this.isbn = isbn;
    }

    public Integer getPublishedYear() {
        return publishedYear;
    }

    public void setPublishedYear(Integer publishedYear) {
        this.publishedYear = publishedYear;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<Long> getAuthorIds() {
        return authorIds;
    }

    public void setAuthorIds(List<Long> authorIds) {
        this.authorIds = authorIds;
    }
}
