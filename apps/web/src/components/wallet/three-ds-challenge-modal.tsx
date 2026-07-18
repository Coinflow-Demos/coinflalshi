'use client';

import {useEffect, useMemo} from 'react';
import {
  buildThreeDsChallengeHtml,
  buildBasisTheoryChallengeHtml,
  isBasisTheoryChallengeNotification,
} from '@/lib/coinflow/challenge-html';

// A 412 from Coinflow's card endpoints means a 3DS challenge is required, in
// one of two shapes: a `creq` to POST into an iframe at `url` (TokenEx), or
// an empty `creq` with challenge params in `url`'s query string (Basis
// Theory) — both are just an auto-submitting POST form into an iframe, so
// both go through the same builder either way. Once the user finishes the
// challenge, that's our cue to call the matching /complete route and
// finalize the charge — signaled one of two ways depending on which ACS
// handled it: see isBasisTheoryChallengeNotification's doc comment.
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
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data === 'challenge_success' || isBasisTheoryChallengeNotification(event.data)) onComplete(transactionId);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [transactionId, onComplete]);

  const challengeHtml = useMemo(() => {
    if (creq) return buildThreeDsChallengeHtml({url, creq});

    const params = new URL(url).searchParams;
    const acsChallengeUrl = params.get('acsChallengeUrl');
    const acsTransactionId = params.get('acsTransactionId');
    const sessionId = params.get('sessionId');
    const threeDSVersion = params.get('threeDSVersion');
    if (!acsChallengeUrl || !acsTransactionId || !sessionId || !threeDSVersion) return null;
    return buildBasisTheoryChallengeHtml({acsChallengeUrl, acsTransactionId, sessionId, threeDSVersion});
  }, [url, creq]);

  if (!challengeHtml) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="flex h-[600px] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white">
          <p className="m-auto max-w-xs text-center text-sm text-red-600">Malformed 3DS challenge response</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="h-[600px] w-full max-w-md overflow-hidden rounded-xl bg-white">
        <iframe title="3DS verification" style={{width: '100%', height: '100%', border: 'none'}} srcDoc={challengeHtml} />
      </div>
    </div>
  );
}
