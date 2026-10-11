'use strict';
// Interfaz dibujada en el canvas: HUD, diálogos, menús y pantallas finales.
(function () {
  const U = G.U, A = G.art, W = G.W, H = G.H;
  const UI = G.ui = {};
  const FONT = 'Bangers, Impact, sans-serif';
  const FONT2 = '"Lilita One", "Trebuchet MS", sans-serif';

  function text(ctx, str, x, y, size, color = '#fff', align = 'center', edge = '#1a0e1e', font = FONT, lw) {
    ctx.save();
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw ?? Math.max(3, size * 0.2);
    ctx.strokeStyle = edge;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  UI.text = text;
  function panel(ctx, x, y, w, h, r = 12, fill = 'rgba(18,8,28,.78)', stroke = 'rgba(255,230,160,.55)') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
    ctx.restore();
  }
  UI.panel = panel;
  function wrap(ctx, str, maxW) {
    const words = str.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ---------------------------------------------------------------- retratos
  const PORTRAIT = {
    LUFFY: { fn: 'drawLuffy', hy: -96, s: 2.5, pose: (t) => A.pose.idle(t) },
    DANIELA: { fn: 'drawDaniela', hy: -100, s: 2.5, pose: (t) => Object.assign(A.pose.idle(t), { pocketF: 1, pocketB: 1, aF: -0.05, eF: 0.75 }) },
    ARLONG: { fn: 'drawArlong', hy: -142, dx: -12, s: 1.6, pose: (t) => Object.assign(A.pose.idle(t), { face: 'shout' }) },
    HATCHAN: { fn: 'drawHatchan', hy: -100, dx: -2, s: 1.9, pose: (t) => A.pose.idle(t) },
    NAMI: { fn: 'drawNami', hy: -96, s: 2.5, pose: (t) => Object.assign(A.pose.idle(t), { face: 'happy' }) },
  };
  UI.portrait = function (ctx, who, x, y, r, t, bg = '#2a1a3a', face) {
    const P = PORTRAIT[who];
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(x, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, '#6a4a8a'); g.addColorStop(1, bg);
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    if (P) {
      ctx.translate(x, y + 4);
      ctx.scale(P.s * r / 34, P.s * r / 34);
      ctx.translate(P.dx ?? -3, -P.hy);
      const pose = P.pose(t);
      if (face) pose.face = face;
      A[P.fn](ctx, pose, t);
    }
    ctx.restore();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffe2a0';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  // ---------------------------------------------------------------- HUD
  // forma inclinada (paralelogramo) para el HUD estilo manga
  function skew(ctx, x, y, w, h, k) {
    ctx.beginPath(); ctx.moveTo(x + k, y); ctx.lineTo(x + w + k, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
  }
  UI.drawHUD = function (ctx, g) {
    const p = g.player, L = p.kind === 'luffy';
    const col = L ? '#d8322a' : '#3a6ad8', colD = L ? '#7a1418' : '#1a2a6a';
    ctx.save();
    if (g.hurtT > 0.2) ctx.translate(U.rand(-3, 3), U.rand(-2, 2));
    ctx.lineJoin = 'round';
    // panel principal
    skew(ctx, 10, 10, 392, 64, 10);
    const pg = ctx.createLinearGradient(0, 10, 0, 74);
    pg.addColorStop(0, 'rgba(34,16,44,.92)'); pg.addColorStop(1, 'rgba(14,6,24,.92)');
    ctx.fillStyle = pg; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(96, 0); ctx.lineTo(70, 90); ctx.lineTo(0, 90); ctx.closePath(); ctx.fill();
    ctx.fillStyle = colD; ctx.beginPath(); ctx.moveTo(96, 0); ctx.lineTo(104, 0); ctx.lineTo(78, 90); ctx.lineTo(70, 90); ctx.closePath(); ctx.fill();
    UI.halftone(ctx, 0, 10, 100, 64, 'rgba(0,0,0,.18)', 6, 1.6, false);
    ctx.restore();
    skew(ctx, 10, 10, 392, 64, 10);
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a0e1e'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,230,160,.6)'; ctx.stroke();
    // retrato con marco de estallido dorado
    ctx.save(); ctx.translate(46, 42); ctx.rotate(g.time * 0.4);
    A.star(ctx, 0, 0, 36, 28, 14); ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#1a0e1e'; ctx.stroke();
    ctx.restore();
    UI.portrait(ctx, p.name, 46, 42, 26, g.time);
    // nombre
    ctx.save(); ctx.translate(92, 24); ctx.rotate(-0.04);
    text(ctx, p.name, 0, 0, 22, '#ffe14a', 'left', '#1a0e1e', FONT, 6);
    ctx.restore();
    // vida: celdas inclinadas con brillo
    for (let i = 0; i < p.maxHp; i++) {
      const x = 92 + i * 12.6, y = 36;
      skew(ctx, x, y, 10, 13, 3);
      let fill;
      if (i < p.hp) {
        const lowBlink = p.hp <= 4 && Math.floor(g.time * 6) % 2;
        const hg = ctx.createLinearGradient(0, y, 0, y + 13);
        hg.addColorStop(0, lowBlink ? '#ffb09a' : '#ff8a7a'); hg.addColorStop(0.45, lowBlink ? '#ff6a5a' : '#ff3a4a'); hg.addColorStop(1, '#a8142a');
        fill = hg;
      } else fill = i < g.hudHp ? '#ffe27a' : '#2a1a34';
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 1.6; ctx.stroke();
      if (i < p.hp) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x + 3.5, y + 2, 6, 2.2); }
    }
    // energía: barra inclinada con divisiones cada 10
    const ex = 92, ey = 55, ew = 200;
    skew(ctx, ex, ey, ew, 10, 3); ctx.fillStyle = '#16203a'; ctx.fill();
    ctx.save(); skew(ctx, ex, ey, ew, 10, 3); ctx.clip();
    const eg = ctx.createLinearGradient(0, ey, 0, ey + 10);
    eg.addColorStop(0, '#c8f6ff'); eg.addColorStop(0.5, '#4ac0f0'); eg.addColorStop(1, '#1a6ab0');
    ctx.fillStyle = eg; ctx.fillRect(ex, ey, (ew + 3) * p.energy / p.maxEnergy, 10);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    for (let i = 1; i < 5; i++) ctx.fillRect(ex + i * ew / 5 + 1, ey, 1.6, 10);
    ctx.restore();
    skew(ctx, ex, ey, ew, 10, 3); ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 1.6; ctx.stroke();
    if (p.energy >= 10) {
      const pulse = 0.5 + 0.5 * Math.sin(g.time * 8);
      ctx.save();
      ctx.globalAlpha = 0.35 + pulse * 0.4;
      const gg = ctx.createRadialGradient(312, 59, 1, 312, 59, 22);
      gg.addColorStop(0, '#8fe6ff'); gg.addColorStop(1, 'rgba(143,230,255,0)');
      ctx.fillStyle = gg; ctx.fillRect(290, 37, 44, 44);
      ctx.restore();
    }
    text(ctx, 'ESP', 300, 60, 13 + (p.energy >= 10 ? Math.sin(g.time * 8) * 1.2 : 0), p.energy >= 10 ? '#dff8ff' : '#5a6a8a', 'left', '#1a0e1e', FONT, 3);
    // vidas y puntos
    ctx.save(); ctx.translate(346, 28); ctx.scale(0.5, 0.5);
    if (L) A.drawStrawHat(ctx, 0, 0, 0); else { A.begin(ctx); A.limb(ctx, -16, 0, 14, 0, 3, 3, '#f4f1ea', null); ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(16, 0, 3.4, 0, 7); ctx.fill(); }
    ctx.restore();
    text(ctx, '×' + g.lives, 362, 30, 20, '#fff', 'left');
    text(ctx, 'PUNTOS', 334, 54, 11, '#ffd2a0', 'left', '#1a0e1e', FONT, 3);
    text(ctx, String(g.score).padStart(6, '0'), 340, 66, 14, '#fff', 'left', '#1a0e1e', FONT, 3);
    ctx.restore();

    // contador de combos estilo manga
    if (g.comboN >= 2) {
      const k = U.easeOutBack(g.comboPop), a = Math.min(1, g.comboT / 0.3);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W - 120, 150);
      ctx.rotate(-0.12);
      ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      const col = g.comboN >= 10 ? '#ff5a3a' : g.comboN >= 5 ? '#ffb02e' : '#ffe14a';
      text(ctx, String(g.comboN), 0, 0, 64, col, 'center', '#1a0e1e', FONT, 10);
      text(ctx, '¡GOLPES!', 0, 40, 24, '#fff', 'center', '#1a0e1e', FONT, 6);
      ctx.restore();
    }

    // jefe: barra continua con daño que se drena
    const b = g.boss;
    if (b && (b.active || b.state === 'rage' || b.state === 'rise') && b.hp > 0) {
      const bw = 300, bx = 446, by = 14;
      skew(ctx, bx - 30, by - 4, bw + 46, 48, 8);
      ctx.fillStyle = 'rgba(20,6,20,.9)'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#1a0e1e'; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,150,120,.6)'; ctx.stroke();
      // emblema del sol-tiburón
      ctx.save(); ctx.translate(bx - 8, by + 20);
      A.star(ctx, 0, 0, 15, 10, 12); ctx.fillStyle = '#e8e0d0'; ctx.fill(); ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#1b1426'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.moveTo(-6, 1); for (let i = 0; i < 4; i++) { ctx.lineTo(-4.5 + i * 3, 4); ctx.lineTo(-3 + i * 3, 1); } ctx.lineTo(6, 1); ctx.quadraticCurveTo(0, 8, -6, 1); ctx.fill();
      ctx.restore();
      text(ctx, b.name, bx + 14, by + 7, 18, '#ff9a6a', 'left', '#1a0e1e', FONT, 5);
      const hx = bx + 12, hy = by + 20, hw = bw - 10, hh = 14;
      skew(ctx, hx, hy, hw, hh, 4); ctx.fillStyle = '#2a1a34'; ctx.fill();
      ctx.save(); skew(ctx, hx, hy, hw, hh, 4); ctx.clip();
      const drain = (g.bossHud ?? b.hp) / b.maxHp, cur = b.hp / b.maxHp;
      ctx.fillStyle = '#ffe27a'; ctx.fillRect(hx, hy, (hw + 4) * drain, hh);
      const bg = ctx.createLinearGradient(0, hy, 0, hy + hh);
      bg.addColorStop(0, b.flashT > 0 ? '#ffffff' : '#ffb06a'); bg.addColorStop(0.5, b.flashT > 0 ? '#fff0e0' : '#ff5a2a'); bg.addColorStop(1, '#8a1a10');
      ctx.fillStyle = bg; ctx.fillRect(hx, hy, (hw + 4) * cur, hh);
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(hx, hy + 2, (hw + 4) * cur, 3);
      ctx.restore();
      skew(ctx, hx, hy, hw, hh, 4); ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 2; ctx.stroke();
    }
  };

  // ---------------------------------------------------------------- diálogos
  const WHO_COL = { LUFFY: '#d8322a', DANIELA: '#3a6ad8', ARLONG: '#2a5a8a', HATCHAN: '#d86a8a', NAMI: '#ff8a2a' };
  UI.drawDialog = function (ctx, g) {
    const d = g.dialog;
    if (!d) return;
    const line = d.lines[d.i];
    const y = 96, left = line.who === g.player.name || line.who === 'NAMI';
    const px = left ? 82 : W - 82;
    // bocadillo blanco con rabito hacia el retrato
    const bx = left ? 150 : 34, bw = W - 184, bh = 118;
    ctx.save();
    ctx.lineJoin = 'round';
    const bubble = new Path2D();
    const r = 26;
    bubble.moveTo(bx + r, y); bubble.lineTo(bx + bw - r, y); bubble.quadraticCurveTo(bx + bw, y, bx + bw, y + r);
    bubble.lineTo(bx + bw, y + bh - r); bubble.quadraticCurveTo(bx + bw, y + bh, bx + bw - r, y + bh);
    if (!left) { bubble.lineTo(bx + bw - 30, y + bh); bubble.lineTo(px - 40, y + bh - 10); bubble.lineTo(bx + bw - 64, y + bh); }
    bubble.lineTo(bx + r, y + bh);
    if (left) { bubble.lineTo(bx + 64, y + bh); bubble.lineTo(px + 40, y + bh - 10); bubble.lineTo(bx + 30, y + bh); }
    bubble.quadraticCurveTo(bx, y + bh, bx, y + bh - r); bubble.lineTo(bx, y + r); bubble.quadraticCurveTo(bx, y, bx + r, y); bubble.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.translate(4, 5); ctx.fill(bubble); ctx.translate(-4, -5);
    ctx.fillStyle = '#fffdf6'; ctx.fill(bubble);
    ctx.lineWidth = 4; ctx.strokeStyle = '#1a0e1e'; ctx.stroke(bubble);
    ctx.restore();
    // retrato con estallido
    ctx.save(); ctx.translate(px, y + 60); ctx.rotate(g.time * 0.5);
    A.star(ctx, 0, 0, 62, 50, 16); ctx.fillStyle = WHO_COL[line.who] || '#ffd23a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1a0e1e'; ctx.stroke();
    ctx.restore();
    UI.portrait(ctx, line.who, px, y + 60, 46, g.time, undefined, line.face);
    // etiqueta del nombre
    const tx = bx + 28, tw = bw - 60;
    ctx.save(); ctx.translate(tx - 6, y - 4); ctx.rotate(-0.04);
    ctx.font = `22px ${FONT}`;
    const nw = ctx.measureText(line.who).width + 26;
    ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(nw + 6, -14); ctx.lineTo(nw, 14); ctx.lineTo(0, 14); ctx.closePath();
    ctx.fillStyle = WHO_COL[line.who] || '#ffd23a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1a0e1e'; ctx.stroke();
    text(ctx, line.who, 13, 1, 22, '#fff', 'left', '#1a0e1e', FONT, 5);
    ctx.restore();
    // texto con efecto máquina de escribir
    ctx.save();
    ctx.font = `21px ${FONT2}`;
    ctx.fillStyle = '#1a0e1e';
    ctx.textBaseline = 'top';
    const shown = line.text.slice(0, Math.floor(d.chars));
    const lines = wrap(ctx, line.text, tw);
    let rem = shown.length;
    lines.forEach((ln, i) => {
      const part = ln.slice(0, Math.max(0, rem));
      rem -= ln.length + 1;
      ctx.fillText(part, tx, y + 24 + i * 27);
    });
    ctx.restore();
    if (d.chars >= line.text.length && Math.floor(g.time * 3) % 2) text(ctx, '▼', bx + bw - 30, y + bh - 20, 18, '#d8322a');
  };

  // ---------------------------------------------------------------- título (ilustración tipo cartel)
  // logotipo: letras con varias capas de contorno, degradado y el sombrero de paja sobre la "O"
  UI.drawLogo = function (ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.04);
    ctx.font = `104px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    const str = 'ONE PIECE';
    ctx.lineWidth = 26; ctx.strokeStyle = '#1a0e1e'; ctx.strokeText(str, 0, 6);
    ctx.lineWidth = 18; ctx.strokeStyle = '#1d4fa8'; ctx.strokeText(str, 0, 0);
    ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.strokeText(str, 0, 0);
    // degradado con banda de brillo integrada
    const gr = ctx.createLinearGradient(0, -44, 0, 44);
    gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.3, '#fff0a0'); gr.addColorStop(0.31, '#ffd23a'); gr.addColorStop(0.6, '#ffb21a'); gr.addColorStop(1, '#ff6a1a');
    ctx.fillStyle = gr; ctx.fillText(str, 0, 0);
    // sombrero de paja apoyado en la primera letra
    const ow = ctx.measureText('ONE PIECE').width;
    ctx.save(); ctx.translate(-ow / 2 + 30, -46); ctx.scale(1.55, 1.55);
    A.begin(ctx);
    A.drawStrawHat(ctx, 0, 0, -0.25 + Math.sin(t * 2) * 0.03);
    ctx.restore();
    ctx.restore();
  };
  UI.drawRibbon = function (ctx, x, y, w, str, t) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.02);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a0e1e';
    // puntas plegadas
    for (const d of [-1, 1]) {
      ctx.fillStyle = '#8a1a1a';
      ctx.beginPath();
      ctx.moveTo(d * (w / 2 - 10), -8); ctx.lineTo(d * (w / 2 + 34), -8); ctx.lineTo(d * (w / 2 + 20), 12); ctx.lineTo(d * (w / 2 + 34), 32); ctx.lineTo(d * (w / 2 - 10), 32);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    const g = ctx.createLinearGradient(0, -20, 0, 22);
    g.addColorStop(0, '#ff5a4a'); g.addColorStop(0.5, '#d8282a'); g.addColorStop(1, '#a01818');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-w / 2, -20); ctx.quadraticCurveTo(0, -28, w / 2, -20); ctx.lineTo(w / 2, 22); ctx.quadraticCurveTo(0, 14, -w / 2, 22); ctx.closePath();
    ctx.fill(); ctx.stroke();
    text(ctx, str, 0, 0, 34, '#fff6d8', 'center', '#5a0a0a', FONT, 6);
    ctx.restore();
  };
  UI.drawTitle = function (ctx, g) {
    const t = g.time;
    g.level.drawSky(ctx, 0, t);
    // estallido radial de luz detrás de la escena
    ctx.save();
    ctx.translate(W / 2, 250);
    ctx.rotate(t * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 24; i++) {
      ctx.rotate(Math.PI / 12);
      ctx.fillStyle = i % 2 ? 'rgba(255,200,140,.06)' : 'rgba(255,160,120,.03)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-90, -700); ctx.lineTo(90, -700); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // silueta gigante de Arlong en el cielo, con ojos rojos encendidos
    const ap = Object.assign(A.pose.idle(t * 0.6), { aF: 0.9, eF: 0.9, aB: -0.4, eB: 0.6, face: 'shout', sword: 1, wA: 2.6 });
    const AX = 790, AY = 640, AS = 3.0;
    ctx.save();
    ctx.translate(AX, AY); ctx.scale(-AS, AS);
    ctx.globalAlpha = 0.82;
    A.flash = '#2a1438'; A.noOutline = true;
    A.drawArlong(ctx, ap, t);
    A.flash = false; A.noOutline = false;
    ctx.restore();
    {
      const J = A.solve(ap, A.ARLONG_DIMS);
      const eye = A.headPoint(J, 15.2 * 1.12, -29 * 1.12);
      const ex = AX - eye.x * AS, ey = AY + eye.y * AS;
      const pulse = 0.75 + 0.25 * Math.sin(t * 3);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 26);
      eg.addColorStop(0, `rgba(255,80,60,${pulse})`); eg.addColorStop(1, 'rgba(255,40,40,0)');
      ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff0e0'; ctx.beginPath(); ctx.ellipse(ex, ey, 5, 2.4, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    g.level.drawSea(ctx, 0, t);
    // entrada animada: héroes deslizándose, logo que cae y cinta que entra
    const it = g.stateT || 0;
    const slideL = (1 - U.easeOutCubic(U.clamp(it / 0.6, 0, 1))) * -420;
    const slideR = (1 - U.easeOutCubic(U.clamp((it - 0.1) / 0.6, 0, 1))) * 420;
    // héroes en acción
    ctx.save(); ctx.translate(170 + slideL, 505); ctx.scale(2.35, 2.35);
    A.shadow(ctx, 20);
    A.drawLuffy(ctx, { torso: 0.25, head: -0.15, aF: Math.PI / 2 - 0.05, eF: 0, stretchF: 70 + Math.sin(t * 3) * 6, sagF: Math.sin(t * 5) * 3, aB: -0.8, eB: 1.3, lF: 0.7, kF: -0.5, lB: -0.6, kB: -0.1, hy: 4, face: 'grin', hatRot: Math.sin(t * 2) * 0.04 }, t);
    ctx.restore();
    ctx.save(); ctx.translate(800 + slideR, 505); ctx.scale(-2.35, 2.35);
    A.shadow(ctx, 20);
    A.drawDaniela(ctx, { torso: -0.45, head: 0.35, aF: -0.9, eF: 0.6, aB: -1.5, eB: 0.4, lF: 1.95 + Math.sin(t * 2.5) * 0.05, kF: 0, lB: -0.15, kB: -0.1, frontLegLast: 1, face: 'cool', hairSway: Math.sin(t * 2) * 0.4, flap: 0.6 + Math.sin(t * 6) * 0.3 }, t);
    ctx.restore();
    // logotipo y cinta
    const bob = Math.sin(t * 2) * 4;
    const lk = U.clamp((it - 0.45) / 0.35, 0, 1);
    if (lk > 0) {
      const ls = 0.88 * (lk < 1 ? 2.4 - 1.4 * U.easeOutCubic(lk) : 1);
      ctx.save(); ctx.globalAlpha = Math.min(1, lk * 2);
      UI.drawLogo(ctx, W / 2 - 70, 100 + bob, ls, t);
      ctx.restore();
    }
    // impacto del logo: destello y anillo
    if (it > 0.8 && it < 1.25) {
      const k = (it - 0.8) / 0.45;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.7; ctx.fillStyle = '#fff6d8'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 10 * (1 - k);
      ctx.beginPath(); ctx.ellipse(W / 2 - 70, 100, 80 + k * 420, 30 + k * 160, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const rk = U.clamp((it - 0.95) / 0.4, 0, 1);
    if (rk > 0) UI.drawRibbon(ctx, W / 2 - 70 - (1 - U.easeOutBack(rk)) * 700, 186 + bob * 0.5, 430, 'LA CAÍDA DE ARLONG PARK', t);
    if (it < 1.4) return;
    if (Math.floor(t * 2) % 2 === 0) {
      panel(ctx, W / 2 - 200, 278, 400, 44, 22, 'rgba(14,6,24,.65)', 'rgba(255,230,160,.6)');
      text(ctx, G.isTouch ? 'TOCA LA PANTALLA PARA EMPEZAR' : 'PULSA ENTER PARA EMPEZAR', W / 2, 300, 26, '#fff');
    }
    if (G.isTouch) return;
    panel(ctx, W / 2 - 230, 440, 460, 84, 12);
    ctx.save();
    ctx.font = `16px ${FONT2}`; ctx.fillStyle = '#ffe9c8'; ctx.textAlign = 'center';
    ctx.fillText('Mover: ← → / A D   ·   Agacharse: ↓   ·   Saltar: Espacio / Z', W / 2, 462);
    ctx.fillText('Atacar: X / J   ·   Especial: C / L   ·   Pausa: P   ·   Sonido: M', W / 2, 484);
    ctx.fillText('↓ + Atacar en el aire: golpe descendente   ·   Mando compatible', W / 2, 506);
    ctx.restore();
  };

  // ---------------------------------------------------------------- selección
  UI.selectRects = [{ x: 90, y: 90, w: 360, h: 410 }, { x: 510, y: 90, w: 360, h: 410 }];
  // trama de puntos (screentone) de manga
  UI.halftone = function (ctx, x, y, w, h, col, step = 9, rmax = 2.2, fromTop = true) {
    ctx.save();
    ctx.fillStyle = col;
    for (let yy = y; yy < y + h; yy += step) {
      const k = fromTop ? 1 - (yy - y) / h : (yy - y) / h;
      const r = rmax * k;
      if (r < 0.3) continue;
      for (let xx = x + ((yy / step) % 2 ? step / 2 : 0); xx < x + w; xx += step) { ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  };
  UI.drawSelect = function (ctx, g) {
    const t = g.time;
    g.level.drawSky(ctx, 2000, t);
    g.level.drawSea(ctx, 2000, t);
    ctx.fillStyle = 'rgba(10,4,20,.55)'; ctx.fillRect(0, 0, W, H);
    UI.halftone(ctx, 0, 0, W, 160, 'rgba(255,200,150,.12)', 12, 2.6, true);
    text(ctx, 'ELIGE PERSONAJE', W / 2, 48, 50, '#ffe14a', 'center', '#1a0e1e', FONT, 10);
    const chars = [
      { k: 'luffy', name: 'LUFFY', fn: 'drawLuffy', stats: [5, 3, 3], sp: 'Gomu Gomu no Gatling', desc: 'Puño de goma de largo alcance.', c1: '#ff6a3a', c2: '#7a1020' },
      { k: 'daniela', name: 'DANIELA', fn: 'drawDaniela', stats: [2, 5, 5], sp: 'Mouton Shot', desc: 'Patadas veloces y doble salto.', c1: '#4a7ae8', c2: '#101838' },
    ];
    const SK = 0.1;
    chars.forEach((c, i) => {
      const r = UI.selectRects[i], sel = g.selIndex === i;
      // viñeta inclinada
      const card = new Path2D();
      card.moveTo(r.x + SK * r.h, r.y); card.lineTo(r.x + r.w + SK * r.h, r.y);
      card.lineTo(r.x + r.w, r.y + r.h); card.lineTo(r.x, r.y + r.h); card.closePath();
      ctx.save();
      ctx.clip(card);
      const cx = r.x + r.w / 2 + 15, cy = r.y + 200;
      const bg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 300);
      bg.addColorStop(0, sel ? c.c1 : A.mix(c.c1, '#2a1a3a', 0.6)); bg.addColorStop(1, c.c2);
      ctx.fillStyle = bg; ctx.fillRect(r.x - 60, r.y, r.w + 120, r.h);
      // líneas de velocidad giratorias
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(t * (sel ? 0.25 : 0.05));
      ctx.fillStyle = sel ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)';
      for (let k = 0; k < 18; k++) { ctx.rotate(Math.PI / 9); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-22, -420); ctx.lineTo(22, -420); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      UI.halftone(ctx, r.x - 40, r.y + r.h - 160, r.w + 80, 160, 'rgba(0,0,0,.25)', 8, 2.4, false);
      // personaje
      ctx.save();
      ctx.translate(r.x + r.w / 2 - 6, r.y + 300);
      const sc = sel ? 2.5 + Math.sin(t * 4) * 0.02 : 2.35;
      ctx.scale(sc, sc);
      A.shadow(ctx, 20);
      let pose = A.pose.idle(t);
      if (c.k === 'daniela') Object.assign(pose, { pocketF: 1, pocketB: 1, aF: -0.05, eF: 0.75 });
      if (sel && c.k === 'luffy') pose = Object.assign(A.pose.idle(t), { aF: Math.PI / 2, eF: 0, stretchF: 30 + Math.abs(Math.sin(t * 3)) * 26, sagF: Math.sin(t * 9) * 3, face: 'grin', torso: 0.15 });
      if (sel && c.k === 'daniela') pose = { torso: -0.4, head: 0.3, aF: -0.9, eF: 0.6, aB: -1.4, eB: 0.4, lF: 1.9 + Math.sin(t * 4) * 0.08, kF: 0, lB: -0.15, kB: -0.1, frontLegLast: 1, face: 'cool', fire: Math.sin(t * 2) > 0.3, hairSway: Math.sin(t * 3) * 0.3 };
      A[c.fn](ctx, pose, t);
      ctx.restore();
      if (!sel) { ctx.fillStyle = 'rgba(10,4,24,.5)'; ctx.fillRect(r.x - 60, r.y, r.w + 120, r.h); }
      ctx.restore();
      // borde grueso de viñeta
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 9; ctx.strokeStyle = '#1a0e1e'; ctx.stroke(card);
      ctx.lineWidth = 4; ctx.strokeStyle = sel ? '#ffe14a' : '#f2e6d0'; ctx.stroke(card);
      ctx.restore();
      // nombre, descripción y estadísticas
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + 334); ctx.rotate(-0.05);
      text(ctx, c.name, 0, 0, sel ? 50 : 42, sel ? '#ffe14a' : '#e8e0d0', 'center', '#1a0e1e', FONT, 10);
      ctx.restore();
      ctx.save(); ctx.font = `16px ${FONT2}`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#1a0e1e'; ctx.strokeText(c.desc, r.x + r.w / 2, r.y + 366);
      ctx.fillStyle = '#ffe9c8'; ctx.fillText(c.desc, r.x + r.w / 2, r.y + 366);
      ctx.restore();
      ['ALCANCE', 'VELOC.', 'SALTO'].forEach((lab, j) => {
        const bx = r.x + 22 + j * 112;
        text(ctx, lab, bx + 44, r.y + 384, 14, '#9fd8ff', 'center', '#1a0e1e', FONT, 3);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = k < c.stats[j] ? '#ffe14a' : 'rgba(40,20,50,.85)';
          ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx + k * 18, r.y + 393, 14, 8, 3) : ctx.rect(bx + k * 18, r.y + 393, 14, 8); ctx.fill();
          ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 1.2; ctx.stroke();
        }
      });
      panel(ctx, r.x + 30 + SK * 40, r.y + 8, r.w - 60, 24, 12, 'rgba(14,6,24,.7)', 'rgba(255,230,160,.5)');
      text(ctx, 'Especial: ' + c.sp, r.x + r.w / 2 + 4, r.y + 20, 16, '#ff9a6a', 'center', '#1a0e1e', FONT, 3);
    });
    text(ctx, G.isTouch ? 'Toca un personaje para elegirlo' : '← → para elegir · ENTER / X para confirmar', W / 2, 522, 20, '#fff');
  };

  // ---------------------------------------------------------------- historia
  UI.STORY = [
    'East Blue. Isla de Cocoyashi.',
    'Hace ocho años, Arlong y su banda de hombres-pez conquistaron la isla y la convirtieron en su reino.',
    'Nami ha pasado todo ese tiempo trabajando para él, intentando comprar la libertad de su pueblo...',
    'Pero hoy, por fin, alguien va a cruzar las puertas de Arlong Park.',
  ];
  // Página de manga: cuatro viñetas ilustradas que aparecen al avanzar la historia
  UI.STORY_PANELS = [
    [[28, 22], [478, 22], [466, 252], [28, 252]],
    [[492, 22], [932, 22], [932, 252], [480, 252]],
    [[28, 268], [474, 268], [486, 512], [28, 512]],
    [[488, 268], [932, 268], [932, 512], [500, 512]],
  ];
  UI.drawStory = function (ctx, g) {
    const t = g.time;
    ctx.fillStyle = '#f2ead8'; ctx.fillRect(0, 0, W, H);
    UI.halftone(ctx, 0, 0, W, H, 'rgba(120,90,60,.08)', 10, 1.6, false);
    const k = Math.min(g.storyI, 3);
    for (let i = 0; i <= k; i++) {
      const pts = UI.STORY_PANELS[i];
      const isNew = i === g.storyI;
      const a = isNew ? U.easeOutBack(Math.min(1, g.storyT * 2.5)) : 1;
      const path = new Path2D();
      path.moveTo(pts[0][0], pts[0][1]); for (let j = 1; j < 4; j++) path.lineTo(pts[j][0], pts[j][1]); path.closePath();
      const minX = Math.min(...pts.map((q) => q[0])), maxX = Math.max(...pts.map((q) => q[0]));
      const minY = Math.min(...pts.map((q) => q[1])), maxY = Math.max(...pts.map((q) => q[1]));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, pw = maxX - minX, ph = maxY - minY;
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(a, a); ctx.translate(-cx, -cy);
      ctx.save();
      ctx.clip(path);
      UI.storyPanel(ctx, g, i, minX, minY, pw, ph, t);
      ctx.restore();
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6; ctx.strokeStyle = '#1a0e1e'; ctx.stroke(path);
      // cartela de texto
      const line = UI.STORY[i];
      ctx.font = `17px ${FONT2}`;
      const lines = wrap(ctx, line, pw - 70);
      const bh = lines.length * 21 + 14, bw = Math.min(pw - 40, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 24);
      const bx = i % 2 ? maxX - bw - 18 : minX + 16, by = i < 2 ? minY + 12 : maxY - bh - 14;
      ctx.fillStyle = '#fffdf4'; ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 3;
      ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = i === 3 ? '#b8281e' : '#1a0e1e'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
      lines.forEach((l, j) => ctx.fillText(l, bx + 12, by + 8 + j * 21));
      ctx.restore();
    }
    if (Math.floor(t * 2) % 2) text(ctx, G.isTouch ? 'Toca para continuar' : 'Pulsa ENTER o ESPACIO para continuar', W / 2, 527, 18, '#fff', 'center', '#1a0e1e', FONT, 5);
  };
  // contenido de cada viñeta
  UI.storyPanel = function (ctx, g, i, x, y, w, h, t) {
    const burst = (cx, cy, c1, c2, n = 20, spin = 0.1) => {
      const rg = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(w, h));
      rg.addColorStop(0, c1); rg.addColorStop(1, c2);
      ctx.fillStyle = rg; ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(t * spin);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      for (let k = 0; k < n; k++) { ctx.rotate(Math.PI * 2 / n); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-16, -600); ctx.lineTo(16, -600); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    };
    if (i === 0) {
      // la isla de Cocoyashi al atardecer
      ctx.save(); ctx.translate(x - 10, y - 40); ctx.scale(0.5, 0.56);
      g.level.drawSky(ctx, 0, t); g.level.drawSea(ctx, 0, t);
      ctx.restore();
      ctx.save(); ctx.translate(x + w * 0.42, y + h * 0.66); ctx.scale(1.25, 1.25);
      g.level.drawCocoyashi(ctx, 0, 0, t);
      ctx.restore();
    } else if (i === 1) {
      // Arlong en primer plano, sonrisa de tiburón
      burst(x + w * 0.62, y + h * 0.42, '#c8302a', '#3a0a1a', 22, 0.08);
      UI.halftone(ctx, x, y + h * 0.5, w, h * 0.5, 'rgba(0,0,0,.25)', 8, 2.2, false);
      ctx.save(); ctx.translate(x + w * 0.58, y + h + 300); ctx.scale(-2.6, 2.6);
      A.drawArlong(ctx, Object.assign(A.pose.idle(t), { face: 'shout', aF: 1.2, eF: 1.0, torso: 0.1, head: -0.15 }), t);
      ctx.restore();
    } else if (i === 2) {
      // Nami llorando bajo la lluvia
      const bg = ctx.createLinearGradient(0, y, 0, y + h);
      bg.addColorStop(0, '#2a3a6a'); bg.addColorStop(1, '#141a34');
      ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
      ctx.save(); ctx.strokeStyle = 'rgba(180,210,255,.35)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 40; k++) {
        const rx = x + ((k * 53 + t * 260) % (w + 40)) - 20, ry = y + ((k * 97 + t * 520) % (h + 40)) - 20;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.translate(x + w * 0.5, y + h + 150); ctx.scale(3.4, 3.4);
      A.drawNami(ctx, Object.assign(A.pose.idle(t), { face: 'cry', aF: 2.25, eF: 1.95, aB: -0.2, eB: 0.6, head: 0.18, torso: 0.08 }), t);
      ctx.restore();
    } else {
      // el héroe llega a Arlong Park
      burst(x + w * 0.5, y + h * 0.45, '#ffe27a', '#e8742a', 24, 0.2);
      const L = (g.chosen || 'luffy') === 'luffy';
      ctx.save(); ctx.translate(x + w * 0.5, y + h + 12); ctx.scale(2.15, 2.15);
      if (L) A.drawLuffy(ctx, Object.assign(A.pose.idle(t), { aF: 2.6, eF: 0.3, aB: -0.6, eB: 1.4, face: 'grin', hatRot: Math.sin(t * 2) * 0.04 }), t);
      else A.drawDaniela(ctx, Object.assign(A.pose.idle(t), { pocketF: 1, pocketB: 1, aF: -0.05, eF: 0.75, face: 'cool', hairSway: Math.sin(t * 2) * 0.3 }), t);
      ctx.restore();
    }
  };

  // ---------------------------------------------------------------- pausa
  UI.drawPause = function (ctx, g) {
    ctx.fillStyle = 'rgba(8,2,16,.6)'; ctx.fillRect(0, 0, W, H);
    text(ctx, 'PAUSA', W / 2, 150, 72, '#ffe14a');
    panel(ctx, W / 2 - 250, 210, 500, 200);
    ctx.save(); ctx.font = `19px ${FONT2}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    const L = g.player.kind === 'luffy';
    const rows = [
      'Atacar: ' + (L ? 'Gomu Gomu no Pistol (pulsa seguido: ráfaga)' : 'Patadas (pulsa seguido: combo de 3)'),
      'Especial (10 energía): ' + (L ? 'Gomu Gomu no Gatling' : 'Mouton Shot (invulnerable)'),
      'En el aire ↓ + Atacar: ' + (L ? 'Gomu Gomu no Ono' : 'Concassé'),
      L ? 'La carne de los farolillos te cura mucho' : 'Doble salto: salta otra vez en el aire',
      '↓ + Saltar sobre una repisa: bajar de ella',
    ];
    rows.forEach((r, i) => ctx.fillText(r, W / 2, 244 + i * 34));
    ctx.restore();
    text(ctx, G.isTouch ? 'Toca ❚❚ para continuar' : 'Pulsa P o ESC para continuar', W / 2, 450, 22, '#ffd2a0');
  };

  // ---------------------------------------------------------------- game over
  UI.goRects = [{ x: W / 2 - 230, y: 300, w: 210, h: 64, label: 'CONTINUAR' }, { x: W / 2 + 20, y: 300, w: 210, h: 64, label: 'TÍTULO' }];
  UI.drawGameOver = function (ctx, g) {
    const t = g.time, st = g.stateT || 0;
    const dg = ctx.createLinearGradient(0, 0, 0, H);
    dg.addColorStop(0, 'rgba(6,2,14,.88)'); dg.addColorStop(1, 'rgba(20,6,24,.8)');
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    // lluvia
    ctx.save(); ctx.strokeStyle = 'rgba(170,190,255,.35)'; ctx.lineWidth = 1.3;
    for (let k = 0; k < 90; k++) {
      const rx = ((k * 97.3 + t * 300) % (W + 60)) - 30, ry = ((k * 61.7 + t * 700) % (H + 60)) - 30;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 18); ctx.stroke();
    }
    ctx.restore();
    // el sombrero (o el cigarro) tirado en el suelo, bajo un foco
    const fg = ctx.createRadialGradient(W / 2, 470, 10, W / 2, 470, 220);
    fg.addColorStop(0, 'rgba(255,220,160,.22)'); fg.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = fg; ctx.fillRect(0, 250, W, H - 250);
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(W / 2, 478, 90, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(W / 2, 462);
    if (g.player && g.player.kind === 'daniela') {
      ctx.scale(2.6, 2.6); A.begin(ctx);
      A.limb(ctx, -16, 0, 14, 0, 3, 3, '#f4f1ea', null);
      ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(16, 0, 3.4, 0, 7); ctx.fill();
      ctx.save(); ctx.strokeStyle = 'rgba(230,230,240,.35)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(17, -2); for (let i = 1; i < 12; i++) ctx.lineTo(17 + Math.sin(t * 2 + i * 0.8) * 3, -2 - i * 3); ctx.stroke(); ctx.restore();
    } else { ctx.scale(2.4, 2.4); ctx.rotate(0.12); A.begin(ctx); A.drawStrawHat(ctx, 0, 0, 0); }
    ctx.restore();
    // GAME OVER agrietado que tiembla al aparecer
    const k = Math.min(1, st * 1.5), sh = st < 0.6 ? (0.6 - st) * 14 : 0;
    ctx.save(); ctx.translate(W / 2 + U.rand(-sh, sh), 170 + U.rand(-sh, sh)); ctx.scale(0.6 + 0.4 * U.easeOutBack(k), 0.6 + 0.4 * U.easeOutBack(k));
    text(ctx, 'GAME OVER', 0, 0, 96, '#ff4a4a', 'center', '#1a0e1e', FONT, 14);
    ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-150, -30); ctx.lineTo(-120, -4); ctx.lineTo(-135, 12); ctx.lineTo(-110, 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(90, -36); ctx.lineTo(110, -10); ctx.lineTo(98, 6); ctx.lineTo(124, 30); ctx.stroke();
    ctx.restore();
    UI.goRects.forEach((r, i) => {
      const sel = g.goIndex === i;
      panel(ctx, r.x, r.y, r.w, r.h, 14, sel ? 'rgba(90,30,40,.95)' : 'rgba(30,10,30,.85)', sel ? '#ffe14a' : 'rgba(255,230,160,.4)');
      text(ctx, r.label, r.x + r.w / 2, r.y + r.h / 2, 32, sel ? '#ffe14a' : '#fff');
    });
    text(ctx, 'Continuar reinicia desde el último punto de control (puntos a 0)', W / 2, 410, 18, '#ffd2a0', 'center', '#1a0e1e', FONT2);
  };

  // ---------------------------------------------------------------- victoria
  UI.drawVictory = function (ctx, g) {
    const t = g.vicT;
    // oscurece sólo arriba para que se vea la escena con Nami
    const dg = ctx.createLinearGradient(0, 0, 0, H);
    dg.addColorStop(0, `rgba(10,4,20,${Math.min(0.6, t * 0.3)})`); dg.addColorStop(0.55, `rgba(10,4,20,${Math.min(0.25, t * 0.15)})`); dg.addColorStop(1, 'rgba(10,4,20,0)');
    ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
    if (t < 0.6) return;
    const s = Math.min(1, (t - 0.6) * 2);
    ctx.save(); ctx.translate(W / 2 - 150, 78); ctx.rotate(-0.04); ctx.scale(U.easeOutBack(s), U.easeOutBack(s));
    text(ctx, '¡VICTORIA!', 0, 0, 84, '#ffe14a', 'center', '#1a3a8a', FONT, 14);
    text(ctx, '¡VICTORIA!', 0, 0, 84, '#ffe14a', 'center', '#1a0e1e', FONT, 5);
    ctx.restore();
    if (t < 1.3) return;
    text(ctx, '¡Arlong Park ha caído! Cocoyashi es libre.', W / 2 - 150, 140, 26, '#fff');
    const k = U.easeOutCubic(Math.min(1, (t - 1.3) * 2.5));
    const px = W - 300 + (1 - k) * 340;
    panel(ctx, px, 40, 270, 150);
    const mins = Math.floor(g.playTime / 60), secs = Math.floor(g.playTime % 60);
    const rows = [['PUNTOS', String(g.score).padStart(6, '0')], ['TIEMPO', `${mins}:${String(secs).padStart(2, '0')}`], ['ENEMIGOS', String(g.kills)], ['VIDAS', String(g.lives)]];
    rows.forEach((r, i) => {
      text(ctx, r[0], px + 22, 66 + i * 32, 22, '#9fd8ff', 'left');
      text(ctx, r[1], px + 248, 66 + i * 32, 22, '#fff', 'right');
    });
    if (t > 2.5 && Math.floor(t * 2) % 2) text(ctx, G.isTouch ? 'Toca para volver al título' : 'Pulsa ENTER para volver al título', W / 2 - 150, 182, 20, '#ffd2a0');
  };
})();
