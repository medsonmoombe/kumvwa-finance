import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// The flat illustration set, lifted 1:1 from the design mockup's SVG symbols.
///
/// These are decorative only — none of them carry text, and every screen that
/// uses one supplies a semantic label of its own alongside it.
enum IllustrationAsset {
  /// The mascot. A person's torso, arms up, head and face — used on the splash
  /// scene, peeking from a header, and inside a chooser card.
  mascot('assets/illustrations/mascot.svg'),

  /// A classical institution: pediment, four columns, three steps. Stands in
  /// for a lender.
  bank('assets/illustrations/bank.svg'),

  /// The composed splash scene — the institution on a blue disc inside a dashed
  /// orbit, with the confetti the mockup scatters around it.
  splashScene('assets/illustrations/splash_scene.svg');

  const IllustrationAsset(this.path);

  final String path;

  /// Intrinsic aspect ratio (width / height) of the source viewBox.
  double get aspect => switch (this) {
    IllustrationAsset.mascot => 200 / 240,
    IllustrationAsset.bank => 200 / 170,
    IllustrationAsset.splashScene => 360 / 250,
  };
}

/// Renders an [IllustrationAsset].
///
/// Give exactly one of [width] (height follows the asset's aspect ratio),
/// [height] (width follows), or [size] (square, for a circular frame).
class Illustration extends StatelessWidget {
  const Illustration(
    this.asset, {
    super.key,
    this.width,
    this.height,
    this.size,
    this.color,
    this.semanticLabel,
  });

  final IllustrationAsset asset;
  final double? width;
  final double? height;

  /// Square bounding box. Ignores the asset's aspect ratio — use for avatars
  /// and circular frames, where the caller wants a box, not a proportion.
  final double? size;

  /// Recolours every pixel. Off by default; the illustrations carry their own
  /// flat palette and only a one-colour placement should ask for a wash.
  final Color? color;

  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final paint = SvgPicture.asset(
      asset.path,
      width: width,
      height: height,
      colorFilter: color == null
          ? null
          : ColorFilter.mode(color!, BlendMode.srcIn),
      semanticsLabel: semanticLabel,
    );

    if (size != null) {
      return SizedBox(width: size, height: size, child: paint);
    }
    assert(width != null || height != null, 'Give Illustration a size.');
    return paint;
  }
}
