export interface MarketTemplate {
  slug: string;
  category: string;
  title: string;
  subtitle?: string;
  imageEmoji: string;
  outcomes: {label: string; priceCents: number}[];
  durationMinutes: number;
}

export const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    slug: 'france-vs-morocco',
    category: 'Soccer',
    title: 'France vs Morocco',
    subtitle: 'FIFA World Cup quarterfinal rematch',
    imageEmoji: '⚽',
    outcomes: [
      {label: 'France advances', priceCents: 77},
      {label: 'Morocco advances', priceCents: 23},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'lakers-vs-celtics',
    category: 'Basketball',
    title: 'Lakers vs Celtics',
    subtitle: 'Who wins tonight?',
    imageEmoji: '🏀',
    outcomes: [
      {label: 'Lakers win', priceCents: 48},
      {label: 'Celtics win', priceCents: 52},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'btc-100k-by-close',
    category: 'Crypto',
    title: 'Will BTC close above $100,000 today?',
    subtitle: 'Settles on the 5pm ET candle',
    imageEmoji: '₿',
    outcomes: [
      {label: 'Yes', priceCents: 41},
      {label: 'No', priceCents: 59},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'eth-flip-week',
    category: 'Crypto',
    title: 'Will ETH gain more than BTC this week?',
    imageEmoji: '◆',
    outcomes: [
      {label: 'Yes', priceCents: 36},
      {label: 'No', priceCents: 64},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'nyc-rain-today',
    category: 'Weather',
    title: 'Will it rain in NYC today?',
    imageEmoji: '🌧️',
    outcomes: [
      {label: 'Yes', priceCents: 28},
      {label: 'No', priceCents: 72},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'fed-rate-cut',
    category: 'Economics',
    title: 'Fed cuts rates at next meeting?',
    imageEmoji: '🏦',
    outcomes: [
      {label: 'Yes', priceCents: 63},
      {label: 'No', priceCents: 37},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'moon-landing-2030',
    category: 'Space',
    title: 'Next crewed Moon landing happens before 2030?',
    subtitle: 'To the Moon 🚀 — a Coinflalshi original',
    imageEmoji: '🌕',
    outcomes: [
      {label: 'Yes', priceCents: 55},
      {label: 'No', priceCents: 45},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'moon-made-of-cheese',
    category: 'Space',
    title: "Will scientists confirm the Moon is secretly cheese this week?",
    subtitle: 'A Coinflalshi original — for entertainment only',
    imageEmoji: '🧀',
    outcomes: [
      {label: 'Yes', priceCents: 2},
      {label: 'No', priceCents: 98},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'novak-wins-next-slam',
    category: 'Tennis',
    title: 'Djokovic wins the next Grand Slam he enters?',
    imageEmoji: '🎾',
    outcomes: [
      {label: 'Yes', priceCents: 44},
      {label: 'No', priceCents: 56},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'yankees-vs-dodgers',
    category: 'Baseball',
    title: 'Yankees vs Dodgers',
    subtitle: 'Interleague showdown',
    imageEmoji: '⚾',
    outcomes: [
      {label: 'Yankees win', priceCents: 51},
      {label: 'Dodgers win', priceCents: 49},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'netflix-number-one',
    category: 'Culture',
    title: "Will the current #1 Netflix show still be #1 tomorrow?",
    imageEmoji: '🎬',
    outcomes: [
      {label: 'Yes', priceCents: 67},
      {label: 'No', priceCents: 33},
    ],
    durationMinutes: 10,
  },
  {
    slug: 'sol-vs-eth-flippening',
    category: 'Crypto',
    title: 'Will SOL outperform ETH this week?',
    imageEmoji: '◎',
    outcomes: [
      {label: 'Yes', priceCents: 39},
      {label: 'No', priceCents: 61},
    ],
    durationMinutes: 10,
  },
];

export function pickRandomTemplate(exclude: string[] = []): MarketTemplate {
  const pool = MARKET_TEMPLATES.filter(
    (template) => !exclude.includes(template.slug)
  );
  const candidates = pool.length > 0 ? pool : MARKET_TEMPLATES;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
