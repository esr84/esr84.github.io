'use strict';
// Núcleo: espacio de nombres, utilidades, lienzo HiDPI, entrada y física.
window.G = window.G || {};

(function () {
  const W = 960, H = 540;
  G.W = W; G.H = H;
  G.params = new URLSearchParams(location.search);
  G.debug = G.params.has('debug');
  // accesibilidad: sin destellos en negativo y menos sacudida si el sistema pide reducir movimiento
  G.reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------------------------------------------------------------- utilidades
  const U = G.U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    choose: (arr) => arr[Math.floor(Math.random() * arr.length)],
    sign: (v) => (v < 0 ? -1 : 1),
    approach: (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t)),
    overlap: (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    smooth: (t) => t * t * (3 - 2 * t),
    // rectángulo de colisión de una entidad cuyo origen está en los pies (centro-abajo)
    box: (e) => ({ x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h }),
  };

  // ---------------------------------------------------------------- lienzo
  const canvas = G.canvas = document.getElementById('game');
  const ctx = G.ctx = canvas.getContext('2d');
  G.renderScale = 1;
  // táctil si el puntero principal es "grueso" (móvil/tablet); en PC se activa al primer toque real
  G.isTouch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches) || G.params.has('touch');

  G.resize = function () {
    const vw = window.innerWidth, vh = window.innerHeight;
    const portrait = vh > vw;
    let availH = vh;
    if (portrait) availH = vh * 0.62;           // deja sitio para los controles
    const scale = Math.min(vw / W, availH / H);
    const cssW = Math.floor(W * scale), cssH = Math.floor(H * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, G.isTouch ? 2 : 2.5);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    G.renderScale = canvas.width / W;
    G.cssScale = scale;
  };
  window.addEventListener('resize', G.resize);
  window.addEventListener('orientationchange', () => setTimeout(G.resize, 200));
  G.resize();

  // convierte coordenadas de pantalla a coordenadas lógicas del juego
  G.toLogical = function (clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * W, y: (clientY - r.top) / r.height * H };
  };

  // ---------------------------------------------------------------- entrada
  // Cada acción puede estar pulsada por varias fuentes (teclado, táctil, mando).
  const Input = G.input = {
    held: {}, pressed: {}, _src: {},
    set(action, src, down) {
      const s = this._src[action] || (this._src[action] = new Set());
      const was = s.size > 0;
      if (down) s.add(src); else s.delete(src);
      const now = s.size > 0;
      if (now && !was) this.pressed[action] = true;
      this.held[action] = now;
    },
    consume() { this.pressed = {}; },
    clearAll() { this._src = {}; this.held = {}; this.pressed = {}; },
    anyPressed(...acts) { return acts.some((a) => this.pressed[a]); },
  };

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    KeyX: 'attack', KeyJ: 'attack',
    KeyC: 'special', KeyL: 'special',
    Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyM: 'mute',
  };
  window.addEventListener('keydown', (e) => {
    const a = KEYMAP[e.code];
    if (G.audio) G.audio.unlock();
    if (!a) return;
    e.preventDefault();
    if (!e.repeat) Input.set(a, 'k:' + e.code, true);
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    Input.set(a, 'k:' + e.code, false);
  });
  window.addEventListener('blur', () => Input.clearAll());

  // Mando (Gamepad API)
  const padState = {};
  G.pollGamepads = function () {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const p of pads) {
      if (!p) continue;
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const map = {
        left: b(14) || ax < -0.4, right: b(15) || ax > 0.4,
        up: b(12) || ay < -0.5, down: b(13) || ay > 0.5,
        jump: b(0), attack: b(2), special: b(1) || b(3),
        start: b(9), pause: b(8),
      };
      for (const k in map) {
        const id = 'g' + p.index + ':' + k;
        if (map[k] !== !!padState[id]) {
          padState[id] = map[k];
          Input.set(k, id, map[k]);
          if (map[k] && G.audio) G.audio.unlock();
        }
      }
    }
  };

  // vibración háptica breve (sólo móvil y tras un gesto del usuario)
  G.rumble = function (ms) {
    if (!G.isTouch || !G.userActed || !navigator.vibrate) return;
    try { navigator.vibrate(ms); } catch (_) { /* no disponible */ }
  };

  // ---------------------------------------------------------------- física
  // Entidades con origen en los pies. Colisión AABB contra sólidos y plataformas de un sentido.
  G.phys = {
    move(e, dt, level) {
      e.hitWall = 0;
      // eje X
      e.x += e.vx * dt;
      let r = U.box(e);
      for (const s of level.solids) {
        if (!U.overlap(r, s)) continue;
        // ignora si estamos esencialmente encima (escalones mínimos)
        if (r.y + r.h - s.y < 6 && e.vy >= 0) { e.y = s.y; r = U.box(e); continue; }
        if (e.x < s.x + s.w / 2) { e.x = s.x - e.w / 2 - 0.01; e.hitWall = 1; }
        else { e.x = s.x + s.w + e.w / 2 + 0.01; e.hitWall = -1; }
        r = U.box(e);
      }
      // eje Y
      const prevBottom = e.y;
      e.y += e.vy * dt;
      e.onGround = false;
      r = U.box(e);
      for (const s of level.solids) {
        if (!U.overlap(r, s)) continue;
        if (e.vy >= 0 && prevBottom <= s.y + 8) { e.y = s.y; e.vy = 0; e.onGround = true; e.groundRef = s; }
        else if (e.vy < 0) { e.y = s.y + s.h + e.h; e.vy = 0; }
        r = U.box(e);
      }
      if (e.vy >= 0 && !e.dropping) {
        for (const p of level.oneways) {
          if (e.x + e.w / 2 > p.x && e.x - e.w / 2 < p.x + p.w && prevBottom <= p.y + 1 && e.y >= p.y) {
            e.y = p.y; e.vy = 0; e.onGround = true; e.groundRef = p;
          }
        }
      }
    },
    // ¿hay suelo justo debajo del punto (x, y)?
    groundAt(level, x, y) {
      for (const s of level.solids) if (x >= s.x && x <= s.x + s.w && y >= s.y - 2 && y <= s.y + 12) return true;
      for (const p of level.oneways) if (x >= p.x && x <= p.x + p.w && y >= p.y - 2 && y <= p.y + 12) return true;
      return false;
    },
  };
})();
