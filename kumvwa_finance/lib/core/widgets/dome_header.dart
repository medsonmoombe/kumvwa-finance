import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// The domed header — the mockup's signature surface.
///
/// A brand gradient whose bottom corners are an ELLIPSE (46% of the width
/// across, 54 down) rather than a circle, with two translucent discs tucked
/// behind the content. Every screen in the design language opens with one; the
/// `.sm` variant is the compressed form for secondary screens.
///
/// Do not pair this with a circular border radius. The dome is what makes the
/// header read as lit from above instead of as a rounded card.
class DomeHeader extends StatelessWidget {
  const DomeHeader({
    super.key,
    required this.child,
    this.small = false,
    this.gradient,
    this.blobs = true,
    this.blobOpacity = 1,
    this.padding,
  });

  final Widget child;

  /// The compressed `.dome.sm`: shallower dome, 40%/42 instead of 46%/54.
  final bool small;

  final Gradient? gradient;
  final bool blobs;

  /// Scales the blob alpha down on a short surface, where full strength reads
  /// heavier than the mockup intends.
  final double blobOpacity;

  /// Defaults to the mockup's `16px 18px 24px` (or `14px 18px 22px` when small).
  final EdgeInsets? padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(gradient: gradient ?? AppGradients.dome),
      child: Stack(
        children: [
          if (blobs) _DomeBlobs(opacity: blobOpacity),
          Padding(
            padding:
                padding ??
                EdgeInsets.fromLTRB(
                  AppInsets.page,
                  small ? 14 : 16,
                  AppInsets.page,
                  small ? 22 : 24,
                ),
            child: child,
          ),
        ],
      ),
    );
  }
}

/// The mockup's two decorative discs, positioned against the header's own box.
class _DomeBlobs extends StatelessWidget {
  const _DomeBlobs({required this.opacity});

  final double opacity;

  @override
  Widget build(BuildContext context) {
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -60,
              top: -90,
              child: _Disc(size: 190, alpha: 0.09 * opacity),
            ),
            Positioned(
              left: -44,
              bottom: -30,
              child: _Disc(size: 130, alpha: 0.07 * opacity),
            ),
          ],
        ),
      ),
    );
  }
}

class _Disc extends StatelessWidget {
  const _Disc({required this.size, required this.alpha});

  final double size;
  final double alpha;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: Colors.white.withValues(alpha: alpha),
      ),
    );
  }
}

/// A title + supporting line for a domed header, with an optional circular back
/// button above it. The standard top of every screen that isn't a hero.
class DomeTitle extends StatelessWidget {
  const DomeTitle({
    super.key,
    required this.title,
    this.subtitle,
    this.onBack,
    this.trailing,
    this.centerTitle = false,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;

  /// Right-hand action in the title row — used by the notifications header for
  /// its "Mark all read" link.
  final Widget? trailing;

  /// Centres the title block. The mockup does this on the success screen.
  final bool centerTitle;

  @override
  Widget build(BuildContext context) {
    final heading = Column(
      crossAxisAlignment: centerTitle
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        Text(title, style: AppText.domeTitle),
        if (subtitle != null) ...[
          const SizedBox(height: 3),
          Text(
            subtitle!,
            style: AppText.sheetSub.copyWith(color: AppColors.onGradientSub),
          ),
        ],
      ],
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (onBack != null) ...[
          DomeBackButton(onTap: onBack!),
          const SizedBox(height: 8),
        ],
        if (trailing != null)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: heading),
              trailing!,
            ],
          )
        else
          heading,
      ],
    );
  }
}

/// The mockup's back affordance: a translucent disc holding a chevron.
class DomeBackButton extends StatelessWidget {
  const DomeBackButton({super.key, required this.onTap, this.tooltip});

