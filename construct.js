/* Builders: how a cursor brings one block onto the page.

   draw   a panel is dragged out corner to corner, like a frame in a design tool
   place  a heading or a tile is carried in and dropped where it belongs
   pop    buttons and chips appear one click at a time
   row    a list entry: one click on its badge, then the line settles in
   rise   plain reading text simply fades up, no cursor needed

   Text is never typed. Every block is whole from its first visible frame, and a
   block that cannot get a cursor in time builds itself, so reading never waits.
   Stages live in data-stage: pending (hidden by CSS), running, done. */
window.Construct = (() => {
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const CLEAR = 'transform,opacity,clipPath';

    // Layout box in page coordinates. Blocks are measured before any transform is applied.
    function box(el) {
        const r = el.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    }
    function point(el, fx = .5, fy = .5, dx = 0, dy = 0) {
        const r = box(el);
        return { x: r.x + r.w * fx + dx, y: r.y + r.h * fy + dy };
    }
    const tagOf = el => `&lt;${el.dataset.tag || el.tagName.toLowerCase()}&gt;`;

    function create(el, team) {
        return {
            el, team, kind: el.dataset.build, from: el.dataset.from || '', items: el.dataset.items || '',
            stage: '', started: false, cancelled: false, parent: null,
            cursor: null, preset: null, fan: undefined, frame: null,
            tweens: new Set(), touched: new Set(), waiters: [], starters: [],
        };
    }
    function stage(b, value) {
        b.stage = value;
        b.el.dataset.stage = value;
        if (value !== 'pending') b.starters.splice(0).forEach(resolve => resolve());
    }
    function touch(b, ...elements) { elements.flat().forEach(el => el && b.touched.add(el)); }

    // A progress tween whose promise also resolves when the block is finished early.
    function play(b, duration, ease, update) {
        return new Promise(resolve => {
            const state = { p: 0 };
            const easing = gsap.parseEase(ease);
            const tween = gsap.to(state, {
                p: 1, duration, ease: 'none',
                onUpdate: () => update(easing(state.p), state.p),
                onComplete: () => { b.tweens.delete(tween); resolve(); },
            });
            tween.resolve = resolve;
            b.tweens.add(tween);
        });
    }
    function to(b, targets, vars) {
        const tween = gsap.to(targets, { ...vars, onComplete: () => b.tweens.delete(tween) });
        b.tweens.add(tween);
        touch(b, targets);
        return tween;
    }
    const wait = (b, seconds) => play(b, seconds, 'none', () => {});

    function settle(b) {
        b.touched.forEach(el => {
            gsap.set(el, { clearProps: CLEAR });
            el.style.removeProperty('--rule');
        });
        b.touched.clear();
        stage(b, 'done');
        b.waiters.splice(0).forEach(resolve => resolve());
        b.el.dispatchEvent(new CustomEvent('built', { bubbles: true }));
    }
    // Jump straight to the finished state: anchors, keyboard focus, pausing motion.
    function finish(b) {
        if (b.stage === 'done') return;
        b.cancelled = true;
        b.tweens.forEach(tween => { tween.kill(); tween.resolve?.(); });
        b.tweens.clear();
        b.frame?.remove(); b.frame = null;
        // A cursor that was assigned but never got to start goes back to the team as well.
        [b.cursor, b.preset].forEach(c => { if (c) b.team?.release(c); });
        b.cursor = b.preset = null;
        settle(b);
    }
    const whenDone = b => b.stage === 'done' ? Promise.resolve() : new Promise(resolve => b.waiters.push(resolve));
    const whenBegun = b => b.stage === 'running' || b.stage === 'done' ? Promise.resolve() : new Promise(resolve => b.starters.push(resolve));

    async function hire(b, at, patience = .2) {
        if (b.preset) { b.cursor = b.preset; b.preset = null; return b.cursor; }
        if (!b.team || b.unattended) return null;
        const c = await b.team.acquire(at, b.patience ?? patience);
        if (b.cancelled) { if (c) b.team.release(c); return null; }
        b.cursor = c;
        return c;
    }
    function rest(b, anchor, options) {
        if (!b.cursor) return;
        const page = b.team.layer.clientWidth;
        const safe = anchor && (() => { const p = anchor(); return { x: clamp(p.x, 8, page - 26), y: p.y }; });
        b.team.release(b.cursor, { anchor: safe, ...options, ...b.keep });
        b.cursor = null;
    }
    function takeFan(b) { const fan = b.fan; b.fan = undefined; return fan === undefined ? {} : { fan }; }

    /* Drag a panel out from one corner to the opposite one. The panel is clipped
       to the growing frame, so its surface and content arrive with the drag. */
    async function draw(b) {
        const { el } = b;
        const r = box(el);
        const corner = Number(el.dataset.corner ?? 0);
        const sx = corner === 1 || corner === 2 ? -1 : 1, sy = corner >= 2 ? -1 : 1;
        const start = { x: sx > 0 ? r.x : r.x + r.w, y: sy > 0 ? r.y : r.y + r.h };
        const c = await hire(b, start);
        if (b.cancelled) return;
        if (c) {
            await c.fly(start, takeFan(b));
            if (b.cancelled) return;
            c.press();
            b.frame = b.team.frame(c.tone, tagOf(el));
        }
        const radius = getComputedStyle(el).borderTopLeftRadius;
        el.style.clipPath = 'inset(50%)';
        touch(b, el);
        stage(b, 'running');
        await play(b, clamp(.32 + Math.hypot(r.w, r.h) / 3000, .4, .56), 'power2.inOut', p => {
            const w = r.w * p, h = r.h * p;
            const left = sx > 0 ? 0 : r.w - w, top = sy > 0 ? 0 : r.h - h;
            el.style.clipPath = `inset(${top.toFixed(1)}px ${(r.w - left - w).toFixed(1)}px ${(r.h - top - h).toFixed(1)}px ${left.toFixed(1)}px round ${radius})`;
            b.frame?.set(r.x + left, r.y + top, w, h, true);
            c?.set(start.x + sx * w, start.y + sy * h);
        });
        if (b.cancelled) return;
        c?.release();
        b.frame?.done(); b.frame = null;
        rest(b, () => point(el, sx > 0 ? 1 : 0, sy > 0 ? 1 : 0, sx * 12, sy * 10));
    }

    function offset(b, r) {
        const from = b.from;
        if (from === 'offscreen') return { x: -(r.x + r.w + 36), y: 0, tilt: 0 };
        if (from === 'right') return { x: 130, y: 0, tilt: 0 };
        if (from === 'below') return { x: 0, y: 46, tilt: 0 };
        if (from === 'above') return { x: 0, y: -46, tilt: 0 };
        if (from.includes(',')) {
            const [x, y, tilt = 0] = from.split(',').map(Number);
            return { x, y, tilt };
        }
        return { x: -Math.min(150, r.x * .6 + 50), y: 0, tilt: 0 };
    }

    /* Carry a whole element in and drop it. Cursor, selection frame and element all
       read the same progress value, so the grip never slips. */
    async function place(b) {
        const { el } = b;
        const r = box(el);
        const off = offset(b, r);
        // An element pulled in from outside the screen is held by its leading end.
        const inset = Math.min(30, r.w * .14);
        const grab = { x: b.from === 'offscreen' ? r.x + r.w - inset : r.x + inset, y: r.y + r.h * .62 };
        gsap.set(el, { x: off.x, y: off.y, rotation: off.tilt, opacity: 0 });
        touch(b, el);
        stage(b, 'running');
        const from = { x: grab.x + off.x, y: grab.y + off.y };
        const c = await hire(b, from);
        if (b.cancelled) return;
        if (c) {
            // A cursor that is away starts outside the screen already holding the element: no flight first.
            const outside = from.x < scrollX - 10;
            if (!(outside && b.fan === undefined && c.appear(from))) {
                await c.fly(from, takeFan(b));
                if (b.cancelled) return;
            }
            c.press();
            if (el.dataset.frame !== 'off') b.frame = b.team.frame(c.tone, tagOf(el));
        }
        const distance = Math.hypot(off.x, off.y);
        await play(b, clamp(.4 + distance / 2200, .46, .78), el.dataset.ease || 'power3.out', p => {
            const k = 1 - p;
            gsap.set(el, { x: off.x * k, y: off.y * k, rotation: off.tilt * k, opacity: Math.min(1, p * 5) });
            b.frame?.set(r.x + off.x * k - 6, r.y + off.y * k - 4, r.w + 12, r.h + 8);
            c?.set(grab.x + off.x * k, grab.y + off.y * k);
        });
        if (b.cancelled) return;
        c?.release();
        b.frame?.done(); b.frame = null;
        rest(b, () => point(el, 1, .5, 14, 4));
    }

    const itemsOf = b => b.items ? [...b.el.querySelectorAll(b.items)] : [...b.el.children];

    /* Buttons and chips appear under one cursor. A few items get a click each;
       a long row is swept in one glide and every chip pops as the cursor passes it. */
    async function pop(b) {
        const items = itemsOf(b);
        gsap.set(items, { opacity: 0, scale: .5 });
        touch(b, items);
        stage(b, 'running');
        if (!items.length) return;
        const show = item => to(b, item, { opacity: 1, scale: 1, duration: .4, ease: 'back.out(2.2)' });
        const spot = item => { const r = box(item); return { x: r.x + r.w * .5, y: r.y + r.h * .62 }; };
        const c = await hire(b, spot(items[0]));
        if (b.cancelled) return;
        if (!c) {
            for (const item of items) {
                show(item);
                await wait(b, .045);
                if (b.cancelled) return;
            }
        } else if (items.length <= 3) {
            for (let i = 0; i < items.length; i++) {
                const at = spot(items[i]);
                const hop = Math.hypot(at.x - c.x, at.y - c.y);
                await c.fly(at, i ? { duration: clamp(.12 + hop / 1400, .16, .34), bulge: .14 } : takeFan(b));
                if (b.cancelled) return;
                c.click();
                show(items[i]);
            }
        } else {
            // Lines of a wrapped list are swept one after another.
            const lines = [];
            items.forEach(item => {
                const y = box(item).y, line = lines[lines.length - 1];
                if (line && Math.abs(line.y - y) < 6) line.items.push(item);
                else lines.push({ y, items: [item] });
            });
            for (const line of lines) {
                const first = spot(line.items[0]), last = spot(line.items[line.items.length - 1]);
                await c.fly({ x: first.x - 14, y: first.y }, takeFan(b));
                if (b.cancelled) return;
                c.press();
                const waitingItems = line.items.map(item => ({ item, x: spot(item).x }));
                await c.fly({ x: last.x + 10, y: last.y }, {
                    duration: clamp(.28 + (last.x - first.x) / 1500, .36, .8), bulge: .03,
                    onMove(cursor) {
                        while (waitingItems.length && cursor.x >= waitingItems[0].x - 6) show(waitingItems.shift().item);
                    },
                });
                if (b.cancelled) return;
                waitingItems.forEach(entry => show(entry.item));
                c.release();
            }
        }
        await wait(b, .4);
        if (b.cancelled) return;
        const last = items[items.length - 1];
        rest(b, () => point(last, 1, 1, 8, 4));
    }

    // A list entry: click its badge, the badge pops, the text rises and the rule draws.
    async function row(b) {
        const { el } = b;
        const badge = b.items ? el.querySelector(b.items) : null;
        const others = [...el.children].filter(child => child !== badge);
        const target = () => badge ? point(badge, .5, .6) : point(el, 0, .5, 16, 0);
        gsap.set(others, { opacity: 0, y: 12 });
        if (badge) gsap.set(badge, { opacity: 0, scale: .5 });
        el.style.setProperty('--rule', '0');
        touch(b, others, badge, el);
        stage(b, 'running');
        const c = await hire(b, target(), .12);
        if (b.cancelled) return;
        if (c) {
            await c.fly(target(), takeFan(b));
            if (b.cancelled) return;
            c.click();
        }
        if (badge) to(b, badge, { opacity: 1, scale: 1, duration: .38, ease: 'back.out(2.2)' });
        to(b, others, { opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .05 });
        to(b, el, { '--rule': 1, duration: .6, ease: 'power2.inOut' });
        await wait(b, .6);
        if (b.cancelled) return;
        rest(b, badge ? () => point(badge, 1, 1, 6, 4) : null, { linger: .5 });
    }

    async function rise(b) {
        const items = b.items ? itemsOf(b) : [b.el];
        gsap.set(items, { opacity: 0, y: 14 });
        touch(b, items);
        stage(b, 'running');
        to(b, items, { opacity: 1, y: 0, duration: .55, ease: 'power2.out', stagger: .07 });
        await wait(b, .55 + (items.length - 1) * .07);
    }

    const BUILDERS = { draw, place, pop, row, rise };

    /* Build one block. Options: cursor (a specific team member), fan (leave the
       origin in this direction), unattended (no cursor at all), keep (how the
       cursor rests afterwards), patience (seconds to wait for a free cursor).
       A nested block starts shortly after the block around it. */
    async function run(b, options = {}) {
        if (b.started || b.stage === 'done') return whenDone(b);
        b.started = true;
        b.preset = options.cursor || null;
        b.fan = options.fan;
        b.unattended = Boolean(options.unattended);
        b.keep = options.keep;
        b.patience = options.patience;
        if (b.parent && b.parent.stage !== 'done') {
            // Chips inside a panel set off while the panel is still being drawn, so both finish together.
            run(b.parent, { unattended: b.unattended });
            await whenBegun(b.parent);
            if (b.parent.stage !== 'done') await wait(b, .24);
        }
        if (b.cancelled) return;
        try {
            await (BUILDERS[b.kind] || rise)(b);
        } catch (error) {
            console.error('Build step failed:', error);
            finish(b);
        }
        if (!b.cancelled && b.stage !== 'done') settle(b);
    }

    // Every [data-build] element under `root`, in document order, linked to its enclosing block.
    function collect(root, team) {
        const blocks = [...root.querySelectorAll('[data-build]')].map(el => create(el, team));
        const byElement = new Map(blocks.map(b => [b.el, b]));
        blocks.forEach(b => { b.parent = byElement.get(b.el.parentElement?.closest('[data-build]')) || null; });
        return blocks;
    }

    return { collect, run, finish, stage, whenDone, box, point };
})();
