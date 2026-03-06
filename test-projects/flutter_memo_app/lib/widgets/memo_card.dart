import 'package:flutter/material.dart';
import '../models/memo.dart';

class MemoCard extends StatelessWidget {
  final Memo memo;

  const MemoCard({Key? key, required this.memo}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: () {
          // Navigate to edit screen
        },
        child: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                memo.title,
                style: const TextStyle(fontWeight: FontWeight.bold),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4.0),
              Text(
                memo.content.length > 50
                    ? '${memo.content.substring(0, 50)}...'
                    : memo.content,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const Spacer(),
              Text(
                'Updated: ${memo.updatedAt.toLocal()}'.split(' ')[0],
                style: const TextStyle(color: Colors.grey, fontSize: 12.0),
              ),
            ],
          ),
        ),
      ),
    );
  }
}