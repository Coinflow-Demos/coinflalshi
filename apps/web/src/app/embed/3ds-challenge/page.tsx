'use client';

import {Suspense} from 'react';
import {ThreeDsChallengeClient} from './challenge-client';

export default function ThreeDsChallengeEmbedPage() {
  return (
    <Suspense fallback={null}>
      <ThreeDsChallengeClient />
    </Suspense>
  );
}
