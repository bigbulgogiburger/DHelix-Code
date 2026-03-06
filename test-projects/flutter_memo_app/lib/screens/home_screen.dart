import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/memo_provider.dart';

import '../widgets/memo_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  @override
  @override
  @override
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isSearching = false;

  @override
  Widget build(BuildContext context) {
    return Consumer<MemoProvider>(
      builder: (context, memoProvider, child) {
        return Scaffold(
          appBar: AppBar(
            title: _isSearching
                ? TextField(
                    autofocus: true,
                    decoration: InputDecoration(hintText: 'Search...'),
                    onChanged: (query) {
                      memoProvider.setSearchQuery(query);
                    },
                  )
                : Text('Memos'),
            actions: [
              IconButton(
                icon: Icon(_isSearching ? Icons.close : Icons.search),
                onPressed: () {
                  setState(() {
                    _isSearching = !_isSearching;
                    if (!_isSearching) {
                      memoProvider.setSearchQuery('');
                    }
                  });
                },
              ),
            ],
          ),
          body: GridView.builder(
            padding: EdgeInsets.all(8.0),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 3 / 2,
              crossAxisSpacing: 8.0,
              mainAxisSpacing: 8.0,
            ),
            itemCount: memoProvider.memos.length,
            itemBuilder: (context, index) {
              final memo = memoProvider.memos[index];
              return Dismissible(
                key: Key(memo.id.toString()),
                direction: DismissDirection.endToStart,
                onDismissed: (direction) {
                  memoProvider.deleteMemo(memo.id!);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Memo deleted'),
                      action: SnackBarAction(
                        label: 'Undo',
                        onPressed: () {
                          memoProvider.undoDelete();
                        },
                      ),
                    ),
                  );
                },
                background: Container(color: Colors.red),
                child: MemoCard(memo: memo),
              );
            },
          ),
          floatingActionButton: FloatingActionButton(
            onPressed: () {
              // Navigate to create memo screen
            },
            child: Icon(Icons.add),
          ),
        );
      },
    );
  }
}