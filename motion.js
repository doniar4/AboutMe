/* Decorative choreography only. HTML remains the source of truth and is readable
   without JS, with reduced motion, or if the animation runtime fails to load. */
(() => {
    const button = document.getElementById('motion-toggle');
    if (!window.gsap || !window.ScrollTrigger || !window.PortfolioAssembly) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = false;
    try { paused = localStorage.getItem('motion') === 'paused'; } catch (_) {}
    let context;
    let intro;
    const sceneTimelines = [];

    const measurements = [];

    function heroSequence() {
        intro = gsap.timeline();
        const jobs = [
            ['.name-frame', { corner: 0, textSelector: '[data-type]', typeDuration: .7 }, 0],
            ['.hero-note', { corner: 1, textSelector: '.note-tab, .note-headline, .note-code span, .note-code strong, .note-signature', typeDuration: 1 }, .2],
            ['.hero-subtitle', { corner: 2, selfText: true, typeDuration: .8 }, .45],
            ['.hero-actions', { corner: 3, textSelector: '.no-typing', typeDuration: 0 }, .7],
        ];
        jobs.forEach(([selector, options, at]) => {
            const job = PortfolioAssembly.create(document.querySelector(selector), options);
            measurements.push(job.measure);
            intro.add(job.line.play(), at);
        });
        intro.fromTo('.terminal-line', { opacity: 0 }, { opacity: 1, duration: .25 }, .1);
        if (location.hash || window.scrollY > 20) intro.progress(1);
    }

    function start() {
        context?.revert();
        sceneTimelines.length = 0;
        measurements.length = 0;
        const enabled = !paused && !reduced.matches;
        document.documentElement.dataset.motion = enabled ? 'on' : 'off';
        button.hidden = false;
        button.disabled = reduced.matches;
        button.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
        button.setAttribute('aria-pressed', String(!enabled));
        if (!enabled) return;
        context = gsap.context(() => {});
        try {
            context.add(() => {
                heroSequence();
                buildScenes();
            });
            ScrollTrigger.refresh();
            if (location.hash) finishTarget(document.getElementById(location.hash.slice(1)));
        } catch (error) {
            // Any partial initialization must fail open, never strand hidden content.
            context.revert();
            document.documentElement.dataset.motion = 'off';
            button.hidden = true;
            console.error('Portfolio motion unavailable:', error);
        }
    }
    function buildScenes() {
        const headed = new Set();
        document.querySelectorAll('[data-assemble]').forEach((piece, index) => {
            const section = piece.closest('.section-inner, .footer-inner');
            const heading = headed.has(section) ? null : section.querySelector('h2');
            headed.add(section);
            const job = PortfolioAssembly.create(piece, { corner: index % 4, heading });
            measurements.push(job.measure);
            ScrollTrigger.create({
                animation: job.line,
                trigger: heading || piece,
                endTrigger: piece,
                start: 'top 92%',
                end: 'clamp(top 38%)',
                scrub: .2,
                invalidateOnRefresh: true,
            });
            // The first cursor writes the section heading, then builds its panel.
            sceneTimelines.push({ host: heading ? section : piece, line: job.line });
        });
    }

    function finishTarget(target) {
        if (!target) return;
        intro?.progress(1);
        sceneTimelines.forEach(({ host, line }) => {
            if (host.contains(target) || target.contains(host)) {
                line.progress(1);
                line.scrollTrigger?.kill(false);
            }
        });
    }
    // A keyboard user or an anchor jump always gets fully readable content.
    document.addEventListener('focusin', event => finishTarget(event.target));
    document.addEventListener('click', event => {
        const anchor = event.target.closest('a[href^="#"]');
        if (anchor) finishTarget(document.getElementById(anchor.getAttribute('href').slice(1)));
    });
    window.addEventListener('hashchange', () => finishTarget(document.getElementById(location.hash.slice(1))));
    document.addEventListener('visibilitychange', () => {
        if (intro && intro.progress() < 1) intro.paused(document.hidden);
    });

    button.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem('motion', paused ? 'paused' : 'on'); } catch (_) {}
        start();
    });
    reduced.addEventListener('change', start);
    ScrollTrigger.addEventListener('refreshInit', () => measurements.forEach(measure => measure()));
    start();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
