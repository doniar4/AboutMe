/* Decorative choreography only. HTML remains the source of truth and is readable
   without JS, with reduced motion, or if the animation runtime fails to load.

   The introduction starts from one dot, the full stop of the name: the cursor
   team pours out of it and assembles the hero in under two seconds. After that
   each block builds once, in real time, when it scrolls into view. Nothing is
   tied to scroll position, so text never waits for the reader to scroll. */
(() => {
    const root = document.documentElement;
    const button = document.getElementById('motion-toggle');
    if (!button || !window.gsap || !window.Swarm || !window.Construct) {
        root.dataset.motion = 'off';
        return;
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const C = Construct;
    let paused = false;
    try { paused = localStorage.getItem('motion') === 'paused'; } catch (_) {}

    let team = null;
    let blocks = [];
    let observer = null;
    let heroDone = false;
    let heroStarted = -1;
    let speed = 0;

    function stop() {
        observer?.disconnect();
        observer = null;
        blocks.forEach(C.finish);
        blocks = [];
        team?.destroy();
        team = null;
        heroStarted = -1;
        gsap.globalTimeline.timeScale(1);
    }

    function start() {
        window.motionStarted = true;
        stop();
        const enabled = !paused && !reduced.matches;
        root.dataset.motion = enabled ? 'on' : 'off';
        button.hidden = false;
        button.disabled = reduced.matches;
        button.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
        button.setAttribute('aria-pressed', String(!enabled));
        if (!enabled) return;
        try {
            const wide = innerWidth >= 768;
            team = Swarm.create({ size: wide ? 8 : 5, labels: wide });
            blocks = C.collect(document, team);
            const hero = document.querySelector('.hero');
            const skipHero = heroDone || Boolean(location.hash) || scrollY > 40;
            blocks.forEach(b => {
                b.hero = hero.contains(b.el);
                // Anything the reader has already scrolled past is simply there.
                const seen = b.hero ? skipHero : b.el.getBoundingClientRect().bottom < 0;
                C.stage(b, seen ? 'done' : 'pending');
            });
            if (skipHero) heroDone = true;
            else playHero();
            // Opened at a section link: everything above it is ready before the browser jumps there.
            if (location.hash) finishThrough(document.getElementById(location.hash.slice(1)), false);
            observe();
        } catch (error) {
            // Any partial initialization must fail open, never strand hidden content.
            stop();
            root.dataset.motion = 'off';
            button.hidden = true;
            console.error('Portfolio motion unavailable:', error);
        }
    }

    /* The hero. Order matters twice: it is the order cursors leave the dot and,
       on small screens with a smaller team, who gets a cursor at all. */
    const HERO_ORDER = ['.name-word', '.hero-note', '.terminal-line', '.hero-subtitle', '.hero-actions', '.hero-tile'];
    function playHero() {
        const dot = document.querySelector('.name-dot');
        const origin = C.point(dot, .5, .62);
        const rank = b => { const i = HERO_ORDER.findIndex(selector => b.el.matches(selector)); return i < 0 ? 99 : i; };
        const jobs = blocks.filter(b => b.hero).sort((a, b) => rank(a) - rank(b));
        const crew = team.cursors;
        const step = Math.PI * 2 / crew.length;
        heroStarted = gsap.ticker.time;
        gsap.fromTo(dot, { scale: 0 }, { scale: 1, duration: .5, ease: 'back.out(3.2)', clearProps: 'transform' });
        const start = i => .12 + i * .035;
        const runs = jobs.map((b, i) => new Promise(resolve => {
            team.later(start(i), () => {
                if (b.stage === 'done') { resolve(); return; }
                const cursor = i < crew.length ? team.take(crew[i]) : null;
                if (cursor) team.spawn(cursor, origin);
                // Two cursors stay in the hero afterwards, by the name and by the note. The rest leave quickly.
                const keep = b.el.matches('.hero-note') ? { stay: true }
                    : b.el.matches('.name-line:last-child .name-word') ? { stay: true, anchor: () => C.point(dot, 1, .5, 16, 6) }
                    : { linger: team.between(.25, .7) };
                C.run(b, { cursor, fan: -2.4 + i * step, keep, patience: .7 }).then(resolve);
            });
        }));
        // Spare cursors still leave the dot with the others, then wait for work.
        crew.slice(jobs.length).forEach((c, k) => team.later(start(jobs.length + k), () => {
            team.take(c);
            team.spawn(c, origin);
            const angle = -2.4 + (jobs.length + k) * step;
            c.fly({ x: origin.x + Math.cos(angle) * 150, y: origin.y + Math.sin(angle) * 110 }, { fan: angle })
                .then(() => team.release(c, { linger: .5 }));
        }));
        Promise.all(runs).then(() => {
            heroDone = true;
            gsap.globalTimeline.timeScale(1);
        });
    }

    /* When the contact section stands, everyone who is free walks over and waits
       beside its title: the team that built the page, next to "Start a conversation". */
    const SPOTS = [[0, -58], [96, -84], [190, -40], [-30, 14], [70, -8], [164, 36], [20, 84], [118, 96]];
    function gather() {
        const title = document.querySelector('.footer-title');
        if (!team || !title || innerWidth < 960) return;
        const crew = team;
        SPOTS.slice(0, crew.cursors.length).forEach(([dx, dy], i) => crew.later(.1 + i * .08, () => {
            const anchor = () => C.point(title, 1, .5, 120 + dx, dy);
            crew.acquire(anchor(), 1.6).then(c => {
                if (c) c.fly(anchor()).then(arrived => { if (arrived) crew.release(c, { stay: true, anchor }); });
            });
        }));
    }

    function observe() {
        const byElement = new Map(blocks.map((b, order) => { b.order = order; return [b.el, b]; }));
        observer = new IntersectionObserver(entries => {
            // Anything that jumped past above the screen without ever being seen is simply there.
            entries.forEach(entry => {
                const b = byElement.get(entry.target);
                if (b && !entry.isIntersecting && entry.boundingClientRect.bottom < 0 && b.stage === 'pending') {
                    observer.unobserve(b.el);
                    C.finish(b);
                }
            });
            const batch = entries.filter(entry => entry.isIntersecting).map(entry => byElement.get(entry.target))
                .filter(b => b && !b.started && b.stage === 'pending').sort((a, b) => a.order - b.order);
            // While the hero is still assembling, blocks below it wait their turn.
            const hold = heroStarted < 0 || heroDone ? 0 : Math.max(0, 1.1 - (gsap.ticker.time - heroStarted));
            batch.forEach((b, i) => {
                observer.unobserve(b.el);
                if (b.el.getBoundingClientRect().bottom < 0) { C.finish(b); return; }
                // A reader racing down the page gets the content at once, without the show.
                const unattended = Math.abs(speed) > 2800 && performance.now() - lastTime < 140;
                team.later(hold + i * .06, () => C.run(b, { unattended }));
            });
        }, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
        blocks.filter(b => !b.hero && b.stage === 'pending').forEach(b => observer.observe(b.el));
        const footer = blocks.filter(b => b.el.closest('.site-footer'));
        if (footer.some(b => b.stage === 'pending')) Promise.all(footer.map(C.whenDone)).then(gather);
    }

    // Finish every block above the target at once; with `inclusive`, the target's own blocks too.
    function finishThrough(target, inclusive) {
        if (!target || !blocks.length) return;
        blocks.forEach(b => {
            const holds = b.el.contains(target);
            const inside = target.contains(b.el);
            const before = !holds && Boolean(target.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_PRECEDING);
            if (before || (inclusive && (holds || inside))) C.finish(b);
        });
    }
    // A keyboard user always lands on fully visible content.
    document.addEventListener('focusin', event => finishThrough(event.target, true));
    // An anchor jump skips the show for everything above; the target builds on arrival.
    document.addEventListener('click', event => {
        const anchor = event.target.closest('a[href^="#"]');
        if (anchor) finishThrough(document.getElementById(anchor.getAttribute('href').slice(1)), false);
    });
    window.addEventListener('hashchange', () => finishThrough(document.getElementById(location.hash.slice(1)), false));

    let lastY = scrollY, lastTime = performance.now();
    window.addEventListener('scroll', () => {
        const now = performance.now();
        if (now > lastTime) speed = (scrollY - lastY) / (now - lastTime) * 1000;
        lastY = scrollY; lastTime = now;
        // Scrolling away during the introduction: the team hurries instead of holding the reader back.
        if (heroStarted >= 0 && !heroDone && scrollY > 80) gsap.globalTimeline.timeScale(2.4);
    }, { passive: true });

    button.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem('motion', paused ? 'paused' : 'on'); } catch (_) {}
        start();
    });
    reduced.addEventListener('change', start);
    start();
})();
