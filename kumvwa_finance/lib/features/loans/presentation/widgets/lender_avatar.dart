import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';

/// The lender's identity mark: their uploaded logo, or their initials on their
/// brand colour when no logo is set.
///
/// Shared by every borrower-facing card so one lender looks the same
/// everywhere — the same loan used to show a logo in one row and a generic
/// blue sticker in the next.
class LenderAvatar extends StatelessWidget {
  const LenderAvatar({
    super.key,
    required this.theme,
    required this.name,
    this.size = 40,
  });

  final LenderTheme theme;
  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: theme.solid, shape: BoxShape.circle),
      child: theme.logoUrl != null
          ? ClipOval(
              child: Image.network(
                theme.logoUrl!,
                width: size,
                height: size,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _initials(size),
              ),
            )
          : _initials(size),
    );
  }

  Widget _initials(double size) => Text(
    Fmt.initials(name),
    style: TextStyle(
      fontSize: size * 0.3,
      fontWeight: FontWeight.w700,
      color: Colors.white,
    ),
  );
}
