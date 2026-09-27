import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/notifications/data/notifications_repository.dart';
import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';

/// Notification center — embedded as the client "Alerts" tab and pushed
/// from the business home bell.
class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({
    super.key,
    required this.role,
    this.embedded = false,
  });

  final String role;
  final bool embedded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider(role));

    final body = async.when(
      loading: () => ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          SkeletonCard(),
          SizedBox(height: 9),
          SkeletonCard(),
          SizedBox(height: 9),
          SkeletonCard(),
          SizedBox(height: 9),
          SkeletonCard(),
        ],
      ),
      error: (_, _) =>
          const Center(child: Text('Could not load notifications')),
      data: (items) {
        if (items.isEmpty) {
          return const Center(
            child: Text(
              'No notifications yet',
              style: TextStyle(color: AppColors.muted),
            ),
          );
        }
        final today = _isToday(items.first.time);
        return ListView.builder(
          padding: EdgeInsets.fromLTRB(
            16,
            embedded ? 8 : 4,
            16,
            embedded ? 90 : 24,
          ),
          itemCount: items.length + 1,
          itemBuilder: (_, i) {
            if (i == 0) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  today ? 'Today' : 'Earlier',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.muted,
                  ),
                ),
              );
            }
            final n = items[i - 1];
            final sectionBreak =
                i > 1 && _isToday(n.time) != _isToday(items[i - 2].time);
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (sectionBreak) ...[
                  const Padding(
                    padding: EdgeInsets.only(top: 8, bottom: 8),
                    child: Text(
                      'Earlier',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.muted,
                      ),
                    ),
                  ),
                ],
                _NotificationTile(
                  notification: n,
                  onTap: () => _openNotification(context, ref, n),
                ),
              ],
            );
          },
        );
      },
    );

    if (embedded) return body;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref
                  .read(notificationsRepositoryProvider)
                  .markAllRead(role: role);
              ref.invalidate(notificationsProvider(role));
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: SafeArea(child: body),
    );
  }

  bool _isToday(DateTime t) {
    final now = DateTime.now();
    return t.year == now.year && t.month == now.month && t.day == now.day;
  }

  Future<void> _openNotification(
    BuildContext context,
    WidgetRef ref,
    AppNotification notification,
  ) async {
    if (!notification.read) {
      await ref.read(notificationsRepositoryProvider).markRead(notification.id);
      ref.invalidate(notificationsProvider(role));
    }

    final requestId = notification.data['requestId'] as String?;
    if (requestId != null && requestId.isNotEmpty) {
      if (context.mounted) unawaited(context.push('/c/request-status/$requestId'));
      return;
    }

    final loanId = notification.data['loanId'] as String?;
    if (loanId != null && loanId.isNotEmpty) {
      if (context.mounted) unawaited(context.push('/c/loan/$loanId'));
      return;
    }

    if (context.mounted) {
      unawaited(context.push('/c/notification/${notification.id}', extra: notification));
    }
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (
      Color iconBg,
      Color iconFg,
      IconData icon,
    ) = switch (notification.type) {
      NotificationType.paymentDue => (
        AppColors.red50,
        AppColors.red,
        Icons.alarm,
      ),
      NotificationType.paymentReceived => (
        AppColors.green50,
        AppColors.green700,
        Icons.check_circle_outline,
      ),
      NotificationType.loanOverdue => (
        AppColors.red50,
        AppColors.red,
        Icons.alarm,
      ),
      NotificationType.requestApproved => (
        AppColors.green50,
        AppColors.green700,
        Icons.check_circle_outline,
      ),
      NotificationType.requestRejected => (
        AppColors.red50,
        AppColors.red,
        Icons.cancel_outlined,
      ),
      NotificationType.verification => (
        AppColors.blue50,
        AppColors.blue600,
        Icons.verified_outlined,
      ),
      NotificationType.clientActivity => (
        AppColors.blue50,
        AppColors.blue600,
        Icons.person_add_alt_1_outlined,
      ),
      NotificationType.loanRequest => (
        AppColors.blue50,
        AppColors.blue600,
        Icons.pending_actions_outlined,
      ),
      NotificationType.system => (
        const Color(0xFFF0F2F7),
        AppColors.muted,
        Icons.info_outline,
      ),
    };

    return Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Ink(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: notification.read
                    ? AppColors.line
                    : const Color(0xFFB9C6E8),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: iconBg,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 17, color: iconFg),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (!notification.read)
                            Container(
                              width: 7,
                              height: 7,
                              margin: const EdgeInsets.only(right: 6),
                              decoration: const BoxDecoration(
                                color: AppColors.blue600,
                                shape: BoxShape.circle,
                              ),
                            ),
                          Expanded(
                            child: Text(
                              notification.title,
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: notification.read
                                    ? FontWeight.w600
                                    : FontWeight.w700,
                                color: AppColors.ink,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        notification.body,
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.muted,
                          height: 1.45,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        _timeAgo(notification.time),
                        style: const TextStyle(
                          fontSize: 10,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(left: 8, top: 7),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: AppColors.muted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _timeAgo(DateTime t) {
    final d = DateTime.now().difference(t);
    if (d.inMinutes < 60) return '${d.inMinutes}m ago';
    if (d.inHours < 24) return '${d.inHours}h ago';
    return '${d.inDays}d ago · ${Fmt.date(t)}';
  }
}
