package com.example.bookapi.controller;

import com.example.bookapi.dto.CreateBookDTO;
import com.example.bookapi.entity.Book;
import com.example.bookapi.repository.BookRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
public class BookControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private ObjectMapper objectMapper;

    private CreateBookDTO createDto() {
        CreateBookDTO dto = new CreateBookDTO();
        dto.setTitle("Test Book");
        dto.setIsbn("1234567890");
        dto.setPublishedYear(2021);
        dto.setDescription("A test book description.");
        return dto;
    }

    @BeforeEach
    public void setup() {
        bookRepository.deleteAll();
    }

    @Test
    public void testGetAllBooks() throws Exception {
        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    public void testCreateBook() throws Exception {
        mockMvc.perform(post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createDto())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title").value("Test Book"));
    }

    @Test
    public void testGetBookById() throws Exception {
        Book book = new Book();
        book.setTitle("Test Book");
        book.setIsbn("1234567890");
        book.setPublishedYear(2021);
        book.setDescription("A test book description.");
        book = bookRepository.saveAndFlush(book);

        mockMvc.perform(get("/api/books/" + book.getId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Test Book"));
    }

    @Test
    public void testGetBookByIdNotFound() throws Exception {
        mockMvc.perform(get("/api/books/999"))
                .andExpect(status().isNotFound());
    }

    @Test
    public void testUpdateBook() throws Exception {
        Book book = new Book();
        book.setTitle("Test Book");
        book.setIsbn("1234567890");
        book.setPublishedYear(2021);
        book.setDescription("A test book description.");
        book = bookRepository.saveAndFlush(book);

        CreateBookDTO updateDto = createDto();
        updateDto.setTitle("Updated Test Book");

        mockMvc.perform(put("/api/books/" + book.getId())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Updated Test Book"));
    }

    @Test
    public void testDeleteBook() throws Exception {
        Book book = new Book();
        book.setTitle("Test Book");
        book.setIsbn("1234567890");
        book.setPublishedYear(2021);
        book.setDescription("A test book description.");
        book = bookRepository.saveAndFlush(book);

        mockMvc.perform(delete("/api/books/" + book.getId()))
                .andExpect(status().isNoContent());
    }
}
