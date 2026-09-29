import 'package:flutter/material.dart';

/// Kumvwa Finance design tokens.
///
/// Values mirror the mobile design mockup 1:1 (the mockup's CSS custom
/// properties), so a screen ported from it keeps its exact metrics. Anything
/// that is NOT in the mockup is marked as such.
class AppColors {
  AppColors._();

  // Brand — Blues
  static const Color blue900 = Color(0xFF0D2C6E);
  static const Color blue600 = Color(0xFF1A4FBF); // primary
  static const Color blue500 = Color(0xFF2E63E6);
  static const Color blue50 = Color(0xFFEAF0FC);

  /// Stops of the mockup's `--grad` (165deg) dome/button gradient.
  static const Color blue300 = Color(0xFF3B72EC);
  static const Color blue800 = Color(0xFF123A93);

  /// The lighter blue the splash illustration tints its disc with.
  static const Color blue400 = Color(0xFF4C7DF0);

  // Accent — Greens
  static const Color green500 = Color(0xFF2ECC71);
  static const Color green700 = Color(0xFF1E8F55);
  static const Color green50 = Color(0xFFE7F8EF);

  /// Stops of the mockup's `--gradG` (135deg) gradient.
  static const Color green300 = Color(0xFF43E08A);
  static const Color green100 = Color(0xFF7FE8AC);

  // Status
  static const Color amber = Color(0xFFF5A623);
  static const Color amber50 = Color(0xFFFDF3E0);

  /// Text/icon shade for amber surfaces. [amber] itself is the dot/indicator
  /// shade — it fails contrast as type on [amber50].
  static const Color amberInk = Color(0xFFB26A00);

  /// Border for amber surfaces, one step deeper than [amber50].
  static const Color amberLine = Color(0xFFF3DCB3);

  static const Color red = Color(0xFFE5484D);
  static const Color red50 = Color(0xFFFDECEC);

  /// Text/icon shade for red surfaces (mirrors [amberInk]).
  static const Color redInk = Color(0xFFC62828);

  static const Color redLine = Color(0xFFF3C6C8);

  // Neutrals
  static const Color ink = Color(0xFF0F1115);
  static const Color ink2 = Color(0xFF3A4050);
  static const Color muted = Color(0xFF7A8194);
  static const Color line = Color(0xFFE3E6EC);

  /// Quieter hairline for rows nested inside a floating container — the mockup's
  /// `--line2`, where [line] would draw a second competing frame.
  static const Color line2 = Color(0xFFEEF0F3);

  /// Neutral pill fill (no status attached) — the mockup's `.seg` track and
  /// the neutral icon tiles.
  static const Color neutral = Color(0xFFF1F3F8);

  /// Border for blue-tinted tiles, one step deeper than [blue50].
  static const Color blueLine = Color(0xFFDCE7FB);

  static const Color bg = Color(0xFFF5F6F8);
  static const Color card = Color(0xFFFFFFFF);

  /// Dashed border on the mockup's file-upload rows.
  static const Color dashedLine = Color(0xFFC9D2E4);

  /// The fill the mockup's inputs sit on before focus lifts them to white.
  static const Color fieldFill = Color(0xFFEFF4FD);

  // Dark home surface
  static const Color darkBg = Color(0xFF0D1B3E);
  static const Color darkCard = Color(0xFF152348);
  static const Color darkLine = Color(0xFF1E2F5A);
  static const Color darkMuted = Color(0xFF7A8FAF);

  // ───────────────────────── on-gradient ink ─────────────────────────
  //
  // The mockup keeps its gradient text in white at varying alphas (72-78% for
  // supporting copy, 66% for eyebrows) and never tints it. Named here so no
  // screen has to remember which alpha a given line wants.

  /// Eyebrow / label letterspaced over a gradient surface.
  static const Color onGradientEyebrow = Color(0xB3FFFFFF);

  /// Supporting copy on a gradient surface.
  static const Color onGradientSub = Color(0xC7FFFFFF);

  /// Hairline icon on a gradient surface.
  static const Color onGradientLine = Color(0x9EBFD0F2);

  // ───────────────────────── mobile money ─────────────────────────
  //
  // Brand-exact wallet colours. Fixed, never themed — a carrier's identity
  // must not follow a lender's white-label gradient.

  static const Color airtel = Color(0xFFE40000);
  static const Color mtn = Color(0xFFFFCB05);
  static const Color mtnInk = Color(0xFF00578E);
  static const Color zamtel = Color(0xFF00954C);
  static const Color bankInk = Color(0xFF003087);

  // ───────────────────────── focus ─────────────────────────

  /// The blue focus ring the mockup draws around links and interactive text.
  static const Color focusRing = Color(0xFF7FA8F8);

  /// The glow the mockup puts behind a link outside a gradient surface.
  static const Color linkInk = Color(0xFF7FA8F8);
}
