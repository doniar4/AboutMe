/* Construction jobs performed by the swarm. A panel is never animated as one
   block: corners are placed one by one, edges are dragged between them, a cursor
   fills the surface from the point it clicks, badges are dragged out as
   selections and several cursors type different lines at the same time.

   Content is never transformed, only revealed, so measurements stay exact. */
window.Construct = (() => {
    const TEXT = 'h3, p, dt, dd, li, .contact-platform, .contact-handle, .note-tab, .note-code span, .note-code strong, .note-signature, .project-note';
    const CHIPS = '.project-status, .log-status, .btn, .text-link, .project-monogram, .hardware-mark, .contact-arrow';
    const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
    // Edge drawn from corner a to corner b: [edge index, transform origin, axis].
    const EDGES = {
        '01': [0, 'left center', 'scaleX'], '10': [0, 'right center', 'scaleX'],
        '12': [1, 'center top', 'scaleY'], '21': [1, 'center bottom', 'scaleY'],
        '23': [2, 'right center', 'scaleX'], '32': [2, 'left center', 'scaleX'],
        '30': [3, 'center bottom', 'scaleY'], '03': [3, 'center top', 'scaleY'],
    };
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    /* One accessible copy for assistive technology and one decorative copy whose
       characters can be revealed. Inline markup (colours, the name dot, arrows) is
       kept: only text nodes are split into words and characters. */
    function split(element) {
        if (element.querySelector(':scope > .type-visual')) return;
        const copy = element.cloneNode(true);
        copy.querySelectorAll('br').forEach(br => br.replaceWith(' '));
        copy.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove());
        const accessible = document.createElement('span');
        accessible.className = 'sr-only';
        accessible.textContent = copy.textContent.replace(/\s+/g, ' ').trim();
        const visual = document.createElement('span');
        visual.className = 'type-visual';
        visual.setAttribute('aria-hidden', 'true');
        visual.append(...element.childNodes);
        const walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(node => {
            const fragment = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach(word => {
                if (!word) return;
                if (/^\s+$/.test(word)) { fragment.append(word); return; }
                const group = document.createElement('span');
                group.className = 'type-word';
                Array.from(word).forEach(char => {
                    const span = document.createElement('span');
                    span.className = 'type-char';
                    span.textContent = char;
                    group.append(span);
                });
                fragment.append(group);
            });
            node.replaceWith(fragment);
        });
        element.replaceChildren(accessible, visual);
    }

    function ensure(host, className, fill) {
        let el = host.querySelector(`:scope > .${className}`);
        if (!el) {
            el = document.createElement('span');
            el.className = className;
            el.setAttribute('aria-hidden', 'true');
            fill?.(el);
            host.append(el);
        }
        return el;
    }

    function prepare(host, { mode, texts = TEXT, chips = CHIPS, self = false, shell = false } = {}) {
        if (self) split(host);
        host.classList.add('assembly-host');
        const surface = ensure(host, 'assembly-surface');
        const frame = ensure(host, 'assembly-frame', el => {
            el.innerHTML = '<b></b><b></b><b></b><b></b><i></i><i></i><i></i><i></i>';
        });
        const chipEls = shell ? [] : [...host.querySelectorAll(chips)];
        let textEls = [];
        if (self) textEls = [host];
        else if (!shell) {
            const candidates = [...host.querySelectorAll(texts)]
                .filter(el => !chipEls.some(chip => chip.contains(el)) && !el.closest('.sr-only, .type-visual'));
            textEls = candidates.filter(el => !candidates.some(other => other !== el && el.contains(other)));
            textEls.forEach(split);
        }
        // Badges that are direct children are revealed by their own drag, not with the content.
        const content = shell ? [] : [...host.children]
            .filter(el => el !== surface && el !== frame && !chipEls.includes(el));
        if (!mode) {
            const style = getComputedStyle(surface);
            mode = parseFloat(style.borderTopWidth) > 0 ? 'box'
                : parseFloat(style.borderBottomWidth) > 0 ? 'rule' : 'bare';
        }
        const edges = [...frame.querySelectorAll('b')];
        const handles = [...frame.querySelectorAll('i')];
        const chars = textEls.flatMap(el => [...el.querySelectorAll('.type-char')]);
        gsap.set(content, { opacity: 0 });
        gsap.set(chipEls, { opacity: 0 });
        gsap.set(chars, { opacity: 0 });
        gsap.set(surface, { opacity: 0 });
        gsap.set(handles, { scale: 0 });
        gsap.set([edges[0], edges[2]], { scaleX: 0 });
        gsap.set([edges[1], edges[3]], { scaleY: 0 });
        return { host, surface, frame, edges, handles, chips: chipEls, texts: textEls, content, mode };
    }

    function reveal(stage, part, at) {
        if (part.content.length) stage.timeline.to(part.content, { opacity: 1, duration: .2 }, at);
    }

    /* Four cursors claim the four corners, then each drags one edge to the next
       corner. A fifth action fills the surface outward from where it is clicked. */
    function frame(stage, part, at, { fill = true, fresh = false } = {}) {
        const tl = stage.timeline;
        const clockwise = stage.rand() > .4;
        const first = Math.floor(stage.rand() * 4);
        const order = [0, 1, 2, 3].map(k => (first + (clockwise ? k : 4 - k)) % 4);
        const crew = order.map((corner, k) => {
            const target = stage.point(part.host, ...CORNERS[corner]);
            const c = stage.take(at + k * .035, target, { fresh });
            const arrived = stage.fly(c, target, at + k * .035);
            const clicked = stage.click(c, arrived);
            tl.fromTo(part.handles[corner], { scale: 0 }, {
                scale: 1, duration: .26, ease: 'back.out(3.2)', immediateRender: false,
            }, arrived + .04);
            return { c, arrived, clicked };
        });
        const sync = Math.max(...crew.map(m => m.clicked)) + .04;
        const box = stage.rect(part.host);
        let drawn = sync;
        crew.forEach(({ c, arrived }, k) => {
            const a = order[k], b = order[(k + 1) % 4];
            const [index, origin, axis] = EDGES[`${a}${b}`];
            const edge = part.edges[index];
            const duration = clamp(.3 + (axis === 'scaleX' ? box.w : box.h) / 1500, .36, .95);
            const start = sync + k * .025;
            gsap.set(edge, { transformOrigin: origin });
            stage.press(c, start);
            tl.fromTo(edge, { [axis]: 0 }, {
                [axis]: 1, duration, ease: 'power2.inOut', immediateRender: false,
            }, start + .07);
            const end = stage.move(c, stage.point(part.host, ...CORNERS[b]), start + .07,
                { straight: true, duration, ease: 'power2.inOut' });
            stage.release(c, end);
            stage.role(c, 'frame', arrived, end);
            drawn = Math.max(drawn, end + .12);
        });
        if (!fill) return { crew: crew.map(m => m.c), built: drawn };

        const filler = crew[Math.floor(stage.rand() * crew.length)].c;
        const fx = stage.between(.3, .7), fy = stage.between(.3, .7);
        const where = `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`;
        const t = stage.fly(filler, stage.point(part.host, fx, fy), drawn - .06);
        stage.click(filler, t, 1.7);
        stage.role(filler, 'fill', t - .05, t + .45);
        tl.set(part.surface, { opacity: 1 }, t + .05)
            .fromTo(part.surface, { clipPath: `circle(0% at ${where})` }, {
                clipPath: `circle(150% at ${where})`, duration: .65, ease: 'power2.out', immediateRender: false,
            }, t + .05)
            .set(part.surface, { clipPath: 'none' }, t + .72);
        fold(stage, part, t + .5);
        return { crew: crew.map(m => m.c), built: t + .3 };
    }

    // Construction guides disappear once the surface stands on its own.
    function fold(stage, part, at) {
        stage.timeline.to(part.handles, { scale: 0, duration: .2, stagger: .03, ease: 'power2.in' }, at)
            .to(part.edges, { opacity: 0, duration: .3, ease: 'power1.out' }, at + .05);
    }

    // A divider: two cursors meet in its middle and pull it apart.
    function rule(stage, part, at, { fresh = false } = {}) {
        const tl = stage.timeline;
        const pair = [0, 1].map(k => {
            const target = stage.point(part.host, .5, 1, k ? 3 : -3, 0);
            const c = stage.take(at + k * .05, target, { fresh });
            return { c, arrived: stage.fly(c, target, at + k * .05) };
        });
        const start = Math.max(...pair.map(p => p.arrived)) + .03;
        const duration = clamp(.35 + stage.rect(part.host).w / 1600, .4, 1);
        pair.forEach(({ c, arrived }, k) => {
            stage.press(c, start);
            const end = stage.move(c, stage.point(part.host, k, 1), start + .07,
                { straight: true, duration, ease: 'power2.inOut' });
            stage.release(c, end);
            stage.role(c, 'rule', arrived, end);
        });
        tl.set(part.surface, { opacity: 1 }, start + .07)
            .fromTo(part.surface, { clipPath: 'inset(0% 50% 0% 50%)' }, {
                clipPath: 'inset(0% 0% 0% 0%)', duration, ease: 'power2.inOut', immediateRender: false,
            }, start + .07)
            .set(part.surface, { clipPath: 'none' }, start + .07 + duration);
        return start + .07 + duration * .5;
    }

    /* A badge or button: grab its top-left corner, drag a selection to the opposite
       corner while the size readout updates, release, and the element appears. */
    function stamp(stage, el, at, { fresh = false } = {}) {
        const tl = stage.timeline;
        const corner = stage.point(el, 0, 0, -1, -1);
        const c = stage.take(at, corner, { fresh });
        const arrived = stage.fly(c, corner, at);
        const marquee = document.createElement('span');
        marquee.className = 'swarm-marquee';
        marquee.innerHTML = '<span class="swarm-size"></span>';
        stage.layer.append(marquee);
        const readout = marquee.firstChild;
        const size = stage.rect(el);
        const duration = clamp(.22 + Math.hypot(size.w, size.h) / 900, .26, .6);
        stage.press(c, arrived);
        tl.set(marquee, { opacity: 1 }, arrived + .07);
        const end = stage.move(c, stage.point(el, 1, 1, 1, 1), arrived + .07, {
            straight: true, duration, ease: 'power2.out',
            onPlace(p) {
                const o = corner();
                const w = Math.max(0, p.x - o.x), h = Math.max(0, p.y - o.y);
                marquee.style.translate = `${o.x.toFixed(1)}px ${o.y.toFixed(1)}px`;
                marquee.style.width = `${w.toFixed(1)}px`;
                marquee.style.height = `${h.toFixed(1)}px`;
                readout.textContent = `${Math.round(w)} × ${Math.round(h)}`;
            },
        });
        stage.release(c, end);
        stage.role(c, 'drag', arrived, end + .1);
        tl.fromTo(el, { opacity: 0, clipPath: 'circle(0% at 100% 100%)' }, {
            opacity: 1, clipPath: 'circle(150% at 100% 100%)', duration: .4, ease: 'power2.out', immediateRender: false,
        }, end)
            .set(el, { clipPath: 'none' }, end + .4)
            .to(marquee, { opacity: 0, duration: .22 }, end + .12);
        return end + .4;
    }

    function linesOf(stage, el) {
        const lines = [];
        el.querySelectorAll('.type-char').forEach(char => {
            const r = stage.rect(char);
            const line = lines[lines.length - 1];
            if (line && Math.abs(r.y - line.y) < r.h * .5) line.chars.push(char);
            else lines.push({ y: r.y, chars: [char] });
        });
        return lines;
    }

    // One cursor types one line: the arrow glides under the glyphs, the caret follows.
    function type(stage, c, chars, at, perChar) {
        const tl = stage.timeline;
        const glyph = char => stage.rect(char);
        const below = (g, f) => ({ x: g.x + g.w * f + 3, y: g.y + g.h + 4 });
        const arrived = stage.fly(c, () => below(glyph(chars[0]), 0), at);
        const caret = stage.caretOf(c);
        const count = chars.length;
        const duration = clamp(count * perChar, .16, 2.4);
        const state = { n: 0 };
        let shown = 0;
        tl.set(caret, { opacity: 1 }, arrived)
            .to(state, {
                n: count, duration, ease: 'none',
                onUpdate() {
                    const n = state.n;
                    const visible = Math.min(count, n > 0 ? Math.floor(n) + 1 : 0);
                    // Only the characters crossed since the previous frame are touched.
                    for (let i = Math.min(shown, visible); i < Math.max(shown, visible); i++) {
                        chars[i].style.opacity = i < visible ? '1' : '0';
                    }
                    shown = visible;
                    const i = Math.min(count - 1, Math.floor(n));
                    const g = glyph(chars[i]);
                    stage.place(c, below(g, n >= count ? 1 : n - Math.floor(n)));
                    const last = glyph(chars[Math.max(0, visible - 1)]);
                    caret.style.translate = `${(visible ? last.x + last.w + 1 : g.x).toFixed(1)}px ${(last.y + last.h * .12).toFixed(1)}px`;
                    caret.style.height = `${(last.h * .78).toFixed(1)}px`;
                },
            }, arrived)
            .set(caret, { opacity: 0 }, arrived + duration);
        const rest = () => below(glyph(chars[count - 1]), 1);
        stage.occupy(c, arrived, arrived + duration, rest, 'type');
        c.pos = rest;
        stage.role(c, 'type', arrived, arrived + duration);
        return arrived + duration;
    }

    /* Several cursors share the text: each one takes a contiguous run of lines with
       roughly the same number of characters, so they finish together. */
    function write(stage, elements, at, { perChar = .022, typists, fresh = false, gap = .06 } = {}) {
        const lines = elements.flatMap(el => linesOf(stage, el));
        if (!lines.length) return at;
        const total = lines.reduce((sum, line) => sum + line.chars.length, 0);
        const count = clamp(typists ?? Math.ceil(total / 42), 1, Math.min(4, lines.length));
        const groups = Array.from({ length: count }, () => []);
        let done = 0;
        lines.forEach(line => {
            groups[Math.min(count - 1, Math.floor(done / total * count))].push(line);
            done += line.chars.length;
        });
        let end = at;
        groups.filter(group => group.length).forEach((group, k) => {
            const start = at + k * .06;
            const c = stage.take(start, stage.point(group[0].chars[0], 0, 1), { fresh });
            let t = start;
            group.forEach(line => { t = type(stage, c, line.chars, t, perChar) + gap; });
            end = Math.max(end, t);
        });
        return end;
    }

    function panel(stage, part, at, { fresh = false, perChar, typists } = {}) {
        let ready = at;
        if (part.mode === 'box') ready = frame(stage, part, at, { fresh }).built;
        else if (part.mode === 'rule') ready = rule(stage, part, at, { fresh });
        reveal(stage, part, ready);
        let end = ready;
        part.chips.forEach((chip, i) => { end = Math.max(end, stamp(stage, chip, ready + .05 + i * .14)); });
        return Math.max(end, write(stage, part.texts, ready + .02, { perChar, typists }));
    }

    return { split, prepare, reveal, frame, fold, rule, stamp, write, type, panel };
})();
