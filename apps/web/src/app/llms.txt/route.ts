import { BROWSERS, DESCRIPTION, FAQ, SITE } from '@/lib/facts';
import { version } from '@/lib/release';

export const dynamic = 'force-static';

export function GET() {
  const current = version();
  const body = `# Gengar

> ${DESCRIPTION}

## Pages

- [Install](${SITE}/install): download the Chrome extension, the Firefox add-on or the userscript, with install steps
- [FAQ](${SITE}/faq): how Gengar works, supported browsers and privacy
- [Privacy Policy](${SITE}/privacy): Gengar collects nothing

## Facts

${current ? `- Version: ${current}\n` : ''}- Price: free, no account
- Works in: ${BROWSERS}
- Covers: Twitch live streams, not VODs or clips
- Works alongside uBlock Origin and AdBlock
- Data collection: none

## Questions

${FAQ.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}
`;

  return new Response(body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
}
