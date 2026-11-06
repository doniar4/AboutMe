/* A cursor edits a stationary surface: select, drag a corner, release, then type.
   Geometry is sampled at refresh, not on every animation frame. */
window.PortfolioAssembly = (() => {
    function split(element) {
        if (element.querySelector('.type-visual')) return;
        const copy = element.cloneNode(true);
        copy.querySelectorAll('br').forEach(br => br.replaceWith(document.createTextNode('\u0000')));
        const text = copy.textContent;
        copy.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
        const accessible = document.createElement('span');
        accessible.className = 'sr-only'; accessible.textContent = copy.textContent.replaceAll('\u0000', ' ');
        const visual = document.createElement('span');
        visual.className = 'type-visual'; visual.setAttribute('aria-hidden', 'true');
        text.split(/(\s+|\u0000)/).forEach(word => {
            if (word === '\u0000') { visual.append(document.createElement('br')); return; }
            if (/^\s+$/.test(word)) { visual.append(document.createTextNode(word)); return; }
            const group = document.createElement('span'); group.className = 'type-word';
            Array.from(word).forEach(char => {
                const span = document.createElement('span');
                span.className = 'type-char';
                if (char === '.' && element.closest('.hero-title')) span.classList.add('name-dot');
                span.textContent = char; group.append(span);
            });
            visual.append(group);
        });
        element.replaceChildren(accessible, visual);
    }

    function decoration(host, className) {
        let el = host.querySelector(`:scope > .${className.split(' ')[0]}`);
        if (!el) {
            el = document.createElement('span'); el.className = className;
            el.setAttribute('aria-hidden', 'true'); host.append(el);
        }
        return el;
    }

    function create(host, { corner = 0, heading = null, textSelector = 'h3, p, dt, dd, .stack-list li, .contact-platform, .contact-handle', selfText = false, typeDuration = 1.3 } = {}) {
        if (selfText) split(host);
        else host.querySelectorAll(textSelector).forEach(split);
        if (heading) split(heading);
        host.classList.add('assembly-host');
        const surface = decoration(host, 'assembly-surface');
        const outline = decoration(host, 'assembly-outline');
        if (!outline.children.length) {
            for (let n = 0; n < 4; n++) outline.append(document.createElement('i'));
        }
        const cursor = decoration(host, 'build-cursor scene-cursor');
        if (!cursor.children.length) {
            const arrow = document.createElement('span'); arrow.className = 'cursor-arrow'; cursor.append(arrow);
        }
        const caret = decoration(host, 'typing-caret');
        const decorations = [surface, outline, cursor, caret];
        const content = [...host.children].filter(el => !decorations.includes(el));
        const chars = [...host.querySelectorAll('.type-char')];
        const headerChars = heading ? [...heading.querySelectorAll('.type-char')] : [];
        const originX = corner % 2;
        const originY = Math.floor(corner / 2);
        let width, height;
        const glyphs = new Map();
        function measure() {
            width = host.clientWidth; height = host.clientHeight;
            const box = host.getBoundingClientRect();
            [...chars, ...headerChars].forEach(char => {
                const rect = char.getBoundingClientRect();
                glyphs.set(char, {
                    x: rect.right - box.left - host.clientLeft,
                    y: rect.top - box.top - host.clientTop,
                    height: rect.height,
                    start: rect.left - box.left - host.clientLeft,
                });
            });
        }
        measure();
        gsap.set([cursor, caret, outline], { opacity: 0 });
        gsap.set(content, { opacity: 0 });
        gsap.set([...chars, ...headerChars], { opacity: 0 });
        gsap.set([surface, outline], { transformOrigin: `${originX * 100}% ${originY * 100}%` });
        const setX = gsap.quickSetter(cursor, 'x', 'px');
        const setY = gsap.quickSetter(cursor, 'y', 'px');
        const caretX = gsap.quickSetter(caret, 'x', 'px');
        const caretY = gsap.quickSetter(caret, 'y', 'px');
        const line = gsap.timeline({ paused: true });

        function write(characters, start, duration) {
            if (!characters.length) return start;
            const state = { count: 0 };
            let previous = -1;
            const first = () => glyphs.get(characters[0]);
            line.to(cursor, { x: () => first().start + 4, y: () => first().y + first().height + 6,
                opacity: 1, duration: .18, ease: 'power2.inOut' }, start)
                .set(caret, { opacity: 1 }, start + .18)
                .to(state, { count: characters.length, duration, ease: 'none', onUpdate() {
                    const count = Math.floor(state.count);
                    if (count === previous) return;
                    // Only characters crossed since the last frame need touching.
                    for (let i = Math.max(0, Math.min(previous, count)); i < Math.max(previous, count); i++) {
                        if (characters[i]) characters[i].style.opacity = i < count ? '1' : '0';
                    }
                    const point = glyphs.get(characters[Math.max(0, count - 1)]);
                    const x = count ? point.x : point.start;
                    setX(x + 5); setY(point.y + point.height + 6);
                    caretX(x + 1); caretY(point.y + point.height * .12);
                    caret.style.height = `${point.height * .78}px`;
                    previous = count;
                } }, start + .18)
                .set(caret, { opacity: 0 }, start + .18 + duration);
            return start + .18 + duration;
        }

        let drawStart = 0;
        if (heading) {
            const first = () => glyphs.get(headerChars[0]);
            line.fromTo(cursor, { x: () => first().start + 40, y: () => first().y - 28 },
                { opacity: 1, duration: .12 }, 0);
            drawStart = write(headerChars, .12, .65) + .12;
        }
        // Four different anchor corners. The cursor stays on the growing corner
        // throughout the drag; lettering and layout never stretch with the surface.
        line.fromTo([surface, outline], { scaleX: () => 12 / width, scaleY: () => 12 / height, opacity: 0 },
            { opacity: 1, duration: .1 }, drawStart)
            .to(cursor, { x: () => originX * width + (originX ? -12 : 12),
                y: () => originY * height + (originY ? -12 : 12), opacity: 1,
                duration: .22, ease: 'power2.inOut' }, drawStart)
            .to(cursor, { '--pressed': 1, duration: .08 }, drawStart + .22)
            .to([surface, outline], { scaleX: 1, scaleY: 1, duration: .7, ease: 'power2.inOut' }, drawStart + .3)
            .to(cursor, { x: () => (1 - originX) * width, y: () => (1 - originY) * height,
                duration: .7, ease: 'power2.inOut' }, drawStart + .3)
            .to(cursor, { '--pressed': 0, duration: .1 }, drawStart + 1)
            .to(content, { opacity: 1, duration: .15 }, drawStart + 1.08)
            .to(outline, { opacity: .45, duration: .15 }, drawStart + 1.08);
        const typedEnd = write(chars, drawStart + 1.15, typeDuration);
        line.to(outline, { opacity: 0, duration: .2 }, typedEnd + .1)
            .to(cursor, { opacity: 0, duration: .25 }, typedEnd + .1);
        return { host, line, measure, cursor, surface, outline, drawStart };
    }
    return { create, split };
})();
