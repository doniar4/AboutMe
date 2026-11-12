const { test, expect } = require('@playwright/test');

const browserEvidence = new WeakMap();
test.beforeEach(async ({ page }) => {
    const events = [];
    browserEvidence.set(page, events);
    page.on('pageerror', e => events.push(['pageerror', e.message]));
    page.on('console', e => { if (e.type() === 'error') events.push(['console', e.text()]); });
    page.on('requestfailed', r => events.push(['requestfailed', r.url(), r.failure()?.errorText]));
});
test.afterEach(async ({ page }, info) => {
    if (info.status !== info.expectedStatus) console.log('Browser failure evidence:', JSON.stringify(browserEvidence.get(page)));
});

async function moveTo(page, selector, viewportFraction = .35) {
    await page.locator(selector).first().evaluate((el, fraction) => {
        window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * fraction, behavior: 'instant' });
    }, viewportFraction);
}
// Scroll the way a reader does, in wheel steps, until the element is well inside the viewport.
async function wheelTo(page, selector, viewportFraction = .5) {
    await page.mouse.move(640, 400);
    for (let i = 0; i < 200; i++) {
        const left = await page.locator(selector).first().evaluate((el, fraction) =>
            el.getBoundingClientRect().top - innerHeight * fraction, viewportFraction);
        if (left <= 0) return;
        await page.mouse.wheel(0, Math.min(90, Math.max(20, left)));
        await page.waitForTimeout(40);
    }
}
async function visibleContents(page, selector, timeout = 5000) {
    await expect.poll(() => page.locator(selector).evaluateAll(elements => elements.length > 0 && elements.every(el => {
        // Check every ancestor as well: a visible child can be inside a transparent surface.
        for (let node = el; node && node !== document.body; node = node.parentElement) {
            if (Number(getComputedStyle(node).opacity) < .99) return false;
        }
        return true;
    })), { timeout }).toBe(true);
}
const visibleCursors = page => page.locator('.cursor-body').evaluateAll(list =>
    list.filter(el => Number(getComputedStyle(el).opacity) > .5).length);
const stages = (page, scope) => page.locator(`${scope} [data-build]`).evaluateAll(list => list.map(el => el.dataset.stage));

/* Sampled once per frame inside the page: where each cursor first appears, and how
   far the nearest cursor is from the corner of a frame while that frame is being drawn. */
