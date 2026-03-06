package com.example.bookapi.service;

import com.example.bookapi.dto.BookDTO;
import com.example.bookapi.dto.CreateBookDTO;
import com.example.bookapi.entity.Book;
import com.example.bookapi.entity.Author;
import com.example.bookapi.exception.ResourceNotFoundException;
import com.example.bookapi.repository.BookRepository;
import com.example.bookapi.repository.AuthorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class BookService {

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private AuthorRepository authorRepository;

    public List<BookDTO> getAllBooks() {
        return bookRepository.findAll().stream().map(BookDTO::fromEntity).collect(Collectors.toList());
    }

    public BookDTO getBookById(Long id) {
        Book book = bookRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Book not found with id " + id));
        return BookDTO.fromEntity(book);
    }

    public BookDTO createBook(CreateBookDTO dto) {
        Book book = new Book();
        book.setTitle(dto.getTitle());
        book.setIsbn(dto.getIsbn());
        book.setPublishedYear(dto.getPublishedYear());
        book.setDescription(dto.getDescription());
        if (dto.getAuthorIds() != null) {
            List<Author> authors = authorRepository.findAllById(dto.getAuthorIds());
            book.setAuthors(authors.stream().collect(Collectors.toSet()));
        }
        book = bookRepository.save(book);
        return BookDTO.fromEntity(book);
    }

    public BookDTO updateBook(Long id, CreateBookDTO dto) {
        Book book = bookRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Book not found with id " + id));
        book.setTitle(dto.getTitle());
        book.setIsbn(dto.getIsbn());
        book.setPublishedYear(dto.getPublishedYear());
        book.setDescription(dto.getDescription());
        if (dto.getAuthorIds() != null) {
            List<Author> authors = authorRepository.findAllById(dto.getAuthorIds());
            book.setAuthors(authors.stream().collect(Collectors.toSet()));
        }
        book = bookRepository.save(book);
        return BookDTO.fromEntity(book);
    }

    public void deleteBook(Long id) {
        if (!bookRepository.existsById(id)) {
            throw new ResourceNotFoundException("Book not found with id " + id);
        }
        bookRepository.deleteById(id);
    }

    public List<BookDTO> searchBooks(String title) {
        return bookRepository.findByTitleContainingIgnoreCase(title).stream().map(BookDTO::fromEntity).collect(Collectors.toList());
    }
}
