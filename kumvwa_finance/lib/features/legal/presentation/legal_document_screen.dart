import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/features/legal/data/legal_documents_repository.dart';

/// Renders a platform legal document.
///
/// The API stores the text as published — a masthead followed by numbered
/// sections separated by blank lines, each section hard-wrapped at ~80
/// columns. It is laid out as a readable document rather than one preformatted
/// wall of text: the masthead is dropped (the header already names the document
/// and its version), numbered sections get a heading, and every other block is
/// reflowed so paragraphs soft-wrap to the device's width instead of breaking
/// where the file happened to be wrapped. Only whitespace moves — no words are
/// added, removed or reordered — so what a reader accepts is still exactly
/// what was published.
class LegalDocumentScreen extends ConsumerWidget {
  const LegalDocumentScreen({required this.kind, super.key});

  final LegalDocumentKind kind;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doc = ref.watch(legalDocumentProvider(kind));

    return Scaffold(
      backgroundColor: AppColors.card,
      body: DomeScaffold(
        backgroundColor: AppColors.card,
        header: DomeHeader(
          small: true,
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 40),
          child: DomeTitle(
            title: kind.title,
            subtitle: 'Kumvwa Finance · Platform policy',
            onBack: () => Navigator.of(context).maybePop(),
          ),
        ),
        body: doc.when(
          loading: () => const Center(
            child: CircularProgressIndicator(
              color: AppColors.blue600,
              strokeWidth: 2,
            ),
          ),
          error: (e, _) => _Error(
            title: 'Could not load the ${kind.title.toLowerCase()}',
            detail: '$e',
            onRetry: () => ref.invalidate(legalDocumentProvider(kind)),
          ),
          data: (d) => _DocumentBody(doc: d),
        ),
      ),
    );
  }
}

class _DocumentBody extends StatelessWidget {
  const _DocumentBody({required this.doc});

  final LegalDocument doc;

  @override
  Widget build(BuildContext context) {
    final blocks = _parseLegalBody(doc.body);

    return ListView(
      padding: const EdgeInsets.fromLTRB(AppInsets.page, 18, AppInsets.page, 40),
      children: [
        _VersionCard(
          kind: doc.kind,
          version: doc.version,
          publishedAt: doc.publishedAt,
        ),
        const SizedBox(height: 26),
        for (final block in blocks)
          switch (block) {
            _SectionHeading(:final number, :final text) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _Heading(number: number, text: text),
            ),
            _BodyParagraph(:final text) => Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: SelectableText(
                text,
                style: AppText.body.copyWith(
                  color: AppColors.ink2,
                  height: 1.7,
                ),
              ),
            ),
          },
      ],
    );
  }
}

/// The pinned version and its publication date. A policy a user cannot date is
/// not evidence of what they agreed to, so it leads the document rather than
/// hiding in a footnote.
class _VersionCard extends StatelessWidget {
  const _VersionCard({
    required this.kind,
    required this.version,
    required this.publishedAt,
  });

  final LegalDocumentKind kind;
  final int version;
  final DateTime? publishedAt;

