import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/router/app_router.dart';
import 'package:kumvwa_finance/core/theme/app_theme.dart';

/// Root widget of the app — wires theme + router together.
/// Kept separate from main.dart so tests/flavors can mount the app
/// without bootstrapping main().
class KumvwaApp extends ConsumerWidget {
  const KumvwaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'Kumvwa Finance',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: ref.watch(appRouterProvider),
    );
  }
}
