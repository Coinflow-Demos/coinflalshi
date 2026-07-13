import {randomUUID} from 'node:crypto';
import {db, type Market, type Outcome} from './client';
import {MarketTemplate} from './marketTemplates';
import {seedPriceHistory} from './priceHistory';
import {seedMarketActivity} from './marketActivity';

type MarketWithOutcomes = Market & {outcomes: Outcome[]};

async function finalizeNewMarket({
  market,
  now,
  resolvesAt,
}: {
  market: MarketWithOutcomes;
  now: Date;
  resolvesAt: Date;
}) {
  await Promise.all(
    market.outcomes.map((outcome) =>
      seedPriceHistory({
        outcomeId: outcome.id,
        basePriceCents: outcome.priceCents,
        startAt: now,
        endAt: resolvesAt,
      })
    )
  );

  await seedMarketActivity({
    marketId: market.id,
    outcomes: market.outcomes,
    startAt: now,
    endAt: resolvesAt,
  });

  return market;
}

export async function createMarketFromTemplate({
  template,
  now = new Date(),
}: {
  template: MarketTemplate;
  now?: Date;
}) {
  const slug = `${template.slug}-${randomUUID().slice(0, 6)}`;
  const resolvesAt = new Date(
    now.getTime() + template.durationMinutes * 60_000
  );
  const closesAt = new Date(resolvesAt.getTime() - 15_000);

  const market = await db.market.create({
    data: {
      slug,
      category: template.category,
      title: template.title,
      subtitle: template.subtitle,
      imageEmoji: template.imageEmoji,
      closesAt,
      resolvesAt,
      outcomes: {
        create: template.outcomes.map((outcome) => ({
          label: outcome.label,
          priceCents: outcome.priceCents,
        })),
      },
    },
    include: {outcomes: true},
  });

  return finalizeNewMarket({market, now, resolvesAt});
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'market'
  );
}

export async function createCustomMarket({
  title,
  subtitle,
  category,
  imageEmoji,
  outcomeLabels,
  durationMinutes,
  creatorId,
  creatorName,
  now = new Date(),
}: {
  title: string;
  subtitle?: string;
  category: string;
  imageEmoji?: string;
  outcomeLabels: [string, string];
  durationMinutes: number;
  creatorId: string;
  creatorName: string;
  now?: Date;
}) {
  const slug = `${slugify(title)}-${randomUUID().slice(0, 6)}`;
  const resolvesAt = new Date(now.getTime() + durationMinutes * 60_000);
  const closesAt = new Date(resolvesAt.getTime() - 15_000);

  const market = await db.market.create({
    data: {
      slug,
      category,
      title,
      subtitle,
      imageEmoji: imageEmoji ?? '❓',
      closesAt,
      resolvesAt,
      creatorId,
      creatorName,
      outcomes: {
        create: outcomeLabels.map((label) => ({label, priceCents: 50})),
      },
    },
    include: {outcomes: true},
  });

  return finalizeNewMarket({market, now, resolvesAt});
}
