'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {BasisTheory3ds} from '@basis-theory/web-threeds';

const BT_CHALLENGE_CONTAINER_ID = 'bt-3ds-challenge-container';

// Coinflow's card-family checkout endpoints return one of two challenge
// styles on a 412:
//  - TokenEx-style: a `creq` to POST into an iframe pointed at `url`.
//  - Basis Theory-style: an empty `creq`, and `url` is NOT a webpage — it's
//    a bundle of query params (acsChallengeUrl/acsTransactionId/sessionId/
//    threeDSVersion) meant to be handed to Basis Theory's own
//    @basis-theory/web-threeds SDK, which runs the challenge UI directly in
//    a container on THIS page. Loading `url` as an iframe/popup 404s or gets
//    CSP-blocked — it was never meant to be navigated to. This mirrors
//    Coinflow's own hosted-checkout implementation (BtChallengePage.tsx).
export function ThreeDsChallengeModal({
  url,
  creq,
  transactionId,
  onComplete,
}: {
  url: string;
  creq: string;
  transactionId: string;
  onComplete: (transactionId: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const runBasisTheoryChallenge = useCallback(async () => {
    const publicKey = process.env.NEXT_PUBLIC_COINFLOW_BT_PUBLIC_KEY;
    if (!publicKey) {
      setError(
        'This card requires a verification step we can’t render yet — missing Basis Theory public key (ask Coinflow for the sandbox VITE_BT_PUBLIC_KEY value).'
      );
      return;
    }

    const params = new URL(url).searchParams;
    const acsChallengeUrl = params.get('acsChallengeUrl');
    const acsTransactionId = params.get('acsTransactionId');
    const sessionId = params.get('sessionId');
    const threeDSVersion = params.get('threeDSVersion');
    if (!acsChallengeUrl || !acsTransactionId || !sessionId || !threeDSVersion) {
      setError('Malformed 3DS challenge response');
      return;
    }

    try {
      const bt3ds = BasisTheory3ds(publicKey);
      await bt3ds.startChallenge({
        acsChallengeUrl,
        acsTransactionId,
        sessionId,
        threeDSVersion: threeDSVersion as '2.1.0' | '2.2.0',
        containerId: BT_CHALLENGE_CONTAINER_ID,
        timeout: 10 * 60_000,
      });
      onComplete(transactionId);
    } catch {
      setError('Verification failed — please try again');
    }
  }, [url, transactionId, onComplete]);

  useEffect(() => {
    if (creq || started.current) return;
    started.current = true;
    runBasisTheoryChallenge();
  }, [creq, runBasisTheoryChallenge]);

  if (!creq) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="flex h-[600px] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white">
          {error ? (
            <p className="m-auto max-w-xs text-center text-sm text-red-600">{error}</p>
          ) : (
            <div id={BT_CHALLENGE_CONTAINER_ID} className="h-full w-full" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="h-[600px] w-full max-w-md overflow-hidden rounded-xl bg-white">
        <iframe
          title="3DS verification"
          style={{width: '100%', height: '100%', border: 'none'}}
          srcDoc={`<html><body onload="document.challenge.submit()">
            <form method="post" name="challenge" action="${url}">
              <input type="hidden" name="creq" value="${creq}" />
            </form>
          </body></html>`}
        />
      </div>
    </div>
  );
}
