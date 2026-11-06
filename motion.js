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

    const splitText = PortfolioAssembly.split;
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
    function cursorFor(host, label) {
        let cursor = host.querySelector(':scope > .scene-cursor');
        if (!cursor) {
            cursor = document.createElement('span');
            cursor.className = 'build-cursor scene-cursor';
            cursor.setAttribute('aria-hidden', 'true');
            const arrow = document.createElement('span');
            arrow.className = 'cursor-arrow';
            cursor.append(arrow);
            host.append(cursor);
        }
        return cursor;
    }

    function buildScenes() {
        document.querySelectorAll('.section-inner, .footer-inner').forEach(host => {
            const heading = host.querySelector('h2');
            splitText(heading);
            const cursor = cursorFor(host, 'type');
            const chars = heading.querySelectorAll('.type-char');
            const line = gsap.timeline({ scrollTrigger: {
                trigger: heading, start: 'top 90%', end: 'top 62%', scrub: .25,
                invalidateOnRefresh: true
            }});
            line.fromTo(cursor, { x: -24, y: () => heading.offsetTop - 30, opacity: 0 },
                { x: 0, y: () => heading.offsetTop, opacity: 1, duration: .15 })
                .fromTo(chars, { opacity: 0 }, { opacity: 1, duration: .01, stagger: .012, ease: 'none' }, .12)
                .to(cursor, { x: () => Math.min(heading.scrollWidth * .8, host.clientWidth - 85), y: () => heading.offsetTop + heading.offsetHeight, duration: .6, ease: 'none' }, .12)
                .to(cursor, { opacity: 0, duration: .15 });
            sceneTimelines.push({ host, line });
        });
        document.querySelectorAll('[data-assemble]').forEach((piece, index) => {
            const cursor = cursorFor(piece, piece.dataset.assemble);
            // Animate the surface and its contents independently: first place, then fill.
            const content = [...piece.children].filter(child => child !== cursor);
            const line = gsap.timeline({ scrollTrigger: {
                trigger: piece, start: 'top 94%', end: 'top 57%', scrub: .35,
                invalidateOnRefresh: true
            }});
            line.fromTo(piece, { opacity: 0, y: 34, rotation: index % 2 ? 1.2 : -1.2 },
                { opacity: 1, y: 0, rotation: 0, duration: .5, ease: 'power2.out' }, 0)
                .fromTo(cursor, { x: -10, y: -15, opacity: 0 },
                    { x: 10, y: 10, opacity: 1, duration: .15 }, 0)
                .fromTo(content, { opacity: 0, y: 10 },
                    { opacity: 1, y: 0, duration: .3, stagger: .055, ease: 'power2.out' }, .2)
                .to(cursor, { x: () => Math.max(24, piece.clientWidth - 85), y: () => Math.min(piece.clientHeight - 30, 170), duration: .65, ease: 'power1.inOut' }, .1)
                .to(cursor, { opacity: 0, duration: .2 }, .8);
            sceneTimelines.push({ host: piece, line });
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
