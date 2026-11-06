const { test, expect } = require('@playwright/test');

async function moveTo(page, selector, viewportFraction = .35) {
    await page.locator(selector).first().evaluate((el, fraction) => {
        window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - innerHeight * fraction, behavior: 'instant' });
    }, viewportFraction);
}
async function visibleContents(page, selector) {
    await expect.poll(() => page.locator(selector).evaluateAll(elements => elements.every(el => {
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
