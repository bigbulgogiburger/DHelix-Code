import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_memo_app/models/memo.dart';
import 'package:flutter_memo_app/providers/memo_provider.dart';

void main() {
  group('Memo Model Tests', () {
    test('Create a Memo and verify fields', () {
      final memo = Memo(
        id: 1,
        title: 'Test Title',
        content: 'Test Content',
        createdAt: DateTime(2023, 10, 1),
        updatedAt: DateTime(2023, 10, 2),
      );

      expect(memo.id, 1);
      expect(memo.title, 'Test Title');
      expect(memo.content, 'Test Content');
      expect(memo.createdAt, DateTime(2023, 10, 1));
      expect(memo.updatedAt, DateTime(2023, 10, 2));
    });

    test('toMap returns correct map', () {
      final memo = Memo(
        id: 1,
        title: 'Test Title',
        content: 'Test Content',
        createdAt: DateTime(2023, 10, 1),
        updatedAt: DateTime(2023, 10, 2),
      );

      final map = memo.toMap();

      expect(map['id'], 1);
      expect(map['title'], 'Test Title');
      expect(map['content'], 'Test Content');
      expect(map['createdAt'], '2023-10-01T00:00:00.000');
      expect(map['updatedAt'], '2023-10-02T00:00:00.000');
    });

    test('fromMap creates correct Memo', () {
      final map = {
        'id': 1,
        'title': 'Test Title',
        'content': 'Test Content',
        'createdAt': '2023-10-01T00:00:00.000',
        'updatedAt': '2023-10-02T00:00:00.000',
      };

      final memo = Memo.fromMap(map);

      expect(memo.id, 1);
      expect(memo.title, 'Test Title');
      expect(memo.content, 'Test Content');
      expect(memo.createdAt, DateTime(2023, 10, 1));
      expect(memo.updatedAt, DateTime(2023, 10, 2));
    });

    test('copyWith creates modified copy', () {
      final memo = Memo(
        id: 1,
        title: 'Test Title',
        content: 'Test Content',
        createdAt: DateTime(2023, 10, 1),
        updatedAt: DateTime(2023, 10, 2),
      );

      final modifiedMemo = memo.copyWith(title: 'New Title');

      expect(modifiedMemo.id, 1);
      expect(modifiedMemo.title, 'New Title');
      expect(modifiedMemo.content, 'Test Content');
      expect(modifiedMemo.createdAt, DateTime(2023, 10, 1));
      expect(modifiedMemo.updatedAt, DateTime(2023, 10, 2));
    });
  });

  group('MemoProvider Basic Tests', () {
    test('Initial state has empty list', () {
      final provider = MemoProvider();

      expect(provider.memos, isEmpty);
    });

    test('searchQuery filtering works', () {
      final provider = MemoProvider();
      provider.addMemo('Test Title', 'Test Content');
      provider.setSearchQuery('Title');

      expect(provider.memos.length, 1);
      expect(provider.memos.first.title, 'Test Title');

      provider.setSearchQuery('Nonexistent');

      expect(provider.memos, isEmpty);
    });
  });
}
