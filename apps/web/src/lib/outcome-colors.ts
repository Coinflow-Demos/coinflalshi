const OUTCOME_COLORS = [
  'var(--success)',
  'var(--destructive)',
  'var(--primary)',
  'var(--warning)',
];

export function getOutcomeColor(index: number): string {
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}
