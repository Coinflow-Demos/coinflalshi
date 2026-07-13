export const colors = {
  background: '#0f0f14',
  card: '#1a1a22',
  border: '#26262f',
  foreground: '#f5f5f7',
  muted: '#a1a1aa',
  primary: '#4F46E5',
  success: '#22c55e',
  destructive: '#ef4444',
  warning: '#f59e0b',
};

// Matches web's getOutcomeColor: first two map to the classic "red line,
// green line" binary-market look, extra outcomes cycle through the rest.
const OUTCOME_COLORS = [colors.success, colors.destructive, colors.primary, colors.warning];

export function getOutcomeColor(index: number): string {
  return OUTCOME_COLORS[index % OUTCOME_COLORS.length];
}
