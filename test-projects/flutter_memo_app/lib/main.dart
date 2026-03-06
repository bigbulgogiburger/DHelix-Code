import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/memo_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/home_screen.dart';
import 'screens/editor_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => MemoProvider()..loadMemos()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()..loadTheme()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, child) {
          return MaterialApp(
            title: 'Flutter Memo App',
            theme: themeProvider.themeData,
            home: const HomeScreen(),
            routes: {
              '/editor': (context) => const EditorScreen(),
            },
          );
        },
      ),
    );
  }
}