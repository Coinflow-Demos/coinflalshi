import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';

// Returns the raw Coinflow card token so the client can mount a CVV-only
// re-verification form (CoinflowCvvForm) before charging this saved card.
// Safe to expose: the token alone can't charge anything without a fresh CVV.
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const {id} = await params;
  const savedPaymentMethod = await db.savedPaymentMethod.findUnique({where: {id}});
  if (!savedPaymentMethod || savedPaymentMethod.userId !== userId) {
    return NextResponse.json({error: 'Payment method not found'}, {status: 404});
  }

  return NextResponse.json({
    id: savedPaymentMethod.id,
    cardToken: savedPaymentMethod.cardToken,
    brand: savedPaymentMethod.brand,
    last4: savedPaymentMethod.last4,
  });
}

export async function DELETE(request: Request, {params}: {params: Promise<{id: string}>}) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const {id} = await params;
  const savedPaymentMethod = await db.savedPaymentMethod.findUnique({where: {id}});
  if (!savedPaymentMethod || savedPaymentMethod.userId !== userId) {
    return NextResponse.json({error: 'Payment method not found'}, {status: 404});
  }

  await db.savedPaymentMethod.delete({where: {id}});
  return NextResponse.json({status: 'deleted'});
}
