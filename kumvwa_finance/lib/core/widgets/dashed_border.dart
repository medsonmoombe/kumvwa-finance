import 'dart:math' as math;

import 'package:flutter/material.dart';

/// A rounded rectangle whose stroke is drawn as dashes.
///
/// Flutter has no dashed [Border], and the mockup's dotted outline is load-
/// bearing on upload rows — it reads as "drop a file here" rather than "this
/// field is filled in". [Border] also cannot stroke a shape whose corners are
/// rounded AND whose edge is segmented, so this is a real [ShapeBorder] with its
/// own [paint] rather than a painter bolted onto a decoration.
class DashedRoundedRectangleBorder extends ShapeBorder {
  const DashedRoundedRectangleBorder({
    this.radius = const Radius.circular(12),
    this.color = const Color(0xFFE3E7F0),
    this.strokeWidth = 1.5,
    this.dash = 5,
    this.gap = 4,
  });

  final Radius radius;
  final Color color;
  final double strokeWidth;

  /// Length of each painted segment, in logical pixels.
  final double dash;

  /// Length of the gap between segments.
  final double gap;

  @override
  EdgeInsetsGeometry get dimensions => EdgeInsets.all(strokeWidth);

  @override
  ShapeBorder scale(double t) => DashedRoundedRectangleBorder(
    radius: Radius.circular(radius.x * t),
    color: color,
    strokeWidth: strokeWidth * t,
    dash: dash * t,
    gap: gap * t,
  );

  @override
  Path getInnerPath(Rect rect, {TextDirection? textDirection}) => Path()
    ..fillType = PathFillType.evenOdd
    ..addPath(getOuterPath(rect), Offset.zero);

  @override
  Path getOuterPath(Rect rect, {TextDirection? textDirection}) =>
      Path()..addRRect(RRect.fromRectAndRadius(rect, radius));

  @override
  void paint(Canvas canvas, Rect rect, {TextDirection? textDirection}) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    // Inset by half the stroke so the dashes sit inside the box rather than
    // straddling the edge.
    final r = rect.deflate(strokeWidth / 2);
    canvas.drawPath(_dash(RRect.fromRectAndRadius(r, radius)), paint);
  }

  /// Walks the rounded rect's path, cutting it into dash/gap segments.
  ///
  /// Done by arc length rather than by parameterising the path, because
  /// [PathMetric] is the only way to get a uniform dash that stays even through
  /// the corner arcs — sampling by segment index makes corners visibly
  /// misaligned.
  Path _dash(RRect rrect) {
    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics().toList();
    if (metrics.isEmpty) return path;

    final out = Path();
    for (final metric in metrics) {
      final total = metric.length;
      // Degenerate shapes (a collapsed row mid-animation) report zero, and an
      // unconstrained one reports infinity — walking either of those by `period`
      // would never terminate, so give up and let the solid stroke stand.
      if (!total.isFinite || total <= 0 || dash <= 0) continue;
      final period = dash + gap;
      // A dash that never closes is just a line — draw it and move on.
      if (period >= total) {
        out.addPath(metric.extractPath(0, total), Offset.zero);
        continue;
      }
      for (var d = 0.0; d < total; d += period) {
        final end = math.min(d + dash, total);
        out.addPath(metric.extractPath(d, end), Offset.zero);
      }
    }
    return out;
  }

  @override
  bool operator ==(Object other) =>
      other is DashedRoundedRectangleBorder &&
      other.radius == radius &&
      other.color == color &&
      other.strokeWidth == strokeWidth &&
      other.dash == dash &&
      other.gap == gap;

  @override
  int get hashCode => Object.hash(radius, color, strokeWidth, dash, gap);
}
