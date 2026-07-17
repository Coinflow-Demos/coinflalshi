'use client';

import {useEffect} from 'react';
import {buildThreeDsChallengeHtml} from '@/lib/coinflow/challenge-html';

// A 412 from Coinflow's card endpoints means a 3DS challenge is required, in
// one of two shapes: a `creq` to POST into an iframe at `url` (TokenEx), or
// an empty `creq` with `url` pointing straight at Coinflow's own hosted
// Basis Theory challenge page — merchants never touch the Basis Theory SDK
// or key themselves. That page posts the string "challenge_success" to
// window.parent once the user completes it.
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
    if (creq) return;
    function handleMessage(event: MessageEvent) {
      if (event.data === 'challenge_success') onComplete(transactionId);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [creq, transactionId, onComplete]);

  const challengeHtml = creq ? buildThreeDsChallengeHtml({url, creq}) : null;

  if (creq && !challengeHtml) {
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
        {challengeHtml ? (
          <iframe title="3DS verification" style={{width: '100%', height: '100%', border: 'none'}} srcDoc={challengeHtml} />
        ) : (
          <iframe title="3DS verification" style={{width: '100%', height: '100%', border: 'none'}} src={url} />
        )}
      </div>
    </div>
  );
}
