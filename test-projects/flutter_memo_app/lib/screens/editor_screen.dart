import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/memo.dart';
import '../providers/memo_provider.dart';

class EditorScreen extends StatefulWidget {
  final Memo? memo;

  const EditorScreen({Key? key, this.memo}) : super(key: key);

  @override
  @override
  @override
  @override
  _EditorScreenState createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  late TextEditingController _titleController;
  late TextEditingController _contentController;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.memo?.title ?? '');
    _contentController = TextEditingController(text: widget.memo?.content ?? '');
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  void _saveMemo() {
    if (_titleController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title cannot be empty')),
      );
      return;
    }

    final memoProvider = Provider.of<MemoProvider>(context, listen: false);
    if (widget.memo == null) {
      memoProvider.addMemo(_titleController.text, _contentController.text);
    } else {
      final updatedMemo = widget.memo!.copyWith(
        title: _titleController.text,
        content: _contentController.text,
        updatedAt: DateTime.now(),
      );
      memoProvider.updateMemo(updatedMemo);
    }
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.memo == null ? 'New Memo' : 'Edit Memo'),
        actions: [
          IconButton(
            icon: Icon(Icons.save),
            onPressed: _saveMemo,
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _titleController,
              style: TextStyle(fontSize: 24.0, fontWeight: FontWeight.bold),
              decoration: const InputDecoration(hintText: 'Title', border: InputBorder.none),
            ),
            Expanded(
              child: TextField(
                controller: _contentController,
                decoration: const InputDecoration(hintText: 'Content', border: InputBorder.none),
                maxLines: null,
                expands: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}