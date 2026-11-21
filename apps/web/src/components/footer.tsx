import Link from 'next/link';
import type { ReactNode } from 'react';
import { REPO } from '@/lib/facts';

const LINK = 'underline underline-offset-2 hover:no-underline aria-[current=page]:no-underline';

export function Footer({
  className,
  current,
  children
}: {
  className: string;
  current?: '/faq' | '/privacy';
  children?: ReactNode;
}) {
  return (
    <footer className={`flex items-end gap-x-8 text-[10.5px] leading-[1.35] ${className}`}>
      {children && <p className="flex flex-wrap gap-x-4">{children}</p>}
      <nav className="ml-auto flex shrink-0 gap-4">
        <Link href="/faq" aria-current={current === '/faq' ? 'page' : undefined} className={LINK}>
          FAQ
        </Link>
        <Link href="/privacy" aria-current={current === '/privacy' ? 'page' : undefined} className={LINK}>
          Privacy
        </Link>
        <a href={REPO} className={LINK}>
          GitHub
        </a>
      </nav>
    </footer>
  );
}