function watchTheTeam() {
    window.teamLog = { first: [], grip: [] };
    const sizes = new WeakMap();
    const frame = () => {
        const cursors = [...document.querySelectorAll('.cursor')];
        const at = cursors.map(c => { const m = new DOMMatrix(getComputedStyle(c).transform); return { x: m.e, y: m.f }; });
        cursors.forEach((c, i) => {
            if (!window.teamLog.first[i] && Number(getComputedStyle(c.firstElementChild.nextElementSibling).opacity) > .02) window.teamLog.first[i] = at[i];
        });
        document.querySelectorAll('.build-frame').forEach(box => {
            if (!box.querySelector('em')?.textContent || Number(getComputedStyle(box).opacity) < 1) return;
            const m = new DOMMatrix(getComputedStyle(box).transform);
            const w = parseFloat(box.style.width), h = parseFloat(box.style.height);
            // Only while the frame is still growing: afterwards the cursor lets go and steps aside.
            const growing = Math.abs(w - (sizes.get(box) ?? w)) > .5;
            sizes.set(box, w);
            if (!growing || !(w > 20 && h > 20)) return;
            const corners = [[m.e, m.f], [m.e + w, m.f], [m.e + w, m.f + h], [m.e, m.f + h]];
            window.teamLog.grip.push(Math.min(...at.flatMap(p => corners.map(([x, y]) => Math.hypot(p.x - x, p.y - y)))));
        });
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

test('the introduction pours out of the full stop of the name and builds the hero quickly', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(watchTheTeam);
    const started = Date.now();
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    await expect(page.locator('.swarm-layer')).toHaveCount(1);
    await expect(page.locator('.cursor')).toHaveCount(8);
    // Several cursors are out working at the same time.
    await expect.poll(() => visibleCursors(page), { timeout: 3000 }).toBeGreaterThanOrEqual(6);
    // The whole hero stands within a few seconds of opening the page, without any scrolling.
    await expect.poll(() => stages(page, '.hero').then(list => list.every(stage => stage === 'done')), { timeout: 4000 }).toBe(true);
    expect(Date.now() - started).toBeLessThan(4500);
    await visibleContents(page, '.hero [data-build], .hero .btn, .note-headline');
    // Every cursor first appeared on the dot that ends the name.
    const origin = await page.locator('.name-dot').evaluate(dot => {
        const r = dot.getBoundingClientRect();
        return { x: r.left + scrollX + r.width / 2, y: r.top + scrollY + r.height * .62 };
    });
    const first = await page.evaluate(() => window.teamLog.first);
    expect(first.filter(Boolean)).toHaveLength(8);
    first.forEach(p => expect(Math.hypot(p.x - origin.x, p.y - origin.y)).toBeLessThan(40));
    // Nothing is typed: the text was never split into characters, and there is no ring or counter.
    await expect(page.locator('.type-char, .swarm-hub')).toHaveCount(0);
    await expect(page.locator('.hero-title')).toHaveText(/Daniyar\s*Idirov\./);
    // The team leaves; at most the two residents stay by the name and the note.
    await expect.poll(() => visibleCursors(page), { timeout: 6000 }).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
});

test('a cursor drags a panel out by its corner, and sections build in real time', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(watchTheTeam);
    await page.goto('/');
    await expect.poll(() => stages(page, '.hero').then(list => list.every(stage => stage === 'done')), { timeout: 4000 }).toBe(true);
    await wheelTo(page, '#projects .project-entry', .6);
    // No more scrolling from here on: the section finishes by itself.
    await expect.poll(() => stages(page, '#projects').then(list => list.every(stage => stage === 'done')), { timeout: 4000 }).toBe(true);
    await visibleContents(page, '#projects [data-build], #projects .project-status, #projects .text-link');
    // While a frame was being drawn, a cursor was on one of its corners in every sampled frame.
    const grip = await page.evaluate(() => window.teamLog.grip);
    expect(grip.length).toBeGreaterThan(8);
    expect(Math.max(...grip)).toBeLessThan(4);
    // Frames are temporary: none is left on the finished page.
    await expect(page.locator('.build-frame')).toHaveCount(0, { timeout: 3000 });
    expect(errors).toEqual([]);
});

test('the stack is readable within moments of arriving, however the reader gets there', async ({ page }) => {
    await page.goto('/');
    // A slow reader: wheel down to the section.
    await wheelTo(page, '#stack .stack-groups', .55);
    await visibleContents(page, '#stack [data-build], #stack .stack-list li', 3500);
    await expect(page.locator('#stack .stack-list li')).toHaveCount(16);
    // A reader in a hurry: jump straight to the end of the page.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await visibleContents(page, '.footer-title, .contact-profile, .footer-note', 3500);
    await expect(page.getByRole('link', { name: /Telegram @doniar4/ })).toHaveAttribute('href', 'https://t.me/doniar4');
});

test('at the end of the page the team gathers beside the contact title', async ({ page }) => {
    await page.goto('/');
    await page.mouse.move(640, 400);
    const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 0; y < total + 200; y += 110) { await page.mouse.wheel(0, 110); await page.waitForTimeout(45); }
    await expect.poll(() => stages(page, 'body').then(list => list.every(stage => stage === 'done')), { timeout: 6000 }).toBe(true);
    await expect.poll(() => page.evaluate(() => {
        const title = document.querySelector('.footer-title').getBoundingClientRect();
        return [...document.querySelectorAll('.cursor')].filter(c => {
            const r = c.getBoundingClientRect();
            return Number(getComputedStyle(c.querySelector('.cursor-body')).opacity) > .5
                && r.left > title.right && Math.abs(r.top - (title.top + title.height / 2)) < 160;
        }).length;
    }), { timeout: 6000 }).toBeGreaterThanOrEqual(6);
});

test('motion controls reveal all content and survive reload and OS preference changes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pause motion' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    await expect(page.locator('.swarm-layer')).toHaveCount(0);
    await visibleContents(page, '[data-build]');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play motion' })).toBeVisible();
    await visibleContents(page, '[data-build]');
    await page.getByRole('button', { name: 'Play motion' }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
    await visibleContents(page, '[data-build]');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.getByRole('button', { name: 'Pause motion' })).toBeVisible();
});

test('anchor navigation and keyboard focus never land on transparent links', async ({ page }) => {
    await page.goto('/#stack');
    await visibleContents(page, '#stack [data-build], .hero [data-build], #about [data-build]', 3500);
    await page.getByRole('link', { name: 'contact.sh' }).click();
    await visibleContents(page, '.contact-profile, .footer-title', 3500);
    await page.goto('/');
    await page.locator('.project-entry .text-link').focus();
    await visibleContents(page, '.project-entry .text-link', 500);
});

