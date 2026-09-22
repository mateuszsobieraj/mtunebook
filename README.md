# MTunebook

A React tunebook for ABC notation, transposition, and melody playback.

## Development

Use Node.js 20 or newer:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The development server and production build regenerate the tune index. GitHub
Actions runs tests before deployment to GitHub Pages and checks pull requests.

## Adding tunes

1. Add one UTF-8 `.abc` file per tune in `public/tunes/`. Use a stable filename
   such as `my-new-reel.abc`; filenames are used in links and saved preferences.
2. Include the ABC headers `X:`, `T:`, `M:`, `L:`, `Q:`, and `K:`. Add `R:` for
   the rhythm. Supported tempo controls range from 40 to 220 BPM.
3. Run `npm run generate:index`. Optional search tags can be added to the tune's
   `tags` array in `public/tunes/index.json`; regeneration preserves them.
4. Check notation and playback with `npm run dev`, then run tests and build.

```abc
X:1
T:Example Reel
R:reel
M:4/4
L:1/8
Q:1/4=120
K:D
|:DEFG A2FA|B2AF E2D2:|
```

## Navigation and playback

Tune links use `#tune=filename.abc`, so they work on static hosting. Browser Back
and Forward restore the selection. `#list` opens the list without restoring the
last tune. Search text is retained while moving between the list and a tune.

Space starts/stops playback or cancels audio preparation. Up/Down changes tempo
when focus is outside a form control. Clicking Tempo restores the original tempo.
Settings are saved per tune when browser storage is available.

## Offline use

Service workers run in production on HTTPS or localhost. The build generates a
versioned precache containing HTML, CSS, JavaScript (including lazy chunks), and
all bundled tunes. Once installation completes, notation is available offline
without first opening every tune. Initial installation needs a working connection.

Playback downloads soundfont samples from `paulrosen.github.io` on demand. Only
samples already downloaded by the controlling service worker are available
offline; a new tune or transposition can need additional samples. Browser storage
eviction can remove offline data.

Updates activate after tabs using the previous version close. Cache cleanup is
restricted to this application's scope and never clears other apps' data.
