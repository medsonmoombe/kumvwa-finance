import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

enum AppButtonTone {
  /// The brand dome gradient. One primary action per screen.
  primary,

  /// Money leaving the user's account — pay, apply, send.
  green,

  /// No fill. A secondary path that must not compete with the primary.
  ghost,

  /// Outlined, for a peer of a primary action.
  outline,
}

enum AppButtonSize { regular, small }

/// The primary action button.
///
/// Gradient fills aren't available on `ElevatedButton`, so this is a hand-rolled
/// press surface rather than a themed one — it also carries the mockup's
/// press-down scale, which Material's ink ripple doesn't reproduce.
class AppButton extends StatefulWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.tone = AppButtonTone.primary,
    this.size = AppButtonSize.regular,
    this.icon,
    this.busy = false,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonTone tone;
  final AppButtonSize size;

  /// Leading glyph. Keep it the same optical weight as the label.
  final IconData? icon;

  /// Swaps the label for a spinner and blocks input. Use it whenever the action
  /// has crossed the network boundary.
  final bool busy;

  /// Whether to fill the available width. Off for buttons that sit beside
  /// another one.
  final bool expand;

  bool get _enabled => onPressed != null && !busy;

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final tone = _toneOf(widget.tone, widget._enabled);

    return Semantics(
      button: true,
      enabled: widget._enabled,
      label: widget.label,
      child: GestureDetector(
        onTapDown: widget._enabled ? (_) => setState(() => _down = true) : null,
        onTapUp: widget._enabled ? (_) => setState(() => _down = false) : null,
        onTapCancel: widget._enabled
            ? () => setState(() => _down = false)
            : null,
        onTap: widget._enabled ? widget.onPressed : null,
        child: AnimatedScale(
          scale: _down ? 0.97 : 1,
          duration: const Duration(milliseconds: 120),
          child: AnimatedOpacity(
            opacity: widget._enabled ? 1 : 0.55,
            duration: const Duration(milliseconds: 150),
            child: Container(
              width: widget.expand ? double.infinity : null,
              height: widget.size == AppButtonSize.regular
                  ? AppSizes.button
                  : AppSizes.buttonSm,
              padding: widget.expand
                  ? null
                  : const EdgeInsets.symmetric(horizontal: 18),
              alignment: Alignment.center,
              decoration: _decoration(tone),
              child: widget.busy
                  ? const AppSpinner()
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (widget.icon != null) ...[
                          Icon(widget.icon, size: 18, color: tone.fg),
                          const SizedBox(width: 9),
                        ],
                        Flexible(
                          child: Text(
                            widget.label,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: widget.size == AppButtonSize.regular
                                ? AppText.buttonLabel.copyWith(color: tone.fg)
                                : AppText.buttonGhost.copyWith(
                                    color: tone.fg,
                                    fontWeight: FontWeight.w700,
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

  BoxDecoration _decoration(_Tone tone) => switch (widget.tone) {
    AppButtonTone.primary => BoxDecoration(
      gradient: AppGradients.dome,
      borderRadius: BorderRadius.circular(AppRadii.button),
      boxShadow: AppShadows.shButton,
    ),
    AppButtonTone.green => BoxDecoration(
      gradient: AppGradients.green,
      borderRadius: BorderRadius.circular(AppRadii.button),
      boxShadow: AppShadows.shButtonGreen,
    ),
    AppButtonTone.ghost => const BoxDecoration(color: Colors.transparent),
    AppButtonTone.outline => BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadii.button),
      border: Border.all(color: tone.fg, width: 1.5),
    ),
  };

  _Tone _toneOf(AppButtonTone tone, bool enabled) => switch (tone) {
    AppButtonTone.primary => _Tone(enabled ? Colors.white : AppColors.muted),
    AppButtonTone.green => const _Tone(Colors.white),
    AppButtonTone.ghost => _Tone(enabled ? AppColors.blue600 : AppColors.muted),
    AppButtonTone.outline => _Tone(
      enabled ? AppColors.blue600 : AppColors.muted,
    ),
  };
}

class _Tone {
  const _Tone(this.fg);
  final Color fg;
}

/// The mockup's button spinner: a thin ring with a white leading arc.
class AppSpinner extends StatelessWidget {
  const AppSpinner({super.key, this.size = 17, this.color = Colors.white});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: size * 0.147,
        color: color,
        backgroundColor: color.withValues(alpha: 0.35),
      ),
    );
  }
}

/// A smaller spinner for inline use, where a 17dp ring would dominate a row.
class AppSpinnerMini extends StatelessWidget {
  const AppSpinnerMini({
    super.key,
    this.color = AppColors.blue500,
    this.size = 15,
  });

  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: size * 0.12,
        color: color,
        backgroundColor: color.withValues(alpha: 0.2),
      ),
    );
  }
}
