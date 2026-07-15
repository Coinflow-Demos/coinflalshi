import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {coinflowConfig} from '@/lib/coinflow/config';
import {verifyCoinflowWebhookSignature} from '@/lib/coinflow/verify-webhook';

interface CoinflowWebhookPacket {
  eventType: string;
  category: 'Purchase' | 'Withdraw' | 'Subscription' | string;
  created: string;
  data: {
    id?: string;
    paymentId?: string;
    subtotal?: {cents: number; currency: string};
    total?: {cents: number; currency: string};
    amount?: {cents: number; currency: string};
    customerId?: string;
    webhookInfo?: {pendingTransactionId?: string; userId?: string} | null;
  };
}

const SUCCESS_EVENT_TYPES = new Set(['Settled']);
const FAILURE_EVENT_TYPES = new Set([
  'Card Payment Declined',
  'Card Payment Voided',
  'Payment Expiration',
]);
// A chargeback only ever arrives after a Settled transaction already credited
// the wallet, so it needs to reverse that credit rather than just mark a
// status. Only the "opened" event is handled — re-crediting on a won dispute
// would need to distinguish "reversed by chargeback" from "never completed",
// which the current schema has no field for; out of scope for now.
const CHARGEBACK_OPENED_EVENT_TYPES = new Set(['Card Payment Chargeback Opened']);

// Crypto pay-ins carry a different payload shape than card payments —
// `paymentId` instead of `id`, and `customerId` is our internal userId.
const CRYPTO_PAYIN_EVENT_TYPE = 'Crypto Payin Funds Received';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('coinflow-signature');

  if (!signatureHeader) {
    return NextResponse.json({error: 'Missing signature'}, {status: 401});
  }

  const isValid = verifyCoinflowWebhookSignature({
    signatureHeader,
    payload: rawBody,
    secret: coinflowConfig.webhookValidationKey(),
  });
  if (!isValid) {
    return NextResponse.json({error: 'Invalid signature'}, {status: 401});
  }

  const packet = JSON.parse(rawBody) as CoinflowWebhookPacket;

  if (packet.eventType === CRYPTO_PAYIN_EVENT_TYPE) {
    return handleCryptoPayinFundsReceived(packet);
  }

  if (packet.category !== 'Purchase') {
    // Withdraw/subscription events aren't wired up to ledger updates yet.
    return NextResponse.json({received: true});
  }

  const pendingTransactionId = packet.data.webhookInfo?.pendingTransactionId;
  const coinflowPaymentId = packet.data.id;

  const transaction = pendingTransactionId
    ? await db.transaction.findUnique({where: {id: pendingTransactionId}})
    : coinflowPaymentId
      ? await db.transaction.findUnique({where: {coinflowPaymentId}})
      : null;

  if (!transaction) {
    return NextResponse.json({received: true});
  }

  if (SUCCESS_EVENT_TYPES.has(packet.eventType)) {
    await creditIfPending(transaction, {
      coinflowPaymentId,
      creditedCents: packet.data.subtotal?.cents,
    });
  } else if (FAILURE_EVENT_TYPES.has(packet.eventType)) {
    await db.transaction.updateMany({
      where: {id: transaction.id, status: 'PENDING'},
      data: {status: 'FAILED', coinflowPaymentId},
    });
  } else if (CHARGEBACK_OPENED_EVENT_TYPES.has(packet.eventType)) {
    await reverseIfCompleted(transaction, packet.data.subtotal?.cents);
  }

  return NextResponse.json({received: true});
}

// Coinflow retries webhook deliveries, so the same "Settled" event can arrive
// more than once for one transaction. The status check has to happen inside
// the same atomic statement as the credit — checking it beforehand leaves a
// window where two concurrent deliveries both see PENDING and both credit
// the wallet. `updateMany` with `status: 'PENDING'` in the WHERE clause only
// ever matches for whichever delivery gets there first.
async function creditIfPending(
  transaction: {id: string; userId: string; amountCents: number},
  {coinflowPaymentId, creditedCents}: {coinflowPaymentId?: string; creditedCents?: number}
) {
  await db.$transaction(async (tx) => {
    const {count} = await tx.transaction.updateMany({
      where: {id: transaction.id, status: 'PENDING'},
      data: {status: 'COMPLETED', coinflowPaymentId},
    });
    if (count === 0) return;
    await tx.wallet.update({
      where: {userId: transaction.userId},
      data: {balanceCents: {increment: creditedCents ?? transaction.amountCents}},
    });
  });
}

// Same atomicity concern as creditIfPending — only reverse a credit that's
// actually still COMPLETED, so a duplicate chargeback event can't decrement
// the wallet twice.
async function reverseIfCompleted(transaction: {id: string; userId: string; amountCents: number}, reversedCents?: number) {
  await db.$transaction(async (tx) => {
    const {count} = await tx.transaction.updateMany({
      where: {id: transaction.id, status: 'COMPLETED'},
      data: {status: 'FAILED', metadata: {chargedBack: true}},
    });
    if (count === 0) return;
    await tx.wallet.update({
      where: {userId: transaction.userId},
      data: {balanceCents: {decrement: reversedCents ?? transaction.amountCents}},
    });
  });
}

async function handleCryptoPayinFundsReceived(packet: CoinflowWebhookPacket) {
  const coinflowPaymentId = packet.data.paymentId;
  const userId = packet.data.customerId;
  const creditedCents = packet.data.amount?.cents;

  if (!coinflowPaymentId || !userId || !creditedCents) {
    return NextResponse.json({received: true});
  }

  // Idempotent — webhooks can be retried/duplicated by Coinflow.
  const existing = await db.transaction.findUnique({where: {coinflowPaymentId}});
  if (existing) {
    return NextResponse.json({received: true});
  }

  const wallet = await db.wallet.findUnique({where: {userId}});
  if (!wallet) {
    return NextResponse.json({received: true});
  }

  await db.$transaction(async (tx) => {
    await tx.transaction.create({
      data: {
        userId,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        amountCents: creditedCents,
        method: 'CRYPTO',
        coinflowPaymentId,
      },
    });
    await tx.wallet.update({
      where: {userId},
      data: {balanceCents: {increment: creditedCents}},
    });
  });

  return NextResponse.json({received: true});
}
