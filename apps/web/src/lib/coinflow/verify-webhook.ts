import 'server-only';
import crypto from 'node:crypto';

export function verifyCoinflowWebhookSignature({
  signatureHeader,
  payload,
  secret,
}: {
  signatureHeader: string;
  payload: string;
  secret: string;
}): boolean {
  const parts = signatureHeader.split(',');
  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = value;
    else if (key === 'v1') signature = value;
  }

  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}
