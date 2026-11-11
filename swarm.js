/* The cursor team: a few named cursors that live on the page in real time.

   Nothing here is tied to scrolling. A cursor is either working (a builder moves
   it), resting beside what it just made, or away. Flights are single smooth arcs
   with minimum-jerk easing, the way a hand moves a mouse: no wobble, no lean.
   Resting cursors breathe a little and step aside when the real pointer comes
   close. All positions are page coordinates, so cursors scroll with the content. */
window.Swarm = (() => {
    const ARROW = 'M2.2 1.6V19.4L6.9 15L10 22.2L13.3 20.8L10.3 13.9H16.9Z';
    const TICKS = 'M-4.5 -9.5L-6.2 -13.6M-9.5 -4.5L-13.6 -6.2M-8.4 -8.4L-11.6 -11.6';
    // The tools from stack.json are the ones building the page.
    const NAMES = ['C++', 'TS', 'CSS', 'Git', 'Python', 'React', 'GSAP', 'HTML'];
    const TONES = 4;
    const SHY = 120;
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    // Minimum-jerk profile: zero velocity and acceleration at both ends.
    const minJerk = p => p * p * p * (10 + p * (6 * p - 15));

    function generator(seed) {
        let state = seed >>> 0;
        return () => {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function create({ size = 8, seed = 11, labels = true } = {}) {
        const rand = generator(seed);
        const between = (min, max) => min + rand() * (max - min);
        const layer = document.createElement('div');
        layer.className = 'swarm-layer';
        layer.setAttribute('aria-hidden', 'true');
        document.body.append(layer);

        const pointer = { x: 0, y: 0, active: false };
        const waiting = [];
        const calls = new Set();
        const later = (seconds, fn) => {
            const call = gsap.delayedCall(seconds, () => { calls.delete(call); fn(); });
            calls.add(call);
            return call;
        };

        const cursors = Array.from({ length: size }, (_, index) => {
            const el = document.createElement('span');
            const name = NAMES[index % NAMES.length];
            el.className = `cursor tone-${index % TONES}`;
            el.innerHTML = '<span class="cursor-trail"></span><span class="cursor-body">'
                + `<svg class="cursor-ticks" viewBox="-16 -16 16 16" focusable="false"><path d="${TICKS}"/></svg>`
                + `<svg class="cursor-arrow" viewBox="0 0 19 24" focusable="false"><path d="${ARROW}"/></svg>`
                + (labels ? `<span class="cursor-label">${name}</span>` : '') + '</span>';
            layer.append(el);
            const [trail, body] = el.children;
            const c = {
                el, trail, body, ticks: body.children[0], arrow: body.children[1], index, name, tone: index % TONES,
                x: 0, y: 0, lx: 0, ly: 0, vx: 0, vy: 0, streak: false,
                shown: false, busy: false, idle: false, anchor: null, tween: null, settle: null, leave: null,
                // Each cursor breathes at its own pace while resting.
                w1: between(.55, .95), w2: between(.4, .8), phase: between(0, 6.28), ax: between(2, 4.5), ay: between(1.5, 3.5),
            };
            gsap.set(body, { opacity: 0, scale: .4, transformOrigin: '0 0' });
            c.fly = (to, options) => fly(c, to, options);
            c.set = (x, y) => { c.x = x; c.y = y; };
            c.press = () => press(c);
            c.release = () => lift(c);
            c.click = () => click(c);
            return c;
        });

        const inView = c => c.y > scrollY - 40 && c.y < scrollY + innerHeight + 40
            && c.x > -40 && c.x < layer.clientWidth + 40;

        function paint(c, dt) {
            c.el.style.transform = `translate3d(${c.x.toFixed(2)}px,${c.y.toFixed(2)}px,0)`;
            if (dt > 0) {
                const k = 1 - Math.exp(-dt * 16);
                c.vx += ((c.x - c.lx) / dt - c.vx) * k;
                c.vy += ((c.y - c.ly) / dt - c.vy) * k;
            }
            c.lx = c.x; c.ly = c.y;
            // A faint streak, only at real speed, never longer than the arrow itself.
            const length = clamp((Math.hypot(c.vx, c.vy) - 320) * .014, 0, 18);
            if (length > .5) {
                c.trail.style.width = `${length.toFixed(1)}px`;
                c.trail.style.opacity = (length / 18 * .2).toFixed(3);
                c.trail.style.transform = `rotate(${Math.atan2(-c.vy, -c.vx).toFixed(3)}rad)`;
                c.streak = true;
            } else if (c.streak) {
                c.trail.style.opacity = '0';
                c.streak = false;
            }
        }

        function tick(time, delta) {
            const dt = Math.min(.05, delta / 1000);
            const px = pointer.x + scrollX, py = pointer.y + scrollY;
            for (const c of cursors) {
                if (!c.shown) continue;
                if (c.idle && inView(c)) {
                    const home = c.anchor();
                    let tx = home.x + Math.sin(time * c.w1 + c.phase) * c.ax;
                    let ty = home.y + Math.cos(time * c.w2 + c.phase * 1.7) * c.ay;
                    if (pointer.active) {
                        const dx = tx - px, dy = ty - py, d = Math.hypot(dx, dy) || 1;
                        if (d < SHY) {
                            const push = (1 - d / SHY) * 70;
                            tx += dx / d * push; ty += dy / d * push;
                        }
                    }
                    const k = 1 - Math.exp(-dt * 5.5);
                    c.x += (tx - c.x) * k; c.y += (ty - c.y) * k;
                }
                paint(c, dt);
            }
        }
        gsap.ticker.add(tick);

        const onMove = event => {
            if (event.pointerType === 'touch') return;
            pointer.x = event.clientX; pointer.y = event.clientY; pointer.active = true;
        };
        const onLeave = () => { pointer.active = false; };
        window.addEventListener('pointermove', onMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', onLeave);

        function show(c) {
            c.shown = true;
            gsap.killTweensOf(c.body);
            gsap.to(c.body, { opacity: 1, scale: 1, duration: .26, ease: 'back.out(2.2)' });
        }
        function hide(c) {
            c.shown = false; c.idle = false;
            gsap.killTweensOf(c.body);
            gsap.set(c.body, { opacity: 0, scale: .4 });
        }
        function jump(c, x, y) { c.x = c.lx = x; c.y = c.ly = y; c.vx = c.vy = 0; }
        function spawn(c, at) { stop(c); jump(c, at.x, at.y); paint(c, 0); show(c); }

        // A cursor that is away comes in over the nearest edge of the screen, not across the page.
        function enter(c, to) {
            const top = scrollY, height = innerHeight, width = layer.clientWidth;
            const near = to.x < width / 2 ? -30 : width + 30;
            const roll = rand();
            const sideY = clamp(to.y + between(-170, 170), top + 90, top + height - 50);
            if (roll < .55) jump(c, near, sideY);
            else if (roll < .85) jump(c, clamp(to.x + between(-280, 280), 40, width - 40), top + height + 30);
            else jump(c, near < 0 ? width + 30 : -30, sideY);
            paint(c, 0);
            show(c);
        }

        function stop(c) {
            c.leave?.kill(); c.leave = null;
            c.tween?.kill(); c.tween = null;
            const settle = c.settle; c.settle = null;
            settle?.(false);
        }

        function fly(c, target, { duration, bulge, fan, radius } = {}) {
            stop(c);
            c.idle = false;
            const to = typeof target === 'function' ? target() : target;
            if (!c.shown || !inView(c)) enter(c, to);
            else show(c);
            const from = { x: c.x, y: c.y };
            const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
            if (d < 1.5) return Promise.resolve(true);
            const nx = -dy / d, ny = dx / d;
            const side = (bulge ?? between(.07, .19) * (rand() < .5 ? -1 : 1)) * Math.min(d, 640);
            // One arc: both handles sit on the same side of the straight line.
            let c1 = { x: from.x + dx * .3 + nx * side, y: from.y + dy * .3 + ny * side };
            const c2 = { x: from.x + dx * .74 + nx * side * .5, y: from.y + dy * .74 + ny * side * .5 };
            if (fan !== undefined) {
                // Leaving the origin: head out along the fan direction first, then curve to the job.
                const reach = radius ?? between(90, 170);
                c1 = { x: from.x + Math.cos(fan) * reach, y: from.y + Math.sin(fan) * reach };
            }
            duration ??= clamp(.34 + d / 1750, .44, .98) * between(.94, 1.1) + (fan !== undefined ? .1 : 0);
            return new Promise(resolve => {
                const state = { p: 0 };
                c.settle = resolve;
                c.tween = gsap.to(state, {
                    p: 1, duration, ease: 'none',
                    onUpdate() {
                        const t = minJerk(state.p), u = 1 - t;
                        c.x = u * u * u * from.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x;
                        c.y = u * u * u * from.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y;
                    },
                    onComplete() { c.tween = null; c.settle = null; resolve(true); },
                });
            });
        }

        function press(c) { gsap.to(c.arrow, { scale: .86, duration: .08, ease: 'power2.out', transformOrigin: '2px 2px' }); }
        function lift(c) { gsap.to(c.arrow, { scale: 1, duration: .22, ease: 'back.out(3)', transformOrigin: '2px 2px' }); }
        function click(c) {
            press(c);
            gsap.fromTo(c.ticks, { opacity: .95, scale: .35 },
                { opacity: 0, scale: 1.1, duration: .4, ease: 'power2.out', transformOrigin: '100% 100%' });
            later(.09, () => lift(c));
        }

        function pick(at) {
            let best = null, cost = Infinity;
            for (const c of cursors) {
                if (c.busy) continue;
                // An away cursor costs about one flight from the edge of the screen.
                const d = c.shown && inView(c) ? Math.hypot(c.x - at.x, c.y - at.y) : 560 + rand() * 120;
                if (d < cost) { cost = d; best = c; }
            }
            return best;
        }
        function take(c) {
            c.busy = true; c.idle = false;
            c.leave?.kill(); c.leave = null;
            return c;
        }
        /* The nearest free cursor, or null when everyone stays busy for `wait` seconds.
           Builders carry on without a cursor then: content never waits for the team. */
        function acquire(at, wait = .2) {
            const free = pick(at);
            if (free) return Promise.resolve(take(free));
            if (!wait) return Promise.resolve(null);
            return new Promise(resolve => {
                const request = c => { timeout.kill(); calls.delete(timeout); resolve(c); };
                const timeout = later(wait, () => {
                    const i = waiting.indexOf(request);
                    if (i >= 0) waiting.splice(i, 1);
                    resolve(null);
                });
                waiting.push(request);
            });
        }

        function release(c, { anchor, linger, stay = false } = {}) {
            if (!c || !c.busy) return;
            stop(c);
            const next = waiting.shift();
            if (next) { next(c); return; }
            c.busy = false;
            c.idle = true;
            const here = { x: c.x, y: c.y };
            c.anchor = anchor || (() => here);
            c.leave?.kill();
            c.leave = stay ? null : later(linger ?? between(1.2, 2.6), () => dismiss(c));
        }

        // Wander a short way off and fade, like a collaborator leaving the file.
        function dismiss(c) {
            if (c.busy || !c.shown) return;
            c.idle = false;
            const away = c.x < layer.clientWidth / 2 ? -1 : 1;
            gsap.to(c.body, { opacity: 0, scale: .7, duration: .4, delay: .16, ease: 'power2.in' });
            fly(c, { x: c.x + away * between(60, 120), y: c.y + between(30, 80) }, { duration: .62 })
                .then(done => { if (done && !c.busy) c.shown = false; });
        }

        // A selection frame, as a design tool draws it: four handles, a tag and a size readout.
        function frame(tone, tag) {
            const el = document.createElement('span');
            el.className = `build-frame tone-${tone}`;
            el.innerHTML = `<i></i><i></i><i></i><i></i>${tag ? `<b>${tag}</b>` : ''}<em></em>`;
            layer.append(el);
            const readout = el.lastChild;
            return {
                set(x, y, w, h, measure) {
                    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
                    el.style.width = `${Math.max(0, w).toFixed(1)}px`;
                    el.style.height = `${Math.max(0, h).toFixed(1)}px`;
                    if (measure) readout.textContent = `${Math.round(w)} × ${Math.round(h)}`;
                },
                done() { gsap.to(el, { opacity: 0, duration: .34, delay: .1, ease: 'power1.out', onComplete: () => el.remove() }); },
                remove() { gsap.killTweensOf(el); el.remove(); },
            };
        }

        function clear() {
            waiting.splice(0).forEach(request => request(null));
            calls.forEach(call => call.kill());
            calls.clear();
            cursors.forEach(c => { stop(c); c.busy = false; hide(c); gsap.killTweensOf([c.arrow, c.ticks]); });
            layer.querySelectorAll('.build-frame').forEach(el => { gsap.killTweensOf(el); el.remove(); });
        }
        function destroy() {
            clear();
            gsap.ticker.remove(tick);
            window.removeEventListener('pointermove', onMove);
            document.documentElement.removeEventListener('pointerleave', onLeave);
            layer.remove();
        }

        return { layer, cursors, spawn, take, acquire, release, dismiss, frame, later, clear, destroy, rand, between };
    }

    return { create, generator };
})();
