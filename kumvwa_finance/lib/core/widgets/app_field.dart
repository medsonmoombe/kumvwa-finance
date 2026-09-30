import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/dashed_border.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';

/// A labelled form field in the mockup's style: 47dp tall, 13dp radius, a 1.5dp
/// hairline, and a leading glyph.
///
/// Deliberately tolerant of being handed the error state from a [FormField] or
/// handed it directly — when both are given, the direct [error] wins, because
/// that is the one the caller can recompute (server validation, cross-field
/// rules) after a submit.
class AppField extends StatefulWidget {
  const AppField({
    super.key,
    this.label,
    this.controller,
    this.hint,
    this.icon,
    this.helper,
    this.error,
    this.obscure = false,
    this.enabled = true,
    this.readOnly = false,
    this.onTap,
    this.onSubmitted,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.maxLength,
    this.maxLines = 1,
    this.minLines,
    this.formFieldKey,
    this.validator,
    this.autovalidateMode,
    this.inputFormatters,
    this.focusNode,
    this.suffix,
  });

  final String? label;
  final TextEditingController? controller;
  final String? hint;
  final IconData? icon;
  final String? helper;
  final String? error;

  final bool obscure;
  final bool enabled;

  /// Renders as a filled-in value with no caret, and routes taps to [onTap] —
  /// this is how date, picker and dropdown fields are built.
  final bool readOnly;

  final VoidCallback? onTap;
  final ValueChanged<String>? onSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final int? maxLength;
  final int? maxLines;
  final int? minLines;
  final Key? formFieldKey;
  final String? Function(String?)? validator;
  final AutovalidateMode? autovalidateMode;
  final List<TextInputFormatter>? inputFormatters;
  final FocusNode? focusNode;

  /// Extra affordance on the right — the password eye, a currency code, a
  /// unit. Replaces the generated one, so pass only one of the two.
  final Widget? suffix;

  @override
  State<AppField> createState() => _AppFieldState();
}

class _AppFieldState extends State<AppField> {
  late bool _obscured = widget.obscure;
  late final FocusNode _focus = widget.focusNode ?? FocusNode();
  bool _ownsFocus = false;

  @override
  void initState() {
    super.initState();
    _ownsFocus = widget.focusNode == null;
    _focus.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocusChanged);
    if (_ownsFocus) _focus.dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    // Read-only fields (pickers) hold a value the caller already knows, so a
    // FormField can't validate them.
    if (widget.validator == null || widget.readOnly) {
      return _fieldColumn(_directError);
    }
    return FormField<String>(
      key: widget.formFieldKey,
      initialValue: widget.controller?.text,
      autovalidateMode: widget.autovalidateMode,
      validator: (value) {
        // A controller is the source of truth whenever the caller supplied one.
        // FormField's own value is snapshotted from `initialValue` and never
        // follows the controller, so a validator handed straight to us — as in
        // `validator: Validators.password` — would go on checking whatever the
        // field held on its first build, usually empty, and reject a password
        // the user can plainly see in the box.
        final v = widget.controller != null ? widget.controller!.text : value;
        return widget.validator!(v);
      },
      // The entire field renders in here, not just its frame. A FormField's
      // builder runs after this build method has already returned, so anything
      // read outside it would be a frame stale — which is exactly how a
      // validated error ends up tinted but never explained.
      builder: (state) => _fieldColumn(
        _directError ?? (state.hasError ? state.errorText : null),
      ),
    );
  }

  /// The error the caller passed in, if any. A server response or a cross-field
  /// rule can only be expressed this way, so it has to drive the frame too —
  /// a message under a neutral-looking input reads as stale.
  String? get _directError {
    final e = widget.error?.trim();
    return (e == null || e.isEmpty) ? null : e;
  }

  Widget _fieldColumn(String? error) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(widget.label!, style: AppText.fieldLabel),
          const SizedBox(height: 6),
        ],
        _frame(child: _buildField(), error: error),
        if (error != null) ...[
          const SizedBox(height: 5),
          Text(error, style: AppText.fieldError),
        ] else if (widget.helper != null) ...[
          const SizedBox(height: 5),
          Text(widget.helper!, style: AppText.fieldError),
        ],
      ],
    );
  }

  Widget _buildField() {
    final focused = _focus.hasFocus;
    final controller = widget.controller;
    final value = controller?.text ?? '';

    return TextField(
      controller: controller,
      focusNode: _focus,
      enabled: widget.enabled,
      readOnly: widget.readOnly,
      onTap: widget.onTap,
      onSubmitted: widget.onSubmitted,
      keyboardType: widget.keyboardType,
      textInputAction: widget.textInputAction,
      textCapitalization: widget.textCapitalization,
      maxLength: widget.maxLength,
      maxLines: widget.readOnly ? 1 : (widget.obscure ? 1 : widget.maxLines),
      minLines: widget.minLines,
      inputFormatters: widget.inputFormatters,
      obscureText: _obscured,
      cursorColor: AppColors.blue500,
      cursorWidth: 1.5,
      style: TextStyle(
        fontSize: 13,
        fontWeight: value.isEmpty ? FontWeight.w400 : FontWeight.w600,
        color: widget.enabled ? AppColors.ink : AppColors.muted,
      ),
      decoration: InputDecoration(
        isDense: true,
        counterText: '',
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        errorBorder: InputBorder.none,
        focusedErrorBorder: InputBorder.none,
        disabledBorder: InputBorder.none,
        hintText: widget.hint,
        hintStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w400,
          color: AppColors.muted,
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        prefixIcon: widget.icon == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(right: 9),
                child: Icon(
                  widget.icon,
                  size: 16,
                  color: focused ? AppColors.blue500 : AppColors.muted,
                ),
              ),
        suffixIcon: _suffix(focused),
      ),
    );
  }

  Widget? _suffix(bool focused) {
    if (widget.suffix != null) {
      return Padding(
        padding: const EdgeInsets.only(left: 8),
        child: widget.suffix,
      );
    }
    if (widget.obscure) {
      return IconButton(
        onPressed: () => setState(() => _obscured = !_obscured),
        visualDensity: VisualDensity.compact,
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 26, minHeight: 26),
        icon: Icon(
          _obscured ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          size: 15,
          color: AppColors.muted,
        ),
      );
    }
    if (widget.readOnly) {
      return Padding(
        padding: const EdgeInsets.only(left: 8),
        child: Icon(
          Icons.keyboard_arrow_down_rounded,
          size: 18,
          color: focused ? AppColors.blue500 : AppColors.muted,
        ),
      );
    }
    return null;
  }

  Widget _frame({required Widget child, String? error}) {
    final bad = error != null;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      height: bad ? 49 : AppSizes.field,
      padding: const EdgeInsets.symmetric(horizontal: 13),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bad ? const Color(0xFFFFF7F7) : Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(
          color: bad ? AppColors.redInk : AppColors.line2,
          width: 1.5,
        ),
      ),
      child: Row(
        children: [
          Expanded(child: child),
          if (bad)
            const Icon(
              Icons.error_outline_rounded,
              size: 15,
              color: AppColors.redInk,
            ),
        ],
      ),
    );
  }
}

