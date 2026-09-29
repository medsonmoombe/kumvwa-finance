import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Soft "puffy widget" elevation.
///
/// The mockup drops hairline borders on elevated surfaces and leans on a wide
/// blur with a NEGATIVE spread instead — that is what makes a surface read as a
/// pillow rather than a bordered box. Reach for [sh1] on tiles and rows, [sh2]
/// on cards and floating panels, [sh3] under full-bleed gradient headers.
class AppShadows {
  AppShadows._();

  /// Tiles and rows — mockup `0 10px 22px -16px rgba(13,44,110,.25)`.
  static const List<BoxShadow> sh1 = [
    BoxShadow(
      color: Color(0x40102C6E),
      blurRadius: 22,
      offset: Offset(0, 10),
      spreadRadius: -16,
    ),
  ];

  /// Cards and floating panels — mockup `0 12px 26px -16px rgba(13,44,110,.25)`.
  static const List<BoxShadow> sh2 = [
    BoxShadow(
      color: Color(0x40102C6E),
      blurRadius: 26,
      offset: Offset(0, 12),
      spreadRadius: -16,
    ),
  ];

  /// Deeper card lift, for the profile stats strip.
  static const List<BoxShadow> sh2Deep = [
    BoxShadow(
      color: Color(0x4D102C6E),
      blurRadius: 26,
      offset: Offset(0, 12),
      spreadRadius: -18,
    ),
  ];

  /// Primary button — mockup `0 14px 26px -10px rgba(13,44,110,.55)`.
  static const List<BoxShadow> shButton = [
    BoxShadow(
      color: Color(0x8C0D2C6E),
      blurRadius: 26,
      offset: Offset(0, 14),
      spreadRadius: -10,
    ),
  ];

  /// Green primary button — mockup `0 14px 26px -10px rgba(30,143,85,.55)`.
  static const List<BoxShadow> shButtonGreen = [
    BoxShadow(
      color: Color(0x8C1E8F55),
      blurRadius: 26,
      offset: Offset(0, 14),
      spreadRadius: -10,
    ),
  ];

  /// Circular action tile — mockup `0 10px 20px -8px rgba(26,79,191,.55)`.
  static const List<BoxShadow> shAction = [
    BoxShadow(
      color: Color(0x8C1A4FBF),
      blurRadius: 20,
      offset: Offset(0, 10),
      spreadRadius: -8,
    ),
  ];

  /// Circular action tile, green variant.
  static const List<BoxShadow> shActionGreen = [
    BoxShadow(
      color: Color(0x801E8F55),
      blurRadius: 20,
      offset: Offset(0, 10),
      spreadRadius: -8,
    ),
  ];

  /// Focus ring glow on a tinted input.
  static const List<BoxShadow> fieldFocus = [
    BoxShadow(color: Color(0x1F1A4FBF), blurRadius: 4, offset: Offset.zero),
  ];

  /// Selected pill — mockup `0 8px 16px -8px rgba(26,79,191,.6)`.
  static const List<BoxShadow> shPill = [
    BoxShadow(
      color: Color(0x991A4FBF),
      blurRadius: 16,
      offset: Offset(0, 8),
      spreadRadius: -8,
    ),
  ];

  /// The lifted half of a segmented control — mockup `0 2px 8px rgba(15,17,21,.1)`.
  static const List<BoxShadow> shSeg = [
    BoxShadow(color: Color(0x1A0F1115), blurRadius: 8, offset: Offset(0, 2)),
  ];

  /// The bottom nav bar's upward cast — mockup `0 -10px 30px rgba(16,19,26,.08)`.
  static const List<BoxShadow> shNav = [
    BoxShadow(color: Color(0x1410131A), blurRadius: 30, offset: Offset(0, -10)),
  ];
}

/// Corner radii, named by what they wrap so screens stop inventing numbers.
/// Values are the mockup's, one token per element that uses one.
class AppRadii {
  AppRadii._();

