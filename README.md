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

  0.1.0 is waiting on review from the chrome web store and
  firefox add-ons. store links go here once approved.
  live streams only. vods and clips are not covered.
  during a break the ad-free stream can play at a lower quality.

> while you wait?

  userscript    install tampermonkey or violentmonkey, then open
                https://geng.ar/gengar.user.js. updates itself.
  chrome        unzip gengar-chrome.zip from geng.ar/install, turn on
                developer mode in chrome://extensions, load unpacked
  firefox       load gengar-firefox.zip from about:debugging.
                firefox removes it on restart.

> links?

  https://geng.ar

> license?

  mit, see LICENSE
```
