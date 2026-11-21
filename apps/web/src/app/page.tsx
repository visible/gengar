import { Footer } from '@/components/footer';
import { Grid } from '@/components/grid';
import { Header } from '@/components/header';
import { Schema } from '@/components/schema';
import { BROWSERS, DESCRIPTION, SITE, meta } from '@/lib/facts';
import { version } from '@/lib/release';

export const metadata = meta('/', 'Gengar - Twitch without the ad breaks', DESCRIPTION);

export default function HomePage() {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': `${SITE}/#site`, name: 'Gengar', url: SITE, description: DESCRIPTION },
      {
        '@type': 'SoftwareApplication',
        '@id': `${SITE}/#app`,
        name: 'Gengar',
        description: DESCRIPTION,
        url: SITE,
        downloadUrl: `${SITE}/install`,
        image: `${SITE}/opengraph-image`,
        applicationCategory: 'BrowserApplication',
        applicationSubCategory: 'Ad blocker',
        operatingSystem: 'Windows, macOS, Linux, ChromeOS',
        browserRequirements: BROWSERS,
        softwareVersion: version() ?? undefined,
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      }
    ]
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-paper text-ink">
      <Schema data={schema} />

      <div className="absolute inset-x-[clamp(20px,6vw,96px)] top-[clamp(28px,7dvh,88px)] bottom-[clamp(28px,6dvh,72px)]">
        <Grid />

        <Header title="Twitch ad blocker" href="/install" action="Install" className="absolute inset-x-0 top-0" />

        <Footer className="absolute inset-x-0 bottom-0" />
      </div>
    </main>
  );
}
