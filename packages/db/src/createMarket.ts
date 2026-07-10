import {randomUUID} from 'node:crypto';
import {db} from './client';
import {MarketTemplate} from './marketTemplates';

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

  return db.market.create({
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
}
