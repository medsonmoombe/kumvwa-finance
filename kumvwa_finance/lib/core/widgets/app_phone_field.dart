import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
// The main entrypoint imports the country table but does not re-export it, so
// locking the field to one entry means reaching for it directly.
import 'package:intl_phone_field/countries.dart';
import 'package:intl_phone_field/intl_phone_field.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Phone field with the Zambia (+260) prefix baked in and locked.
///
/// The country selector is deliberately inert: Kumvwa lends in Zambia only, so
/// offering a picker invites a choice that cannot be honoured. The flag and
/// dial code are shown as a fixed prefix — the same visual information the
/// picker gave, minus a control that does nothing.
///
/// IMPORTANT: [controller] holds the **national number only** — the dial
/// code is rendered in the flag prefix and never lands in the controller.
/// A user entering 971234567 against the `+260` prefix gives you exactly
/// "971234567", with no leading 0 and no country code. Callers that need
/// a canonical number must normalise it themselves (see
/// `MockAuthRepository._normalize`).
///
/// Validates what the user actually typed (national format) —
/// intl_phone_field's `validator` receives the naive concatenation
/// of dial code + input, so we deliberately ignore it.
class AppPhoneField extends StatefulWidget {
  const AppPhoneField({
    super.key,
    required this.label,
    required this.controller,
    this.formFieldKey,
    this.hint,
    this.validator,
    this.error,
    this.enabled = true,
    this.onSubmitted,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;

  /// Identifies this field inside an enclosing `Form`, matching `AppField`.
  final Key? formFieldKey;
  final String? hint;
  final String? Function(String?)? validator;

  /// A server-supplied or cross-field error, rendered exactly as `AppField`
  /// does. Outranks [validator], which is the newer information.
  final String? error;
  final bool enabled;
  final void Function(String)? onSubmitted;
  final bool autofocus;

  @override
  State<AppPhoneField> createState() => _AppPhoneFieldState();
}

class _AppPhoneFieldState extends State<AppPhoneField> {
  final _focus = FocusNode();

  /// Resolved late, for the same reason `AppField` does it: this field renders
  /// inside a FormField builder, which runs after `build` returns.
  String? _resolvedError;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _focus
      ..removeListener(_onFocusChanged)
      ..dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted) setState(() {});
  }

  /// Only Zambia, resolved from the package's own table so the flag and dial
  /// code stay in step with it. Note ZM, not ZW.
  static final List<Country> _zambiaOnly = [
    countries.firstWhere((c) => c.code == 'ZM'),
  ];

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      key: widget.formFieldKey,
      initialValue: widget.controller.text,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      validator: (value) {
        // The controller is the source of truth; FormField's own value is a
        // one-time snapshot that would never see what the user typed.
        final v = widget.controller.text;
        return widget.validator?.call(v);
      },
      builder: (state) {
        final error =
            _trimmed(widget.error) ?? (state.hasError ? state.errorText : null);
        _resolvedError = error;
        return _body(error);
      },
    );
  }

  static String? _trimmed(String? value) {
    final v = value?.trim();
    return (v == null || v.isEmpty) ? null : v;
  }

  Widget _body(String? error) {
    final bad = error != null;
    final focused = _focus.hasFocus;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.label, style: AppText.fieldLabel),
        const SizedBox(height: 6),
        AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: bad ? 49 : AppSizes.field,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            color: bad ? const Color(0xFFFFF7F7) : Colors.white,
            borderRadius: BorderRadius.circular(AppRadii.input),
            border: Border.all(
              color: bad
                  ? AppColors.redInk
                  : (focused ? AppColors.blue500 : AppColors.line2),
              width: 1.5,
            ),
          ),
          child: IntlPhoneField(
            controller: widget.controller,
            focusNode: _focus,
            enabled: widget.enabled,
            autofocus: widget.autofocus,
            textInputAction: TextInputAction.next,
            keyboardType: TextInputType.phone,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            // Locked to Zambia: the only country a Kumvwa number can be, and
            // the only one offered. A user who taps the flag gets a one-row
            // picker, which is honest about there being nothing to choose.
            initialCountryCode: 'ZM',
            countries: _zambiaOnly,
            onCountryChanged: (_) {},
            showDropdownIcon: false,
            dropdownIconPosition: IconPosition.leading,
            flagsButtonMargin: const EdgeInsets.only(right: 7),
            flagsButtonPadding: EdgeInsets.zero,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: widget.controller.text.isEmpty
                  ? FontWeight.w400
                  : FontWeight.w600,
              color: widget.enabled ? AppColors.ink : AppColors.muted,
              height: 1.3,
            ),
            dropdownTextStyle: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: widget.enabled ? AppColors.ink : AppColors.muted,
            ),
            decoration: InputDecoration(
              isDense: true,
              counterText: '',
              filled: true,
              fillColor: Colors.transparent,
              contentPadding: EdgeInsets.zero,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              hintText: widget.hint,
              hintStyle: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w400,
                color: AppColors.muted,
              ),
            ),
            // intl_phone_field hands us a PhoneNumber built from the naive
            // dial-code + input concatenation; we ignore it and validate
            // exactly what the user typed instead.
            validator: (_) => null,
          ),
        ),
        if (_resolvedError != null) ...[
          const SizedBox(height: 5),
          Text(_resolvedError!, style: AppText.fieldError),
        ],
      ],
    );
  }
}
