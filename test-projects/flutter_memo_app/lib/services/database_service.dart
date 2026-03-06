import 'dart:async';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:flutter/foundation.dart';

import 'package:path_provider/path_provider.dart';
import '../models/memo.dart';
import 'dart:io';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  static Database? _database;

  DatabaseService._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB();
    return _database!;
  }

  Future<Database> _initDB() async {
    Directory documentsDirectory = await getApplicationDocumentsDirectory();
    String path = join(documentsDirectory.path, 'memo.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute(
          'CREATE TABLE memos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, content TEXT, createdAt TEXT, updatedAt TEXT)'
        );
      },
    );
  }

  Future<int> insertMemo(Memo memo) async {
    final db = await database;
    return await db.insert('memos', memo.toMap());
  }

  Future<List<Memo>> getAllMemos() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('memos', orderBy: 'updatedAt DESC');
    return List.generate(maps.length, (i) {
      return Memo.fromMap(maps[i]);
    });
  }

  Future<Memo?> getMemoById(int id) async {
    final db = await database;
    List<Map<String, dynamic>> maps = await db.query('memos', where: 'id = ?', whereArgs: [id]);
    if (maps.isNotEmpty) {
      return Memo.fromMap(maps.first);
    }
    return null;
  }

  Future<int> updateMemo(Memo memo) async {
    final db = await database;
    return await db.update('memos', memo.toMap(), where: 'id = ?', whereArgs: [memo.id]);
  }

  Future<int> deleteMemo(int id) async {
    final db = await database;
    return await db.delete('memos', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<Memo>> searchMemos(String query) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'memos',
      where: 'title LIKE ? OR content LIKE ?',
      whereArgs: ['%$query%', '%$query%'],
    );
    return List.generate(maps.length, (i) {
      return Memo.fromMap(maps[i]);
    });
  }
}