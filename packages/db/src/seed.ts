import {db} from './client';
import {createMarketFromTemplate} from './createMarket';
import {MARKET_TEMPLATES} from './marketTemplates';

async function main() {
  const existing = await db.market.count();
  if (existing > 0) {
    console.log(`Skipping seed — ${existing} markets already exist.`);
    return;
  }

  const now = Date.now();
  for (const [index, template] of MARKET_TEMPLATES.entries()) {
    // Stagger start times so markets resolve a few at a time rather than
    // all at once, giving the resolution engine something to do continuously.
    const staggeredNow = new Date(now - index * 45_000);
    const market = await createMarketFromTemplate({
      template,
      now: staggeredNow,
    });
    console.log(`Created market: ${market.title} (${market.slug})`);
  }

  console.log(`Seeded ${MARKET_TEMPLATES.length} markets.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
