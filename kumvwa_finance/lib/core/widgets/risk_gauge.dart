import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Semicircle credit-score gauge (300–850), filled proportionally
/// and colored by band: ≥700 green, ≥550 amber, else red.
class RiskGauge extends StatelessWidget {
  const RiskGauge({super.key, required this.score, this.width = 104});

  final int score;
  final double width;

  @override
  Widget build(BuildContext context) {
    final fill = ((score - 300) / 550).clamp(0.0, 1.0);
    final color = score >= 700
        ? AppColors.green500
        : score >= 550
        ? AppColors.amber
        : AppColors.red;

    return SizedBox(
      width: width,
      height: width * 0.58,
      child: CustomPaint(
        painter: _GaugePainter(fill: fill, color: color),
        child: Align(
          alignment: Alignment.bottomCenter,
          child: Text('$score', style: AppText.pageTitle),
        ),
      ),
    );
  }
}

class _GaugePainter extends CustomPainter {
  _GaugePainter({required this.fill, required this.color});

  final double fill;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.shortestSide * 0.10;
    final rect = Rect.fromLTWH(
      stroke / 2,
      stroke / 2,
      size.width - stroke,
      size.width - stroke,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    // Track: left → right half circle.
    canvas.drawArc(
      rect,
      math.pi,
      math.pi,
      false,
      paint..color = AppColors.line,
    );
    if (fill > 0) {
      canvas.drawArc(
        rect,
        math.pi,
        math.pi * fill,
        false,
        paint..color = color,
      );
    }
  }

  @override
  bool shouldRepaint(_GaugePainter old) =>
      old.fill != fill || old.color != color;
}
