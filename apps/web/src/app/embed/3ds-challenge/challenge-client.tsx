'use client';

import {useEffect} from 'react';
import {useSearchParams} from 'next/navigation';
import {
  buildThreeDsChallengeHtml,
  buildBasisTheoryChallengeHtml,
  isBasisTheoryChallengeNotification,
} from '@/lib/coinflow/challenge-html';

declare global {
  interface Window {
    ReactNativeWebView?: {postMessage(message: string): void};
  }
}

/** Bridge page for the native app: mobile opens this in a WebView to render
 * whichever 3DS challenge shape Coinflow returned (TokenEx `creq` form-post,
 * or Basis-Theory-style params in `url`'s query string) as an auto-submitting
 * form inside an iframe — see three-ds-challenge-modal.tsx for the web
 * equivalent and why no SDK/key is needed for the Basis Theory shape. Once
 * the challenge finishes, that completion signal is forwarded to the native
 * WebView via ReactNativeWebView.postMessage. */
export function ThreeDsChallengeClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';
  const creq = searchParams.get('creq') ?? '';
  const transactionId = searchParams.get('transactionId') ?? '';

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data === 'challenge_success' || isBasisTheoryChallengeNotification(event.data)) {
        window.ReactNativeWebView?.postMessage(JSON.stringify({method: 'complete', transactionId}));
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [transactionId]);

  if (!url) {
    return <p style={{padding: 16, fontFamily: 'sans-serif'}}>Missing challenge parameters.</p>;
  }

  const challengeHtml = creq
    ? buildThreeDsChallengeHtml({url, creq})
    : (() => {
        const params = new URL(url).searchParams;
        const acsChallengeUrl = params.get('acsChallengeUrl');
        const acsTransactionId = params.get('acsTransactionId');
        const sessionId = params.get('sessionId');
        const threeDSVersion = params.get('threeDSVersion');
        if (!acsChallengeUrl || !acsTransactionId || !sessionId || !threeDSVersion) return null;
        return buildBasisTheoryChallengeHtml({acsChallengeUrl, acsTransactionId, sessionId, threeDSVersion});
      })();

  if (!challengeHtml) {
    return <p style={{padding: 16, fontFamily: 'sans-serif', color: '#ef4444'}}>Malformed 3DS challenge response</p>;
  }

  return (
    <iframe title="3DS verification" style={{width: '100vw', height: '100vh', border: 'none'}} srcDoc={challengeHtml} />
  );
}
