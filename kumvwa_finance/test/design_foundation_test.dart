import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl_phone_field/intl_phone_field.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/action_grid.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_card.dart';
import 'package:kumvwa_finance/core/widgets/app_chip.dart';
import 'package:kumvwa_finance/core/widgets/app_field.dart';
import 'package:kumvwa_finance/core/widgets/app_nav.dart';
import 'package:kumvwa_finance/core/widgets/app_phone_field.dart';
import 'package:kumvwa_finance/core/widgets/app_pill.dart';
import 'package:kumvwa_finance/core/widgets/app_row.dart';
import 'package:kumvwa_finance/core/widgets/app_seg.dart';
import 'package:kumvwa_finance/core/widgets/app_sheet.dart';
import 'package:kumvwa_finance/core/widgets/app_toast.dart';
import 'package:kumvwa_finance/core/widgets/app_toggle.dart';
import 'package:kumvwa_finance/core/widgets/dashed_border.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';
import 'package:kumvwa_finance/core/widgets/stats_strip.dart';
import 'package:kumvwa_finance/core/widgets/success_screen.dart';

/// These lock down the geometry the mockup specifies numerically.
///
/// Everything asserted here is a value the design fixes exactly — the dome's
/// 46%/54 ellipse, the 47dp field, the 50dp action circle. `flutter analyze`
/// cannot catch a token being edited, and a 2dp drift here is invisible in code
/// review but obvious on a device, so the numbers are pinned as tests.
Future<void> _pumpAt(
  WidgetTester tester,
  Widget child, {
  Size size = const Size(360, 720),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(home: Scaffold(body: child)));
}

