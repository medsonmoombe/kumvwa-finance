import 'dart:async';

import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

enum ToastTone { info, success, error }

/// Shows a transient pill toast above the bottom nav.
///
/// Use it for the outcome of something the user just did — a payment posted, a
/// copy failed, a network call rejected. Anything the user must act on is a
/// dialog or an inline error, not a toast: a toast can't be tapped, read at
/// leisure, or recovered from.
///
/// Returns immediately. Pass a [Duration] only to override the default dwell.
void showAppToast(
  BuildContext context,
  String message, {
  ToastTone tone = ToastTone.info,
  IconData? icon,
  Duration duration = const Duration(milliseconds: 2600),
}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;

  late final OverlayEntry entry;
  entry = OverlayEntry(
    builder: (ctx) => _AppToast(
      message: message,
      tone: tone,
      icon: icon,
      // Sits above the nav bar rather than over it, so the toast never hides
      // the control that produced it.
      bottomInset: AppSizes.navHeight + 14,
      dwell: duration,
      onDone: () {
        if (entry.mounted) entry.remove();
      },
    ),
  );

  overlay.insert(entry);
}

class _AppToast extends StatefulWidget {
  const _AppToast({
    required this.message,
    required this.tone,
    required this.icon,
    required this.bottomInset,
    required this.onDone,
    this.dwell = const Duration(milliseconds: 2600),
  });

  final String message;
  final ToastTone tone;
  final IconData? icon;
  final double bottomInset;
  final VoidCallback onDone;
  final Duration dwell;

  @override
  State<_AppToast> createState() => _AppToastState();
}

class _AppToastState extends State<_AppToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 220),
  )..forward();

  /// The dwell lives here rather than in a `Future.delayed` at the call site so
  /// that a toast removed early — a route pop, a test teardown — cancels it
  /// instead of leaving a timer pending.
  Timer? _dwell;

  @override
  void initState() {
    super.initState();
    _dwell = Timer(widget.dwell, () {
      if (mounted) widget.onDone();
    });
  }

  @override
  void dispose() {
    _dwell?.cancel();
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = switch (widget.tone) {
      ToastTone.info => const (fg: AppColors.blue500, bg: AppColors.blue50),
      ToastTone.success => const (
        fg: AppColors.green700,
        bg: AppColors.green50,
      ),
      ToastTone.error => const (fg: AppColors.redInk, bg: AppColors.red50),
    };

    return Positioned(
      left: AppInsets.page,
      right: AppInsets.page,
      bottom: widget.bottomInset,
      child: IgnorePointer(
        child: FadeTransition(
          opacity: _c,
          child: SlideTransition(
            position: Tween(
              begin: const Offset(0, 0.35),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutCubic)),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
              decoration: BoxDecoration(
                color: AppColors.ink,
                borderRadius: BorderRadius.circular(AppRadii.input),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x4D0F1115),
                    blurRadius: 24,
                    offset: Offset(0, 10),
                    spreadRadius: -8,
                  ),
                ],
              ),
              child: Row(
                children: [
                  Icon(
                    widget.icon ??
                        switch (widget.tone) {
                          ToastTone.info => Icons.info_outline_rounded,
                          ToastTone.success =>
                            Icons.check_circle_outline_rounded,
                          ToastTone.error => Icons.error_outline_rounded,
                        },
                    size: 16,
                    color: c.fg,
                  ),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      widget.message,
                      style: AppText.paragraph.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
