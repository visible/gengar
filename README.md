```bash
> gengar?

  twitch without the ad breaks.
  an ad blocker for chrome, firefox and userscript managers.
  no accounts. no servers. no tracking.

> how?

  twitch puts ads inside the video stream itself, which is why
  regular ad blockers miss them. when a break starts, gengar asks
  twitch for the same stream as a different player that has no
  ads, plays that until the break ends, then switches back.

> features?

  ✓ blocks ad breaks on live streams
  ✓ settings inside the player: source quality, catch up to live,
    player type and a test ad break
  ✓ toolbar popup with a running total, this tab's status and an off switch
  ✓ works alongside ublock origin and adblock
  ✓ only asks for storage and twitch.tv
  ✓ collects nothing

> browsers?

  chrome extension    chrome, edge, brave, arc and opera
  firefox add-on      firefox 140+ and firefox for android 142+
  userscript          tampermonkey or violentmonkey, including safari

> status?

  0.1.0, not released yet.
  live streams only. vods and clips are not covered.
  during a break the ad-free stream can play at a lower quality.

> stack?

  packages/core     javascript                         the ad blocker, shared by every build
  apps/extension    manifest v3 · chrome · firefox     the extension
  apps/web          next.js · typescript · tailwind    the site at geng.ar

  node.js 22+ · npm workspaces

> develop?

  npm ci
  npm run dev                  build the extension, then run the site
  npm run dev:extension        rebuild the extension on save
  npm run dev:script           rebuild the userscript on save, served on :4173
  npm test                     core tests
  npm run build                extension zips and the site

> try it?

  chrome     load apps/extension/dist/chrome unpacked from chrome://extensions
  firefox    load apps/extension/dist/firefox/manifest.json from about:debugging

> release?

  npx playwright install chromium         once, for smoke and store
  npm -w @gengar/extension run smoke      test the built extension on a live stream
  npm -w @gengar/extension run store      store screenshots and promo tiles

  apps/extension/dist/gengar-chrome-<version>.zip     chrome web store
  apps/extension/dist/gengar-firefox-<version>.zip    addons.mozilla.org
  apps/extension/dist/gengar-source-<version>.zip     source for mozilla review

> links?

  https://geng.ar

> license?

  mit, see LICENSE
```

gengar is not affiliated with or endorsed by Twitch. Twitch is a trademark of Twitch Interactive, Inc.
