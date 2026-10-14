'use strict';
/* Dungeon Explorer. Part 1: pure generator (also runs under node). Part 2: browser game. */
const MW = 60, MH = 40;
const KINDS = {
  slime:    { name: 'Slime',    hp: 4,  dmg: 1, sight: 6, slow: true, col: '#5fd26b', glow: '#3dff7a' },
  skeleton: { name: 'Skeleton', hp: 6,  dmg: 2, sight: 8, slow: false, col: '#ddd8c4', glow: '#a8c0ff' },
  demon:    { name: 'Demon',    hp: 11, dmg: 3, sight: 9, slow: false, col: '#e0443e', glow: '#ff5a3a' },
};

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function generate(depth, rnd) {
  for (;;) { const L = tryGen(depth, rnd); if (L) return L; }
}

function tryGen(depth, rnd) {
  const tiles = new Uint8Array(MW * MH), rooms = [], want = 9 + Math.min(depth, 5);
  const ri = n => (rnd() * n) | 0;
  for (let i = 0; i < 500 && rooms.length < want; i++) {
    const w = 4 + ri(6), h = 4 + ri(4), x = 1 + ri(MW - w - 2), y = 1 + ri(MH - h - 2);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  if (rooms.length < 6) return null;
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) tiles[y * MW + x] = 1;
  const carve = (x, y) => { if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1 && !tiles[y * MW + x]) tiles[y * MW + x] = 1; };
  const hl = (x1, x2, y) => { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y); };
  const vl = (y1, y2, x) => { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x, y); };
  const link = (a, b) => {
    const m = rnd();
    if (m < 0.35) { hl(a.cx, b.cx, a.cy); vl(a.cy, b.cy, b.cx); }
    else if (m < 0.7) { vl(a.cy, b.cy, a.cx); hl(a.cx, b.cx, b.cy); }
    else { const mx = (a.cx + b.cx) >> 1; hl(a.cx, mx, a.cy); vl(a.cy, b.cy, mx); hl(mx, b.cx, b.cy); } // winding Z
  };
  // Prim's MST over room centres guarantees every room joins the tree.
  const inT = [0], rest = new Set(rooms.map((_, i) => i).slice(1));
  while (rest.size) {
    let best = null, bd = 1e9;
    for (const a of inT) for (const b of rest) {
      const d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
      if (d < bd) { bd = d; best = [a, b]; }
    }
    link(rooms[best[0]], rooms[best[1]]); inT.push(best[1]); rest.delete(best[1]);
  }
  for (let i = 0; i < 3; i++) link(rooms[ri(rooms.length)], rooms[ri(rooms.length)]); // loops

  const start = { x: rooms[0].cx, y: rooms[0].cy };
  const dist = bfs(tiles, start.x, start.y);
  let far = 1;
  for (let i = 1; i < rooms.length; i++) if (dist[rooms[i].cy * MW + rooms[i].cx] > dist[rooms[far].cy * MW + rooms[far].cx]) far = i;
  const stairs = { x: rooms[far].cx, y: rooms[far].cy };
  tiles[stairs.y * MW + stairs.x] = 2;

  const used = new Set([start.y * MW + start.x, stairs.y * MW + stairs.x]);
  const pick = (r) => {
    for (let k = 0; k < 40; k++) {
      const x = r.x + ri(r.w), y = r.y + ri(r.h);
      if (!used.has(y * MW + x)) { used.add(y * MW + x); return { x, y }; }
    }
    return null;
  };
  const others = rooms.slice(1), items = [], enemies = [];
  const any = () => others[ri(others.length)];
  for (const r of others) if (rnd() < 0.6) for (let n = 1 + ri(2); n--;) {
    const p = pick(r); if (p) items.push({ ...p, type: 'gold', value: 3 + ri(6) + depth * 2 });
  }
  for (let n = 2 + (depth / 3 | 0); n--;) { const p = pick(any()); if (p) items.push({ ...p, type: 'chest', value: 15 + ri(20) + depth * 5 }); }
  for (let n = 2 + ri(2); n--;) { const p = pick(rnd() < 0.3 ? rooms[0] : any()); if (p) items.push({ ...p, type: 'potion', value: 8 }); }
  for (let n = Math.min(4 + depth * 2, 24); n--;) {
    const p = pick(any()); if (!p) continue;
    const r = rnd();
    const kind = depth >= 3 && r < 0.22 ? 'demon' : depth >= 2 && r < 0.6 ? 'skeleton' : r < 0.2 && depth === 1 ? 'skeleton' : 'slime';
    enemies.push({ ...p, kind });
  }
  return { tiles, rooms, start, stairs, items, enemies };
}

function bfs(tiles, sx, sy) {
  const d = new Int16Array(MW * MH).fill(-1), q = [sy * MW + sx]; d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % MW, y = (i / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx;
      if (tiles[j] && d[j] < 0) { d[j] = d[i] + 1; q.push(j); }
    }
  }
  return d;
}

