import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// The single source of truth for type in the app, matched 1:1 to the mobile
/// design mockup.
///
/// Every piece of text in the app must use one of these — never a hand-rolled
/// `TextStyle`, which is how the sizes drifted apart in the first place.
///
/// Two voices, exactly as the mockup declares them:
///   * **Poppins** — display and heading voice, plus every number that has to
///     read as a figure.
///   * **Inter** — reading voice, everything else.
///
/// Money tokens carry `tabular-nums` (the mockup's `.num` class) so columns of
/// figures never reflow as digits change.
class AppText {
  AppText._();

  /// The mockup's `.num` — figures that must not jitter as they change.
  static const List<FontFeature> tabular = [FontFeature.tabularFigures()];

  // ═══════════════════════ display voice (Poppins) ═══════════════════════

  /// The one number on the screen — mockup `.hero .hn` (32/800).
  static final heroNumber = _poppins(
    32,
    FontWeight.w800,
    AppColors.ink,
    ls: -0.6,
    figures: true,
  );

  /// Amount on the receipt/success screen — mockup `.dn-big` (28/800).
  static final receiptAmount = _poppins(
    28,
    FontWeight.w800,
    AppColors.ink,
    ls: -0.5,
    figures: true,
  );

  /// Big figure inside a tinted panel — mockup `.amtbox b` (24/800).
  static final amountLarge = _poppins(
    24,
    FontWeight.w800,
    AppColors.blue900,
    figures: true,
  );

  /// Splash headline — mockup `.sp-copy h1` (22/800).
  static final splashTitle = _poppins(
    22,
    FontWeight.w800,
    AppColors.ink,
    ls: -0.2,
  );

  /// Screen and AppBar titles. Also the theme's `titleLarge` — keep in step.
  static final pageTitle = _poppins(20, FontWeight.w700, AppColors.ink);

  /// Domed header title, full-bleed variant — mockup `.dome-t` (19/700).
  static final domeTitle = _poppins(
    23,
    FontWeight.w800,
    Colors.white,
    ls: -0.3,
  );

  /// Domed header title, compressed `.dome.sm` variant (17/700).
  static final domeTitleSm = _poppins(
    17,
    FontWeight.w700,
    Colors.white,
    ls: -0.2,
  );

  /// Name at the top of the profile dome — mockup `.phead b` (16/700).
  static final nameOnDome = _poppins(16, FontWeight.w700, Colors.white);

  /// Card, section and list headers — mockup `.shead b` (13.5/700).
  static final cardTitle = _poppins(13.5, FontWeight.w700, AppColors.ink);

  /// Legacy alias for [cardTitle] — the mockup gives section headers and card
  /// headers the same voice and size, so they are the same token. Kept because
  /// the cards that predate this file reference it.
  static final sectionTitle = cardTitle;

  /// Title inside a chooser card — mockup `.rc-t b` (13.5/700).
  static final chooserTitle = _poppins(13.5, FontWeight.w700, AppColors.ink);

  /// Bold figure in the profile stats strip — mockup `.stats b` (15/800).
  static final statValue = _poppins(
    15,
    FontWeight.w800,
    AppColors.ink,
    figures: true,
  );

  /// Score readout inside a progress ring — mockup `.score-ring b` (25/800).
  static final scoreValue = _poppins(
    25,
    FontWeight.w800,
    AppColors.ink,
    figures: true,
  );

  /// Bottom-sheet title — mockup `.sh-t` (16.5/700).
  static final sheetTitle = _poppins(16.5, FontWeight.w700, AppColors.ink);

  /// Trailing money on a transaction row — mockup `.amt` (12.5/800).
  static final rowAmount = _poppins(
    12.5,
    FontWeight.w800,
    AppColors.blue600,
    figures: true,
  );

  /// A right-hand link in a section header — mockup `.lnk` (11/700).
  static final linkLabel = GoogleFonts.inter(
    fontSize: 11,
    fontWeight: FontWeight.w700,
    color: AppColors.blue600,
  );

  // ═══════════════════════ reading voice (Inter) ═══════════════════════

