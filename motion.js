/* Decorative choreography only. HTML remains the source of truth and is readable
   without JS, with reduced motion, or if the animation runtime fails to load. */
(() => {
    const button = document.getElementById('motion-toggle');
    if (!window.gsap || !window.ScrollTrigger || !window.Swarm || !window.Construct || !window.PortfolioAssembly) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = false;
    try { paused = localStorage.getItem('motion') === 'paused'; } catch (_) {}
    let context;
    let intro;
    const sceneTimelines = [];

    const measurements = [];
    const stages = [];

    /* The introduction: one origin between the name and the note card. Eighteen
       cursors burst out of it at once, each with its own job, and fly home when
       the hero is assembled. */
    function heroSequence() {
        const inner = document.querySelector('.hero-inner');
        const stage = Swarm.stage(inner, { seed: 4093 });
        stages.push(stage);
        measurements.push(stage.measure);
        const wide = () => innerWidth > 767;
        stage.setOrigin(() => {
            const r = stage.rect(inner);
            return wide() ? { x: r.w * .615, y: r.h * .5 } : { x: r.w * .5, y: r.h * .4 };
        });
        const C = Construct;
        const terminal = C.prepare(document.querySelector('.terminal-line'), { self: true, mode: 'bare' });
        const name = C.prepare(document.querySelector('.name-frame'), { mode: 'outline', texts: '[data-type]' });
        const subtitle = C.prepare(document.querySelector('.hero-subtitle'), { self: true, mode: 'bare' });
        const actions = C.prepare(document.querySelector('.hero-actions'), { mode: 'bare', texts: '.no-typing', chips: '.btn' });
        const note = C.prepare(document.querySelector('.hero-note'), {
            texts: '.note-tab, .note-headline, .note-code span, .note-code strong, .note-signature',
        });

        const t = .25;
        [terminal, subtitle, actions].forEach(part => C.reveal(stage, part, t));
        C.write(stage, terminal.texts, t, { typists: 1, perChar: .03, fresh: true });
        const framed = C.frame(stage, name, t + .04, { fill: false, fresh: true });
        C.reveal(stage, name, framed.built - .1);
        // The large name is typed by two cursors, one per line.
        const named = C.write(stage, name.texts, framed.built - .1, { typists: 2, perChar: .085, fresh: true });
        C.fold(stage, name, named + .1);
        const noted = C.frame(stage, note, t + .1, { fresh: true });
        C.reveal(stage, note, noted.built);
        C.write(stage, note.texts, noted.built + .02, { typists: 3, perChar: .026, fresh: true });
        const subtitled = C.write(stage, subtitle.texts, t + .5, { typists: 2, perChar: .021, fresh: true });
        actions.chips.forEach((chip, i) => C.stamp(stage, chip, Math.min(subtitled, 1.5) + i * .16, { fresh: true }));

        stage.finish();
        intro = stage.timeline;
        intro.timeScale(1.2).play();
        if (location.hash || window.scrollY > 20) intro.progress(1);
    }

    function start() {
        context?.revert();
        stages.forEach(stage => stage.destroy());
        stages.length = 0;
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
