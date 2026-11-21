import { Footer } from '@/components/footer';
import { delay } from '@/components/grid';
import { Header } from '@/components/header';
import { Pick } from '@/components/pick';
import { meta } from '@/lib/facts';
import { kilobytes, version } from '@/lib/release';

export const metadata = meta(
  '/install',
  'Install Gengar',
  'Download Gengar, the free Twitch ad blocker, as a Chrome extension, a Firefox add-on or a userscript for Tampermonkey and Violentmonkey.'
);

const OPTIONS = [
  {
    id: 'chrome',
    file: 'gengar-chrome.zip',
    action: 'Download the Chrome extension',
    place: 'lg:col-start-1',
    what: 'Extension for Chrome, Edge, Brave, Arc and Opera.',
    steps: [
      'Unzip the download.',
      'Open chrome://extensions and turn on Developer mode.',
      'Click Load unpacked and choose the unzipped folder.'
    ]
  },
  {
    id: 'firefox',
    file: 'gengar-firefox.zip',
    action: 'Download the Firefox add-on',
    place: 'lg:col-start-5',
    what: 'Add-on for Firefox 140 and later.',
    steps: ['Open about:debugging and click This Firefox.', 'Click Load Temporary Add-on and choose the zip.'],
    note: 'Firefox removes it on restart. The userscript stays installed.'
  },
  {
    id: 'userscript',
    file: 'gengar.user.js',
    action: 'Install the userscript',
    place: 'lg:col-start-9',
    what: 'For Tampermonkey or Violentmonkey, in any browser.',
    steps: ['Install Tampermonkey or Violentmonkey.', 'Open the script and confirm the install.'],
    note: 'Updates itself from geng.ar.'
  }
];

export default function InstallPage() {
  const current = version();

  return (
    <main className="grid min-h-dvh grid-cols-32 content-between gap-y-[clamp(32px,6dvh,96px)] bg-paper px-[clamp(20px,6vw,96px)] pt-[clamp(28px,7dvh,88px)] pb-[clamp(28px,6dvh,72px)] text-ink">
      <Header title="Install" href="/" action="Back" className="col-span-full" />

      <ul className="col-span-full grid grid-cols-32 gap-y-[clamp(32px,5dvh,72px)]">
        {OPTIONS.map((option, k) => {
          const size = kilobytes(option.file);
          return (
            <li
              key={option.id}
              className={`col-span-full flex flex-col items-start gap-4 [--word:clamp(56px,min(9.2vw,16dvh),176px)] lg:col-end-[-1] lg:flex-row lg:items-end lg:gap-[2.75vw] ${option.place}`}
            >
              <a
                href={`/${option.file}`}
                download={option.id === 'userscript' ? undefined : true}
                aria-label={option.action}
                className="group"
              >
                <span className="block pb-[0.08em] text-[length:var(--word)] leading-none font-bold tracking-[-0.05em] whitespace-nowrap transition-colors group-hover:bg-ink group-hover:text-paper">
                  {[...option.id].map((char, j) => (
                    <span key={j} className="set" style={{ animationDelay: delay(k * 31 + j + 1) }}>
                      {char}
                    </span>
                  ))}
                </span>
              </a>

              <div className="max-w-[32ch] text-[11px] leading-[1.4] lg:mb-[calc(var(--word)*0.2)]">
                <p className="mb-2 flex items-center gap-2">
                  <a
                    href={`/${option.file}`}
                    download={option.id === 'userscript' ? undefined : true}
                    tabIndex={-1}
                    className="font-bold whitespace-nowrap underline underline-offset-2 hover:no-underline"
                  >
                    {option.file}
                    {size && `, ${size}`}
                  </a>
                  <Pick id={option.id} />
                </p>
                <p className="font-bold">{option.what}</p>
                <ol className="list-decimal pl-[1.6ch]">
                  {option.steps.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {option.note && <p>{option.note}</p>}
              </div>
            </li>
          );
        })}
      </ul>

      <Footer className="col-span-full">
        {current && <span>Version {current}</span>}
        <span>All three block the same ads. Works alongside uBlock Origin and AdBlock.</span>
      </Footer>
    </main>
  );
}
