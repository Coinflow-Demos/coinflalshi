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
    subtotal?: {cents: number; currency: string};
    total?: {cents: number; currency: string};
    webhookInfo?: {pendingTransactionId?: string; userId?: string} | null;
  };
}

const SUCCESS_EVENT_TYPES = new Set(['Settled', 'Completed']);
const FAILURE_EVENT_TYPES = new Set([
  'Card Payment Declined',
  'Failed',
  'Auth Declined',
]);

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

  if (!transaction || transaction.status === 'COMPLETED') {
    return NextResponse.json({received: true});
  }

  if (SUCCESS_EVENT_TYPES.has(packet.eventType)) {
    const creditedCents = packet.data.subtotal?.cents ?? transaction.amountCents;

    await db.$transaction(async (tx) => {
      await tx.transaction.update({
        where: {id: transaction.id},
        data: {status: 'COMPLETED', coinflowPaymentId},
      });
      await tx.wallet.update({
        where: {userId: transaction.userId},
        data: {balanceCents: {increment: creditedCents}},
      });
    });
  } else if (FAILURE_EVENT_TYPES.has(packet.eventType)) {
    await db.transaction.update({
      where: {id: transaction.id},
      data: {status: 'FAILED', coinflowPaymentId},
    });
  }

  return NextResponse.json({received: true});
}
