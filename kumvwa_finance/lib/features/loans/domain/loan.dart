import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';
import 'package:kumvwa_finance/core/time/zambia_time.dart';

enum InstallmentStatus { paid, due, overdue, upcoming }

class Installment {
  const Installment({
    required this.number,
    required this.dueDate,
    required this.amount,
    required this.status,
    this.penalty = 0,
    this.rolloverFee = false,
  });

  final int number;
  final DateTime dueDate;
  final double amount;

  /// Accrued late penalty (kwacha) riding with this installment — shown
  /// separately in red; paying the installment settles it first.
  final double penalty;

  final InstallmentStatus status;

  /// True when this row was appended by a rollover — it is an EXTENSION FEE
  /// paid to move the deadline, not part of the agreed repayment plan (the
  /// server flags it with `seq > termCount`). The detail screen renders these
  /// in their own section so "3 installments" never becomes "5".
  final bool rolloverFee;
}

/// Bureau-sourced credit risk attached to a borrower at loan time.
class CreditRisk {
  const CreditRisk({
    required this.score,
    required this.source,
    required this.checkedAt,
  });

  final int score; // 300–850
  final String source; // e.g. 'TransUnion Zambia'
  final DateTime checkedAt;

  RiskLevel get band => RiskLevelX.fromScore(score);
}

/// The next rung of a lender's credit ladder — the "grow your limit" hero
/// on the client home reads this straight off the resolved limit. All fields
/// are server-computed (the app never derives the ladder itself).
class CreditNextTier {
  const CreditNextTier({
    required this.label,
    required this.limitKwacha,
    required this.clearedNeeded,
    required this.clearedRemaining,
  });

  final String label;
  final double limitKwacha;

  /// The rung's threshold — fully-cleared loans required to reach it.
  final int clearedNeeded;

  /// How many more loans the client must clear: `clearedNeeded` minus their
  /// current cleared count. The caption uses this delta, not a guess.
  final int clearedRemaining;
}

/// The credit allowance the API resolved for a client with ONE lender (M5).
/// Mirrors `CreditResolution` in @kumvwa/core: `limitKwacha` is 0 with a
/// `blockedReason` while platforms/gating blocks the client.
class CreditLimit {
  const CreditLimit({
    required this.limitKwacha,
    required this.tier,
    required this.maxTermMonths,
    this.blockedReason,
    this.policyVersion = 0,
    this.nextTier,
  });

  final double limitKwacha;
  final String tier;
  final int maxTermMonths;
  final String? blockedReason;
  final int policyVersion;

  /// Next ladder rung; null when blocked or already at the top tier.
  final CreditNextTier? nextTier;

  bool get isBlocked => limitKwacha <= 0;
}

/// A lender's first active loan product — the honest rate/fee/term the apply
/// screen's live breakdown displays before the client submits (M5). Null when
/// the lender hasn't set one up yet; the screen falls back to defaults.
class ProductTerms {
  const ProductTerms({
    required this.ratePct,
    required this.feePct,
    required this.maxTermMonths,
    this.frequency = 'monthly',
    this.repaymentStructure = 'bullet',
  });

  final double ratePct;
  final double feePct;
  final int maxTermMonths;
  final String frequency;
  final String repaymentStructure;
}

class Loan {
  const Loan({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.lenderName,
    required this.nrc,
    required this.principal,
    required this.interestRatePct,
    required this.termInstallments,
    required this.totalDue,
    required this.amountPaid,
    required this.status,
    required this.schedule,
    this.tenantId,
    this.frequency = 'monthly',
    this.rolloverCount = 0,
    this.risk,
    this.loanRef,
    this.repaymentStructure = 'bullet',
  });

  final String id;
  final String clientId;
  final String clientName;
  final String lenderName;
  final String nrc;
  final double principal;
  final double interestRatePct;
  final int termInstallments;
  final double totalDue;
  final double amountPaid;
  final LoanStatus status;
  final List<Installment> schedule;

  /// Contextual branding key — the lender's tenant. Null in mock data.
  final String? tenantId;

  /// Installment spacing: 'monthly' | 'weekly' | 'fortnightly'.
  final String frequency;

  /// How many times "Pay Interest & Extend" has been used on this loan.
  final int rolloverCount;

  /// Bureau risk — null when no credit check has been run yet.
  final CreditRisk? risk;

  /// Human reference (`LN-2026-00001`) — the lender's paper-trail key.
  final String? loanRef;

  /// M5 structure: 'bullet' (one lump at maturity) or 'installments'.
  final String repaymentStructure;

  /// Bullet loans carry ONE installment for the whole obligation.
  bool get isBullet =>
      repaymentStructure == 'bullet' || schedule.length == 1;

  double get outstanding => totalDue - amountPaid;
  double get progress =>
      totalDue > 0 ? (amountPaid / totalDue).clamp(0.0, 1.0) : 0.0;

  /// Earliest unpaid installment — the one a payment will settle next.
  /// Extension-fee rows are excluded: they record a charge already collected,
  /// so they must never become the "next payment due" (this also keeps the
  /// pay button honest if a legacy fee row is still unpaid).
  Installment? get nextInstallment {
    final unpaid = schedule
        .where((i) => i.status != InstallmentStatus.paid && !i.rolloverFee)
        .toList();
    if (unpaid.isEmpty) return null;
    unpaid.sort((a, b) => a.dueDate.compareTo(b.dueDate));
    return unpaid.first;
  }

  /// Whole days until the next installment (-ve = overdue). Null when cleared.
  ///
  /// Counted against today in ZAMBIA, not the handset's timezone, so the
  /// count matches the day a borrower reads off their own calendar.
  int? get daysUntilDue {
    final next = nextInstallment;
    if (next == null) return null;
    return daysUntilZambianDate(next.dueDate);
  }
}