test('the header follows the reader: open file and reading progress', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pause motion' }).click();
    await moveTo(page, '#stack', .2);
    await expect(page.locator('.main-nav a[aria-current="true"]')).toHaveText('stack.json');
    const middle = Number(await page.locator('.site-header').evaluate(el => el.style.getPropertyValue('--progress')));
    expect(middle).toBeGreaterThan(.2);
    expect(middle).toBeLessThan(.9);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await expect(page.locator('.main-nav a[aria-current="true"]')).toHaveText('contact.sh');
    await expect.poll(() => page.locator('.site-header').evaluate(el => Number(el.style.getPropertyValue('--progress')))).toBeGreaterThan(.98);
});

test('both themes carry colour: a bright accent, tinted paper by day, ink panels', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pause motion' }).click();
    const read = () => page.evaluate(() => {
        const css = (selector, property) => getComputedStyle(document.querySelector(selector))[property];
        return {
            theme: document.documentElement.dataset.theme,
            page: css('body', 'backgroundColor'),
            button: css('.btn-primary', 'backgroundColor'),
            note: css('.hero-note', 'backgroundColor'),
            footer: css('.site-footer', 'backgroundColor'),
        };
    });
    const first = await read();
    await page.locator('#theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', first.theme === 'light' ? 'dark' : 'light');
    // Buttons ease from one theme's colour to the other; read them once they have settled.
    await page.waitForTimeout(400);
    const second = await read();
    const day = first.theme === 'light' ? first : second, night = first.theme === 'light' ? second : first;
    expect(day.theme).toBe('light');
    expect(night.theme).toBe('dark');
    // Day: the page is not white, the accent is a bright yellow, the note is a yellow sticky and the footer is ink.
    expect(day.page).toBe('rgb(228, 239, 225)');
    expect(day.button).toBe('rgb(255, 201, 51)');
    expect(day.note).toBe('rgb(255, 224, 102)');
    expect(day.footer).toBe('rgb(16, 38, 29)');
    // Night keeps the amber accent.
    expect(night.button).toBe('rgb(255, 180, 58)');
});

for (const width of [320, 390, 768]) {
    test(`light and dark themes fit a ${width}px canvas`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/');
        await page.getByRole('button', { name: 'Pause motion' }).click();
        for (let theme = 0; theme < 2; theme++) {
            for (const section of ['.hero', '#about', '#projects', '#stack', '#experience', '#goals', '#contact']) {
                await moveTo(page, section);
                expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            }
            await page.locator('#theme-toggle').click();
        }
        await expect(page.locator('#stack')).not.toContainText(/comfortable|learning|beginner/i);
        await expect(page.locator('#goals')).toContainText('NASA Space Apps Challenge');
        await expect(page.locator('#experience')).toContainText('Idea Battle');
        await expect(page.locator('#experience')).toContainText('Pizza Pitch');
    });
}

test('a phone gets a smaller team without labels and no sideways scrolling while it works', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.cursor')).toHaveCount(5);
    await expect(page.locator('.cursor-label')).toHaveCount(0);
    await expect.poll(() => stages(page, '.hero').then(list => list.every(stage => stage === 'done')), { timeout: 5000 }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await visibleContents(page, '.hero [data-build]');
});

test('the portfolio remains readable without JavaScript, the runtime, or the motion script', async ({ browser }) => {
    for (const mode of ['no-js', 'no-runtime', 'no-motion-script']) {
        const context = await browser.newContext({ javaScriptEnabled: mode !== 'no-js' });
        const page = await context.newPage();
        if (mode === 'no-runtime') await page.route('**/vendor/*.js', route => route.abort());
        if (mode === 'no-motion-script') await page.route('**/motion.js', route => route.abort());
        await page.goto('http://127.0.0.1:8879/');
        // If the motion script never starts, the page gives up waiting after three seconds.
        await expect(page.locator('.hero-title')).toBeVisible();
        await visibleContents(page, '.name-word', mode === 'no-motion-script' ? 6000 : 3000);
        for (const section of ['#about', '#projects', '#stack', '#experience', '#goals', '#contact']) {
            await moveTo(page, section);
            await visibleContents(page, `${section}, ${section} [data-build]`);
        }
        await context.close();
    }
});
