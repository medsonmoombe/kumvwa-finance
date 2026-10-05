import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Single source of truth for typography.
///
/// Font: **Inter** throughout — tabular figures on all money tokens,
/// negative letter-spacing on large numbers and headings, 1.4–1.5 line-height
/// on body copy, 1.1–1.2 on headlines.
///
/// Scale (matches fintech/banking standard):
///   Hero number   32–40 / 700
///   Screen title  22–24 / 700
///   Section head  16–17 / 600
///   Card title    15    / 600
///   Body          14–15 / 500
///   Meta/sub      12.5–13 / 500
///   Button        15–16 / 600
///   Badge/tag     11–12 / 700
///
/// Weight floor: nothing that a human reads as prose drops below 500. Running
/// text at 400 is the single most common legibility complaint on cheap phone
/// panels (low contrast, glare, bright sun), and the reading voice is what
/// carries the content — headings at 600/700 already separate themselves
/// without help from below. Keep 400 for decoration only.
class AppText {
  AppText._();

  static const List<FontFeature> tabular = [FontFeature.tabularFigures()];

  // ─── hero numbers ────────────────────────────────────────────────────────

  /// Large balance / hero number — 36 / 700, tight tracking, tabular.
  static final heroNumber = _inter(
    36, FontWeight.w700, AppColors.ink,
    ls: -1.0, lh: 1.1, figures: true,
  );

  /// Receipt / success amount — 28 / 700, tabular.
  static final receiptAmount = _inter(
    28, FontWeight.w700, AppColors.ink,
    ls: -0.6, lh: 1.1, figures: true,
  );

  /// Amount inside a tinted panel — 24 / 700, tabular.
  static final amountLarge = _inter(
    24, FontWeight.w700, AppColors.blue900,
    ls: -0.4, figures: true,
  );

  // ─── screen titles ───────────────────────────────────────────────────────

  /// Splash headline — 22 / 700.
  static final splashTitle = _inter(
    22, FontWeight.w700, AppColors.ink,
    ls: -0.3, lh: 1.2,
  );

  /// Screen / AppBar title — 20 / 700.
  static final pageTitle = _inter(
    20, FontWeight.w700, AppColors.ink,
    ls: -0.3, lh: 1.2,
  );

  /// Dome header title, full — 22 / 700, white.
  static final domeTitle = _inter(
    22, FontWeight.w700, Colors.white,
    ls: -0.4, lh: 1.2,
  );

  /// Dome header title, compact — 17 / 600, white.
  static final domeTitleSm = _inter(
    17, FontWeight.w600, Colors.white,
    ls: -0.2, lh: 1.2,
  );

  /// Name on profile dome — 16 / 700, white.
  static final nameOnDome = _inter(16, FontWeight.w700, Colors.white);

  // ─── section & card headers ──────────────────────────────────────────────

  /// Card / section header — 15 / 600.
  static final cardTitle = _inter(15, FontWeight.w600, AppColors.ink);
  static final sectionTitle = cardTitle;

  /// Chooser card title — 15 / 600.
  static final chooserTitle = _inter(15, FontWeight.w600, AppColors.ink);

  /// Bottom-sheet title — 16 / 600.
  static final sheetTitle = _inter(16, FontWeight.w600, AppColors.ink);

  // ─── figures ─────────────────────────────────────────────────────────────

  /// Stats strip bold figure — 15 / 700, tabular.
  static final statValue = _inter(
    15, FontWeight.w700, AppColors.ink,
    figures: true,
  );

  /// Score ring readout — 25 / 700, tabular.
  static final scoreValue = _inter(
    25, FontWeight.w700, AppColors.ink,
    ls: -0.4, figures: true,
  );

  /// Row trailing amount — 12.5 / 700, tabular.
  static final rowAmount = _inter(
    12.5, FontWeight.w700, AppColors.blue600,
    figures: true,
  );

  // ─── reading voice ───────────────────────────────────────────────────────

  /// Primary body — 14 / 500, lh 1.5.
  static const body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.ink,
    height: 1.5,
  );

  /// Emphasised body — 14 / 600.
  static const bodyStrong = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
    height: 1.5,
  );

  /// Text the user types — 14 / 500.
  static const fieldInput = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.ink,
  );

  /// Secondary / meta — 13 / 500, muted, lh 1.45.
  static const subText = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
    height: 1.45,
  );

  /// Field label — 13 / 600.
  static const fieldLabel = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// List row primary line — 13 / 600.
  static const rowTitle = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// List row secondary line — 12 / 500, muted.
  static const rowSub = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
    height: 1.4,
  );

  /// Sheet subtitle — 13 / 500, muted.
  static const sheetSub = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
    height: 1.45,
  );

  /// Paragraph / explanatory copy — 13 / 500, lh 1.5.
  static const paragraph = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AppColors.ink2,
    height: 1.5,
  );

  // ─── buttons ─────────────────────────────────────────────────────────────

  /// Primary button — 15 / 600 (semibold, not bold — fintech standard).
  static const buttonLabel = TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: Colors.white,
    letterSpacing: 0.1,
  );

  /// Ghost / secondary button — 13 / 600.
  static const buttonGhost = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.ink2,
  );

  // ─── chrome & micro ──────────────────────────────────────────────────────

  /// Small field label — 12 / 600.
  static const fieldLabelSm = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.ink2,
  );

  /// Inline validation — 11 / 600, red.
  static const fieldError = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: AppColors.redInk,
  );

  /// Pill label — 12 / 600.
  static const pillLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.ink2,
  );

  /// Fine print — 11 / 500, muted, lh 1.5.
  static const fine = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
    height: 1.5,
  );

  /// Caption / badge — 12 / 600, muted.
  static const caption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    color: AppColors.muted,
  );

  /// Status chip — 11 / 700.
  static const chipLabel = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );

  /// Nav label inactive — 10 / 500.
  static const navLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w500,
    color: Color(0xFF9AA1B2),
  );

  /// Nav label active — 10 / 700.
  static const navLabelOn = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    color: AppColors.blue600,
  );

  /// Eyebrow on gradient — 10 / 700, wide tracking.
  static const eyebrow = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.5,
    color: AppColors.onGradientEyebrow,
  );

  /// Eyebrow on light surface — 10 / 700.
  static const eyebrowInk = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
    color: AppColors.muted,
  );

  /// Tight eyebrow in sheet — 9.5 / 700.
  static const eyebrowTight = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
    color: AppColors.muted,
  );

  /// Tiny eyebrow in panel — 9 / 700.
  static const eyebrowTiny = TextStyle(
    fontSize: 9,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
    color: AppColors.muted,
  );

  /// Stats strip column label — 9 / 700.
  static const statLabel = TextStyle(
    fontSize: 9,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.1,
    color: AppColors.muted,
  );

  /// Notification timestamp — 10 / 500, muted.
  static const timeStamp = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );

  /// Upload row status — 11 / 700, blue.
  static const uploadStatus = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.blue600,
  );

  /// Section header right-hand link — 11 / 700, blue.
  static final linkLabel = GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.blue600,
  );

  // ─── builder ─────────────────────────────────────────────────────────────

  static TextStyle _inter(
    double size,
    FontWeight weight,
    Color color, {
    double ls = 0,
    double? lh,
    bool figures = false,
  }) => GoogleFonts.inter(
    fontSize: size,
    fontWeight: weight,
    color: color,
    letterSpacing: ls,
    height: lh,
    fontFeatures: figures ? AppText.tabular : null,
  );
}
