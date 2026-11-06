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
    function buildScenes() { /* Section choreography is registered below. */ }

    button.addEventListener('click', () => {
        paused = !paused;
        try { localStorage.setItem('motion', paused ? 'paused' : 'on'); } catch (_) {}
        start();
    });
    reduced.addEventListener('change', start);
    start();
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
})();
