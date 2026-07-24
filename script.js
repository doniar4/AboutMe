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

// ---------- Cursor spotlight in the hero ----------
(function heroSpotlight() {
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || prefersReducedMotion) return;

    hero.addEventListener('pointermove', (event) => {
        const rect = hero.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 100;
        const y = ((event.clientY - rect.top) / rect.height) * 100;
        hero.style.setProperty('--mx', `${x}%`);
        hero.style.setProperty('--my', `${y}%`);
    });
})();

// ---------- Typing effect in the hero terminal line ----------
(function typeCommand() {
    const target = document.getElementById('typed-command');
    if (!target) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const command = 'whoami';

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

alert('Good luck, vro. Keep learning web!');