import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../models/memo.dart';

class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  static Database? _database;

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
    var res = await db.query('memos', orderBy: 'updatedAt DESC');
    return res.isNotEmpty ? res.map((c) => Memo.fromMap(c)).toList() : [];
  }

  Future<Memo?> getMemoById(int id) async {
    final db = await database;
    var res = await db.query('memos', where: 'id = ?', whereArgs: [id]);
    return res.isNotEmpty ? Memo.fromMap(res.first) : null;
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
    var res = await db.query('memos', where: 'title LIKE ? OR content LIKE ?', whereArgs: ['%$query%', '%$query%']);
    return res.isNotEmpty ? res.map((c) => Memo.fromMap(c)).toList() : [];
  }
}
