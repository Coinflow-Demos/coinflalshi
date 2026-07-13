'use client';

import {Suspense} from 'react';
import nextDynamic from 'next/dynamic';

// @basis-theory/web-threeds touches `window` at module load time, which
// crashes SSR — same reason deposit-panel.tsx defers it with next/dynamic.
// Next 16 requires the ssr:false dynamic() call to live in a Client
// Component, hence 'use client' on this page itself.
const ThreeDsChallengeClient = nextDynamic(
  () => import('./challenge-client').then((mod) => mod.ThreeDsChallengeClient),
  {ssr: false}
);

export default function ThreeDsChallengeEmbedPage() {
  return (
    <Suspense fallback={null}>
      <ThreeDsChallengeClient />
    </Suspense>
  );
}
