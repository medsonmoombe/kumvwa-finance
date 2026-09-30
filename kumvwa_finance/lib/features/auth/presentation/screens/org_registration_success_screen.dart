import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/widgets/success_screen.dart';

class OrgRegistrationSuccessScreen extends StatelessWidget {
  const OrgRegistrationSuccessScreen({
    super.key,
    required this.businessName,
  });

  final String businessName;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SuccessScreen(
          title: 'Organisation Registered',
          subtitle:
              'Your application is under review. We\'ll notify you once approved — usually within 1–2 business days.',
          checks: [
            SuccessCheckRow(
              title: businessName,
              subtitle: 'Business name registered',
            ),
            SuccessCheckRow(
              title: 'Contact identity',
              subtitle: 'NRC captured for review',
            ),
            SuccessCheckRow(
              title: 'Platform Terms',
              subtitle: 'Accepted',
              showDivider: false,
            ),
          ],
          primaryLabel: 'Go to Dashboard',
          onPrimary: () => context.go('/lender/home'),
        ),
      ),
    );
  }
}
