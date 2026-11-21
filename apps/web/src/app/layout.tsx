import type { Metadata, Viewport } from 'next';
import { Inter_Tight } from 'next/font/google';
import { DESCRIPTION, SITE } from '@/lib/facts';
import './globals.css';

const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-inter-tight',
  display: 'swap'
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Gengar - Twitch Ad Blocker',
  description: DESCRIPTION,
  applicationName: 'Gengar',
  category: 'technology',
  openGraph: { siteName: 'Gengar', type: 'website' },
  twitter: { card: 'summary_large_image' }
};

export const viewport: Viewport = {
  themeColor: '#9146ff'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interTight.variable}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