  /// Primary reading text: list names, field values, paragraph copy.
  /// Inter 14 / w500 / ink. Also the theme's `bodyLarge`.
  static const body = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: AppColors.ink,
  );

  /// Body copy the user must notice — Inter 14 / w600 / ink.
  static const bodyStrong = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// Text the user types into a field — Inter 14 / w400 / ink.
  static const fieldInput = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.ink,
  );

  /// EVERY secondary line: helper text, metadata, empty-state copy.
  /// Inter 13.5 / w500 / muted. Also the theme's `bodySmall`.
  static const subText = TextStyle(
    fontSize: 13.5,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );

  /// Labels above form fields — Inter 13 / w600 / ink.
  static const fieldLabel = TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// Leading line of a list row — mockup `.tr-m b` (12.5/600).
  static const rowTitle = TextStyle(
    fontSize: 12.5,
    fontWeight: FontWeight.w600,
    color: AppColors.ink,
  );

  /// Trailing line of a list row — mockup `.tr-m span` (10.5/500).
  static const rowSub = TextStyle(
    fontSize: 10.5,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );

  /// Supporting line under a bottom-sheet title — mockup `.sh-s` (11/500).
  static const sheetSub = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );

  /// Mid-length explanatory copy — mockup `.swap`, hint paragraphs (11.5/500).
  static const paragraph = TextStyle(
    fontSize: 11.5,
    fontWeight: FontWeight.w500,
    color: AppColors.ink2,
    height: 1.55,
  );

  /// Primary button label — mockup `.pbtn` (14/700).
  static const buttonLabel = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    letterSpacing: 0.4,
  );

  /// Secondary/ghost button label — mockup `.ghostbtn` (12.5/600).
  static const buttonGhost = TextStyle(
    fontSize: 12.5,
    fontWeight: FontWeight.w600,
    color: AppColors.ink2,
  );

  /// Field label as the mockup draws it, above a soft-filled input (11.5/600).
  static const fieldLabelSm = TextStyle(
    fontSize: 11.5,
    fontWeight: FontWeight.w600,
    color: AppColors.ink2,
  );

  /// Inline validation message — mockup `.err` (10.5/500).
  static const fieldError = TextStyle(
    fontSize: 10.5,
    fontWeight: FontWeight.w500,
    color: AppColors.redInk,
  );

  /// Selectable pill, unselected — mockup `.pill` (11/600).
  static const pillLabel = TextStyle(
    fontSize: 11,
    fontWeight: FontWeight.w600,
    color: AppColors.ink2,
  );

  /// Fine print and captions — mockup `.fine` (10/500).
  static const fine = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
    height: 1.55,
  );

  /// Compact chrome: badges, chips, nav labels. Inter 11.5 / w600 / muted.
  /// Also the theme's `labelSmall`.
  static const caption = TextStyle(
    fontSize: 11.5,
    fontWeight: FontWeight.w600,
    color: AppColors.muted,
  );

  /// Filled status pill — mockup `.chip` (9.5/700).
  static const chipLabel = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w700,
    color: AppColors.ink,
  );

  /// Bottom-nav item label, inactive — mockup `.nv` (9.5/600).
  static const navLabel = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w600,
    color: Color(0xFF9AA1B2),
  );

  /// Bottom-nav item label, active — mockup `.nv.on` (9.5/700).
  static const navLabelOn = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w700,
    color: AppColors.blue600,
  );

  /// Letterspaced eyebrow over a gradient surface — mockup `.hero .hl`.
  static const eyebrow = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.7,
    color: AppColors.onGradientEyebrow,
  );

  /// Letterspaced eyebrow on a light surface — mockup `.fsec` (9.5/700).
  static const eyebrowInk = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.3,
    color: AppColors.muted,
  );

  /// Group label inside a sheet — mockup `.glbl` (9/700).
  static const eyebrowTight = TextStyle(
    fontSize: 9,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.3,
    color: AppColors.muted,
  );

  /// Label above a figure in a tinted panel — mockup `.amtbox span` (8.5/700).
  static const eyebrowTiny = TextStyle(
    fontSize: 8.5,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
    color: AppColors.muted,
  );

  /// Column caption in the profile stats strip — mockup `.stats span` (8/700).
  static const statLabel = TextStyle(
    fontSize: 8,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
    color: AppColors.muted,
  );

  /// Timestamp under a notification — mockup `.nrow time` (9.5/500).
  static const timeStamp = TextStyle(
    fontSize: 9.5,
    fontWeight: FontWeight.w500,
    color: AppColors.muted,
  );

  /// Right-hand status on an upload row — mockup `.up-st` (10/700).
  static const uploadStatus = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    color: AppColors.blue600,
  );

  static TextStyle _poppins(
    double size,
    FontWeight weight,
    Color color, {
    double ls = 0,
    bool figures = false,
  }) => GoogleFonts.poppins(
    fontSize: size,
    fontWeight: weight,
    color: color,
    letterSpacing: ls,
    fontFeatures: figures ? AppText.tabular : null,
  );
}
