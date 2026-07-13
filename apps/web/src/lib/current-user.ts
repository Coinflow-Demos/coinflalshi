import {auth} from '@/auth';
import {verifyMobileToken} from '@/lib/mobile-token';

/** Resolves the current user from a web session cookie or a mobile Bearer token. */
export async function getCurrentUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifyMobileToken(authHeader.slice('Bearer '.length));
  }

  const session = await auth();
  return session?.user?.id ?? null;
}
