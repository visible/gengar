import Link from 'next/link';
import { Footer } from '@/components/footer';
import { delay } from '@/components/grid';
import { Header } from '@/components/header';
import { Schema } from '@/components/schema';
import { FAQ, UPDATED_TEXT, meta } from '@/lib/facts';

export const metadata = meta(
  '/faq',
  'Gengar FAQ',
  'How Gengar removes Twitch ads, which browsers it supports, how it works with uBlock Origin, and what it does with your data.'
);

const COLUMNS = ['lg:col-start-1', 'lg:col-start-12', 'lg:col-start-23'];

const schema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer }
  }))
};

export default function FaqPage() {
  return (
    <main className="grid min-h-dvh grid-cols-32 content-between gap-y-[clamp(32px,6dvh,96px)] bg-paper px-[clamp(20px,6vw,96px)] pt-[clamp(28px,7dvh,88px)] pb-[clamp(28px,6dvh,72px)] text-ink">
      <Schema data={schema} />

      <Header title="Questions" href="/" action="Back" className="col-span-full" />

      <div className="col-span-full flex flex-col items-start gap-4 [--word:clamp(56px,min(12vw,20dvh),220px)] lg:flex-row lg:items-end lg:gap-[2.75vw]">
        <p aria-hidden="true" className="pb-[0.08em] text-[length:var(--word)] leading-none font-bold tracking-[-0.055em]">
          {[...'questions'].map((char, j) => (
            <span key={j} className="set" style={{ animationDelay: delay(j * 7 + 5) }}>
              {char}
            </span>
          ))}
        </p>
        <p className="max-w-[34ch] text-[11px] leading-[1.4] lg:mb-[calc(var(--word)*0.2)]">
          Short answers about how Gengar works, where it runs and what it keeps.
        </p>
      </div>

      <div className="col-span-full grid grid-cols-32 gap-y-6">
        {FAQ.map(({ question, answer }, k) => (
          <section
            key={question}
            className={`col-span-full max-w-[40ch] text-[11px] leading-[1.4] lg:col-span-9 ${COLUMNS[k % COLUMNS.length]}`}
          >
            <h2 className="font-bold">{question}</h2>
            <p>{answer}</p>
          </section>
        ))}
      </div>

      <Footer className="col-span-full" current="/faq">
        <span>Updated {UPDATED_TEXT}</span>
        <Link href="/install" className="underline underline-offset-2 hover:no-underline">
          Install
        </Link>
      </Footer>
    </main>
  );
}
