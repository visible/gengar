'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

function detect() {
  const ua = navigator.userAgent;
  if (/Mobi|Android|iPhone|iPad/.test(ua)) return 'userscript';
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Chrome\/|Chromium\//.test(ua)) return 'chrome';
  return 'userscript';
}

export function Pick({ id }: { id: string }) {
  const mine = useSyncExternalStore(subscribe, detect, () => null);
  if (mine !== id) return null;
  return <span className="bg-ink px-1.5 py-1 leading-none font-bold whitespace-nowrap text-paper">Your browser</span>;
}
