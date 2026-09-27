import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl_phone_field/intl_phone_field.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Phone field with a country picker, defaulting to Zambia (+260).
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
class AppPhoneField extends StatelessWidget {
  const AppPhoneField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.validator,
    this.enabled = true,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final String? Function(String?)? validator;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppText.fieldLabel),
        const SizedBox(height: 6),
        IntlPhoneField(
          controller: controller,
          enabled: enabled,
          initialCountryCode: 'ZM', // Zambia — note: ZM, not ZW (Zimbabwe!)
          keyboardType: TextInputType.phone,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: AppText.fieldInput,
          dropdownTextStyle: AppText.fieldInput,
          dropdownIcon: const Icon(
            Icons.arrow_drop_down,
            color: AppColors.muted,
          ),
          decoration: InputDecoration(hintText: hint),
          // intl_phone_field hands us a PhoneNumber built from the naive
          // dial-code + input concatenation; we ignore it and validate
          // exactly what the user typed instead.
          validator: validator == null
              ? null
              : (_) => validator!(controller.text),
        ),
      ],
    );
  }
}
