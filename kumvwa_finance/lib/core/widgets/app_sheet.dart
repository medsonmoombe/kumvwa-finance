import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Presents [builder] as a bottom sheet in the mockup's style.
///
/// Returns whatever the sheet pops, so a picker can hand a selection back to
/// its caller without a callback. Sets [isScrollControlled] because every sheet
/// in this design is tall enough to be clipped on a short device otherwise.
Future<T?> showAppSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool dismissible = true,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    isDismissible: dismissible,
    enableDrag: dismissible,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x590D1B3E),
    builder: (ctx) =>
        AppSheet(scrollable: true, child: Builder(builder: builder)),
  );
}

/// The sheet surface: a grabber, a title, optional subtitle, then content.
class AppSheet extends StatelessWidget {
  const AppSheet({
    super.key,
    required this.child,
    this.title,
    this.subtitle,
    this.scrollable = false,
  });

  final Widget child;
  final String? title;
  final String? subtitle;

  /// Wraps [child] in a scroll view sized to the content. Leave off when the
  /// child manages its own scrolling (a long form inside a [SingleChildScrollView]).
  final bool scrollable;

  /// The mockup's sheet never exceeds this share of the screen — it should read
  /// as something sliding up over a page, not as a new page.
  static const double maxHeightFactor = 0.88;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final maxHeight = media.size.height * maxHeightFactor;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadii.sheet),
          ),
          boxShadow: [
            BoxShadow(
              color: Color(0x330D1B3E),
              blurRadius: 40,
              offset: Offset(0, -8),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 9),
              Container(
                width: 38,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.line,
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              if (title != null) ...[
                const SizedBox(height: 14),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppInsets.page,
                  ),
                  child: Column(
                    children: [
                      Text(
                        title!,
                        style: AppText.sheetTitle,
                        textAlign: TextAlign.center,
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          subtitle!,
                          style: AppText.sheetSub,
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
              Flexible(
                child: scrollable
                    ? SingleChildScrollView(
                        padding: EdgeInsets.fromLTRB(
                          AppInsets.page,
                          title == null ? 16 : 14,
                          AppInsets.page,
                          16,
                        ),
                        child: child,
                      )
                    : Padding(
                        padding: EdgeInsets.fromLTRB(
                          AppInsets.page,
                          title == null ? 16 : 14,
                          AppInsets.page,
                          8,
                        ),
                        child: child,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A labelled group of rows inside a sheet — the mockup's `.glbl`.
class SheetGroup extends StatelessWidget {
  const SheetGroup({super.key, required this.label, required this.children});

  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 0, 6),
          child: Text(label.toUpperCase(), style: AppText.eyebrowTight),
        ),
        for (var i = 0; i < children.length; i++)
          children[i] is Divider
              ? children[i]
              : Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: children[i],
                ),
      ],
    );
  }
}
