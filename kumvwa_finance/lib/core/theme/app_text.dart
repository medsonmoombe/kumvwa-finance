import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// The single source of truth for type in the app, matched to the design
/// mockups (Business Registration / Login frames).
///
/// Every piece of text in the app must use one of these — never a
/// hand-rolled `TextStyle`, which is how the sizes drifted apart. Nothing
/// renders smaller than [caption].
///
/// Poppins = display/heading voice, Inter = reading voice.
class AppText {
  AppText._();

  /// Screen and AppBar titles — Poppins 20 / w700 / ink
  /// (e.g. "Business Registration" in the mockups).
  static final TextStyle pageTitle = GoogleFonts.poppins(
    fontSize: 20,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );

  /// Card, section and list headers — Poppins 14 / w700 / ink.
  static final TextStyle sectionTitle = GoogleFonts.poppins(
    fontSize: 14,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );

  /// Primary reading text: list names, field values, paragraph copy.
  /// Inter 14 / w500 / ink.
  static const TextStyle body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.ink,
  );

  /// EVERY secondary line: helper text, metadata, empty-state copy.
  /// Inter 13.5 / w500 / muted (the mockup's "Step 3 of 4 · Verification" row).
  static const TextStyle subText = TextStyle(
    fontSize: 13.5,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );

  /// Compact chrome only, where a full-size line cannot physically fit:
  /// badges, filter chips, chart axis labels, nav bar labels.
  /// Inter 12 / w600 / muted.
  static const TextStyle caption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.muted,
  );

  /// Labels above form fields — Inter 13 / w600 / near-black ink
  /// ("Owner NRC number", "Phone number" in the mockups).
  static const TextStyle fieldLabel = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// Text the user types into a field — Inter 14 / w400 / ink,
  /// as in the mockup inputs.
  static const TextStyle fieldInput = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.ink,
  );

  /// Big hero numbers on gradient cards (Poppins, display weight).
  static final TextStyle display = GoogleFonts.poppins(
    fontSize: 26,
    fontWeight: FontWeight.w800,
    color: Colors.white,
  );
}
