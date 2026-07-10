import {db} from './client';

function pickWeightedOutcome<T extends {priceCents: number}>(
  outcomes: T[]
): T {
  const totalWeight = outcomes.reduce(
    (sum, outcome) => sum + outcome.priceCents,
    0
  );
  let roll = Math.random() * totalWeight;
  for (const outcome of outcomes) {
    roll -= outcome.priceCents;
    if (roll <= 0) return outcome;
  }
  return outcomes[outcomes.length - 1];
}

export async function resolveMarket({marketId}: {marketId: string}) {
  const market = await db.market.findUnique({
    where: {id: marketId},
    include: {outcomes: true, positions: {where: {status: 'OPEN'}}},
  });

  if (!market) throw new Error(`Market ${marketId} not found`);
  if (market.status === 'RESOLVED') {
    const alreadyResolved = market.outcomes.find(
      (outcome) => outcome.id === market.resolvedOutcomeId
    );
    return {market, winningOutcome: alreadyResolved ?? market.outcomes[0]};
  }

  const winningOutcome = pickWeightedOutcome(market.outcomes);

  await db.$transaction(async (tx) => {
    await tx.market.update({
      where: {id: market.id},
      data: {status: 'RESOLVED', resolvedOutcomeId: winningOutcome.id},
    });

    for (const position of market.positions) {
      const won = position.outcomeId === winningOutcome.id;
      const payoutCents = won ? position.shares * 100 : 0;

      await tx.position.update({
        where: {id: position.id},
        data: {status: won ? 'WON' : 'LOST', payoutCents},
      });

      if (won && payoutCents > 0) {
        await tx.wallet.update({
          where: {userId: position.userId},
          data: {balanceCents: {increment: payoutCents}},
        });

        await tx.transaction.create({
          data: {
            userId: position.userId,
            type: 'BET_PAYOUT',
            status: 'COMPLETED',
            amountCents: payoutCents,
            method: 'LEDGER',
            metadata: {marketId: market.id, positionId: position.id},
          },
        });
      }
    }
  });

  return {market, winningOutcome};
}