function verify(L) {
  const d = bfs(L.tiles, L.start.x, L.start.y);
  if (d[L.stairs.y * MW + L.stairs.x] < 0) return 'stairs unreachable';
  for (const o of L.items.concat(L.enemies)) if (d[o.y * MW + o.x] < 0) return 'object unreachable at ' + o.x + ',' + o.y;
  for (let i = 0; i < MW * MH; i++) if (L.tiles[i] && d[i] < 0) return 'orphan floor tile ' + i;
  return null;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { generate, verify, bfs, mulberry32, MW, MH };

if (typeof window !== 'undefined') (function () {
  const $ = id => document.getElementById(id);
  const cv = $('game'), ctx = cv.getContext('2d'), mctx = $('mini').getContext('2d');
  const MOVE_MS = 110, DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0], F: [0, 0] };
  const KEYMAP = { ArrowUp: 'U', w: 'U', W: 'U', ArrowDown: 'D', s: 'D', S: 'D', ArrowLeft: 'L', a: 'L', A: 'L', ArrowRight: 'R', d: 'R', D: 'R', ' ': 'F', '.': 'W' };
  const MAX_MANA = 10, FB_COST = 4, FB_RANGE = 8, FB_MS = 40; // fireball: mana cost, tiles, ms per tile
  let W = 0, H = 0, dpr = 1, ts = 32, u = 1, vign, hurtImg;
  let G, cam = { x: 0, y: 0 }, parts = [], floats = [], flashes = [], shake = 0, hurt = 0, fade = 0, turn = 0, msgTimer = 0, miniDirty = true;
  let queued = null, held = [], lastAct = 0, last = performance.now();
  let padTop = 0, padBot = 0, mt = 2, ms = 1, ovl = [], frameNo = 0; // overlay-aware camera padding (css px), minimap scale
  const rnd = Math.random;

  /* ---------- audio ---------- */
  let ac = null, muted = false;
  function unlock() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  function blip(f, d, type, vol, slide, delay) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + 0.03);
  }
  function noise(d, vol, f0, f1, type, delay) { // filtered noise burst with a sweeping cutoff
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0), n = Math.max(1, Math.floor(ac.sampleRate * d)), buf = ac.createBuffer(1, n, ac.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + d + 0.03);
  }
  const sfx = {
    step: () => blip(80 + rnd() * 30, 0.05, 'triangle', 0.06),
    coin: () => { blip(988, 0.07, 'square', 0.04); blip(1319, 0.14, 'square', 0.04, 0, 0.07); },
    hit: () => blip(260, 0.12, 'sawtooth', 0.06, -170),
    hurt: () => blip(150, 0.22, 'sawtooth', 0.09, -90),
    potion: () => { blip(400, 0.12, 'sine', 0.08, 500); blip(800, 0.14, 'sine', 0.06, 400, 0.1); },
    stairs: () => [392, 523, 659, 784].forEach((f, i) => blip(f, 0.14, 'square', 0.04, 0, i * 0.08)),
    whoosh: () => { noise(0.34, 0.16, 2400, 260, 'bandpass'); blip(620, 0.3, 'sawtooth', 0.04, -480); },
    boom: () => { noise(0.45, 0.2, 1400, 90, 'lowpass'); blip(110, 0.35, 'sawtooth', 0.09, -70); blip(60, 0.4, 'square', 0.06, -25, 0.03); },
    pop: () => { noise(0.18, 0.1, 1800, 200, 'lowpass'); blip(150, 0.14, 'square', 0.04, -90); },
    fizzle: () => { noise(0.14, 0.06, 5000, 1500, 'highpass'); blip(240, 0.14, 'square', 0.03, -150); },
    die: () => { blip(300, 0.6, 'sawtooth', 0.09, -250); blip(120, 0.8, 'square', 0.05, -80, 0.2); },
  };

  /* ---------- state ---------- */
  function newGame() {
    G = { state: 'title', depth: 1, gold: 0, kills: 0, hp: 20, maxhp: 20, mana: MAX_MANA, maxmana: MAX_MANA, turns: 0, face: [1, 0], fb: null,
          p: { x: 0, y: 0, fx: 0, fy: 0, t0: -1e9, bt: 0, bx: 0, by: 0, hitT: -1e9 } };
    startLevel(); hud();
  }
  function startLevel() {
    const L = generate(G.depth, rnd), p = G.p;
    G.tiles = L.tiles; G.items = L.items; G.stairs = L.stairs;
    G.enemies = L.enemies.map(e => { const k = KINDS[e.kind]; return { x: e.x, y: e.y, fx: e.x, fy: e.y, t0: -1e9, bt: 0, bx: 0, by: 0, hitT: -1e9, kind: e.kind, k,
      hp: k.hp + ((G.depth - 1) / 2 | 0), maxhp: k.hp + ((G.depth - 1) / 2 | 0), dmg: k.dmg + (G.depth / 4 | 0), alert: 0 }; });
    G.seen = new Uint8Array(MW * MH); G.vis = new Uint8Array(MW * MH); G.light = new Float32Array(MW * MH);
    p.x = p.fx = L.start.x; p.y = p.fy = L.start.y; p.t0 = -1e9;
    computeFov(); cam.x = p.x + 0.5 - W / ts / 2; cam.y = p.y + 0.5 - H / ts / 2; clampCam(1);
    parts = []; floats = []; flashes = []; G.fb = null; fade = 1; miniDirty = true;
  }

  /* ---------- fov (recursive shadowcasting) ---------- */
  const OCT = [[1, 0, 0, -1, -1, 0, 0, 1], [0, 1, -1, 0, 0, -1, 1, 0], [0, 1, 1, 0, 0, -1, -1, 0], [1, 0, 0, 1, -1, 0, 0, -1]];
  const solid = (x, y) => x < 0 || y < 0 || x >= MW || y >= MH || !G.tiles[y * MW + x];
  function computeFov() {
    const { x: ox, y: oy } = G.p, R = 10; G.vis.fill(0);
    const mark = (x, y) => { if (x >= 0 && y >= 0 && x < MW && y < MH) G.vis[y * MW + x] = G.seen[y * MW + x] = 1; };
    mark(ox, oy);
    function cast(row, start, end, xx, xy, yx, yy) {
      if (start < end) return;
      let ns = 0;
      for (let j = row; j <= R; j++) {
        let dx = -j - 1, dy = -j, blocked = false;
        while (dx <= 0) {
          dx++;
          const X = ox + dx * xx + dy * xy, Y = oy + dx * yx + dy * yy;
          const lS = (dx - 0.5) / (dy + 0.5), rS = (dx + 0.5) / (dy - 0.5);
          if (start < rS) continue; else if (end > lS) break;
          if (dx * dx + dy * dy <= R * R) mark(X, Y);
          if (blocked) { if (solid(X, Y)) { ns = rS; continue; } blocked = false; start = ns; }
          else if (solid(X, Y) && j < R) { blocked = true; cast(j + 1, start, lS, xx, xy, yx, yy); ns = rS; }
        }
        if (blocked) break;
      }
    }
    for (let o = 0; o < 8; o++) cast(1, 1, 0, OCT[0][o], OCT[1][o], OCT[2][o], OCT[3][o]);
    miniDirty = true;
  }

  /* ---------- turn logic ---------- */
  const enemyAt = (x, y) => G.enemies.find(e => e.x === x && e.y === y);
  function pos(e, now) {
    const p = Math.min(1, (now - e.t0) / MOVE_MS), q = p * (2 - p);
    let x = e.fx + (e.x - e.fx) * q, y = e.fy + (e.y - e.fy) * q;
    const b = (now - e.bt) / 150;
    if (e.bt && b < 1) { const k = Math.sin(b * Math.PI) * 0.35; x += e.bx * k; y += e.by * k; }
    return [x, y];
  }
  function moveTo(e, x, y, now) { const [cx, cy] = pos(e, now); e.fx = cx; e.fy = cy; e.x = x; e.y = y; e.t0 = now; }
  function burst(x, y, col, n, sp, up) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, s = (0.3 + rnd()) * sp;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (up || 0), life: 0.35 + rnd() * 0.45, max: 0.8, col });
    }
  }
  const floatText = (x, y, text, col) => floats.push({ x, y, text, col, t: performance.now() });
  function say(t) { const m = $('msg'); m.textContent = t; m.classList.add('on'); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove('on'), 2200); }

  function act(dir, now) {
    if (G.state !== 'play' || G.fb) return false;
    if (dir === 'F') return cast(now);
    const [dx, dy] = DIRS[dir], p = G.p, nx = p.x + dx, ny = p.y + dy;
    if (dx || dy) {
      G.face = [dx, dy]; // facing = last move direction (even a bump), used to aim fireballs
      const en = enemyAt(nx, ny);
      if (en) {
        const dmg = 2 + (rnd() * 3 | 0);
        en.hp -= dmg; en.hitT = now; en.alert = 6; p.bt = now; p.bx = dx; p.by = dy;
        floatText(en.x + 0.5, en.y, '-' + dmg, '#ffe27a'); burst(en.x + 0.5, en.y + 0.5, en.k.glow, 8, 3.5);
        shake = Math.min(shake + 3, 8); sfx.hit();
        if (en.hp <= 0) {
          G.enemies.splice(G.enemies.indexOf(en), 1); G.kills++;
          burst(en.x + 0.5, en.y + 0.5, en.k.col, 22, 5); sfx.hit();
          if (rnd() < 0.4) G.items.push({ x: en.x, y: en.y, type: 'gold', value: 2 + (rnd() * 4 | 0) + G.depth });
        }
      } else if (G.tiles[ny * MW + nx]) {
        moveTo(p, nx, ny, now); sfx.step();
        const idx = G.items.findIndex(i => i.x === nx && i.y === ny);
        if (idx >= 0) pickup(G.items.splice(idx, 1)[0]);
        if (G.tiles[ny * MW + nx] === 2) { descend(); return true; }
      } else return false; // bumping a wall costs no turn
    }
    endTurn(now);
    return true;
  }
  function endTurn(now) {
    G.turns++; if (G.mana < G.maxmana) G.mana++;
    computeFov(); enemiesAct(now); miniDirty = true; hud();
  }

  /* ---------- fireball ---------- */
  function cast(now) {
    const p = G.p, [dx, dy] = G.face;
    if (G.mana < FB_COST) { // fizzle: feedback only, no turn spent
      sfx.fizzle(); burst(p.x + 0.5 + dx * 0.5, p.y + 0.5 + dy * 0.5, '#6ab7ff', 7, 1.6);
      floatText(p.x + 0.5, p.y, 'NO MANA', '#6ab7ff');
      const b = $('mpbar'); b.classList.remove('fizz'); void b.offsetWidth; b.classList.add('fizz');
      return false;
    }
    G.mana -= FB_COST;
    let dist = FB_RANGE, target = null, end = 'range';
    for (let i = 1; i <= FB_RANGE; i++) {
      const x = p.x + dx * i, y = p.y + dy * i;
      if (solid(x, y)) { dist = i - 1 + 0.5; end = 'wall'; break; }
      const en = enemyAt(x, y);
      if (en) { dist = i; target = en; end = 'enemy'; break; }
    }
    G.fb = { sx: p.x + 0.5, sy: p.y + 0.5, dx, dy, dist, target, end, t0: now, x: p.x + 0.5, y: p.y + 0.5 };
    p.bt = now; p.bx = dx; p.by = dy; // little cast lunge
    sfx.whoosh(); burst(p.x + 0.5 + dx * 0.4, p.y + 0.5 + dy * 0.4, '#ffb347', 8, 2.2); hud();
    return true;
  }
  function explode(x, y, big, now) {
    if (big) { burst(x, y, '#ffd34d', 22, 6); burst(x, y, '#ff7a2a', 28, 5); burst(x, y, '#ff3b1a', 16, 3.5); burst(x, y, '#fff4c0', 8, 7); }
    else { burst(x, y, '#ff9a3a', 11, 3); burst(x, y, '#ffd34d', 5, 4.2); }
    flashes.push({ x, y, t0: now, dur: big ? 420 : 260, r: big ? 7 : 4.2, k: big ? 1.2 : 0.8 });
  }
  function updateFireball(now, dt) {
    const f = G.fb; if (!f) return;
    const d = Math.min(f.dist, Math.max(0, (now - f.t0) / FB_MS));
    f.x = f.sx + f.dx * d; f.y = f.sy + f.dy * d;
    const cols = ['#ffd34d', '#ff8a2a', '#ff5a1a', '#ffe9a8'];
    for (let n = Math.max(1, Math.round(dt * 110)); n--;) // ember trail
      parts.push({ x: f.x - f.dx * rnd() * 0.35, y: f.y - f.dy * rnd() * 0.35, vx: (rnd() - 0.5) * 1.2 - f.dx * 0.8, vy: (rnd() - 0.5) * 1.2 - 0.5,
                   life: 0.25 + rnd() * 0.35, max: 0.6, col: cols[(rnd() * cols.length) | 0] });
    if (d >= f.dist) resolveFireball(now);
  }
  function resolveFireball(now) {
    const f = G.fb; G.fb = null; lastAct = now;
    const ex = f.sx + f.dx * f.dist, ey = f.sy + f.dy * f.dist, en = f.target;
    if (en && G.enemies.includes(en)) {
      const dmg = 3 + (rnd() * 3 | 0) + ((G.depth - 1) / 3 | 0); // 3-5, +1 per 3 depths
      en.hp -= dmg; en.hitT = now; en.alert = 6;
      floatText(en.x + 0.5, en.y, '-' + dmg, '#ff9a3a'); explode(ex, ey, true, now);
      shake = Math.min(shake + 7, 12); sfx.boom();
      if (en.hp <= 0) {
        G.enemies.splice(G.enemies.indexOf(en), 1); G.kills++;
        burst(en.x + 0.5, en.y + 0.5, en.k.col, 22, 5);
        if (rnd() < 0.4) G.items.push({ x: en.x, y: en.y, type: 'gold', value: 2 + (rnd() * 4 | 0) + G.depth });
      }
    } else { explode(ex, ey, false, now); shake = Math.min(shake + 2, 12); sfx.pop(); }
    endTurn(now);
  }
  function pickup(it) {
    const cx = it.x + 0.5, cy = it.y + 0.5;
    if (it.type === 'potion') {
      const heal = Math.min(it.value, G.maxhp - G.hp); G.hp += heal;
      floatText(cx, it.y, '+' + heal + ' HP', '#7dff9a'); burst(cx, cy, '#ff6b8a', 18, 3, 1.5); sfx.potion(); say('You drink a health potion');
    } else {
      G.gold += it.value; floatText(cx, it.y, '+' + it.value, '#ffd34d');
      burst(cx, cy, '#ffd34d', it.type === 'chest' ? 30 : 14, it.type === 'chest' ? 5 : 3, 1.5); sfx.coin();
      if (it.type === 'chest') say('You open a chest! +' + it.value + ' gold');
    }
  }
  function descend() {
    G.depth++; G.hp = Math.min(G.maxhp, G.hp + 3); sfx.stairs(); startLevel(); hud(); say('Depth ' + G.depth + (G.depth === 3 ? ' - demons stir below' : ''));
  }
  function distMap() { return bfs(G.tiles, G.p.x, G.p.y); }
  function enemiesAct(now) {
    turn++; const dm = distMap(), p = G.p;
    for (const e of G.enemies) {
      if (G.state !== 'play') break;
      if (e.k.slow && turn % 2) continue;
      const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y), i = e.y * MW + e.x;
      if (G.vis[i] && d <= e.k.sight) e.alert = 6;
      if (d === 1) { attackPlayer(e, now); continue; }
      const free = (x, y) => G.tiles[y * MW + x] && !enemyAt(x, y) && !(x === p.x && y === p.y);
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [e.x + a, e.y + b]).filter(([x, y]) => free(x, y));
      if (e.alert > 0) {
        e.alert--;
        const better = nb.filter(([x, y]) => dm[y * MW + x] >= 0 && dm[y * MW + x] < dm[i]);
        if (better.length) moveTo(e, ...better[(rnd() * better.length) | 0], now);
      } else if (nb.length && rnd() < 0.5) moveTo(e, ...nb[(rnd() * nb.length) | 0], now);
    }
  }
  function attackPlayer(e, now) {
    const p = G.p; e.bt = now; e.bx = p.x - e.x; e.by = p.y - e.y; p.hitT = now;
    G.hp -= e.dmg; floatText(p.x + 0.5, p.y, '-' + e.dmg, '#ff5a5a'); burst(p.x + 0.5, p.y + 0.5, '#ff3b3b', 12, 3.5);
    shake = Math.min(shake + 6, 12); hurt = 1; sfx.hurt();
    if (G.hp <= 0) {
      G.hp = 0; G.state = 'dead'; sfx.die(); burst(p.x + 0.5, p.y + 0.5, '#ffffff', 40, 6);
      let best = 0, score = G.gold + G.depth * 50 + G.kills * 10;
      try { best = +localStorage.getItem('dde-best') || 0; if (score > best) { best = score; localStorage.setItem('dde-best', score); } } catch (_) { best = Math.max(best, score); }
      $('stats').innerHTML = `Depth reached <b>${G.depth}</b><br>Gold <b>${G.gold}</b> &nbsp; Kills <b>${G.kills}</b><br>Score <b>${score}</b> &nbsp; Best <b>${best}</b>`;
      setTimeout(() => $('over').classList.remove('hidden'), 900);
    }
  }
  function hud() {
    $('hpfill').style.width = (G.hp / G.maxhp * 100) + '%'; $('hptxt').textContent = G.hp + '/' + G.maxhp;
    $('bar').classList.toggle('low', G.hp / G.maxhp <= 0.3);
    $('mpfill').style.width = (G.mana / G.maxmana * 100) + '%'; $('mptxt').textContent = G.mana + '/' + G.maxmana;
    $('fire').classList.toggle('off', G.mana < FB_COST);
    $('gold').textContent = G.gold; $('depth').textContent = G.depth; $('kills').textContent = G.kills;
  }

  /* ---------- input ---------- */
  function begin() {
    unlock();
    if (G.state === 'title') { G.state = 'play'; $('title').classList.add('hidden'); }
    else if (G.state === 'dead' && !$('over').classList.contains('hidden')) { $('over').classList.add('hidden'); newGame(); G.state = 'play'; }
  }
  addEventListener('keydown', ev => {
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key; unlock();
    if (k === 'm' || k === 'M') { muted = !muted; $('snd').textContent = 'M: SOUND ' + (muted ? 'OFF' : 'ON'); return; }
    if (k === 'r' || k === 'R') { if (G.state === 'dead') begin(); return; }
    const dir = KEYMAP[k];
    if (dir || k === 'Enter') ev.preventDefault();
    if (G.state !== 'play') { if (G.state === 'title' && k.length > 0 && !/^(Shift|Control|Alt|Meta|Tab)$/.test(k)) begin(); return; }
    if (!dir) return;
    if (!ev.repeat) { queued = dir; if (dir !== 'W' && dir !== 'F') held = held.filter(d => d !== dir).concat(dir); }
  });
  addEventListener('keyup', ev => { const d = KEYMAP[ev.key]; if (d) held = held.filter(x => x !== d); });
  addEventListener('blur', () => { held = []; queued = null; });
  $('title').addEventListener('pointerdown', begin);
  $('over').addEventListener('pointerdown', begin);
  document.querySelectorAll('#dpad button').forEach(b => {
    const d = b.dataset.d, up = () => { held = held.filter(x => x !== d); };
    b.addEventListener('pointerdown', ev => { ev.preventDefault(); unlock(); queued = d; if (d !== 'W') held.push(d); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, up));
  });
  $('fire').addEventListener('pointerdown', ev => { ev.preventDefault(); unlock(); if (G.state === 'play') queued = 'F'; });
  let sw = null;
  cv.addEventListener('pointerdown', ev => { unlock(); sw = { x: ev.clientX, y: ev.clientY }; });
  cv.addEventListener('pointerup', ev => {
    if (!sw) return; const dx = ev.clientX - sw.x, dy = ev.clientY - sw.y; sw = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    queued = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
  });

  /* ---------- rendering helpers ---------- */
  /* Overlays (HUD bar, d-pad, fire button, minimap) sit on top of the canvas. measure() reads their boxes so the camera keeps the
     player inside the clear area, and so overlays that still end up over the player (map corners) fade out. */
  const hudEl = $('hud'), miniEl = $('mini');
  function measure() {
    const iw = innerWidth, ih = innerHeight, hr = hudEl.getBoundingClientRect();
    padTop = Math.min(Math.ceil(hr.bottom) + 4, ih * 0.3); padBot = 0; ovl = [{ el: hudEl, r: hr }];
    for (const id of ['mini', 'dpad', 'fire']) {
      const el = $(id), r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      ovl.push({ el, r });
      if (r.top > ih / 2 && r.right > iw * 0.3 && r.left < iw * 0.7) padBot = Math.max(padBot, ih - r.top + 6); // would sit under the centred player
    }
    padBot = Math.min(padBot, ih * 0.35);
    const px = Math.ceil(hr.bottom) + 'px'; if (document.documentElement.style.getPropertyValue('--hudh') !== px) document.documentElement.style.setProperty('--hudh', px);
  }
  function dimOverlays(now) { // fade any overlay that currently covers the player
    const [qx, qy] = pos(G.p, now), sx = ((qx + 0.5) * ts - cam.x * ts) / dpr, sy = ((qy + 0.5) * ts - cam.y * ts) / dpr, r = ts / dpr * 0.6;
    for (const o of ovl) o.el.classList.toggle('dim', sx + r > o.r.left && sx - r < o.r.right && sy + r > o.r.top && sy - r < o.r.bottom);
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const iw = Math.max(1, innerWidth), ih = Math.max(1, innerHeight);
    W = cv.width = Math.max(1, Math.floor(iw * dpr)); H = cv.height = Math.max(1, Math.floor(ih * dpr));
    // tile size: ~28 tiles across on desktop, ~24 on small laptops, ~18 on tablets, ~13 on phones; never fewer than ~10 rows
    const across = iw < 520 ? 13 : iw < 900 ? 18 : iw < 1200 ? 24 : 28;
    const css = Math.max(20, Math.floor(Math.min(iw / across, ih / 10)));
    ts = Math.floor(css * dpr); u = Math.max(1, Math.round(ts / 16));
    ctx.imageSmoothingEnabled = false;
    const coarse = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
    mt = coarse ? 1.5 : 2; ms = Math.max(1, Math.round(dpr)); // minimap: css px per tile, backing-store scale
    miniEl.style.width = MW * mt + 'px'; miniEl.style.height = MH * mt + 'px'; miniEl.width = MW * mt * ms; miniEl.height = MH * mt * ms; mctx.imageSmoothingEnabled = false;
    const mk = (inner, stops) => {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const gr = g.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, W, H); return c;
    };
    vign = mk(Math.min(W, H) * 0.3, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.8)']]);
    hurtImg = mk(Math.min(W, H) * 0.2, [[0, 'rgba(255,0,0,0)'], [1, 'rgba(255,20,20,0.75)']]);
    measure(); miniDirty = true;
    if (G) { clampCam(1); }
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 150));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); if (G) clampCam(1); });
  function clampCam(snap) {
    let [px, py] = pos(G.p, performance.now());
    if (G.fb) { px += (G.fb.x - 0.5 - px) * 0.5; py += (G.fb.y - 0.5 - py) * 0.5; } // pan toward a fireball in flight
    const vw = W / ts, top = padTop * dpr / ts, safe = (H - (padTop + padBot) * dpr) / ts; // all in tiles
    let tx = px + 0.5 - vw / 2, ty = py + 0.5 - top - safe / 2; // centre the target in the clear area under the HUD
    tx = MW <= vw ? (MW - vw) / 2 : Math.max(0, Math.min(MW - vw, tx));
    ty = MH <= safe ? -top + (safe - MH) / 2 : Math.max(-top, Math.min(MH - top - safe, ty));
    if (snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * 0.2; cam.y += (ty - cam.y) * 0.2; }
  }
  const hash = (x, y) => (Math.imul(x * 73856093 ^ y * 19349663, 2654435761) >>> 0);
  const tileAt = (x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 0 : G.tiles[y * MW + x];
  const clamp8 = v => v > 255 ? 255 : v < 0 ? 0 : v | 0;
  function shade(c, l) { // unified lit/remembered look: l=0 is the dim, desaturated "explored" state
    const k = 0.2 + 0.95 * l, s = 0.3 + 0.7 * l, g = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    return `rgb(${clamp8((g + (c[0] - g) * s) * k * (1 + 0.3 * l))},${clamp8((g + (c[1] - g) * s) * k * (1 + 0.05 * l))},${clamp8((g + (c[2] - g) * s) * k * (1.08 - 0.28 * l))})`;
  }
  function drawTile(x, y, sx, sy, l, now) {
    const t = tileAt(x, y), h = hash(x, y), a = 0.2 + 0.95 * l, vr = h % 9;
    if (t === 0) {
      let near = false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (tileAt(x + i, y + j)) near = true;
      if (!near) return;
      if (tileAt(x, y + 1)) { // front face with bricks
        ctx.fillStyle = shade([84 + vr, 68 + vr, 98 + vr], l); ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = `rgba(0,0,0,${0.38 * a})`;
        ctx.fillRect(sx, sy + ts / 2 | 0, ts, u); ctx.fillRect(sx + ts / 2 | 0, sy, u, ts / 2 | 0);
        ctx.fillRect(sx + ts / 4 | 0, sy + ts / 2 | 0, u, ts / 2 | 0); ctx.fillRect(sx + ts * 3 / 4 | 0, sy + ts / 2 | 0, u, ts / 2 | 0);
        ctx.fillStyle = `rgba(255,235,255,${0.16 * a})`; ctx.fillRect(sx, sy, ts, u * 2);
        ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`; ctx.fillRect(sx, sy + ts - u * 2, ts, u * 2);
      } else { // top face
        ctx.fillStyle = shade([40 + vr, 34 + vr, 56 + vr], l); ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = `rgba(190,170,230,${0.14 * a})`;
        if (tileAt(x, y - 1)) ctx.fillRect(sx, sy, ts, u);
        if (tileAt(x - 1, y)) ctx.fillRect(sx, sy, u, ts);
        if (tileAt(x + 1, y)) ctx.fillRect(sx + ts - u, sy, u, ts);
      }
      return;
    }
    ctx.fillStyle = shade([46 + vr + (((x + y) & 1) * 3), 40 + vr, 62 + (h % 11)], l); ctx.fillRect(sx, sy, ts, ts);
    if (t === 2) { // stairs
      for (let k = 0; k < 4; k++) { const o = ts * 0.1 * k; ctx.fillStyle = shade([70 - k * 13, 90 - k * 16, 110 - k * 18], l); ctx.fillRect(sx + o, sy + o, ts - o * 2, ts - o * 2); }
      return;
    }
    ctx.fillStyle = `rgba(0,0,0,${0.16 * a})`; ctx.fillRect(sx + ts - u, sy, u, ts); ctx.fillRect(sx, sy + ts - u, ts, u);
    if (h % 5 === 0) { ctx.fillStyle = `rgba(0,0,0,${0.3 * a})`; const cx = sx + ((h >> 4) % 8 + 3) * ts / 16, cy = sy + ((h >> 8) % 8 + 3) * ts / 16; ctx.fillRect(cx, cy, ts / 3, u); ctx.fillRect(cx + ts / 3, cy + u, u, ts / 6); }
    if (h % 3 === 0) { ctx.fillStyle = `rgba(255,230,200,${0.09 * a})`; ctx.fillRect(sx + ((h >> 3) % 13 + 1) * ts / 16, sy + ((h >> 7) % 13 + 1) * ts / 16, u, u); }
    if (!tileAt(x, y - 1)) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(sx, sy, ts, ts * 0.24); }
    if (!tileAt(x - 1, y)) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(sx, sy, ts * 0.14, ts); }
  }
  function glow(col, blur) { ctx.shadowColor = col; ctx.shadowBlur = blur; }
  function drawItem(it, cx, cy, now) {
    const s = ts, bob = Math.sin(now / 300 + it.x * 2 + it.y) * s * 0.03;
    ctx.save(); cy += bob;
    if (it.type === 'gold') {
      glow('#ffc933', s * 0.7);
      [[-0.14, 0.08, 0.14], [0.12, 0.1, 0.13], [0, -0.08, 0.15]].forEach(([dx, dy, r]) => {
        ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.ellipse(cx + dx * s, cy + dy * s, r * s, r * s * 0.8, 0, 0, 7); ctx.fill();
      });
      glow('transparent', 0); ctx.fillStyle = '#fff3b0'; ctx.fillRect(cx - s * 0.06, cy - s * 0.16, u * 2, u);
      const tw = Math.max(0, Math.sin(now / 220 + it.x * 5)); ctx.fillStyle = `rgba(255,255,255,${tw})`; ctx.fillRect(cx + s * 0.12 | 0, cy - s * 0.2 | 0, u * 2, u * 2);
    } else if (it.type === 'chest') {
      glow('#ffb52e', s * 0.8);
      ctx.fillStyle = '#7a4a22'; ctx.fillRect(cx - s * 0.3, cy - s * 0.12, s * 0.6, s * 0.34);
      ctx.fillStyle = '#9a6330'; ctx.fillRect(cx - s * 0.3, cy - s * 0.26, s * 0.6, s * 0.17);
      glow('transparent', 0); ctx.fillStyle = '#ffd34d'; ctx.fillRect(cx - s * 0.04, cy - s * 0.12, s * 0.08, s * 0.12); ctx.fillRect(cx - s * 0.3, cy - s * 0.1, s * 0.6, u);
      ctx.fillStyle = '#2b1a0c'; ctx.fillRect(cx - s * 0.3, cy + s * 0.2, s * 0.6, u);
    } else {
      glow('#ff4d6d', s * 0.9);
      ctx.fillStyle = '#e8365a'; ctx.beginPath(); ctx.arc(cx, cy + s * 0.08, s * 0.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#cfe9ff'; ctx.fillRect(cx - s * 0.06, cy - s * 0.22, s * 0.12, s * 0.16);
      glow('transparent', 0); ctx.fillStyle = '#8a5a2b'; ctx.fillRect(cx - s * 0.08, cy - s * 0.27, s * 0.16, s * 0.06);
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - s * 0.1, cy, u * 2, u * 3);
    }
    ctx.restore();
  }
  function drawEnemy(e, cx, cy, now) {
    const s = ts, flash = now - e.hitT < 110, bob = Math.sin(now / 240 + e.x * 3 + e.y) * s * 0.03, c = flash ? '#ffffff' : e.k.col;
    ctx.save(); cy += bob;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.36, s * 0.26, s * 0.08, 0, 0, 7); ctx.fill();
    glow(e.k.glow, s * 0.55); ctx.fillStyle = c;
    if (e.kind === 'slime') {
      const sq = 1 + Math.sin(now / 200 + e.x) * 0.06;
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.12, s * 0.3 * sq, s * 0.24 / sq, 0, Math.PI, 0); ctx.rect(cx - s * 0.3 * sq, cy + s * 0.12, s * 0.6 * sq, s * 0.2); ctx.fill();
      glow('transparent', 0); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(cx - s * 0.17, cy - s * 0.06, s * 0.1, u * 2);
      ctx.fillStyle = '#10301a'; ctx.fillRect(cx - s * 0.14, cy + s * 0.08, s * 0.07, s * 0.1); ctx.fillRect(cx + s * 0.07, cy + s * 0.08, s * 0.07, s * 0.1);
    } else if (e.kind === 'skeleton') {
      ctx.beginPath(); ctx.arc(cx, cy - s * 0.14, s * 0.2, 0, 7); ctx.fill(); ctx.fillRect(cx - s * 0.12, cy - s * 0.02, s * 0.24, s * 0.08);
      ctx.fillRect(cx - u, cy + s * 0.05, u * 2, s * 0.25); ctx.fillRect(cx - s * 0.2, cy + s * 0.1, s * 0.4, u * 2); ctx.fillRect(cx - s * 0.16, cy + s * 0.2, s * 0.32, u * 2);
      glow('transparent', 0); ctx.fillStyle = '#15101c'; ctx.fillRect(cx - s * 0.12, cy - s * 0.2, s * 0.08, s * 0.1); ctx.fillRect(cx + s * 0.04, cy - s * 0.2, s * 0.08, s * 0.1);
      ctx.fillStyle = '#7fb0ff'; ctx.fillRect(cx - s * 0.1, cy - s * 0.17, u * 2, u * 2); ctx.fillRect(cx + s * 0.06, cy - s * 0.17, u * 2, u * 2);
    } else {
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - s * 0.26, cy - s * 0.12); ctx.lineTo(cx - s * 0.36, cy - s * 0.42); ctx.lineTo(cx - s * 0.08, cy - s * 0.24); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + s * 0.26, cy - s * 0.12); ctx.lineTo(cx + s * 0.36, cy - s * 0.42); ctx.lineTo(cx + s * 0.08, cy - s * 0.24); ctx.fill();
      glow('#ffcc00', s * 0.4); ctx.fillStyle = '#ffe14a'; ctx.fillRect(cx - s * 0.18, cy - s * 0.1, s * 0.12, u * 3); ctx.fillRect(cx + s * 0.06, cy - s * 0.1, s * 0.12, u * 3);
      glow('transparent', 0); ctx.fillStyle = '#2a0a0a'; ctx.fillRect(cx - s * 0.14, cy + s * 0.1, s * 0.28, u * 2);
    }
    ctx.restore();
    if (e.hp < e.maxhp) { // little health bar
      const bw = s * 0.6, bx = cx - bw / 2, by = cy - s * 0.46;
      ctx.fillStyle = '#000a'; ctx.fillRect(bx - u, by - u, bw + u * 2, u * 3 + u * 2); ctx.fillStyle = '#ff4b3f'; ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxhp), u * 3);
    }
  }
  function drawPlayer(cx, cy, now) {
    const s = ts, flash = now - G.p.hitT < 110 || G.state === 'dead', bob = Math.sin(now / 300) * s * 0.025;
    ctx.save(); cy += bob;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.36, s * 0.26, s * 0.08, 0, 0, 7); ctx.fill();
    glow('#ffb347', s * 0.5); ctx.fillStyle = flash ? '#fff' : '#3b78c0';
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.34); ctx.lineTo(cx + s * 0.3, cy + s * 0.36); ctx.lineTo(cx - s * 0.3, cy + s * 0.36); ctx.fill();
    ctx.fillStyle = flash ? '#fff' : '#2c5a96'; ctx.beginPath(); ctx.arc(cx, cy - s * 0.16, s * 0.2, 0, 7); ctx.fill();
    glow('transparent', 0); ctx.fillStyle = '#120e1a'; ctx.fillRect(cx - s * 0.12, cy - s * 0.22, s * 0.24, s * 0.14);
    ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx - s * 0.09, cy - s * 0.17, u * 2, u * 2); ctx.fillRect(cx + s * 0.04, cy - s * 0.17, u * 2, u * 2);
    glow('#ff9a2e', s * 0.6); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(cx + s * 0.27, cy + s * 0.05, s * 0.07, 0, 7); ctx.fill();
    glow('transparent', 0); // facing marker: where a fireball would go (blue-grey when out of mana)
    { const [fx, fy] = G.face, mx = cx + fx * s * 0.62, my = cy + fy * s * 0.62 + s * 0.04, h = s * 0.1;
      ctx.fillStyle = G.mana >= FB_COST ? 'rgba(255,170,70,0.8)' : 'rgba(120,150,200,0.45)';
      ctx.beginPath(); ctx.moveTo(mx + fx * h, my + fy * h); ctx.lineTo(mx - fx * h - fy * h, my - fy * h + fx * h); ctx.lineTo(mx - fx * h + fy * h, my - fy * h - fx * h); ctx.fill(); }
    ctx.restore();
  }

  /* ---------- main draw ---------- */
  function draw(now, dt) {
    const camx = Math.round(cam.x * ts), camy = Math.round(cam.y * ts);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
    const sk = shake * dpr; ctx.translate((rnd() - 0.5) * sk, (rnd() - 0.5) * sk);
    const flick = 1 + 0.05 * Math.sin(now / 90) + 0.035 * Math.sin(now / 37 + 2) + 0.03 * Math.sin(now / 230);
    const [px, py] = pos(G.p, now), R = 9.5 * flick;
    const x0 = Math.max(0, Math.floor(cam.x)), y0 = Math.max(0, Math.floor(cam.y)), x1 = Math.min(MW - 1, Math.ceil(cam.x + W / ts)), y1 = Math.min(MH - 1, Math.ceil(cam.y + H / ts));
    const lights = []; // extra light sources: the flying fireball and short-lived impact flashes
    if (G.fb) lights.push({ x: G.fb.x, y: G.fb.y, r: 5.2 * (0.94 + 0.06 * Math.sin(now / 35)), k: 1 });
    for (let i = flashes.length - 1; i >= 0; i--) {
      const a = (now - flashes[i].t0) / flashes[i].dur; if (a >= 1) { flashes.splice(i, 1); continue; }
      lights.push({ x: flashes[i].x, y: flashes[i].y, r: flashes[i].r, k: flashes[i].k * (1 - a) * (1 - a) });
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * MW + x; if (!G.seen[i]) continue;
      let l = 0;
      if (G.vis[i]) {
        const d = Math.hypot(x + 0.5 - px - 0.5, y + 0.5 - py - 0.5) / R; l = d >= 1 ? 0 : 1 - d; l = l * l * (3 - 2 * l);
        for (const L of lights) { const e = Math.hypot(x + 0.5 - L.x, y + 0.5 - L.y) / L.r; if (e < 1) l += (1 - e) * (1 - e) * L.k; }
        if (l > 1) l = 1;
      }
      G.light[i] = l; drawTile(x, y, x * ts - camx, y * ts - camy, l, now);
    }
    const sx = G.stairs.x, sy = G.stairs.y;
    if (G.seen[sy * MW + sx]) { // stairs glow
      const cx = sx * ts - camx + ts / 2, cy = sy * ts - camy + ts / 2, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 1.1);
      const a = (0.25 + 0.15 * Math.sin(now / 400)) * (G.vis[sy * MW + sx] ? 1 : 0.5);
      g.addColorStop(0, `rgba(120,220,255,${a})`); g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(cx - ts * 1.2, cy - ts * 1.2, ts * 2.4, ts * 2.4); ctx.globalCompositeOperation = 'source-over';
    }
    for (const it of G.items) {
      const i = it.y * MW + it.x; if (!G.vis[i]) continue;
      ctx.globalAlpha = 0.45 + 0.55 * G.light[i]; drawItem(it, it.x * ts - camx + ts / 2, it.y * ts - camy + ts / 2, now);
    }
    for (const e of G.enemies) {
      if (!G.vis[e.y * MW + e.x]) continue;
      const [ex, ey] = pos(e, now); ctx.globalAlpha = 0.4 + 0.6 * G.light[e.y * MW + e.x];
      drawEnemy(e, (ex + 0.5) * ts - camx, (ey + 0.5) * ts - camy, now);
    }
    ctx.globalAlpha = 1; { const [qx, qy] = pos(G.p, now); drawPlayer((qx + 0.5) * ts - camx, (qy + 0.5) * ts - camy, now); }
    // particles
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 6 * dt; p.vx *= 0.97;
      ctx.globalAlpha = Math.min(1, p.life / 0.3); ctx.fillStyle = p.col; const z = Math.max(u, ts * 0.09 * (p.life / p.max + 0.3));
      ctx.fillRect(p.x * ts - camx - z / 2, p.y * ts - camy - z / 2, z, z);
    }
    ctx.globalAlpha = 1;
    if (G.fb) { // glowing core + halo
      const f = G.fb, cx = f.x * ts - camx, cy = f.y * ts - camy, pulse = 1 + 0.12 * Math.sin(now / 28), g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 0.85 * pulse);
      g.addColorStop(0, 'rgba(255,240,190,0.95)'); g.addColorStop(0.25, 'rgba(255,170,60,0.7)'); g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - ts, cy - ts, ts * 2, ts * 2);
      ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.13 * pulse, 0, 7); ctx.fill();
    }
    for (const L of lights) { // orange wash around each extra light
      const cx = L.x * ts - camx, cy = L.y * ts - camy, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * L.r);
      g.addColorStop(0, `rgba(255,150,60,${0.3 * Math.min(1, L.k)})`); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - ts * L.r, cy - ts * L.r, ts * L.r * 2, ts * L.r * 2);
    }
    // warm torch bloom
    { const cx = (px + 0.5) * ts - camx, cy = (py + 0.5) * ts - camy, g = ctx.createRadialGradient(cx, cy, 0, cx, cy, ts * 8 * flick);
      g.addColorStop(0, 'rgba(255,170,80,0.22)'); g.addColorStop(0.4, 'rgba(255,120,40,0.07)'); g.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
    // floating numbers
    ctx.font = `${Math.round(ts * 0.42)}px "Press Start 2P", monospace`; ctx.textAlign = 'center'; ctx.lineWidth = Math.max(2, u * 1.5); ctx.lineJoin = 'round';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], a = (now - f.t) / 900; if (a >= 1) { floats.splice(i, 1); continue; }
      ctx.globalAlpha = 1 - a * a; const fx = f.x * ts - camx, fy = (f.y - a * 0.9) * ts - camy;
      ctx.strokeStyle = '#000'; ctx.strokeText(f.text, fx, fy); ctx.fillStyle = f.col; ctx.fillText(f.text, fx, fy);
    }
    ctx.globalAlpha = 1; ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vign, 0, 0);
    if (hurt > 0.01) { ctx.globalAlpha = hurt; ctx.drawImage(hurtImg, 0, 0); ctx.globalAlpha = 1; }
    if (fade > 0.01) { ctx.fillStyle = `rgba(5,4,10,${fade})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawMini() {
    mctx.setTransform(ms, 0, 0, ms, 0, 0);
    mctx.fillStyle = '#05040a'; mctx.fillRect(0, 0, MW * mt, MH * mt);
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = y * MW + x; if (!G.seen[i] || !G.tiles[i]) continue;
      mctx.fillStyle = G.tiles[i] === 2 ? '#7fe3ff' : G.vis[i] ? '#8a7aa8' : '#41375a'; mctx.fillRect(x * mt, y * mt, mt, mt);
    }
    mctx.fillStyle = '#ffb347'; mctx.fillRect((G.p.x - 0.5) * mt, (G.p.y - 0.5) * mt, mt * 2, mt * 2);
    for (const e of G.enemies) if (G.vis[e.y * MW + e.x]) { mctx.fillStyle = '#ff5a5a'; mctx.fillRect(e.x * mt, e.y * mt, mt, mt); }
  }

  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (G.fb) { queued = null; updateFireball(t, dt); } // input is blocked while a fireball is in flight
    else if (G.state === 'play' && t - lastAct >= MOVE_MS) {
      const d = queued || held[held.length - 1]; queued = null;
      if (d && act(d, t)) lastAct = t;
    }
    if (++frameNo % 15 === 0) measure();
    clampCam(0);
    shake *= Math.pow(0.001, dt); if (shake < 0.1) shake = 0;
    hurt = Math.max(0, hurt - dt * 2.2); fade = Math.max(0, fade - dt * 2.5);
    draw(t, dt);
    if (frameNo % 6 === 0) dimOverlays(t);
    if (miniDirty) { drawMini(); miniDirty = false; }
    requestAnimationFrame(frame);
  }
  resize(); newGame(); cam.x = G.p.x - W / ts / 2; clampCam(1);
  requestAnimationFrame(frame);
})();
