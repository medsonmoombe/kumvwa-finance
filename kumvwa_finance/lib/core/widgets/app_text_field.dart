import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Text field with the label placed above the input, as in the design mockups.
/// Borders, fill and focus colors come from the app theme.
class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.validator,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.obscureText = false,
    this.suffixIcon,
    this.enabled = true,
    this.readOnly = false,
    this.maxLines = 1,
    this.inputFormatters,
    this.onTap,
    this.onChanged,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final String? Function(String?)? validator;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final bool obscureText;
  final Widget? suffixIcon;
  final bool enabled;

  /// Read-only fields back picker-driven inputs (e.g. date of birth), which
  /// open a dialog from [onTap] instead of the soft keyboard.
  final bool readOnly;
  final int maxLines;
  final List<TextInputFormatter>? inputFormatters;
  final VoidCallback? onTap;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppText.fieldLabel),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          validator: validator,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          obscureText: obscureText,
          enabled: enabled,
          readOnly: readOnly,
          maxLines: maxLines,
          inputFormatters: inputFormatters,
          onTap: onTap,
          onChanged: onChanged,
          style: AppText.fieldInput,
          decoration: InputDecoration(hintText: hint, suffixIcon: suffixIcon),
        ),
      ],
    );
  }
}
