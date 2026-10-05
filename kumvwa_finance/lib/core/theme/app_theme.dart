import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

class AppTheme {
  AppTheme._();

  static ThemeData light() {
    const scheme = ColorScheme.light(
      primary: AppColors.blue600,
      onPrimary: Colors.white,
      primaryContainer: AppColors.blue50,
      onPrimaryContainer: AppColors.blue900,
      secondary: AppColors.green500,
      onSecondary: Colors.white,
      secondaryContainer: AppColors.green50,
      onSecondaryContainer: AppColors.green700,
      error: AppColors.red,
      errorContainer: AppColors.red50,
      onErrorContainer: AppColors.redInk,
      surface: AppColors.card,
      onSurface: AppColors.ink,
      surfaceContainerHighest: AppColors.bg,
      outline: AppColors.line,
      outlineVariant: AppColors.line,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme);
    // Apply Inter as the global base — every widget that doesn't set an
    // explicit style will render in Inter automatically.
    final interBase = GoogleFonts.interTextTheme(base.textTheme);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.bg,
      textTheme: _textTheme(interBase),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: AppColors.ink, size: 22),
        titleTextStyle: AppText.pageTitle,
      ),
      cardTheme: CardThemeData(
        color: AppColors.card,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
          side: const BorderSide(color: AppColors.line),
        ),
        margin: EdgeInsets.zero,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.blue600,
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(AppSizes.button),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.button),
          ),
          textStyle: AppText.buttonLabel,
          disabledBackgroundColor: AppColors.line,
          disabledForegroundColor: AppColors.muted,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.blue600,
          side: const BorderSide(color: AppColors.line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.input),
          ),
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.blue600,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          textStyle: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.blue600,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 14,
        ),
        hintStyle: const TextStyle(color: AppColors.muted, fontSize: 13),
        border: _fieldBorder(AppColors.line2),
        enabledBorder: _fieldBorder(AppColors.line2),
        focusedBorder: _fieldBorder(AppColors.line2, width: 1.5),
        errorBorder: _fieldBorder(AppColors.redInk, width: 1.5),
        focusedErrorBorder: _fieldBorder(AppColors.redInk, width: 1.5),
        errorStyle: AppText.fieldError,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.card,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        modalElevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadii.sheet),
          ),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.card,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.chooser),
        ),
        titleTextStyle: AppText.sheetTitle,
        contentTextStyle: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w500,
          color: AppColors.ink2,
          height: 1.5,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.line2,
        thickness: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.ink,
        contentTextStyle: AppText.sheetSub.copyWith(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppColors.card,
        side: const BorderSide(color: AppColors.line),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        labelStyle: AppText.pillLabel,
      ),
      splashFactory: InkSparkle.splashFactory,
    );
  }

  static OutlineInputBorder _fieldBorder(Color color, {double width = 1}) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadii.input),
        borderSide: BorderSide(color: color, width: width),
      );

  static TextTheme _textTheme(TextTheme base) {
    return base.copyWith(
      displaySmall: AppText.heroNumber,
      headlineMedium: AppText.amountLarge,
      headlineSmall: AppText.splashTitle,
      titleLarge: AppText.pageTitle,
      titleMedium: AppText.cardTitle,
      bodyLarge: AppText.body,
      bodyMedium: AppText.paragraph,
      bodySmall: AppText.subText,
      labelLarge: AppText.bodyStrong,
      labelSmall: AppText.caption,
    );
  }
}
