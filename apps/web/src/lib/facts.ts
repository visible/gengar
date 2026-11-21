import type { Metadata } from 'next';

export const SITE = 'https://geng.ar';
export const UPDATED = '2026-11-21';
export const UPDATED_TEXT = new Date(`${UPDATED}T00:00:00Z`).toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC'
});

export const DESCRIPTION =
  'Gengar is a free ad blocker for Twitch. It removes the ads inside the Twitch player, so live streams keep playing through ad breaks.';

export const BROWSERS = 'Chrome, Edge, Brave, Arc, Opera, Firefox 140 or later, and any browser with Tampermonkey or Violentmonkey';

export const FAQ = [
  {
    question: 'What is Gengar?',
    answer:
      'Gengar is a free ad blocker for Twitch. It removes the ads inside the Twitch player, so live streams keep playing through ad breaks. It comes as a Chrome extension, a Firefox add-on and a userscript.'
  },
  {
    question: 'How does Gengar block Twitch ads?',
    answer:
      'Twitch puts ads inside the video stream itself, which is why regular ad blockers miss them. When an ad break starts, Gengar asks Twitch for the same stream as a different player that has no ads, plays that until the break ends, then switches back.'
  },
  {
    question: 'Does Gengar work with uBlock Origin or AdBlock?',
    answer:
      'Yes. Keep them for ads on the rest of the page while Gengar handles the video player. Turn off any other Twitch video ad blocker or script, because two of them will fight over the player.'
  },
  {
    question: 'Which browsers does Gengar support?',
    answer:
      'Chrome, Edge, Brave, Arc and Opera with the Chrome extension. Firefox 140 or later with the Firefox add-on. Any browser with Tampermonkey or Violentmonkey, including Safari, with the userscript.'
  },
  {
    question: 'Is Gengar free?',
    answer: 'Yes. There is no account, no subscription and no paid tier.'
  },
  {
    question: 'Does Gengar collect my data?',
    answer: 'No. Gengar has no servers, no accounts and no analytics. It only talks to Twitch, and its settings stay in your browser.'
  },
  {
    question: 'Does Gengar block ads on VODs and clips?',
    answer: 'No. Gengar is built for live streams. VODs and clips are not covered.'
  },
  {
    question: 'Will the stream quality change during an ad break?',
    answer:
      'Sometimes. The ad-free stream can play at a lower quality for the length of the break, and your chosen quality comes back when the break ends.'
  },
  {
    question: 'Does Gengar work in the Twitch app?',
    answer: 'No. Gengar runs in a web browser on twitch.tv, not in the Twitch app for phones, consoles or TVs.'
  }
];

const IMAGE = { url: '/opengraph-image', width: 1200, height: 630, alt: 'Gengar, a Twitch ad blocker' };

export function meta(path: string, title: string, description: string): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: 'Gengar', type: 'website', images: [IMAGE] },
    twitter: { card: 'summary_large_image', title, description, images: [IMAGE] }
  };
}
