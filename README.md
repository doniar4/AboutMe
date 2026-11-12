# AboutMe

Daniyar Idirov's portfolio: school, projects, technology stack, hackathons and future plans.

The page is built in front of you by a small team of cursors, the way a design file looks when several people work in it at once.

- **One starting point.** The team pours out of the full stop that ends the name and assembles the hero in about two seconds.
- **Named cursors.** Each one is an outlined arrow with a label from the stack (`C++`, `TS`, `CSS`, `Git`, ...) in one of four tones from the palette. Flights are single smooth arcs that start and stop gently. The trail is short and faint and only appears at speed.
- **Three ways of building.** Panels are dragged out by a corner with a selection frame and a live size readout. Headings, tiles and buttons are carried in and dropped. Chips and list rows are clicked into place.
- **Real time, not scroll.** A block builds once when it comes into view and finishes by itself in about a second, so text never waits for the reader. Racing down the page, following a link or tabbing into a section skips the show and gives the content at once.
- **A team with habits.** Free cursors keep away from the real pointer, leave when there is nothing to do, and at the end of the page gather beside "Start a conversation".

Around that sit the quieter details: floating tiles and a note in the hero, a count-up on the facts board, a timetable mock for NIS Hub, a circuit with running signals, a timeline rail that fills as you read, a route drawn towards MIT, a reading-progress line and the open "file" underlined in the header.

## Themes

Two themes share one set of tokens at the top of `style.css`.

- **Night** is a dark green editor with an amber accent and mint, coral and sky as supporting tones. Each section owns one tone.
- **Day** is a notebook: mint paper, ink outlines with hard shadows, highlighter yellow, a yellow sticky note in the hero, and a few panels that stay dark as ink.

The theme switch opens the new theme as a circle from the button (where the browser supports view transitions).

## Code

| File | Role |
| --- | --- |
| `index.html` | All content. `data-build` marks what the team builds and how (`draw`, `place`, `pop`, `row`, `rise`). |
| `style.css` | Tokens for both themes, layout, details, and the rules that keep content visible when motion is off. |
| `swarm.js` | The cursor team: flights, idling, trails, selection frames. |
| `construct.js` | The builders, one per `data-build` kind. |
| `motion.js` | The introduction, building on scroll, the gathering at the end, controls and fallbacks. |
| `script.js` | Theme switch, header, pointer light, hero parallax, count-up. Works without the animation runtime. |

## Local preview

```sh
python3 scripts/serve.py
```

Open http://127.0.0.1:8768/. The server always serves this checkout and disables browser caching. This is a static site: `index.html`, CSS, JavaScript, `fonts/` and `vendor/` can be hosted together without a build step.

## Motion and accessibility

- `Pause motion` switches to a fully readable static layout and remembers the choice.
- The operating system's reduced-motion preference takes priority and can change while the page is open.
- Keyboard focus and section links finish the relevant blocks so links and content are immediately visible.
- Without JavaScript, without the animation files, or if the motion script fails to start within three seconds, the page is the plain static portfolio.
- Nothing is typed out or split into characters: text is real text from the first frame it is shown. Cursors and selection frames are decorative and cannot intercept clicks.
- Phones get a smaller team without labels.
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

Browser coverage includes the introduction leaving from the dot and finishing in time, a cursor holding the corner of every frame it draws, sections finishing without further scrolling, the gathering at the end, motion controls and saved preferences, keyboard and anchor navigation, header state, colours in both themes, mobile overflow in both themes, and no-JavaScript / missing-runtime fallbacks.

## Animation dependency

GSAP is pinned in `package-lock.json`. After intentionally updating the dependency, run `npm run vendor` and commit the generated file. Its original license notice is retained in `vendor/`; font licenses are in `fonts/`.
