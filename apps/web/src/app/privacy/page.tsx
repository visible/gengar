import Link from 'next/link';
import { Footer } from '@/components/footer';
import { delay } from '@/components/grid';
import { Header } from '@/components/header';
import { UPDATED_TEXT, meta } from '@/lib/facts';

export const metadata = meta(
  '/privacy',
  'Gengar Privacy Policy',
  'Gengar collects nothing. It has no servers, no accounts and no analytics, and only talks to Twitch.'
);

const SECTIONS = [
  {
    title: 'Requests to Twitch',
    place: 'lg:col-start-1',
    body: 'To find a stream without ads, Gengar asks Twitch for the same stream as a different player, such as the popout or embed player. These requests go only to Twitch and carry the same headers the Twitch player already sends, including your Twitch login if you are signed in.'
  },
  {
    title: 'Stored in your browser',
    place: 'lg:col-start-9',
    body: 'Player settings are saved on twitch.tv in your browser. The extension keeps its on and off switch and the count of blocked ads in its own storage. None of it is uploaded, and removing the extension deletes its storage.'
  },
  {
    title: 'Permissions',
    place: 'lg:col-start-17',
    body: 'Storage, to remember the switch and the count. Access to twitch.tv, to run inside the player. Gengar cannot read or change any other site.'
  },
  {
    title: 'This website',
    place: 'lg:col-start-25',
    body: 'geng.ar uses no cookies and no analytics. Our host, Vercel, keeps standard request logs.'
  }
];

export default function PrivacyPage() {
  return (
    <main className="grid min-h-dvh grid-cols-32 content-between gap-y-[clamp(32px,6dvh,96px)] bg-paper px-[clamp(20px,6vw,96px)] pt-[clamp(28px,7dvh,88px)] pb-[clamp(28px,6dvh,72px)] text-ink">
      <Header title="Privacy Policy" href="/" action="Back" className="col-span-full" />

      <div className="col-span-full flex flex-col items-start gap-4 [--word:clamp(64px,min(15vw,26dvh),280px)] lg:flex-row lg:items-end lg:gap-[2.75vw]">
        <p className="pb-[0.08em] text-[length:var(--word)] leading-none font-bold tracking-[-0.055em]">
          {[...'nothing'].map((char, j) => (
            <span key={j} className="set" style={{ animationDelay: delay(j * 7 + 3) }}>
              {char}
            </span>
          ))}
        </p>
        <p className="max-w-[34ch] text-[11px] leading-[1.4] lg:mb-[calc(var(--word)*0.2)]">
          <span className="font-bold">That is what Gengar collects.</span> It has no servers, no accounts and no
          analytics, so nothing you do on Twitch is sent to us.
        </p>
      </div>

      <div className="col-span-full grid grid-cols-32 gap-y-6">
        {SECTIONS.map(section => (
          <section key={section.title} className={`col-span-full max-w-[36ch] text-[11px] leading-[1.4] lg:col-span-7 ${section.place}`}>
            <h2 className="font-bold">{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </div>

      <Footer className="col-span-full" current="/privacy">
        <span>Updated {UPDATED_TEXT}</span>
        <Link href="/install" className="underline underline-offset-2 hover:no-underline">
          Install
        </Link>
      </Footer>
    </main>
  );
}