/// A dashed-outline upload row — the lender verification documents.
///
/// The dash pattern is painted rather than composed from a [Border] because
/// Flutter has no dashed border, and the mockup's dotted line is doing real
/// work: it says "this is a drop target, not a filled-in field".
class AppUploadRow extends StatelessWidget {
  const AppUploadRow({
    super.key,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.tone = TileTone.blue,
    this.status = UploadStatus.idle,
    this.busy = false,
    this.enabled = true,
  });

  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final TileTone tone;
  final UploadStatus status;
  final bool busy;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final c = tileColors(tone);
    final done = status == UploadStatus.done;
    final failed = status == UploadStatus.failed;

    final border =
        (failed
                ? AppColors.redInk
                : done
                ? AppColors.green700
                : AppColors.line)
            .withValues(alpha: 0.55);

    return Semantics(
      button: true,
      enabled: enabled && !busy,
      label: '$title. $subtitle',
      child: GestureDetector(
        onTap: enabled && !busy ? onTap : null,
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          decoration: ShapeDecoration(
            color: Colors.white,
            shape: DashedRoundedRectangleBorder(
              radius: const Radius.circular(AppRadii.tile),
              color: border,
              strokeWidth: 1.5,
              dash: 5,
              gap: 4,
            ),
          ),
          child: Row(
            children: [
              IconTile(tone: tone, squircle: true, size: 40, icon: _icon(done)),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.rowTitle),
                    const SizedBox(height: 2),
                    Text(
                      busy ? 'Uploading…' : subtitle,
                      style: AppText.rowSub.copyWith(
                        color: failed
                            ? AppColors.redInk
                            : (done ? AppColors.green700 : AppColors.muted),
                      ),
                    ),
                  ],
                ),
              ),
              if (busy)
                AppSpinnerMini(color: c.fg)
              else
                Icon(
                  failed
                      ? Icons.refresh_rounded
                      : Icons.add_circle_outline_rounded,
                  size: 19,
                  color: failed ? AppColors.redInk : AppColors.muted,
                ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _icon(bool done) =>
      done ? Icons.task_alt_rounded : Icons.file_upload_outlined;
}

enum UploadStatus { idle, uploading, done, failed }
