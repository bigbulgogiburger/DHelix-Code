import 'package:flutter/material.dart';
import '../models/memo.dart';
import '../services/database_service.dart';

class MemoProvider extends ChangeNotifier {
  List<Memo> _memos = [];
  String _searchQuery = '';
  Memo? _lastDeletedMemo;

  List<Memo> get memos {
    if (_searchQuery.isEmpty) {
      return _memos;
    } else {
      return _memos.where((memo) => memo.title.contains(_searchQuery) || memo.content.contains(_searchQuery)).toList();
    }
  }

  String get searchQuery => _searchQuery;

  Future<void> loadMemos() async {
    _memos = await DatabaseService().getAllMemos();
    notifyListeners();
  }

  Future<void> addMemo(String title, String content) async {
    final newMemo = Memo(
      title: title,
      content: content,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    await DatabaseService().insertMemo(newMemo);
    await loadMemos();
  }

  Future<void> updateMemo(Memo memo) async {
    await DatabaseService().updateMemo(memo);
    await loadMemos();
  }

  Future<void> deleteMemo(int id) async {
    _lastDeletedMemo = _memos.firstWhere((memo) => memo.id == id);
    await DatabaseService().deleteMemo(id);
    await loadMemos();
  }

  void undoDelete() async {
    if (_lastDeletedMemo != null) {
      await DatabaseService().insertMemo(_lastDeletedMemo!);
      _lastDeletedMemo = null;
      await loadMemos();
    }
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }
}