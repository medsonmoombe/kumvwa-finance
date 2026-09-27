import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Brand loader: a rotating arc on a soft track, with an optional message.
/// Deliberately carries NO mark in the middle — the splash screen shows the
/// logo, this shows that something is happening.
class AppLoader extends StatefulWidget {
  const AppLoader({super.key, this.size = 84, this.message});

  final double size;
  final String? message;

  @override
  State<AppLoader> createState() => _AppLoaderState();
}

class _AppLoaderState extends State<AppLoader>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _ctrl,
          builder: (_, _) => SizedBox(
            width: widget.size,
            height: widget.size,
            child: CustomPaint(painter: _ArcPainter(progress: _ctrl.value)),
          ),
        ),
        if (widget.message != null) ...[
          const SizedBox(height: 16),
          Text(
            widget.message!,
            textAlign: TextAlign.center,
            style: AppText.subText,
          ),
        ],
      ],
    );
  }
}

class _ArcPainter extends CustomPainter {
  _ArcPainter({required this.progress});

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final stroke = size.shortestSide * 0.06;
    final center = size.center(Offset.zero);
    final radius = (size.shortestSide - stroke * 2) / 2;
    final rect = Rect.fromCircle(center: center, radius: radius);

    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = AppColors.blue50,
    );

    canvas.save();
    canvas.translate(center.dx, center.dy);
    canvas.rotate(progress * 2 * math.pi);
    canvas.translate(-center.dx, -center.dy);
    canvas.drawArc(
      rect,
      -math.pi / 2,
      math.pi * 0.7,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = AppColors.blue600,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.progress != progress;
}

/// Small white spinner for inside buttons.
class ButtonSpinner extends StatelessWidget {
  const ButtonSpinner({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: const CircularProgressIndicator(
        strokeWidth: 2.4,
        color: Colors.white,
      ),
    );
  }
}