  @override
  Widget build(BuildContext context) {
    final published = publishedAt == null
        ? 'Currently in force'
        : 'Published ${publishedAt!.day}/${publishedAt!.month}/${publishedAt!.year}';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.blue50,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.blueLine),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: AppGradients.brand,
              borderRadius: BorderRadius.circular(AppRadii.sm),
              boxShadow: AppShadows.shAction,
            ),
            child: Icon(
              kind == LegalDocumentKind.terms
                  ? Icons.gavel_rounded
                  : Icons.shield_outlined,
              size: 19,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Version $version', style: AppText.cardTitle),
                const SizedBox(height: 2),
                Text(published, style: AppText.rowSub),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A numbered section heading, with the number in a brand chip.
class _Heading extends StatelessWidget {
  const _Heading({required this.number, required this.text});

  final String? number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (number != null) ...[
          Container(
            width: 28,
            height: 28,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: AppGradients.brand,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Text(
              number!,
              style: AppText.chipLabel.copyWith(color: Colors.white),
            ),
          ),
          const SizedBox(width: 11),
        ],
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(top: number != null ? 4 : 0),
            child: Text(
              text,
              style: AppText.sectionTitle.copyWith(fontSize: 16, height: 1.3),
            ),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────── document parsing ─────────────────────────

sealed class _Block {
  const _Block();
}

class _SectionHeading extends _Block {
  const _SectionHeading({required this.number, required this.text});
  final String? number;
  final String text;
}

class _BodyParagraph extends _Block {
  const _BodyParagraph(this.text);
  final String text;
}

final _numberedHeading = RegExp(r'^(\d+)\.\s+(.+)$');
final _hasLowercase = RegExp(r'[a-z]');

/// A line opening a lettered list item, e.g. `a. Identity data: ...`. The
/// privacy document writes its data categories that way inside a section's
/// body, and each one should read as its own block.
final _listItem = RegExp(r'^[a-z]\.\s+\S');

List<_Block> _parseLegalBody(String body) {
  final chunks = body
      .replaceAll('\r\n', '\n')
      .split(RegExp(r'\n\s*\n'))
      .map((c) => c.trim())
      .where((c) => c.isNotEmpty)
      .toList();

  final blocks = <_Block>[];
  for (var i = 0; i < chunks.length; i++) {
    final chunk = chunks[i];
    final lines = chunk.split('\n');

    // Drop only the leading masthead, which the dome header already states.
    // Everything after it keeps its words verbatim.
    if (i == 0 && _isMasthead(lines.first)) continue;

    final match = _numberedHeading.firstMatch(lines.first);
    if (match != null) {
      blocks.add(
        _SectionHeading(number: match.group(1), text: match.group(2)!.trim()),
      );
      blocks.addAll(_reflow(lines.skip(1)).map(_BodyParagraph.new));
    } else if (lines.length == 1 && _isCapsHeading(lines.first)) {
      blocks.add(_SectionHeading(number: null, text: lines.first));
    } else {
      blocks.addAll(_reflow(lines).map(_BodyParagraph.new));
    }
  }
  return blocks;
}

/// Folds the stored hard wrapping: a single newline in the published text is
/// a line break made to fit ~80 columns, not a paragraph break, so the lines
/// are joined back into flowing paragraphs for the screen to soft-wrap to the
/// device's width. A line opening a lettered item ("a.", "b.") starts its own
/// paragraph so the list keeps its shape. Words are untouched.
List<String> _reflow(Iterable<String> lines) {
  final paragraphs = <String>[];
  final current = StringBuffer();
  for (final line in lines) {
    final text = line.trim();
    if (text.isEmpty) continue;
    if (current.isNotEmpty && _listItem.hasMatch(text)) {
      paragraphs.add(current.toString());
      current.clear();
    }
    if (current.isNotEmpty) current.write(' ');
    current.write(text);
  }
  if (current.isNotEmpty) paragraphs.add(current.toString());
  return paragraphs;
}

/// True for the all-caps title line the API documents open with, e.g.
/// "KUMVWA FINANCE — PLATFORM TERMS OF SERVICE".
bool _isMasthead(String firstLine) =>
    firstLine.toUpperCase().contains('KUMVWA FINANCE') &&
    !_hasLowercase.hasMatch(firstLine);

/// A single all-caps line with no lowercase letters — a heading written without
/// a number.
bool _isCapsHeading(String line) =>
    line.length > 3 && !_hasLowercase.hasMatch(line);

// ───────────────────────── error state ─────────────────────────

class _Error extends StatelessWidget {
  const _Error({required this.title, required this.detail, required this.onRetry});

  final String title;
  final String detail;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, size: 34, color: AppColors.muted),
            const SizedBox(height: 12),
            Text(title, style: AppText.bodyStrong, textAlign: TextAlign.center),
            const SizedBox(height: 6),
            Text(detail, style: AppText.fine, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton.tonal(onPressed: onRetry, child: const Text('Try again')),
          ],
        ),
      ),
    );
  }
}