  final VoidCallback onTap;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: tooltip ?? 'Back',
      child: InkWell(
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0x29FFFFFF),
          ),
          child: const Icon(
            Icons.chevron_left_rounded,
            size: 22,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

/// A [DomeHeader] stacked over a scrolling body, with an optional illustration
/// that overhangs the dome's bottom edge.
///
/// The overhang is why this is a custom layout rather than a `Column`: the
/// illustration has to paint ABOVE the body, but must not contribute a single
/// pixel to the column's height.
class DomeScaffold extends StatelessWidget {
  const DomeScaffold({
    super.key,
    required this.header,
    required this.body,
    this.overhang,
    this.overhangWidth = 88,
    this.overhangInset = 26,
    this.overhangAlign = DomeOverhangAlign.bottomRight,
    this.backgroundColor = AppColors.card,
  });

  final Widget header;
  final Widget body;

  /// Paints over the header/body seam, hanging [overhangInset] below it.
  final Widget? overhang;
  final double overhangWidth;

  /// How far the overhang hangs below the seam.
  final double overhangInset;

  final DomeOverhangAlign overhangAlign;

  /// The surface the body scrolls on. The mockup's screens are white below the
  /// dome, not the app's usual grey.
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: backgroundColor,
      child: SizedBox.expand(
        child: CustomMultiChildLayout(
          delegate: _DomeDelegate(
            overhang: overhang,
            overhangWidth: overhangWidth,
            overhangInset: overhangInset,
            overhangAlign: overhangAlign,
          ),
          children: [
            LayoutId(id: _DomeDelegate.headerId, child: header),
            LayoutId(id: _DomeDelegate.bodyId, child: body),
            if (overhang != null)
              LayoutId(
                id: _DomeDelegate.overhangId,
                child: Align(
                  alignment: Alignment.topLeft,
                  child: SizedBox(width: overhangWidth, child: overhang),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Which corner of the header the illustration hangs off.
enum DomeOverhangAlign { bottomRight, bottomLeft }

const _headerId = 'dome-header';
const _bodyId = 'dome-body';
const _overhangId = 'dome-overhang';

class _DomeDelegate extends MultiChildLayoutDelegate {
  _DomeDelegate({
    required this.overhang,
    required this.overhangWidth,
    required this.overhangInset,
    required this.overhangAlign,
  });

  final Widget? overhang;
  final double overhangWidth;
  final double overhangInset;
  final DomeOverhangAlign overhangAlign;

  static const headerId = _headerId;
  static const bodyId = _bodyId;
  static const overhangId = _overhangId;

  @override
  void performLayout(Size size) {
    // The header takes its natural height; the body gets everything left over.
    // The width must be TIGHT: with only a loose max-width the header — a
    // gradient box wrapping content-sized text — shrinks to its child's
    // natural width instead of spanning the screen (the dome only reached as
    // far as its title). Height stays unbounded so the header keeps its own
    // height rather than expanding to fill the viewport.
    final header = layoutChild(
      _headerId,
      BoxConstraints.tightFor(width: size.width),
    );
    positionChild(_headerId, Offset.zero);

    layoutChild(
      _bodyId,
      BoxConstraints.tightFor(
        width: size.width,
        height: (size.height - header.height).clamp(0, size.height),
      ),
    );
    positionChild(_bodyId, Offset(0, header.height));

    if (!hasChild(_overhangId)) return;
    // Laid out but never sized into the parent: the overhang hangs past the
    // seam on purpose.
    final art = layoutChild(
      _overhangId,
      BoxConstraints.loose(Size(overhangWidth, double.infinity)),
    );
    final left = switch (overhangAlign) {
      DomeOverhangAlign.bottomRight => size.width - art.width - 14,
      DomeOverhangAlign.bottomLeft => 14.0,
    };
    positionChild(_overhangId, Offset(left, header.height - overhangInset));
  }

  @override
  bool shouldRelayout(_DomeDelegate old) =>
      old.overhangWidth != overhangWidth ||
      old.overhangInset != overhangInset ||
      old.overhangAlign != overhangAlign;
}
