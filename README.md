# AboutMe

Daniyar Idirov's portfolio: school, projects, technology stack, hackathons and future plans.

The page opens as a canvas that a swarm of small cursors builds in front of you.

- **One origin.** Every scene has a single point the cursors leave from and return to. In the introduction it sits between the name and the note card; in each section it starts beside the file name (`about.md`, `projects.ts`, ...) and follows the reader down the section. A small counter beside it shows how many cursors are out working.
- **Chaotic routes.** Cursors burst outwards, then fly curved routes with random detours and a slight wobble, at different speeds and eases. They lean into horizontal motion and leave a streak proportional to speed. Waiting cursors drift in small loops; cursors idle for too long fly home.
- **Panels build themselves.** Four cursors claim the corners of a panel, then each drags one edge to the next corner. Another cursor clicks inside and the surface fills outward from that point. Dividers are pulled apart from the middle by two cursors. Badges, buttons and links are dragged out as selections with a live size readout. Headings and paragraphs are typed by up to four cursors at once, each taking its own lines.
- **Detailed cursors.** Outlined arrows in four tones from the site palette, a press ring on the hotspot, click ripples, a typing caret and a role tag (`frame`, `fill`, `rule`, `drag`, `type`) while working.

The introduction plays in real time (about four seconds, faster if you start scrolling). Section scenes are tied to scroll distance, so each panel starts as it enters the viewport and scrolling back reverses every step. Routes are seeded, so the same scene always flies the same way. The native pointer and ordinary page scrolling remain available.

Code: `swarm.js` (origin, cursors, routes, timing), `construct.js` (frames, fills, dividers, selections, typing), `motion.js` (scenes, scroll, controls and fallbacks).

## Local preview

```sh
python3 scripts/serve.py
```

Open http://127.0.0.1:8768/. The server always serves this checkout and disables browser caching. This is a static site: `index.html`, CSS, JavaScript, `fonts/` and `vendor/` can be hosted together without a build step.

## Motion and accessibility

- `Pause motion` switches to a fully readable static layout and remembers the choice.
- The operating system's reduced-motion preference takes priority and can change while the page is open.
- Keyboard focus and section links finish the relevant animations so links and content are immediately visible.
- No JavaScript, missing animation files and partial initialization failures fall back to the static portfolio.
- Animated text has a single accessible text alternative and preserves explicit line breaks. Cursors and selection handles are decorative and cannot intercept clicks.
- Scroll choreography reverses cleanly. Geometry is re-measured on resize and font loading, and a real width change rebuilds the scenes because line breaks change. Content is only revealed, never transformed, so text never scales with a panel.
- The pointer light is a faint, broad glow with a short trailing movement. It stops updating once settled and is disabled for touch and reduced motion.
- Font files and GSAP are served locally, without a runtime dependency on third-party CDNs.

## Development checks

```sh
npm ci
npx playwright install chromium
npm run check
npm test
```

Tests start an isolated preview on port 8879. If using an installed Chrome instead of Playwright's Chromium:

```sh
PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npm test
```

Browser coverage includes the introduction bursting from one origin and every cursor returning, a cursor at the tip of every growing frame edge, typing only after drawing, reverse scrolling, rebuilding after a width change, content visibility, motion controls and saved preferences, keyboard and anchor navigation, mobile overflow in both themes, and no-JavaScript / missing-runtime fallbacks.

## Animation dependency

GSAP and ScrollTrigger are pinned in `package-lock.json`. After intentionally updating the dependency, run `npm run vendor` and commit the generated files. Their original license notices are retained in `vendor/`; font licenses are in `fonts/`.
