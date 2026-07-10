import {SignJWT, jwtVerify} from 'jose';

const MOBILE_TOKEN_TTL = '30d';

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(secret);
}

export async function signMobileToken({userId}: {userId: string}) {
  return new SignJWT({userId})
    .setProtectedHeader({alg: 'HS256'})
    .setIssuedAt()
    .setExpirationTime(MOBILE_TOKEN_TTL)
    .sign(getSecretKey());
}

export async function verifyMobileToken(token: string) {
  try {
    const {payload} = await jwtVerify(token, getSecretKey());
    return typeof payload.userId === 'string' ? payload.userId : null;
  } catch {
    return null;
  }
}
