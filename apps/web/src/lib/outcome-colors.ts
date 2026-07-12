// First two colors map to the classic "red line, green line" trading look
// for the (overwhelmingly common) binary market case; extra outcomes cycle
// through the rest of the brand palette.
const OUTCOME_COLORS = [
  'var(--success)',
  'var(--destructive)',
  'var(--primary)',
  'var(--warning)',
];

export function getOutcomeColor(index: number): string {
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}
