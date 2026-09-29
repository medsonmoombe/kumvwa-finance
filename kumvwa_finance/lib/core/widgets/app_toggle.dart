import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// The mockup's switch: a 44x26 track with a 20dp knob.
///
/// A native [Switch] can't be reduced to that without a theme override that
/// fights the rest of Material, so this is a plain gesture surface with a
/// spring knob. It reports intent through [onChanged] like any other control —
/// persist the value, don't flip local state here.
class AppToggle extends StatelessWidget {
  const AppToggle({super.key, required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      toggled: value,
      onTap: () {
        HapticFeedback.selectionClick();
        onChanged(!value);
      },
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          onChanged(!value);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          width: 44,
          height: 26,
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: value ? AppColors.blue500 : const Color(0xFFD9DEE8),
            borderRadius: BorderRadius.circular(14),
          ),
          child: AnimatedAlign(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            alignment: value ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              width: 20,
              height: 20,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Color(0x26000000),
                    blurRadius: 3,
                    offset: Offset(0, 1),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
