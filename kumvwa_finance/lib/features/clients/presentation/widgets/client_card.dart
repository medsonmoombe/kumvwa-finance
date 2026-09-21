import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/features/clients/domain/client.dart';

/// Client row card: avatar, name + NRC + phone, risk badge + lender count.
class ClientCard extends StatelessWidget {
  const ClientCard({super.key, required this.client, required this.onTap});

  final Client client;
  final VoidCallback onTap;

  static const _avatarColors = [
    AppColors.blue500,
    AppColors.green700,
    Color(0xFFB26A00),
    AppColors.red,
  ];

  @override
  Widget build(BuildContext context) {
    final badge = switch (client.risk) {
      RiskLevel.low => const AppBadge('Low risk', variant: BadgeVariant.green),
      RiskLevel.medium => const AppBadge('Medium', variant: BadgeVariant.amber),
      RiskLevel.high => const AppBadge('High risk', variant: BadgeVariant.red),
    };

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color:
                    _avatarColors[client.name.codeUnitAt(0) %
                        _avatarColors.length],
                shape: BoxShape.circle,
              ),
              child: Text(
                Fmt.initials(client.name),
                style: AppText.caption.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    client.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.body.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(client.nrc, style: AppText.subText),
                  const SizedBox(height: 1),
                  Text(client.phone, style: AppText.subText),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                badge,
                const SizedBox(height: 4),
                Text(
                  '${client.lendersCount} lender'
                  '${client.lendersCount == 1 ? '' : 's'}',
                  style: AppText.caption,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
