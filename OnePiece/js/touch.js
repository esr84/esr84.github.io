'use strict';
// Controles táctiles (cruceta analógica + botones) y botones superiores.
(function () {
  const I = G.input;
  const root = document.getElementById('touch');
  const dpad = document.getElementById('dpad');
  const knob = document.getElementById('knob');

  const T = G.touchUI = {
    wanted: false,
    setVisible(v) {
      this.wanted = v;
      root.classList.toggle('hidden', !(v && G.isTouch));
      document.body.classList.toggle('touch', !!G.isTouch);
    },
  };

  // ---------------------------------------------------------------- cruceta
  let padId = null;
  const DIRS = ['left', 'right', 'up', 'down'];
  function applyPad(e) {
    const r = dpad.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width * 0.32;
    const len = Math.hypot(dx, dy);
    const k = len > max ? max / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const dead = r.width * 0.1;
    const st = {
      left: dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.45,
      right: dx > dead && Math.abs(dx) > Math.abs(dy) * 0.45,
      down: dy > r.width * 0.16 && Math.abs(dy) > Math.abs(dx) * 0.6,
      up: dy < -r.width * 0.16 && Math.abs(dy) > Math.abs(dx) * 0.6,
    };
    for (const d of DIRS) I.set(d, 'tpad', st[d]);
  }
  function releasePad() {
    padId = null;
    knob.style.transform = '';
    for (const d of DIRS) I.set(d, 'tpad', false);
  }
  dpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    padId = e.pointerId;
    try { dpad.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
    G.audio.unlock();
    applyPad(e);
  });
  dpad.addEventListener('pointermove', (e) => { if (e.pointerId === padId) applyPad(e); });
  dpad.addEventListener('pointerup', (e) => { if (e.pointerId === padId) releasePad(); });
  dpad.addEventListener('pointercancel', (e) => { if (e.pointerId === padId) releasePad(); });
  dpad.addEventListener('lostpointercapture', () => releasePad());

  // ---------------------------------------------------------------- botones
  document.querySelectorAll('.tbtn').forEach((b) => {
    const act = b.dataset.action;
    const src = 'tb:' + act;
    const down = (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
      G.audio.unlock();
      I.set(act, src, true);
      b.classList.add('on');
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (_) { /* no disponible */ }
    };
    const up = (e) => { e.preventDefault(); I.set(act, src, false); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  // ---------------------------------------------------------------- toques en el lienzo (menús, diálogos)
  G.canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !G.isTouch) { G.isTouch = true; T.setVisible(T.wanted); G.resize(); }
    G.audio.unlock();
    const p = G.toLogical(e.clientX, e.clientY);
    if (G.game) G.game.tap(p.x, p.y);
  });
  window.addEventListener('touchstart', () => {
    if (!G.isTouch) { G.isTouch = true; T.setVisible(T.wanted); G.resize(); }
  }, { passive: true });
  // evita el menú contextual / zoom por doble toque
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  // ---------------------------------------------------------------- botones superiores
  const bPause = document.getElementById('btnPause');
  const bMute = document.getElementById('btnMute');
  const bFull = document.getElementById('btnFull');
  bPause.addEventListener('click', () => { G.audio.unlock(); if (G.game) G.game.togglePause(); });
  bMute.addEventListener('click', () => {
    G.audio.unlock();
    G.audio.setMuted(!G.audio.muted);
    bMute.classList.toggle('off', G.audio.muted);
    try { localStorage.setItem('op_muted', G.audio.muted ? '1' : '0'); } catch (_) { /* sin almacenamiento */ }
  });
  try { if (localStorage.getItem('op_muted') === '1') { G.audio.muted = true; bMute.classList.add('off'); } } catch (_) { /* sin almacenamiento */ }
  bFull.addEventListener('click', async () => {
    G.audio.unlock();
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement) {
        await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } else await document.exitFullscreen();
    } catch (_) { /* pantalla completa no disponible (p. ej. iPhone) */ }
    setTimeout(G.resize, 250);
  });
  if (!document.fullscreenEnabled && !document.webkitFullscreenEnabled) bFull.style.display = 'none';
})();
