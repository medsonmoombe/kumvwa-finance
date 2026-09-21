/// Type of lending tenant — mirrors what BOZ registration distinguishes.
enum BusinessType {
  sacco('SACCO / Cooperative'),
  mfi('Microfinance Institution'),
  individualLender('Individual Lender'),
  other('Other');

  const BusinessType(this.label);
  final String label;
}
