'use client';

import {Suspense} from 'react';
import nextDynamic from 'next/dynamic';

// @basis-theory/web-threeds must be client-only; Next 16 requires the
// ssr:false dynamic() call itself to live in a Client Component.
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