  static const double xs = 10; // segmented control's selected half
  static const double sm = 12; // square icon buttons
  static const double input = 13; // text fields, segmented track
  static const double tile = 14; // method rows, upload rows, stat cards
  static const double button = 15; // primary buttons
  static const double card = 16; // cards, alert rows, tinted panels
  static const double chooser = 18; // role / chooser cards
  static const double sheet = 26; // bottom sheet
  static const double pill = 999;

  /// The domed header. The mockup specifies an ELLIPTICAL bottom — a wide
  /// horizontal radius against a fixed vertical one — which is what makes the
  /// header read as a dome rather than a rounded card. [width] is the header's
  /// own width, because the 46% is a percentage of it.
  static BorderRadius dome(double width, {bool small = false}) {
    final hx = (small ? 0.40 : 0.46) * width;
    final vy = small ? 42.0 : 54.0;
    return BorderRadius.only(
      bottomLeft: Radius.elliptical(hx, vy),
      bottomRight: Radius.elliptical(hx, vy),
    );
  }
}

/// Brand gradients.
///
/// The mockup uses two: a 165deg blue (almost vertical, so the dome reads as
/// lit from above) for headers and primary buttons, and a 135deg green for
/// money actions. CSS measures the angle clockwise from "to top"; the Flutter
/// pairs below are the same lines expressed as begin/end alignments.
class AppGradients {
  AppGradients._();

  /// Mockup `--grad: linear-gradient(165deg,#3B72EC,#1A4FBF 55%,#123A93)`.
  static const LinearGradient dome = LinearGradient(
    begin: Alignment(-0.129, -0.483),
    end: Alignment(0.129, 0.483),
    colors: [AppColors.blue300, AppColors.blue600, AppColors.blue800],
    stops: [0, 0.55, 1],
  );

  /// The same line at a shallower angle, for compact surfaces that have no
  /// room to read as a dome.
  static const LinearGradient brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.blue300, AppColors.blue600, AppColors.blue800],
    stops: [0, 0.55, 1],
  );

  /// Mockup `--gradG: linear-gradient(135deg,#43E08A,#1E8F55)`.
  static const LinearGradient green = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.green300, AppColors.green700],
  );

  /// A lender's own pair, in the same geometry as [dome] — white-label surfaces
  /// must be swappable without the screen knowing.
  static LinearGradient from(List<Color> colors, {bool vertical = true}) {
    final c = colors.length >= 2
        ? colors
        : const [AppColors.blue300, AppColors.blue600, AppColors.blue800];
    final s = c.length == 3 && vertical ? const [0.0, 0.55, 1.0] : null;
    return LinearGradient(
      begin: vertical ? const Alignment(-0.129, -0.483) : Alignment.topLeft,
      end: vertical ? const Alignment(0.129, 0.483) : Alignment.bottomRight,
      colors: c,
      stops: s,
    );
  }
}

/// Page gutters and the fixed heights the mockup's controls share.
class AppInsets {
  AppInsets._();

  /// Horizontal gutter for a screen body — mockup `.bd` (18).
  static const double page = 18;

  /// Horizontal gutter for a form — mockup `.form` (22).
  static const double form = 22;

  /// Taller gutter for a centred success body — mockup `.done-body` (26).
  static const double success = 26;

  /// Bottom breathing room for a scroll body that must clear the nav bar.
  static const double aboveNav = 96;
}

/// Control heights, so a 47dp field in one screen is 47dp in all of them.
class AppSizes {
  AppSizes._();

  static const double field = 47; // mockup `.ctrl input`
  static const double button = 50; // mockup `.pbtn`
  static const double buttonSm = 44; // mockup `.ghostbtn`
  static const double actionCircle = 50; // mockup `.act .c`
  static const double navHeight = 58; // mockup `.nav`
  static const double toggleWidth = 44; // mockup `.tgl`
  static const double toggleHeight = 26;
}
