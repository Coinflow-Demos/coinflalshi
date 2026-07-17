'use client';

import {useEffect} from 'react';
import {useSearchParams} from 'next/navigation';
import {buildThreeDsChallengeHtml} from '@/lib/coinflow/challenge-html';

declare global {
  interface Window {
    ReactNativeWebView?: {postMessage(message: string): void};
  }
}

function notifyComplete(transactionId: string) {
  window.ReactNativeWebView?.postMessage(JSON.stringify({method: 'complete', transactionId}));
}

/** Bridge page for the native app: mobile opens this in a WebView and gets
 * completion back via window.ReactNativeWebView.postMessage. For the Basis
 * Theory path, `url` already points at Coinflow's own hosted challenge page
 * (merchants never touch the Basis Theory SDK or key) — it posts the string
 * "challenge_success" to window.parent once the user completes it. */
export function ThreeDsChallengeClient() {
  const searchParams = useSearchParams();
  const url = searchParams.get('url') ?? '';
  const creq = searchParams.get('creq') ?? '';
  const transactionId = searchParams.get('transactionId') ?? '';

  useEffect(() => {
    if (creq || !url) return;
    function handleMessage(event: MessageEvent) {
      if (event.data === 'challenge_success') notifyComplete(transactionId);
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [creq, url, transactionId]);

  if (!url) {
    return <p style={{padding: 16, fontFamily: 'sans-serif'}}>Missing challenge parameters.</p>;
  }

  const challengeHtml = creq ? buildThreeDsChallengeHtml({url, creq}) : null;

  if (creq && !challengeHtml) {
    return <p style={{padding: 16, fontFamily: 'sans-serif', color: '#ef4444'}}>Malformed 3DS challenge response</p>;
  }

  return (
    <iframe
      title="3DS verification"
      style={{width: '100vw', height: '100vh', border: 'none'}}
      {...(challengeHtml ? {srcDoc: challengeHtml} : {src: url})}
    />
  );
}
