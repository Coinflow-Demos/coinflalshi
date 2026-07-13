'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {BasisTheory3ds} from '@basis-theory/web-threeds';

const BT_CHALLENGE_CONTAINER_ID = 'bt-3ds-challenge-container';

declare global {
  interface Window {
    ReactNativeWebView?: {postMessage(message: string): void};
  }
}

function notifyComplete(transactionId: string) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({method: 'complete', transactionId}));
}

/**
 * Native-only bridge page: the web app renders 3DS challenges inline (see
 * components/wallet/three-ds-challenge-modal.tsx), but React Native has no
 * DOM for @basis-theory/web-threeds to mount into. The mobile app instead
 * opens this page in a WebView, passing the same url/creq/transactionId as
 * query params, and this posts completion back via
 * window.ReactNativeWebView.postMessage — the same convention Coinflow's own
 * SDKs use for native bridging.
 */
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

  if (!creq) {
    return (
      <div style={{height: '100vh', width: '100vw'}}>
        {error ? (
          <p style={{padding: 16, fontFamily: 'sans-serif', color: '#ef4444'}}>{error}</p>
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
      srcDoc={`<html><body onload="document.challenge.submit()">
        <form method="post" name="challenge" action="${url}">
          <input type="hidden" name="creq" value="${creq}" />
        </form>
      </body></html>`}
    />
  );
}
