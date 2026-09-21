/// The two account types in Kumvwa Finance.
enum UserRole {
  /// A tenant lender (SACCO / MFI / individual lender) — requires BOZ registration.
  business,

  /// A borrower, onboarded via a lender's invite link.
  client,
}
