import {NextResponse} from 'next/server';
import {db} from '@coinflalshi/db';
import {getCurrentUserId} from '@/lib/current-user';
import {checkCoinflowCardOnFileAuthorized, getClientIp} from '@/lib/coinflow/server';

// Any failure here (feature not enabled on the merchant, expired CVV
// verification, network error) conservatively means "not authorized" — the
// caller falls back to the CVV re-entry flow rather than surfacing an error.
export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const userId = await getCurrentUserId(request);
  if (!userId) {
    return NextResponse.json({error: 'Unauthorized'}, {status: 401});
  }

  const {id} = await params;
  const savedPaymentMethod = await db.savedPaymentMethod.findUnique({where: {id}});
  if (!savedPaymentMethod || savedPaymentMethod.userId !== userId) {
    return NextResponse.json({authorized: false});
  }

  try {
    const authorized = await checkCoinflowCardOnFileAuthorized({
      userId,
      cardToken: savedPaymentMethod.cardToken,
      clientIp: getClientIp(request),
    });
    return NextResponse.json({authorized});
  } catch {
    return NextResponse.json({authorized: false});
  }
}
