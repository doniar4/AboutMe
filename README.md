# AboutMe

Daniyar Idirov's portfolio: school, projects, technology stack, hackathons and future plans.

The page opens as a canvas. Twenty small, anonymous cursors have individual jobs: four build the introduction and sixteen work through the sections. A cursor grabs a corner, stretches a stationary surface, releases it, then enters the panel and types along the actual text lines. Different panels grow from different corners. The native pointer and ordinary page scrolling remain available.

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
- Scroll choreography reverses cleanly. Surface geometry is refreshed on resize and font loading; text never scales with the panel.
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

Browser coverage includes the cursor staying attached to a growing corner, typing only after drawing, reverse scrolling, twenty anonymous cursors, content visibility, motion controls and saved preferences, keyboard and anchor navigation, mobile overflow in both themes, and no-JavaScript / missing-runtime fallbacks.

## Animation dependency

GSAP and ScrollTrigger are pinned in `package-lock.json`. After intentionally updating the dependency, run `npm run vendor` and commit the generated files. Their original license notices are retained in `vendor/`; font licenses are in `fonts/`.
