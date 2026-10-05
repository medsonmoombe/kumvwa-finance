/// The mobile-money rail a charge runs over.
///
/// Lives in `core/domain` rather than inside a feature because two unrelated
/// layers need the same vocabulary: the payments feature speaks it when talking
/// to the API, and the core `ProviderLogo` widget needs it to pick a brand mark.
/// Core must not import from a feature, so the shared enum is owned here.
///
/// The `wire` values are the API's own `PaymentProvider` strings. The
/// `card` and `sandbox` rails the API also knows are deliberately absent: the
/// app never initiates either, and admitting them here would let code build a
/// payment the app has no UI to complete.
enum PayProvider {
  mtnMomo('mtn_momo', 'MTN MoMo'),
  airtelMoney('airtel_money', 'Airtel Money'),
  zamtelKwacha('zamtel_kwacha', 'Zamtel Kwacha'),
  bank('bank', 'Bank transfer');

  const PayProvider(this.wire, this.label);

  /// The exact string the API expects.
  final String wire;
  final String label;

  /// Null when the API sent a rail this build does not know. Callers decide
  /// whether that is a hard error or a display-only fallback; it is never
  /// silently mapped onto a different provider, since charging MTN because the
  /// server said something unrecognised would move the wrong money.
  static PayProvider? fromWire(String? raw) {
    for (final p in PayProvider.values) {
      if (p.wire == raw) return p;
    }
    return null;
  }
}
