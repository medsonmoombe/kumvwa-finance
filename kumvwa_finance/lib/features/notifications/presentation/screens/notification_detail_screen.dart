import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';

/// Detail fallback for notices that do not point to a loan or application.
class NotificationDetailScreen extends StatelessWidget {
  const NotificationDetailScreen({super.key, required this.notification});

  final AppNotification? notification;

  @override
  Widget build(BuildContext context) {
    final item = notification;
    if (item == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Notification')),
        body: const Center(child: Text('Notification details are unavailable')),
      );
    }

    final visual = _visualFor(item.type);
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('Notification')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
          children: [
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: visual.$1,
                  shape: BoxShape.circle,
                ),
                child: Icon(visual.$3, size: 32, color: visual.$2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              item.title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 21,
                fontWeight: FontWeight.w800,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              item.body,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                height: 1.55,
                color: AppColors.muted,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  _DetailRow(label: 'Received', value: Fmt.date(item.time)),
                  const Divider(height: 1, color: AppColors.line),
                  _DetailRow(
                    label: 'Status',
                    value: item.read ? 'Read' : 'Unread',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.muted,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

(Color, Color, IconData) _visualFor(NotificationType type) => switch (type) {
  NotificationType.paymentDue || NotificationType.loanOverdue => (
    AppColors.red50,
    AppColors.red,
    Icons.alarm_rounded,
  ),
  NotificationType.paymentReceived || NotificationType.requestApproved => (
    AppColors.green50,
    AppColors.green700,
    Icons.check_rounded,
  ),
  NotificationType.requestRejected => (
    AppColors.red50,
    AppColors.red,
    Icons.close_rounded,
  ),
  NotificationType.verification || NotificationType.clientActivity => (
    AppColors.blue50,
    AppColors.blue600,
    Icons.verified_rounded,
  ),
  NotificationType.loanRequest => (
    AppColors.blue50,
    AppColors.blue600,
    Icons.pending_actions_rounded,
  ),
  NotificationType.system => (
    const Color(0xFFF0F2F7),
    AppColors.muted,
    Icons.info_outline_rounded,
  ),
};
