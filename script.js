// ---------- Theme toggle (light / dark) ----------
(function themeToggle() {
    const button = document.getElementById('theme-toggle');
    if (!button) return;

    // data-theme is already set by the inline script in <head>,
    // this just keeps the button and future clicks in sync.
    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        button.setAttribute('aria-pressed', String(theme === 'light'));
        button.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
        // Storage can be unavailable in private or embedded browsing contexts.
        try { localStorage.setItem('theme', theme); } catch (_) {}
    }

    button.setAttribute('aria-pressed', String(currentTheme() === 'light'));
    button.setAttribute('aria-label', currentTheme() === 'light' ? 'Switch to dark theme' : 'Switch to light theme');

    button.addEventListener('click', () => {
        applyTheme(currentTheme() === 'light' ? 'dark' : 'light');
    });
})();

// ---------- One pointer light for the entire page ----------
(function pageSpotlight() {
    const glow = document.querySelector('.pointer-glow');
    if (!glow) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let x = 0;
    let y = 0;
    let lightX = 0;
    let lightY = 0;
    let initialized = false;
    const enabled = () => finePointer.matches && !reducedMotion.matches && document.documentElement.dataset.motion !== 'off';

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
        x = event.clientX;
        y = event.clientY;
        if (!initialized) { lightX = x; lightY = y; initialized = true; }
        // Coalesce multiple pointer events into a single update per frame.
        if (!frame) frame = requestAnimationFrame(paint);
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) hide();
    });
    finePointer.addEventListener('change', hide);
    reducedMotion.addEventListener('change', hide);
})();

