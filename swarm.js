/* A swarm of small cursors that leave one origin point, take curved and slightly
   erratic routes, work on the page and fly home again.

   Every movement is a tween inside one GSAP timeline, so a scene can play in real
   time (the introduction) or be scrubbed and reversed by scrolling (sections).
   Element geometry is read from a cache that is cleared on refresh: cursors stay
   attached to real elements after resizes and font loading. Detours are stored as
   ratios of the flight distance, never as absolute coordinates. */
window.Swarm = (() => {
    const ARROW = 'M1.5 1.5 L1.5 16.7 L5.4 13 L8 19.1 L10.9 17.9 L8.3 11.9 L13.7 11.9 Z';
    const FLIGHT_EASES = ['power2.inOut', 'power3.inOut', 'sine.inOut', 'power3.out', 'expo.inOut'];
    const TONES = 4;
    // A cursor that has waited this long goes home; later work starts from the origin again.
    const IDLE_LIMIT = 2.2;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    // Small deterministic generator: the same scene always flies the same routes,
    // which keeps scrubbing backwards and forwards consistent.
    function generator(seed) {
        let state = seed >>> 0;
        return () => {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // Uniform Catmull-Rom spline through every point, u in [0, 1].
    function spline(points, u) {
        const segments = points.length - 1;
        const f = clamp(u, 0, 1) * segments;
        const i = Math.min(segments - 1, Math.floor(f));
        const t = f - i, t2 = t * t, t3 = t2 * t;
        const p0 = points[Math.max(0, i - 1)], p1 = points[i];
        const p2 = points[i + 1], p3 = points[Math.min(segments, i + 2)];
        const c = (a, b, c2, d) => .5 * (2 * b + (c2 - a) * t
            + (2 * a - 5 * b + 4 * c2 - d) * t2 + (3 * b - a - 3 * c2 + d) * t3);
        return { x: c(p0.x, p1.x, p2.x, p3.x), y: c(p0.y, p1.y, p2.y, p3.y) };
    }

    function createCursor(layer, tone, size) {
        const el = document.createElement('span');
        el.className = `swarm-cursor tone-${tone}`;
        el.style.setProperty('--size', size.toFixed(2));
        el.innerHTML = '<span class="swarm-trail"></span>'
            + '<span class="swarm-body"><span class="swarm-ring"></span>'
            + `<svg class="swarm-arrow" viewBox="0 0 16 21" focusable="false"><path d="${ARROW}"/></svg></span>`
            + '<span class="swarm-tag"></span>';
        layer.append(el);
        const [trail, body, tag] = el.children;
        return { el, trail, body, tag, tone };
    }

    function stage(container, { seed = 1 } = {}) {
        const rand = generator(seed);
        const between = (min, max) => min + rand() * (max - min);
        const pick = list => list[Math.floor(rand() * list.length)];

        const layer = document.createElement('div');
        layer.className = 'swarm-layer';
        layer.setAttribute('aria-hidden', 'true');
        container.append(layer);
        const hub = document.createElement('span');
        hub.className = 'swarm-hub';
        hub.innerHTML = '<span class="swarm-hub-halo"></span><span class="swarm-hub-core"></span>';
        layer.append(hub);

        const timeline = gsap.timeline({ paused: true });
        const cursors = [];
        const cache = new Map();
        let base = null;
        let originAt = () => ({ x: 0, y: 0 });
        let lastPulse = -Infinity;
        let firstSpawn = Infinity;

        function rect(el) {
            let box = cache.get(el);
            if (!box) {
                base ||= layer.getBoundingClientRect();
                const r = el.getBoundingClientRect();
                box = { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
                cache.set(el, box);
            }
            return box;
        }
        const point = (el, fx = 0, fy = 0, dx = 0, dy = 0) => () => {
            const r = rect(el);
            return { x: r.x + r.w * fx + dx, y: r.y + r.h * fy + dy };
        };
        function measure() { cache.clear(); base = null; }

        function place(c, p, vx = 0, vy = 0) {
            c.el.style.translate = `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`;
            const speed = Math.hypot(vx, vy);
            // Cursors lean into horizontal motion and leave a streak proportional to speed.
            c.body.style.rotate = `${clamp(vx * .014, -22, 22).toFixed(1)}deg`;
            const length = clamp(speed * .05, 0, 72);
            c.trail.style.width = `${length.toFixed(1)}px`;
            c.trail.style.opacity = clamp(speed / 1100, 0, .85).toFixed(2);
            if (length > .5) c.trail.style.rotate = `${Math.atan2(-vy, -vx).toFixed(3)}rad`;
        }

        function occupy(c, start, end, pos, kind = 'work') {
            c.busy.push({ start, end, pos, kind });
            c.free = Math.max(c.free, end);
        }

        // A route: endpoints are read live, detours are fixed fractions of the chord.
        function route(from, to, launch) {
            const detours = rand() < .55 ? 2 : 1;
            const knots = Array.from({ length: detours }, (_, k) => ({
                at: (k + 1) / (detours + 1) + between(-.08, .08),
                side: between(-.42, .42),
                lift: between(16, 46) * (rand() < .5 ? -1 : 1),
            }));
            const wobble = { amp: between(2.5, 8), freq: between(2.5, 6.5), phase: between(0, Math.PI * 2) };
            const leap = { radius: between(46, 150), turn: between(-1.5, 1.5) };
            return () => {
                const a = from(), b = to();
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
                const nx = -dy / d, ny = dx / d;
                const points = [a];
                if (launch) {
                    // Leaving the origin: first burst outwards, then turn toward the job.
                    const angle = Math.atan2(dy, dx) + leap.turn;
                    points.push({ x: a.x + Math.cos(angle) * leap.radius, y: a.y + Math.sin(angle) * leap.radius });
                }
                knots.forEach(k => {
                    const off = k.side * Math.min(d, 520) + k.lift;
                    points.push({ x: a.x + dx * k.at + nx * off, y: a.y + dy * k.at + ny * off });
                });
                points.push(b);
                return { points, nx, ny, wobble };
            };
        }

        function move(c, to, at, { duration, ease, straight = false, launch = false, onPlace } = {}) {
            const from = c.pos;
            const shape = straight ? null : route(from, to, launch);
            if (!duration) {
                const a = from(), b = to();
                duration = clamp(.3 + Math.hypot(b.x - a.x, b.y - a.y) / 1050, .34, 1.3) * between(.85, 1.2);
                if (launch) duration += .12;
            }
            const easing = gsap.parseEase(ease || (straight ? 'power2.inOut' : pick(FLIGHT_EASES)));
            function position(u, path) {
                if (!path) {
                    const a = from(), b = to();
                    return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
                }
                const p = spline(path.points, u);
                const w = path.wobble;
                const offset = Math.sin(u * w.freq * Math.PI * 2 + w.phase) * w.amp * Math.sin(Math.PI * u);
                return { x: p.x + path.nx * offset, y: p.y + path.ny * offset };
            }
            const state = { p: 0 };
            timeline.to(state, {
                p: 1, duration, ease: 'none',
                onUpdate() {
                    const p = state.p, path = shape && shape();
                    const lo = Math.max(0, p - .012), hi = Math.min(1, p + .012);
                    const here = position(easing(p), path);
                    const a = position(easing(lo), path), b = position(easing(hi), path);
                    const dt = Math.max(1e-4, (hi - lo) * duration);
                    place(c, here, (b.x - a.x) / dt, (b.y - a.y) / dt);
                    onPlace?.(here, p);
                },
            }, at);
            occupy(c, at, at + duration, to, launch ? 'launch' : 'move');
            c.pos = to;
            return at + duration;
        }

        // Breathing while waiting: a small Lissajous loop that ends where it began.
        function drift(c, start, end, anchor) {
            const span = end - start;
            if (span < .3) return;
            const ax = between(3, 10), ay = between(2.5, 7);
            const turns = Math.max(1, Math.round(span / 1.5)), phase = rand() < .5 ? 1 : -1;
            const state = { p: 0 };
            const at = p => {
                const envelope = Math.sin(Math.PI * p);
                const o = anchor();
                return {
                    x: o.x + Math.sin(p * turns * Math.PI * 2) * ax * envelope * phase,
                    y: o.y + Math.sin(p * turns * Math.PI * 4) * ay * envelope,
                };
            };
            timeline.to(state, {
                p: 1, duration: span, ease: 'none',
                onUpdate() {
                    const p = state.p, a = at(Math.max(0, p - .01)), b = at(Math.min(1, p + .01));
                    const dt = .02 * span;
                    place(c, at(p), (b.x - a.x) / dt, (b.y - a.y) / dt);
                },
            }, start);
        }

        function ripple(where, at, tone, size = 1) {
            const el = document.createElement('span');
            el.className = `swarm-ripple tone-${tone}`;
            layer.append(el);
            timeline.fromTo(el, {
                x: () => where().x, y: () => where().y, scale: .15 * size, opacity: .9,
            }, {
                scale: size, opacity: 0, duration: .5, ease: 'power2.out', immediateRender: false,
            }, at);
        }

        function press(c, at) {
            timeline.to(c.el, { '--press': 1, duration: .07, ease: 'power2.out' }, at);
            occupy(c, at, at + .07, c.pos, 'press');
            return at + .07;
        }
        function release(c, at) {
            timeline.to(c.el, { '--press': 0, duration: .12, ease: 'power2.out' }, at);
            occupy(c, at, at + .12, c.pos, 'press');
            return at + .12;
        }
        function click(c, at, size = 1) {
            const where = c.pos;
            press(c, at);
            ripple(where, at + .04, c.tone, size);
            return release(c, at + .1) + .04;
        }

        // A role label beside the arrow, shown only while the cursor is working.
        function role(c, name, start, end) {
            timeline.set(c.tag, { attr: { 'data-role': name } }, start)
                .to(c.tag, { opacity: 1, x: 0, duration: .14, ease: 'power2.out' }, start)
                .to(c.tag, { opacity: 0, x: -4, duration: .18, ease: 'power2.in' }, Math.max(start + .14, end));
        }

        function caretOf(c) {
            if (!c.caret) {
                c.caret = document.createElement('span');
                c.caret.className = `swarm-caret tone-${c.tone}`;
                layer.append(c.caret);
            }
            return c.caret;
        }

        function spawn(at) {
            let c = cursors.find(item => item.retired && item.away <= at);
            if (!c) {
                c = createCursor(layer, cursors.length % TONES, between(.88, 1.12));
                Object.assign(c, { busy: [], free: 0 });
                gsap.set(c.el, { opacity: 0, scale: 0, transformOrigin: '0 0', '--press': 0 });
                gsap.set(c.tag, { opacity: 0, x: -4 });
                cursors.push(c);
            }
            const origin = () => originAt(at);
            c.retired = false;
            c.pos = origin;
            c.free = at;
            timeline.call(() => place(c, origin()), null, at)
                .fromTo(c.el, { opacity: 0, scale: 0 },
                    { opacity: 1, scale: 1, duration: .2, ease: 'back.out(2.6)', immediateRender: false }, at);
            occupy(c, at, at + .06, origin, 'spawn');
            c.fresh = true;
            if (at - lastPulse > .07) { ripple(origin, at, c.tone, .8); lastPulse = at; }
            firstSpawn = Math.min(firstSpawn, at);
            return c;
        }

        function retire(c, at) {
            const start = Math.max(at, c.free);
            let arrival = start + 1;
            const home = () => originAt(arrival);
            arrival = move(c, home, start, { ease: pick(['power2.inOut', 'power3.in', 'sine.inOut']) });
            timeline.to(c.el, { opacity: 0, scale: 0, duration: .16, ease: 'power2.in' }, arrival - .06);
            c.busy[c.busy.length - 1].kind = 'home';
            c.retired = true;
            c.away = arrival + .12;
            return c.away;
        }

        // Pick the nearest cursor that is free; otherwise send a new one from the origin.
        function take(at, near, { fresh = false } = {}) {
            cursors.forEach(c => {
                if (!c.retired && at - c.free > IDLE_LIMIT) retire(c, c.free + between(.15, .45));
            });
            if (!fresh) {
                const target = near?.();
                let best = null, score = Infinity;
                cursors.forEach(c => {
                    if (c.retired || c.free > at + .04) return;
                    const p = c.pos();
                    const s = target ? Math.hypot(p.x - target.x, p.y - target.y) : c.free;
                    if (s < score) { score = s; best = c; }
                });
                if (best) return best;
            }
            return spawn(at);
        }

        // Fly somewhere, leaving the origin with a burst if the cursor was just born.
        function fly(c, to, at, options = {}) {
            const launch = c.fresh;
            c.fresh = false;
            return move(c, to, Math.max(at, c.free), { launch, ...options });
        }

        function finish() {
            cursors.forEach(c => { if (!c.retired) retire(c, c.free + between(.1, .5)); });
            // Fill every pause inside a working life with idle drift.
            cursors.forEach(c => {
                const spans = c.busy.slice().sort((a, b) => a.start - b.start);
                for (let i = 0; i < spans.length - 1; i++) {
                    if (spans[i].kind === 'home') continue;
                    drift(c, spans[i].end, spans[i + 1].start, spans[i].pos);
                }
            });
            const end = Math.max(0, ...cursors.map(c => c.away || 0));
            const start = Number.isFinite(firstSpawn) ? Math.max(0, firstSpawn - .2) : 0;
            const halo = hub.firstElementChild;
            const where = { t: 0 };
            const placeHub = () => {
                const p = originAt(where.t);
                hub.style.translate = `${p.x.toFixed(1)}px ${p.y.toFixed(1)}px`;
            };
            gsap.set(hub, { opacity: 0, scale: 0 });
            timeline.to(where, { t: end, duration: end, ease: 'none', onUpdate: placeHub }, 0)
                .to(hub, { opacity: 1, scale: 1, duration: .25, ease: 'back.out(2.2)' }, start)
                .fromTo(halo, { scale: .6 }, { scale: 1.25, duration: Math.max(.3, end - start - .3), ease: 'sine.inOut', immediateRender: false }, start)
                .to(hub, { opacity: 0, scale: 0, duration: .22, ease: 'power2.in' }, Math.max(start + .3, end - .1));
            placeHub();
            return Math.max(end + .15, timeline.duration());
        }

        function destroy() { layer.remove(); }

        return {
            layer, timeline, cursors,
            rect, point, measure, place,
            setOrigin(fn) { originAt = fn; },
            originAt: t => originAt(t),
            take, spawn, fly, move, press, release, click, role, ripple, caretOf, retire, occupy, finish, destroy,
            rand, between, pick,
        };
    }

    return { stage, spline, generator };
})();
