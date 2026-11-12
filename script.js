/* Small page behaviours that do not need the animation runtime. Each one is
   optional: without this file the page is still complete and readable. */
(() => {
const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
const calm = () => reducedMotion.matches || root.dataset.motion === 'off';

// ---------- Theme toggle (light / dark) ----------
(function themeToggle() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    // data-theme is already set by the inline script in <head>.
    const current = () => root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

    function sync() {
        button.setAttribute('aria-pressed', String(current() === 'light'));
        button.setAttribute('aria-label', current() === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
    }
    function apply(theme) {
        root.setAttribute('data-theme', theme);
        sync();
        // Storage can be unavailable in private or embedded browsing contexts.
        try { localStorage.setItem('theme', theme); } catch (_) {}
    }
    sync();

    button.addEventListener('click', () => {
        const next = current() === 'light' ? 'dark' : 'light';
        if (!document.startViewTransition || calm()) { apply(next); return; }
        // The new theme opens as a circle from the button that was pressed.
        const box = button.getBoundingClientRect();
        const x = box.left + box.width / 2, y = box.top + box.height / 2;
        const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
        document.startViewTransition(() => apply(next)).ready.then(() => {
            root.animate(
                { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
                { duration: 560, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)' },
            );
        }).catch(() => {});
    });
})();

// ---------- One pointer light for the entire page ----------
(function pageSpotlight() {
    const glow = document.querySelector('.pointer-glow');
    if (!glow) return;
    let frame = 0, x = 0, y = 0, lightX = 0, lightY = 0, initialized = false;
    const enabled = () => finePointer.matches && !calm();

    function hide() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        glow.classList.remove('is-active');
        initialized = false;
    }
    function paint() {
        frame = 0;
        if (!enabled() || document.hidden) return;
        lightX += (x - lightX) * .16;
        lightY += (y - lightY) * .16;
        glow.style.setProperty('--pointer-x', `${lightX}px`);
        glow.style.setProperty('--pointer-y', `${lightY}px`);
        glow.classList.add('is-active');
        if (Math.abs(x - lightX) + Math.abs(y - lightY) > .2) frame = requestAnimationFrame(paint);
    }
    document.addEventListener('pointermove', event => {
        if (!enabled() || event.pointerType === 'touch') return;
        x = event.clientX; y = event.clientY;
        if (!initialized) { lightX = x; lightY = y; initialized = true; }
        // Coalesce multiple pointer events into a single update per frame.
        if (!frame) frame = requestAnimationFrame(paint);
    }, { passive: true });
    root.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); });
    finePointer.addEventListener('change', hide);
    reducedMotion.addEventListener('change', hide);
})();

// ---------- Header: which file is open, and how far down the page ----------
(function header() {
    const header = document.querySelector('.site-header');
    const links = new Map([...document.querySelectorAll('.main-nav a[href^="#"]')]
        .map(link => [link.getAttribute('href').slice(1), link]));
    if (!header || !('IntersectionObserver' in window)) return;

    // The section crossing the middle of the screen is the open one.
    const spy = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const link = links.get(entry.target.id);
            if (!link) return;
            if (entry.isIntersecting) {
                links.forEach(other => other.removeAttribute('aria-current'));
                link.setAttribute('aria-current', 'true');
            } else if (link.getAttribute('aria-current')) {
                link.removeAttribute('aria-current');
            }
        });
    }, { rootMargin: '-45% 0px -54% 0px' });
    links.forEach((_, id) => { const section = document.getElementById(id); if (section) spy.observe(section); });

    const rails = [...document.querySelectorAll('[data-rail]')];
    let frame = 0;
    function measure() {
        frame = 0;
        const max = root.scrollHeight - innerHeight;
        header.style.setProperty('--progress', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : '0');
        // A rail fills as its list passes the lower third of the screen.
        rails.forEach(rail => {
            const box = rail.getBoundingClientRect();
            const filled = (innerHeight * .68 - box.top) / Math.max(1, box.height);
            rail.style.setProperty('--rail', Math.min(1, Math.max(0, filled)).toFixed(4));
        });
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    measure();
})();

// ---------- Cards: a light under the pointer ----------
document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const card = event.target.closest?.('.spot');
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--sx', `${(event.clientX - box.left).toFixed(0)}px`);
    card.style.setProperty('--sy', `${(event.clientY - box.top).toFixed(0)}px`);
}, { passive: true });

// ---------- Hero: the tiles drift a little with the pointer ----------
(function heroParallax() {
    const hero = document.querySelector('.hero');
    const board = document.querySelector('.hero-board');
    if (!hero || !board) return;
    let frame = 0, targetX = 0, targetY = 0, x = 0, y = 0;
    function paint() {
        frame = 0;
        x += (targetX - x) * .08;
        y += (targetY - y) * .08;
        board.style.setProperty('--mx', x.toFixed(3));
        board.style.setProperty('--my', y.toFixed(3));
        if (Math.abs(targetX - x) + Math.abs(targetY - y) > .002) frame = requestAnimationFrame(paint);
    }
    function aim(nextX, nextY) {
        targetX = nextX; targetY = nextY;
        if (!frame) frame = requestAnimationFrame(paint);
    }
    hero.addEventListener('pointermove', event => {
        if (event.pointerType === 'touch' || !finePointer.matches || calm()) return;
        const box = hero.getBoundingClientRect();
        aim((event.clientX - box.left) / box.width * 2 - 1, (event.clientY - box.top) / box.height * 2 - 1);
    }, { passive: true });
    hero.addEventListener('pointerleave', () => aim(0, 0));
})();

// ---------- Numbers count up once their panel has been built ----------
document.addEventListener('built', event => {
    if (calm()) return;
    event.target.querySelectorAll?.('[data-count]').forEach(el => {
        const goal = Number(el.dataset.count);
        const decimals = (el.dataset.count.split('.')[1] || '').length;
        const started = performance.now();
        const step = now => {
            const p = Math.min(1, (now - started) / 650);
            el.textContent = (goal * (1 - Math.pow(1 - p, 3))).toFixed(decimals);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
});
})();
