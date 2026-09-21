import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';

/// TEMPORARY dev screen to preview loaders/skeletons.
/// Remove in Phase 6/7 once real screens consume them.
class LoadersPreviewScreen extends StatelessWidget {
  const LoadersPreviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loaders & Skeletons (dev)')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'AppLoader',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const Center(child: AppLoader(message: 'Restoring session…')),
          const SizedBox(height: 32),
          const Text(
            'Dashboard skeleton',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const DashboardSkeleton(),
          const SizedBox(height: 32),
          const Text(
            'Clients skeleton',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const ClientsSkeletonList(itemCount: 4),
          const SizedBox(height: 32),
          const Text(
            'Button states',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const ElevatedButton(onPressed: null, child: Text('Normal')),
          const SizedBox(height: 9),
          const ElevatedButton(onPressed: null, child: ButtonSpinner()),
          const SizedBox(height: 9),
          const ElevatedButton(
            onPressed: null,
            style: ButtonStyle(
              backgroundColor: WidgetStatePropertyAll(AppColors.line),
              foregroundColor: WidgetStatePropertyAll(AppColors.muted),
            ),
            child: Text('Disabled'),
          ),
        ],
      ),
    );
  }
}
