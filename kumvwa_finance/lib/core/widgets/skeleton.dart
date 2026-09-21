import 'package:flutter/material.dart';

/// Animated shimmer base for all skeleton shapes.
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, this.width, this.height = 12, this.radius = 6});

  final double? width;
  final double height;
  final double radius;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (_, _) =>
              CustomPaint(painter: _ShimmerPainter(t: _ctrl.value)),
        ),
      ),
    );
  }
}

class _ShimmerPainter extends CustomPainter {
  _ShimmerPainter({required this.t});

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.drawRect(
      Offset.zero & size,
      Paint()..color = const Color(0xFFE9EDF5),
    );

    final bandWidth = size.width * 0.6;
    final x = -bandWidth + (size.width + bandWidth * 2) * t;
    final rect = Rect.fromLTWH(x, 0, bandWidth, size.height);
    canvas.drawRect(
      rect,
      Paint()
        ..shader = const LinearGradient(
          colors: [Color(0x00FFFFFF), Color(0x66FFFFFF), Color(0x00FFFFFF)],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_ShimmerPainter old) => old.t != t;
}

// ---------- composed skeleton presets ----------

class SkeletonLine extends StatelessWidget {
  const SkeletonLine({super.key, this.widthFactor = 0.6, this.height = 12});

  final double widthFactor;
  final double height;

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      alignment: Alignment.centerLeft,
      widthFactor: widthFactor,
      child: Skeleton(height: height),
    );
  }
}

class SkeletonCircle extends StatelessWidget {
  const SkeletonCircle({super.key, this.size = 40});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Skeleton(width: size, height: size, radius: size / 2);
  }
}

/// Row card: avatar + two text lines (clients, recent loans, schedule…).
class SkeletonCard extends StatelessWidget {
  const SkeletonCard({super.key, this.showBadge = false});

  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE6E9F0)),
      ),
      child: Row(
        children: [
          const SkeletonCircle(size: 40),
          const SizedBox(width: 11),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonLine(widthFactor: 0.5, height: 13),
                SizedBox(height: 7),
                SkeletonLine(widthFactor: 0.8, height: 10),
              ],
            ),
          ),
          if (showBadge) ...[
            const SizedBox(width: 8),
            const Skeleton(width: 52, height: 20, radius: 999),
          ],
        ],
      ),
    );
  }
}

/// Dashboard-shaped placeholder: hero, stats, health panel, list.
class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Skeleton(width: double.infinity, height: 112, radius: 20),
        const SizedBox(height: 11),
        Row(
          children: [
            for (var i = 0; i < 3; i++) ...[
              if (i > 0) const SizedBox(width: 8),
              const Expanded(child: Skeleton(height: 58, radius: 13)),
            ],
          ],
        ),
        const SizedBox(height: 11),
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE6E9F0)),
          ),
          child: const Row(
            children: [
              SkeletonCircle(size: 88),
              SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonLine(widthFactor: 0.7),
                    SizedBox(height: 8),
                    SkeletonLine(widthFactor: 0.55, height: 10),
                    SizedBox(height: 8),
                    SkeletonLine(widthFactor: 0.62, height: 10),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 11),
        const SkeletonCard(showBadge: true),
        const SizedBox(height: 9),
        const SkeletonCard(showBadge: true),
      ],
    );
  }
}

/// Client-list-shaped placeholder.
class ClientsSkeletonList extends StatelessWidget {
  const ClientsSkeletonList({super.key, this.itemCount = 5});

  final int itemCount;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < itemCount; i++) ...[
          const SkeletonCard(showBadge: true),
          if (i < itemCount - 1) const SizedBox(height: 9),
        ],
      ],
    );
  }
}
