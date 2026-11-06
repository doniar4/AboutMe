/* Decorative choreography only. HTML remains the source of truth and is readable
   without JS, with reduced motion, or if the animation runtime fails to load. */
(() => {
    const button = document.getElementById('motion-toggle');
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let paused = false;
    try { paused = localStorage.getItem('motion') === 'paused'; } catch (_) {}
    let context;
    let intro;
    const sceneTimelines = [];

    function splitText(element) {
        if (element.querySelector('.type-visual')) return;
        const text = element.textContent;
        const accessible = document.createElement('span');
        accessible.className = 'sr-only';
        accessible.textContent = text;
        const visual = document.createElement('span');
        visual.className = 'type-visual';
        visual.setAttribute('aria-hidden', 'true');
        text.split(/(\s+)/).forEach(word => {
            if (/^\s+$/.test(word)) { visual.append(document.createTextNode(word)); return; }
            const group = document.createElement('span');
            group.className = 'type-word';
            Array.from(word).forEach(char => {
                const span = document.createElement('span');
                span.className = char === '.' ? 'type-char name-dot' : 'type-char';
                span.textContent = char;
                group.append(span);
            });
            visual.append(group);
        });
        element.replaceChildren(accessible, visual);
    }
    document.querySelectorAll('[data-type]').forEach(splitText);

    function heroSequence() {
        const host = document.querySelector('.hero-inner');
        const name = document.querySelector('.name-frame');
        const note = document.querySelector('.hero-note');
        const author = host.querySelector('.cursor-author');
        const layout = host.querySelector('.cursor-layout');
        const chars = name.querySelectorAll('.type-char');
        const origin = () => ({ x: name.offsetLeft - 24, y: name.offsetTop - 14 });
        gsap.set([author, layout], { opacity: 0 });
        gsap.set(chars, { opacity: 0 });
        gsap.set(['.hero-subtitle', '.hero-actions', '.terminal-line', '.hero-note', '.selection-label'], { opacity: 0 });
        gsap.set('.selection-box', { scaleX: 0, scaleY: .1, transformOrigin: 'top left' });
        intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
        intro.fromTo(author, { x: -100, y: -120 }, { x: () => origin().x, y: () => origin().y, opacity: 1, duration: .55 }, .12)
            .to('.selection-box', { scaleX: 1, scaleY: 1, duration: .5 }, .45)
            .to('.selection-label', { opacity: 1, duration: .15 }, .5)
            .to(author, { x: () => origin().x + name.offsetWidth + 48, y: () => origin().y + name.offsetHeight + 28, duration: .6 }, .45)
            .to(chars, { opacity: 1, stagger: .045, duration: .05 }, .6)
            .to('.terminal-line', { opacity: 1, duration: .4 }, .75)
            .fromTo(layout, { x: () => host.clientWidth + 60, y: -100 }, { x: () => note.offsetLeft + 24, y: () => note.offsetTop + 20, opacity: 1, duration: .55 }, .65)
            .fromTo(note, { y: 40, rotation: 10 }, { y: 0, rotation: 3, opacity: 1, duration: .65 }, .95)
            .to(layout, { x: () => note.offsetLeft + note.offsetWidth - 20, y: () => note.offsetTop + note.offsetHeight - 20, duration: .55 }, 1)
            .fromTo('.hero-subtitle, .hero-actions', { y: 12 }, { y: 0, opacity: 1, stagger: .1, duration: .45 }, 1.05)
            .to(author, { x: () => name.offsetWidth + 10, y: () => name.offsetTop + name.offsetHeight + 20, duration: .4 }, 1.1)
            .to([author, layout], { opacity: 0, duration: .35 }, 2.4);
        // A direct link or restored scroll position should never replay the opening.
        if (location.hash || window.scrollY > 20) intro.progress(1);
    }

    function start() {
        context?.revert();
        sceneTimelines.length = 0;
        const enabled = !paused && !reduced.matches;
        document.documentElement.dataset.motion = enabled ? 'on' : 'off';
        button.hidden = false;
        button.disabled = reduced.matches;
        button.textContent = reduced.matches ? 'Reduced motion' : paused ? 'Play motion' : 'Pause motion';
        button.setAttribute('aria-pressed', String(!enabled));
        if (!enabled) return;
        context = gsap.context(() => {
            heroSequence();
            buildScenes();
        });
        ScrollTrigger.refresh();
    }
    function cursorFor(host, label) {
        let cursor = host.querySelector(':scope > .scene-cursor');
        if (!cursor) {
            cursor = document.createElement('span');
            cursor.className = 'build-cursor scene-cursor';
            cursor.setAttribute('aria-hidden', 'true');
            const arrow = document.createElement('span');
            arrow.className = 'cursor-arrow';
            const name = document.createElement('span');
            name.className = 'cursor-label';
            name.textContent = label;
            cursor.append(arrow, name);
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

    button.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem('motion', paused ? 'paused' : 'on'); } catch (_) {}
        start();
    });
    reduced.addEventListener('change', start);
    start();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
