'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {BasisTheory3ds} from '@basis-theory/web-threeds';
import {buildThreeDsChallengeHtml} from '@/lib/coinflow/challenge-html';

const BT_CHALLENGE_CONTAINER_ID = 'bt-3ds-challenge-container';

declare global {
  interface Window {
    ReactNativeWebView?: {postMessage(message: string): void};
  }
}

function notifyComplete(transactionId: string) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({method: 'complete', transactionId}));
}

/** Bridge page for the native app: React Native has no DOM for
 * @basis-theory/web-threeds, so mobile opens this in a WebView and gets
 * completion back via window.ReactNativeWebView.postMessage. */
export function ThreeDsChallengeClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';
  const creq = searchParams.get('creq') ?? '';
  const transactionId = searchParams.get('transactionId') ?? '';

  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const runBasisTheoryChallenge = useCallback(async () => {
    const publicKey = process.env.NEXT_PUBLIC_COINFLOW_BT_PUBLIC_KEY;
    if (!publicKey) {
      setError('Missing Basis Theory public key');
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
      notifyComplete(transactionId);
    } catch {
      setError('Verification failed — please try again');
    }
  }, [url, transactionId]);

  useEffect(() => {
    if (creq || started.current || !url) return;
    started.current = true;
    runBasisTheoryChallenge();
  }, [creq, url, runBasisTheoryChallenge]);

  if (!url) {
    return <p style={{padding: 16, fontFamily: 'sans-serif'}}>Missing challenge parameters.</p>;
  }

  const challengeHtml = creq ? buildThreeDsChallengeHtml({url, creq}) : null;

  if (!creq || !challengeHtml) {
    const message = creq && !challengeHtml ? 'Malformed 3DS challenge response' : error;
    return (
      <div style={{height: '100vh', width: '100vw'}}>
        {message ? (
          <p style={{padding: 16, fontFamily: 'sans-serif', color: '#ef4444'}}>{message}</p>
        ) : (
          <div id={BT_CHALLENGE_CONTAINER_ID} style={{height: '100%', width: '100%'}} />
        )}
      </div>
    );
  }

  return (
    <iframe
      title="3DS verification"
      style={{width: '100vw', height: '100vh', border: 'none'}}
      srcDoc={challengeHtml}
    />
  );
}
