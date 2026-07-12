// Coinflow's tokenization responses don't include card brand/last4, but
// Basis Theory-style tokens (e.g. "4242424235424242_bt") preserve the real
// BIN (first 6 digits) and last 4 digits, replacing only the middle. That's
// enough to derive a reasonable display label without ever seeing the PAN.
export function deriveCardDisplay(cardToken: string): {brand: string; last4: string} {
  const digits = cardToken.split('_')[0]?.replace(/\D/g, '') ?? '';
  const last4 = digits.slice(-4) || '0000';
  const firstDigit = digits.charAt(0);

  const brand =
    firstDigit === '4'
      ? 'Visa'
      : firstDigit === '5'
        ? 'Mastercard'
        : firstDigit === '3'
          ? 'Amex'
          : firstDigit === '6'
            ? 'Discover'
            : 'Card';

  return {brand, last4};
}
