import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/memo.dart';
import '../providers/memo_provider.dart';

class EditorScreen extends StatefulWidget {
  final Memo? memo;

  EditorScreen({this.memo});

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.memo == null ? 'New Memo' : 'Edit Memo'),
        actions: [
          IconButton(
            icon: Icon(Icons.save),
            onPressed: () {
              if (_titleController.text.isNotEmpty) {
                if (widget.memo == null) {
                  Provider.of<MemoProvider>(context, listen: false).addMemo(
                    _titleController.text,
                    _contentController.text,
                  );
                } else {
                  final updatedMemo = widget.memo!.copyWith(
                    title: _titleController.text,
                    content: _contentController.text,
                    updatedAt: DateTime.now(),
                  );
                  Provider.of<MemoProvider>(context, listen: false).updateMemo(updatedMemo);
                }
                Navigator.pop(context);
              }
            },
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _titleController,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              decoration: InputDecoration(hintText: 'Title', border: InputBorder.none),
            ),
            Expanded(
              child: TextField(
                controller: _contentController,
                decoration: InputDecoration(hintText: 'Content', border: InputBorder.none),
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