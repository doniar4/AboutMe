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

test('scroll builds the content, moves cursors, and remains readable at the page end', async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'on');
    await expect(page.locator('.build-cursor')).toHaveCount(20);
    await expect(page.locator('.cursor-label')).toHaveCount(0);
    await expect(page.locator('.note-headline .type-visual br')).toHaveCount(1);
    await expect(page.locator('.note-headline > .sr-only')).toHaveText('A little curiosity. A lot of building.');
    await visibleContents(page, '.hero-title .type-char, .hero-actions');
    const target = page.locator('#projects .project-entry').first();
    await moveTo(page, '#projects .project-entry', .80);
    await expect.poll(() => target.locator('.scene-cursor').evaluate(el => Number(getComputedStyle(el).opacity))).toBeGreaterThan(.5);
    const before = await target.locator('.scene-cursor').evaluate(el => getComputedStyle(el).transform);
    await moveTo(page, '#projects .project-entry', .63);
    await expect.poll(() => target.locator('.scene-cursor').evaluate(el => getComputedStyle(el).transform)).not.toBe(before);
    for (const selector of ['#about', '#projects', '#stack', '#experience', '#goals']) {
        await moveTo(page, selector, .05);
        await visibleContents(page, `${selector} h2 .type-char`);
    }
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await visibleContents(page, '.contact-profile');
    await expect(page.getByRole('link', { name: /Telegram @doniar4/ })).toHaveAttribute('href', 'https://t.me/doniar4');
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


test('a cursor grips the growing corner before typing, and reverse scroll unbuilds the panel', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.build-cursor')).toHaveCount(20);
    const target = page.locator('#projects .project-entry').nth(1);
    async function seek(progress) {
        await target.evaluate((el, progress) => {
            const trigger = ScrollTrigger.getAll().find(t => t.vars.endTrigger === el);
            window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * progress, behavior: 'instant' });
        }, progress);
    }
    const drawnWidth = () => target.evaluate(el => el.querySelector('.assembly-outline').getBoundingClientRect().width / el.clientWidth);
    const typedCount = () => target.locator('.type-char').evaluateAll(chars => chars.filter(el => Number(getComputedStyle(el).opacity) > .9).length);
    await seek(.2);
    await expect.poll(drawnWidth).toBeGreaterThan(.08);
    await expect.poll(drawnWidth).toBeLessThan(.8);
    await expect.poll(typedCount).toBe(0);
    await expect.poll(() => target.evaluate(el => {
        const box = el.querySelector('.assembly-outline').getBoundingClientRect();
        const cursor = el.querySelector('.build-cursor').getBoundingClientRect();
        return Math.min(...[box.left, box.right].flatMap(x => [box.top, box.bottom].map(y => Math.hypot(x - cursor.left, y - cursor.top))));
    })).toBeLessThan(4);
    await seek(.85);
    await expect.poll(drawnWidth).toBeGreaterThan(.99);
    await expect.poll(typedCount).toBeGreaterThan(10);
    expect(await typedCount()).toBeLessThan(await target.locator('.type-char').count());
    await seek(.2);
    await expect.poll(typedCount).toBe(0);
    await page.getByRole('button', { name: 'Pause motion' }).click();
    await visibleContents(page, '.type-char');
});
