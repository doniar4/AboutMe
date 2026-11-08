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
async function visibleContents(page, selector) {
    await expect.poll(() => page.locator(selector).evaluateAll(elements => elements.length > 0 && elements.every(el => {
        // Check every ancestor as well: a visible child can be inside a transparent surface.
        for (let node = el; node && node !== document.body; node = node.parentElement) {
            if (Number(getComputedStyle(node).opacity) < .99) return false;
        }
        return true;
    }))).toBe(true);
}

// Seek a section scene directly; ScrollTrigger only drives it on scroll.
async function seekScene(page, selector, progress) {
    return page.evaluate(([selector, progress]) => {
        const inner = document.querySelector(selector).querySelector('.section-inner, .footer-inner');
        const trigger = ScrollTrigger.getAll().find(t => t.trigger === inner);
        trigger.animation.progress(progress);
        return trigger.animation.duration();
    }, [selector, progress]);
}
const visibleCursors = (page, scope) => page.locator(`${scope} .swarm-cursor`).evaluateAll(list =>
    list.filter(el => Number(getComputedStyle(el).opacity) > .5).length);

test('the introduction bursts from one origin and every cursor flies home', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    await expect(page.locator('.hero .swarm-hub')).toHaveCount(1);
    expect(await page.locator('.hero .swarm-cursor').count()).toBeGreaterThanOrEqual(15);
    // Many cursors are out at once, and the origin counts them.
    await expect.poll(() => visibleCursors(page, '.hero'), { timeout: 3000 }).toBeGreaterThanOrEqual(10);
    await expect.poll(() => page.locator('.hero .swarm-hub-count').textContent().then(t => Number(t.slice(1))))
        .toBeGreaterThanOrEqual(10);
    await expect(page.locator('.hero .swarm-cursor .swarm-tag[data-role="frame"]').first()).toBeAttached();
    await expect(page.locator('.note-headline > .sr-only')).toHaveText('A little curiosity. A lot of building.');
    await expect(page.locator('.terminal-line .prompt .type-char')).toHaveCount(7);
    await visibleContents(page, '.hero-title .type-char, .hero-actions .btn, .note-signature .type-char');
    await expect.poll(() => visibleCursors(page, '.hero'), { timeout: 8000 }).toBe(0);
    await expect(page.locator('.hero .swarm-hub-count')).toHaveClass(/is-empty/);
    expect(errors).toEqual([]);
});

test('a crew of cursors frames, fills and types a panel, and reverse scrolling unbuilds it', async ({ page }) => {
    await page.goto('/');
    const panel = page.locator('#projects .project-entry').first();
    const typed = () => panel.locator('.type-char').evaluateAll(chars => chars.filter(el => Number(getComputedStyle(el).opacity) > .9).length);
    const total = await panel.locator('.type-char').count();
    // Find a moment when the frame is half drawn: every growing edge has a cursor at its tip.
    const drawing = await page.evaluate(() => {
        const inner = document.querySelector('#projects .section-inner');
        const line = ScrollTrigger.getAll().find(t => t.trigger === inner).animation;
        const host = inner.querySelector('.project-entry');
        const cursors = [...inner.querySelectorAll('.swarm-cursor')];
        for (let p = 0; p < .6; p += .004) {
            line.progress(p);
            const growing = [...host.querySelectorAll('.assembly-frame b')].filter(edge => {
                const m = new DOMMatrix(getComputedStyle(edge).transform);
                const scale = Math.max(Math.min(m.a, 1), 0) * Math.max(Math.min(m.d, 1), 0);
                return scale > .25 && scale < .75 && Number(getComputedStyle(edge).opacity) > .9;
            });
            if (growing.length < 2) continue;
            const tips = cursors.filter(c => Number(getComputedStyle(c).opacity) > .5).map(c => {
                const [x, y] = c.style.translate.split(' ').map(parseFloat);
                const base = c.parentElement.getBoundingClientRect();
                return { x: base.left + x, y: base.top + y };
            });
            const attached = growing.every(edge => {
                const r = edge.getBoundingClientRect();
                const ends = [[r.left, r.top], [r.right, r.bottom], [r.left, r.bottom], [r.right, r.top]];
                return tips.some(t => ends.some(([x, y]) => Math.hypot(x - t.x, y - t.y) < 6));
            });
            return { progress: p, edges: growing.length, attached, cursors: tips.length };
        }
        return null;
    });
    expect(drawing).not.toBeNull();
    expect(drawing.attached).toBe(true);
    expect(drawing.cursors).toBeGreaterThanOrEqual(4);
    expect(await typed()).toBe(0);
    await seekScene(page, '#projects', 1);
    await expect.poll(typed).toBe(total);
    await visibleContents(page, '#projects .project-status, #projects .text-link, #projects h2 .type-char');
    expect(await visibleCursors(page, '#projects')).toBe(0);
    await seekScene(page, '#projects', 0);
    await expect.poll(typed).toBe(0);
    await page.getByRole('button', { name: 'Pause motion' }).click();
    await visibleContents(page, '.type-char');
});

