import 'package:flutter/material.dart';
import '../models/memo.dart';
import '../screens/editor_screen.dart';

class MemoCard extends StatelessWidget {
  final Memo memo;

  const MemoCard({Key? key, required this.memo}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => EditorScreen(memo: memo),
            ),
          );
        },
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
              SizedBox(height: 8),
              Text(
                'Last edited: ${memo.updatedAt.toLocal()}'.split(' ')[0],
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