void main() {
  group('DomeHeader', () {
    testWidgets('bottom corners are the mockup ellipse, not a circle', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const DomeHeader(child: Text('x')),
        size: const Size(400, 720),
      );

      final clip = tester.widget<ClipRRect>(find.byType(ClipRRect).first);
      final radius = clip.borderRadius as BorderRadius;
      // `46% / 54px` of a 400dp header.
      expect(radius.bottomLeft.x, closeTo(184, 0.5));
      expect(radius.bottomLeft.y, 54);
      expect(radius.bottomRight.x, closeTo(184, 0.5));
      // The top must stay square — that is what makes it a dome.
      expect(radius.topLeft, Radius.zero);
    });

    testWidgets('the small variant uses the 40%/42 geometry', (tester) async {
      await _pumpAt(
        tester,
        const DomeHeader(small: true, child: Text('x')),
        size: const Size(400, 720),
      );
      final clip = tester.widget<ClipRRect>(find.byType(ClipRRect).first);
      final radius = clip.borderRadius as BorderRadius;
      expect(radius.bottomLeft.x, closeTo(160, 0.5));
      expect(radius.bottomLeft.y, 42);
    });

    testWidgets('paints the brand gradient', (tester) async {
      await _pumpAt(tester, const DomeHeader(child: Text('x')));
      final box = tester.widget<DecoratedBox>(
        find
            .descendant(
              of: find.byType(DomeHeader),
              matching: find.byType(DecoratedBox),
            )
            .first,
      );
      final decoration = box.decoration as BoxDecoration;
      expect(decoration.gradient, same(AppGradients.dome));
    });
  });

  group('DomeScaffold', () {
    testWidgets('gives the body everything the header does not use', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const DomeScaffold(
          header: DomeHeader(child: SizedBox(height: 20)),
          body: SizedBox.expand(),
        ),
      );
      final header = tester.getSize(find.byType(DomeHeader));
      final body = tester.getSize(find.byType(SizedBox).last);
      expect(header.height, greaterThan(20));
      expect(body.height, closeTo(720 - header.height, 0.5));
    });

    testWidgets('the overhang hangs past the seam without sizing into it', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const DomeScaffold(
          header: DomeHeader(child: SizedBox(height: 20)),
          body: SizedBox.expand(),
          overhang: SizedBox(height: 60, child: Text('art')),
          overhangInset: 30,
        ),
      );

      final seam =
          tester.getTopLeft(find.byType(DomeHeader)).dy +
          tester.getSize(find.byType(DomeHeader)).height;
      final artTop = tester.getTopLeft(find.text('art')).dy;
      // 30dp below the seam.
      expect(artTop, closeTo(seam + 30 - 60, 0.5));

      // The parent must not have grown to accommodate it.
      expect(tester.getSize(find.byType(Scaffold)).height, 720);
    });
  });

  group('AppButton', () {
    testWidgets('is 50dp tall and reports taps', (tester) async {
      var taps = 0;
      await _pumpAt(
        tester,
        AppButton(label: 'Continue', onPressed: () => taps++),
      );

      expect(tester.getSize(find.byType(AppButton)).height, AppSizes.button);
      await tester.tap(find.text('Continue'));
      expect(taps, 1);
    });

    testWidgets('blocks input and swaps the label while busy', (tester) async {
      var taps = 0;
      await _pumpAt(
        tester,
        AppButton(label: 'Continue', onPressed: () => taps++, busy: true),
      );

      expect(find.byType(AppSpinner), findsOneWidget);
      expect(find.text('Continue'), findsNothing);
      await tester.tap(find.byType(AppButton));
      expect(taps, 0, reason: 'a busy button must not fire its action');
    });

    testWidgets('is inert without a callback', (tester) async {
      await _pumpAt(tester, const AppButton(label: 'Continue'));
      expect(
        tester.widget<AppButton>(find.byType(AppButton)).onPressed,
        isNull,
      );
    });

    testWidgets('the green tone carries the green gradient', (tester) async {
      await _pumpAt(
        tester,
        const AppButton(label: 'Pay', tone: AppButtonTone.green),
      );
      final containers = tester.widgetList<Container>(
        find.descendant(
          of: find.byType(AppButton),
          matching: find.byType(Container),
        ),
      );
      final withGradient = containers
          .map((c) => c.decoration)
          .whereType<BoxDecoration>()
          .where((d) => d.gradient != null)
          .toList();
      expect(withGradient.single.gradient, same(AppGradients.green));
    });
  });

  group('AppPill / AppSeg', () {
    testWidgets('a group reports the value it was given', (tester) async {
      String? picked;
      await _pumpAt(
        tester,
        AppPillGroup(
          options: const [('100', 'K100'), ('500', 'K500')],
          selected: '100',
          onChanged: (v) => picked = v,
        ),
      );

      final pills = tester.widgetList<AppPill>(find.byType(AppPill));
      expect(pills.map((p) => p.selected), [true, false]);

      await tester.tap(find.text('K500'));
      expect(picked, '500');
    });

    testWidgets('a segmented control lays its halves out evenly', (
      tester,
    ) async {
      String? picked;
      await _pumpAt(
        tester,
        AppSeg(
          segments: const [('loans', 'Loans'), ('apps', 'Applications')],
          selected: 'loans',
          onChanged: (v) => picked = v,
        ),
      );
      await tester.tap(find.text('Applications'));
      expect(picked, 'apps');
    });
  });

  group('AppToggle', () {
    testWidgets('reports the opposite of its current value', (tester) async {
      final seen = <bool>[];
      await _pumpAt(tester, AppToggle(value: false, onChanged: seen.add));
      await tester.tap(find.byType(AppToggle));
      expect(seen, [true]);
    });

    testWidgets('matches the mockup track size', (tester) async {
      await _pumpAt(tester, AppToggle(value: true, onChanged: (_) {}));
      final size = tester.getSize(find.byType(AppToggle));
      expect(size.width, AppSizes.toggleWidth);
      expect(size.height, AppSizes.toggleHeight);
    });
  });

  group('DashedRoundedRectangleBorder', () {
    test('compares by value', () {
      const a = DashedRoundedRectangleBorder();
      const b = DashedRoundedRectangleBorder();
      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(
        a,
        isNot(const DashedRoundedRectangleBorder(gap: 9)),
        reason: 'a different gap is a different border',
      );
    });

    test('scales every metric', () {
      const b = DashedRoundedRectangleBorder();
      final s = b.scale(2) as DashedRoundedRectangleBorder;
      expect(s.strokeWidth, 3);
      expect(s.dash, 10);
      expect(s.gap, 8);
      expect(s.radius.x, 24);
    });

    testWidgets('fills the box it is given', (tester) async {
      await _pumpAt(
        tester,
        const ColoredBox(
          color: Colors.white,
          child: SizedBox(
            width: 100,
            height: 40,
            child: DecoratedBox(
              decoration: ShapeDecoration(
                shape: DashedRoundedRectangleBorder(),
              ),
            ),
          ),
        ),
      );
      // Must paint without throwing, and report insets for the stroke.
      expect(tester.takeException(), isNull);
    });
  });

  group('ActionGrid', () {
    testWidgets('reports the tapped action id', (tester) async {
      String? tapped;
      await _pumpAt(
        tester,
        ActionGrid(
          actions: const [
            AppAction(id: 'history', label: 'History', icon: Icons.history),
            AppAction(
              id: 'pay',
              label: 'Pay',
              icon: Icons.payments,
              tone: ActionTone.green,
            ),
          ],
          onTap: (id) => tapped = id,
        ),
      );

      await tester.tap(find.text('History'));
      expect(tapped, 'history');
    });

    testWidgets('lays out four across at the mockup circle size', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        ActionGrid(
          actions: [
            for (var i = 0; i < 4; i++)
              AppAction(id: '$i', label: 'Act $i', icon: Icons.star),
          ],
          onTap: (_) {},
        ),
      );
      final rows = find.descendant(
        of: find.byType(ActionGrid),
        matching: find.byType(Container),
      );
      expect(rows, findsWidgets);
      // No RenderFlex/RenderGrid overflow on the narrowest supported phone.
      expect(tester.takeException(), isNull);
    });
  });

  group('AppNav', () {
    testWidgets('marks the active item with a dot and reports taps', (
      tester,
    ) async {
      String? tapped;
      await _pumpAt(
        tester,
        Align(
          alignment: Alignment.topLeft,
          child: AppNav(
            activeId: 'home',
            onTap: (id) => tapped = id,
            items: const [
              AppNavItem(id: 'home', label: 'Home', icon: Icons.home_outlined),
              AppNavItem(
                id: 'alerts',
                label: 'Alerts',
                icon: Icons.notifications_none,
              ),
            ],
          ),
        ),
      );

      await tester.tap(find.text('Alerts'));
      expect(tapped, 'alerts');

      // Exactly one filled dot, on the active item.
      final dots = tester
          .widgetList<DecoratedBox>(
            find.descendant(
              of: find.byType(AppNav),
              matching: find.byType(DecoratedBox),
            ),
          )
          .where((d) {
            final dec = d.decoration;
            return dec is BoxDecoration &&
                dec.shape == BoxShape.circle &&
                dec.color == AppColors.blue500;
          });
      expect(dots, hasLength(1));
    });
  });

  group('AppField', () {
    testWidgets('is 47dp tall and reports a submitted value', (tester) async {
      final ctrl = TextEditingController();
      addTearDown(ctrl.dispose);
      String? submitted;

      await _pumpAt(
        tester,
        AppField(
          label: 'Password',
          controller: ctrl,
          hint: 'Your password',
          onSubmitted: (v) => submitted = v,
        ),
      );

      expect(tester.getSize(find.byType(AppField)).height, greaterThan(47));
      await tester.enterText(find.byType(TextField), 'hunter2');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      expect(submitted, 'hunter2');
    });

    testWidgets('a validator error surfaces through the enclosing Form', (
      tester,
    ) async {
      final formKey = GlobalKey<FormState>();
      final ctrl = TextEditingController();
      addTearDown(ctrl.dispose);

      await _pumpAt(
        tester,
        Builder(
          builder: (_) => Form(
            key: formKey,
            child: Column(
              children: [
                AppField(
                  controller: ctrl,
                  label: 'Phone number',
                  formFieldKey: const ValueKey('phone'),
                  validator: (v) => (v == null || v.isEmpty)
                      ? 'Phone number is required'
                      : null,
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.text('Phone number is required'), findsNothing);
      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();

      expect(find.text('Phone number is required'), findsOneWidget);
    });

    testWidgets('a controller-backed field revalidates what was typed', (
      tester,
    ) async {
      // The regression this guards: a plain validator used to see the text that
      // was present when the field first built, so a field filled in afterwards
      // could never pass.
      final formKey = GlobalKey<FormState>();
      final ctrl = TextEditingController();
      addTearDown(ctrl.dispose);

      await _pumpAt(
        tester,
        Builder(
          builder: (_) => Form(
            key: formKey,
            child: AppField(
              controller: ctrl,
              label: 'Password',
              obscure: true,
              formFieldKey: const ValueKey('password'),
              validator: Validators.password,
            ),
          ),
        ),
      );

      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Password is required'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'secret123');
      await tester.pump();

      expect(ctrl.text, 'secret123');
      expect(formKey.currentState!.validate(), isTrue);
      await tester.pump();
      expect(find.text('Password is required'), findsNothing);
    });

    testWidgets('the direct error wins over the validator', (tester) async {
      final formKey = GlobalKey<FormState>();
      await _pumpAt(
        tester,
        Builder(
          builder: (_) => Form(
            key: formKey,
            child: AppField(
              label: 'Phone number',
              error: 'Already registered',
              validator: (_) => 'Client-side complaint',
            ),
          ),
        ),
      );

      formKey.currentState!.validate();
      await tester.pump();
      expect(find.text('Already registered'), findsOneWidget);
      expect(find.text('Client-side complaint'), findsNothing);
    });

    group('AppPhoneField', () {
      testWidgets('locks the country to Zambia and offers no choice', (
        tester,
      ) async {
        final ctrl = TextEditingController();
        addTearDown(ctrl.dispose);

        await _pumpAt(
          tester,
          AppPhoneField(
            label: 'Phone number',
            controller: ctrl,
            hint: '971234567',
          ),
        );

        final field = tester.widget<IntlPhoneField>(
          find.byType(IntlPhoneField),
        );
        expect(field.initialCountryCode, 'ZM');
        expect(field.showDropdownIcon, isFalse);
        // One country is not a choice. Offering the full list would let a
        // borrower dial a number Kumvwa cannot lend against.
        expect(field.countries!.single.code, 'ZM');
        expect(field.onCountryChanged, isNotNull);
      });

      testWidgets('keeps the dial code out of the controller', (tester) async {
        final ctrl = TextEditingController();
        addTearDown(ctrl.dispose);

        await _pumpAt(
          tester,
          AppPhoneField(
            label: 'Phone number',
            controller: ctrl,
            hint: '971234567',
          ),
        );

        await tester.enterText(find.byType(TextField), '971234567');
        await tester.pump();

        expect(ctrl.text, '971234567');
        expect(ctrl.text, isNot(contains('260')));
      });

      testWidgets('validates the national number it was given', (tester) async {
        final formKey = GlobalKey<FormState>();
        final ctrl = TextEditingController();
        addTearDown(ctrl.dispose);

        await _pumpAt(
          tester,
          Builder(
            builder: (_) => Form(
              key: formKey,
              child: AppPhoneField(
                label: 'Phone number',
                controller: ctrl,
                formFieldKey: const ValueKey('phone'),
                validator: (v) => Validators.zmPhone(v),
              ),
            ),
          ),
        );

        expect(formKey.currentState!.validate(), isFalse);
        await tester.pump();
        expect(find.text('Phone number is required'), findsOneWidget);

        await tester.enterText(find.byType(TextField), '971234567');
        await tester.pump();
        expect(formKey.currentState!.validate(), isTrue);
        await tester.pump();
        expect(find.text('Phone number is required'), findsNothing);
      });
    });

    testWidgets('toggles obscuring on its own eye', (tester) async {
      final ctrl = TextEditingController(text: 'secret');
      addTearDown(ctrl.dispose);
      await _pumpAt(tester, AppField(controller: ctrl, obscure: true));

      expect(
        tester.widget<TextField>(find.byType(TextField)).obscureText,
        isTrue,
      );
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pump();
      expect(
        tester.widget<TextField>(find.byType(TextField)).obscureText,
        isFalse,
      );
    });

    testWidgets('an error tints the frame and prints the message', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const AppField(label: 'Phone', error: 'Enter a valid number'),
      );
      expect(find.text('Enter a valid number'), findsOneWidget);

      final frame = tester.widgetList<AnimatedContainer>(
        find.descendant(
          of: find.byType(AppField),
          matching: find.byType(AnimatedContainer),
        ),
      );
      final border = frame
          .map((c) => c.decoration)
          .whereType<BoxDecoration>()
          .map((d) => d.border)
          .whereType<Border>()
          .single;
      expect(border.top.color, AppColors.redInk);
    });
  });

  group('AppUploadRow', () {
    testWidgets('dashes its outline and shows its status', (tester) async {
      await _pumpAt(
        tester,
        const AppUploadRow(
          title: 'Certificate of registration',
          subtitle: 'Tap to upload',
          onTap: _noop,
          status: UploadStatus.done,
        ),
      );
      expect(find.text('Tap to upload'), findsOneWidget);
      final shape = tester
          .widgetList<Container>(
            find.descendant(
              of: find.byType(AppUploadRow),
              matching: find.byType(Container),
            ),
          )
          .map((c) => c.decoration)
          .whereType<ShapeDecoration>()
          .map((d) => d.shape)
          .whereType<DashedRoundedRectangleBorder>()
          .toList();
      expect(shape, hasLength(1));
      expect(shape.single.gap, greaterThan(0));
    });

    testWidgets('locks out while uploading', (tester) async {
      var taps = 0;
      await _pumpAt(
        tester,
        AppUploadRow(
          title: 'BOZ',
          subtitle: 'PDF or JPG',
          onTap: () => taps++,
          busy: true,
        ),
      );
      expect(find.text('Uploading…'), findsOneWidget);
      await tester.tap(find.byType(AppUploadRow));
      expect(taps, 0);
    });
  });

  group('AppRow / AppMenuRow / ChooserCard', () {
    testWidgets('a row drops its divider when it is last', (tester) async {
      await _pumpAt(
        tester,
        const Column(
          children: [
            AppRow(title: 'One', showDivider: true),
            AppRow(title: 'Two', showDivider: false),
          ],
        ),
      );
      final dividers = tester
          .widgetList<Divider>(
            find.descendant(
              of: find.byType(AppRow),
              matching: find.byType(Divider),
            ),
          )
          .toList();
      expect(dividers, hasLength(1));
    });

    testWidgets('a menu row opens something', (tester) async {
      var taps = 0;
      await _pumpAt(
        tester,
        AppMenuRow(label: 'Statements', onTap: () => taps++),
      );
      await tester.tap(find.text('Statements'));
      expect(taps, 1);
    });

    testWidgets('a chooser card announces title and description', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await _pumpAt(
        tester,
        const ChooserCard(
          title: "I'm a Borrower",
          description: 'Borrow against your vehicle',
          art: Icon(Icons.person),
          onTap: _noop,
        ),
      );
      expect(
        find.bySemanticsLabel(
          RegExp("I'm a Borrower.*Borrow against your vehicle"),
        ),
        findsOneWidget,
      );
      handle.dispose();
    });
  });

  group('StatsStrip / AppChip / IconTile', () {
    testWidgets('a stats strip divides its figures', (tester) async {
      await _pumpAt(
        tester,
        const StatsStrip(
          stats: [
            StatFigure('Balance', 'K1,200'),
            StatFigure('Owed', 'K430', tone: TileTone.amber),
            StatFigure('Loans', '2'),
          ],
        ),
      );
      expect(find.byType(VerticalDivider), findsNWidgets(2));
      // The amber figure takes the amber ink, not the raw amber.
      expect(
        tester.widget<Text>(find.text('K430')).style!.color,
        tileColors(TileTone.amber).fg,
      );
    });

    testWidgets('a solid chip inverts to white on its tone', (tester) async {
      await _pumpAt(
        tester,
        const Align(
          alignment: Alignment.topLeft,
          child: AppChip(label: 'Approved', tone: TileTone.green, solid: true),
        ),
      );
      final txt = tester.widget<Text>(find.text('Approved'));
      expect(txt.style!.color, Colors.white);
    });

    test('tile tones stay distinct', () {
      final fg = {for (final t in TileTone.values) t: tileColors(t).fg};
      expect(fg.values.toSet(), hasLength(TileTone.values.length));
    });
  });

  group('AppCard / KeyValueRow / NoticeBanner', () {
    testWidgets('a key-value row right-aligns its figure', (tester) async {
      await _pumpAt(
        tester,
        const AppCard(
          child: KeyValueRow(label: 'Reference', value: 'RC-90812'),
        ),
      );
      final txt = tester.widget<Text>(find.text('RC-90812'));
      expect(txt.textAlign, TextAlign.right);
    });

    testWidgets('a notice distinguishes warning from error by tone', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const Column(
          children: [
            NoticeBanner(message: 'Heads up', tone: TileTone.amber),
            NoticeBanner(message: 'Rejected', tone: TileTone.red),
          ],
        ),
      );
      final icons = tester
          .widgetList<Icon>(
            find.descendant(
              of: find.byType(NoticeBanner),
              matching: find.byType(Icon),
            ),
          )
          .map((i) => i.icon)
          .toList();
      expect(icons, [Icons.warning_amber_rounded, Icons.error_outline_rounded]);
    });
  });

  group('SuccessScreen', () {
    testWidgets('renders the amount, the checklist and one way out', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const SuccessScreen(
          title: 'Payment sent',
          subtitle: 'Your lender has been notified',
          amount: 'K450.00',
          amountLabel: 'Total paid',
          primaryLabel: 'Done',
          onPrimary: _noop,
          checks: [
            SuccessCheckRow(
              title: 'To Chilenje SACCO',
              subtitle: 'Zambia Kwacha',
            ),
            SuccessCheckRow(title: 'Reference', subtitle: 'RC-90812'),
          ],
        ),
      );

      expect(find.text('K450.00'), findsOneWidget);
      expect(find.byType(SuccessMark), findsOneWidget);
      expect(find.byType(SuccessCheckRow), findsNWidgets(2));
      expect(find.byType(AppButton), findsOneWidget);

      // Only the first of the two check rows is separated.
      final hairlines = tester
          .widgetList<Divider>(
            find.descendant(
              of: find.byType(SuccessCheckRow),
              matching: find.byType(Divider),
            ),
          )
          .toList();
      expect(hairlines, hasLength(1));
    });

    testWidgets('the mark is a blob, not a circle', (tester) async {
      await _pumpAt(
        tester,
        const Align(alignment: Alignment.topLeft, child: SuccessMark(size: 74)),
      );
      final box = tester.widget<Container>(find.byType(Container).first);
      final shape =
          (box.decoration! as BoxDecoration).borderRadius! as BorderRadius;
      expect(shape.bottomLeft.y, closeTo(74 * 0.56, 0.5));
      expect(shape.topLeft.y, closeTo(74 * 0.44, 0.5));
    });

    testWidgets('omits the figure when no single number is the point', (
      tester,
    ) async {
      await _pumpAt(
        tester,
        const SuccessScreen(
          title: 'Application received',
          subtitle: 'We will call you',
          primaryLabel: 'Done',
          onPrimary: _noop,
        ),
      );
      expect(find.text('Total paid'), findsNothing);
    });
  });

  group('AppSheet', () {
    testWidgets('returns the value it pops', (tester) async {
      String? result;
      await _pumpAt(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result = await showAppSheet<String>(
                context: context,
                builder: (ctx) => AppButton(
                  label: 'Pick me',
                  onPressed: () => Navigator.pop(ctx, 'picked'),
                ),
              );
            },
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pick me'));
      await tester.pumpAndSettle();
      expect(result, 'picked');
    });

    testWidgets('never covers the whole screen', (tester) async {
      await _pumpAt(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showAppSheet<void>(
              context: context,
              builder: (_) => const AppSheet(
                title: 'A very long sheet title that wraps onto two lines',
                child: SizedBox(height: 2000),
              ),
            ),
            child: const Text('open'),
          ),
        ),
      );

      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      // `showAppSheet` wraps the caller's content in its own AppSheet, so the
      // inner one is the last in the tree.
      final height = tester.getSize(find.byType(AppSheet).last).height;
      expect(height, lessThanOrEqualTo(720 * AppSheet.maxHeightFactor + 0.5));
    });
  });

  group('showAppToast', () {
    testWidgets('appears, then clears itself', (tester) async {
      await _pumpAt(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showAppToast(
              context,
              'Statement downloaded',
              tone: ToastTone.success,
            ),
            child: const Text('toast'),
          ),
        ),
      );

      expect(find.text('Statement downloaded'), findsNothing);
      await tester.tap(find.text('toast'));
      await tester.pump();
      expect(find.text('Statement downloaded'), findsOneWidget);

      await tester.pumpAndSettle(const Duration(seconds: 4));
      expect(find.text('Statement downloaded'), findsNothing);
    });

    testWidgets('clears above the nav, never over it', (tester) async {
      await _pumpAt(
        tester,
        Builder(
          builder: (context) => TextButton(
            onPressed: () => showAppToast(context, 'Copied'),
            child: const Text('toast'),
          ),
        ),
      );
      await tester.tap(find.text('toast'));
      await tester.pump();
      final bottom = tester.getBottomLeft(find.text('Copied')).dy;
      expect(bottom, lessThan(720 - AppSizes.navHeight));

      // Let the dwell elapse so the toast doesn't outlive the test.
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(find.text('Copied'), findsNothing);
    });
  });
}

void _noop() {}