test('scrolling builds every section and the page end is readable', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('.swarm-hub')).toHaveCount(7);
    const target = page.locator('#projects .project-entry').first();
    await moveTo(page, '#projects .project-entry', .7);
    await expect.poll(() => visibleCursors(page, '#projects')).toBeGreaterThan(1);
    for (const selector of ['#about', '#projects', '#stack', '#experience', '#goals']) {
        const inner = page.locator(`${selector} .section-inner`);
        await inner.evaluate(el => {
            const t = ScrollTrigger.getAll().find(t => t.trigger === el);
            window.scrollTo({ top: t.end + 2, behavior: 'instant' });
        });
        await visibleContents(page, `${selector} h2 .type-char, ${selector} [data-assemble]`);
    }
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await visibleContents(page, '.contact-profile');
    await expect(page.getByRole('link', { name: /Telegram @doniar4/ })).toHaveAttribute('href', 'https://t.me/doniar4');
    await expect(target.locator('.swarm-marquee')).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('a width change rebuilds the scenes without errors or hidden content', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await page.setViewportSize({ width: 820, height: 900 });
    await page.waitForTimeout(700);
    await expect(page.locator('.swarm-layer')).toHaveCount(7);
    await expect(page.locator('.hero .swarm-hub')).toHaveCount(1);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await visibleContents(page, '.contact-profile, .footer-title .type-char');
    expect(errors).toEqual([]);
});

test('motion controls reveal all content and survive reload and OS preference changes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Pause motion' }).click();
    await visibleContents(page, '.type-char, [data-assemble]');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play motion' })).toBeVisible();
    await page.getByRole('button', { name: 'Play motion' }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.getByRole('button', { name: 'Reduced motion' })).toBeDisabled();
    await visibleContents(page, '.type-char, [data-assemble]');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.getByRole('button', { name: 'Pause motion' })).toBeVisible();
});

test('anchor navigation and keyboard focus never land on transparent links', async ({ page }) => {
    await page.goto('/#stack');
    await visibleContents(page, '#stack .type-char, #stack [data-assemble]');
    await page.getByRole('link', { name: 'contact.sh' }).click();
    await visibleContents(page, '.contact-profile, .footer-title .type-char');
    await page.goto('/');
    await page.locator('.project-entry .text-link').focus();
    await visibleContents(page, '.project-entry .text-link');
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

test('the portfolio remains readable without JavaScript or with a missing animation runtime', async ({ browser }) => {
    for (const javaScriptEnabled of [false, true]) {
        const context = await browser.newContext({ javaScriptEnabled });
        const page = await context.newPage();
        if (javaScriptEnabled) await page.route('**/vendor/*.js', route => route.abort());
        await page.goto('http://127.0.0.1:8879/');
        await expect(page.locator('.hero-title')).toBeVisible();
        for (const section of ['#about', '#projects', '#stack', '#experience', '#goals', '#contact']) {
            await moveTo(page, section);
            await visibleContents(page, section);
        }
        await context.close();
    }
});
