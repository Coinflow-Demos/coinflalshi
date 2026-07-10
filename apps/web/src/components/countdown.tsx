'use client';

import {useEffect, useState} from 'react';

function formatRemaining(ms: number) {
  if (ms <= 0) return 'resolving…';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function Countdown({target}: {target: string | Date}) {
  const targetMs = new Date(target).getTime();
  const [remaining, setRemaining] = useState(() => targetMs - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(targetMs - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetMs]);

  return <span>{formatRemaining(remaining)}</span>;
}
