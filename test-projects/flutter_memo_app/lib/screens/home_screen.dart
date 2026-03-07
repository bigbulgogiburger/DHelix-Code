import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/memo_provider.dart';
import '../widgets/memo_card.dart';
import 'editor_screen.dart';

class HomeScreen extends StatefulWidget {
  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isSearching = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: _isSearching
            ? TextField(
                autofocus: true,
                decoration: InputDecoration(hintText: 'Search...'),
                onChanged: (query) {
                  Provider.of<MemoProvider>(context, listen: false).setSearchQuery(query);
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
                  Provider.of<MemoProvider>(context, listen: false).setSearchQuery('');
                }
              });
            },
          ),
        ],
      ),
      body: Consumer<MemoProvider>(
        builder: (context, memoProvider, child) {
          return GridView.builder(
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2),
            itemCount: memoProvider.memos.length,
            itemBuilder: (context, index) {
              final memo = memoProvider.memos[index];
              return Dismissible(
                key: Key(memo.id.toString()),
                background: Container(color: Colors.red),
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
                child: MemoCard(memo: memo),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => EditorScreen()),
          );
        },
        child: Icon(Icons.add),
      ),
    );
  }
}
