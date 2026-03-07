import 'package:flutter/material.dart';
import '../models/memo.dart';

class MemoCard extends StatelessWidget {
  final Memo memo;

  MemoCard({required this.memo});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              memo.title,
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 4),
            Text(
              memo.content.length > 50 ? memo.content.substring(0, 50) + '...' : memo.content,
            ),
            SizedBox(height: 4),
            Text(
              'Last edited: ${memo.updatedAt.toLocal()}'.split(' ')[0],
              style: TextStyle(color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}