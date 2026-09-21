import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Donut chart with a center widget. Segments are proportional to [value].
class DonutChart extends StatelessWidget {
  const DonutChart({
    super.key,
    required this.segments,
    required this.center,
    this.size = 88,
    this.stroke = 15,
  });

  final List<DonutSegment> segments;
  final Widget center;
  final double size;
  final double stroke;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size.square(size),
            painter: _DonutPainter(segments: segments, stroke: stroke),
          ),
          center,
        ],
      ),
    );
  }
}

class DonutSegment {
  const DonutSegment({required this.value, required this.color});

  final double value;
  final Color color;
}

class _DonutPainter extends CustomPainter {
  _DonutPainter({required this.segments, required this.stroke});

  final List<DonutSegment> segments;
  final double stroke;

  @override
  void paint(Canvas canvas, Size size) {
    final total = segments.fold<double>(0, (s, e) => s + e.value);
    if (total <= 0) return;

    final rect = Rect.fromLTWH(
      stroke / 2,
      stroke / 2,
      size.width - stroke,
      size.height - stroke,
    );

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke;

    var start = -math.pi / 2;
    for (final seg in segments) {
      if (seg.value <= 0) continue;
      final sweep = 2 * math.pi * seg.value / total;
      canvas.drawArc(rect, start, sweep, false, paint..color = seg.color);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) =>
      old.segments != segments || old.stroke != stroke;
}
