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
        localStorage.setItem('theme', theme);
    }

    button.setAttribute('aria-pressed', String(currentTheme() === 'light'));

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
    const enabled = () => finePointer.matches && !reducedMotion.matches;

    function hide() {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        glow.classList.remove('is-active');
    }

    function paint() {
        frame = 0;
        if (!enabled() || document.hidden) return;
        glow.style.setProperty('--pointer-x', `${x}px`);
        glow.style.setProperty('--pointer-y', `${y}px`);
        glow.classList.add('is-active');
    }

    document.addEventListener('pointermove', event => {
        if (!enabled() || event.pointerType === 'touch') return;
        x = event.clientX;
        y = event.clientY;
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

// ---------- Typing effect in the hero terminal line ----------
(function typeCommand() {
    const target = document.getElementById('typed-command');
    if (!target) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const command = 'cat now.md';

    if (prefersReducedMotion) {
        target.textContent = command;
        return;
    }

    let i = 0;
    function step() {
        if (i <= command.length) {
            target.textContent = command.slice(0, i);
            i++;
            setTimeout(step, 110);
        }
    }
    step();
})();

// ---------- Reveal sections on scroll ----------
(function revealOnScroll() {
    const sections = document.querySelectorAll('.section');
    if (!sections.length) return;

    if (!('IntersectionObserver' in window)) {
        sections.forEach((section) => section.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    sections.forEach((section) => observer.observe(section));
})();