'use strict';
// Nivel único: Arlong Park. Geometría, datos de aparición y escenario parallax pintado a mano (vectorial).
(function () {
  const U = G.U, A = G.art, W = G.W, H = G.H;
  const GY = 460;          // altura del suelo
  const hash = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  // trazo de los fondos: más fino y translúcido que el de los personajes, para separarlos
  const BGLINE = 'rgba(46,18,40,.62)';
  const WATER_Y = 492;     // superficie del agua de las pozas

  function Level() {
    this.width = 7680;
    this.solids = [];
    this.oneways = [];
    this.pits = [];
    this.build();
  }
  G.Level = Level;
  Level.GY = GY;
  Level.WATER_Y = WATER_Y;

  Level.prototype.build = function () {
    const S = this.solids, O = this.oneways;
    const ground = (x0, x1, y = GY) => S.push({ x: x0, y, w: x1 - x0, h: H + 200 - y, kind: 'ground' });
    const block = (x, y, w, h, kind = 'stone') => S.push({ x, y, w, h, kind });
    const ledge = (x, y, w) => O.push({ x, y, w });
    const pit = (x0, x1) => this.pits.push({ x: x0, w: x1 - x0 });

    // A) exterior, orilla de Cocoyashi
    ground(-200, 1900);
    block(800, GY - 56, 56, 56, 'crate'); block(856, GY - 56, 56, 56, 'crate'); block(828, GY - 112, 56, 56, 'crate');
    block(1180, GY - 40, 90, 40, 'stone');
    // B/C) patio con pozas
    pit(1900, 2020);
    ground(2020, 2500);
    ledge(2190, 352, 140);
    pit(2500, 2780);
    ledge(2560, 398, 160);
    ground(2780, 3150);
    ledge(2880, 340, 150);
    pit(3150, 3270);
    ground(3270, 5000);
    // D) arena de Hatchan: 3740..4700 (suelo continuo)
    // E) pasarela de la torre
    block(5000, 400, 300, H + 200 - 400, 'wall');
    pit(5300, 5420);
    block(5420, 372, 380, H + 200 - 372, 'wall');
    ledge(5540, 268, 130);
    ground(5800, 6100);
    pit(6100, 6280);
    ledge(6150, 390, 80);
    ground(6280, 7900);
    // F) arena de Arlong: 6720..7680

    // Objetos rompibles: farolillos colgantes ('lantern') y braseros ('brazier')
    this.breakables = [
      { x: 330, y: 330, kind: 'lantern', drop: 'coin' },
      { x: 660, y: 330, kind: 'lantern', drop: 'energy' },
      { x: 1080, y: 330, kind: 'lantern', drop: 'mikan' },
      { x: 1420, y: 330, kind: 'lantern', drop: 'energy' },
      { x: 1760, y: GY, kind: 'brazier', drop: 'coin' },
      { x: 2260, y: 250, kind: 'lantern', drop: 'meat' },
      { x: 2640, y: 300, kind: 'lantern', drop: 'energy' },
      { x: 2955, y: 240, kind: 'lantern', drop: 'bigcoin' },
      { x: 3450, y: GY, kind: 'brazier', drop: 'mikan' },
      { x: 3640, y: 320, kind: 'lantern', drop: 'energy' },
      { x: 4800, y: GY, kind: 'brazier', drop: 'meat' },
      { x: 5150, y: 300, kind: 'lantern', drop: 'energy' },
      { x: 5605, y: 170, kind: 'lantern', drop: 'hat' },
      { x: 5900, y: GY, kind: 'brazier', drop: 'coin' },
      { x: 6400, y: 320, kind: 'lantern', drop: 'meat' },
      { x: 6600, y: 320, kind: 'lantern', drop: 'energy' },
    ];
    // Enemigos colocados (se activan al acercarse la cámara)
    this.spawns = [
      { type: 'grunt', x: 620, v: 0 },
      { type: 'grunt', x: 1050, v: 1 },
      { type: 'grunt', x: 1500, v: 2 },
      { type: 'grunt', x: 2300, v: 3 },
      { type: 'harpooner', x: 2950, y: 340, v: 1 },
      { type: 'grunt', x: 3000, v: 0 },
      { type: 'grunt', x: 3500, v: 2 },
      { type: 'grunt', x: 3600, v: 1 },
      { type: 'harpooner', x: 5200, y: 400, v: 3 },
      { type: 'grunt', x: 4950, v: 0 },
      { type: 'harpooner', x: 5720, y: 372, v: 2 },
      { type: 'grunt', x: 5950, v: 1 },
      { type: 'grunt', x: 6450, v: 3 },
      { type: 'grunt', x: 6600, v: 0 },
    ];
    // Pozas desde las que saltan hombres-pez (como los clásicos tritones de Castlevania)
    this.leapSpawners = this.pits.map((p) => ({ x: p.x + p.w / 2, w: p.w, cd: U.rand(1.5, 3) }));
    // Zonas de peces voladores
    this.flyZones = [{ x0: 1150, x1: 1850, cd: 2 }, { x0: 5850, x1: 6650, cd: 2 }];
    // Arenas con cámara bloqueada
    this.arenas = [
      { id: 'hatchan', trigger: 3860, camX: 3740, boss: 'hatchan', done: false },
      { id: 'arlong', trigger: 6860, camX: 6720, boss: 'arlong', done: false },
    ];
    this.checkpoints = [{ x: 120 }, { x: 3780 }, { x: 6770 }];

    // decorado estable
    this.palms = [150, 520, 940, 1300];
    this.fg = [420, 1380, 2420, 3560, 4900, 6150];
  };

  Level.prototype.inPit = function (x) {
    for (const p of this.pits) if (x > p.x && x < p.x + p.w) return p;
    return null;
  };

  // ================================================================ dibujo
  function roof(ctx, cx, y, w, h, col, colS, trim) {
    // tejado curvo estilo pagoda con aleros levantados
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 - 14, y - 10);
    ctx.quadraticCurveTo(cx - w / 2 + 10, y + 2, cx - w / 2 + 30, y);
    ctx.lineTo(cx + w / 2 - 30, y);
    ctx.quadraticCurveTo(cx + w / 2 - 10, y + 2, cx + w / 2 + 14, y - 10);
    ctx.quadraticCurveTo(cx + w / 3, y - h * 0.45, cx + w * 0.18, y - h);
    ctx.lineTo(cx - w * 0.18, y - h);
    ctx.quadraticCurveTo(cx - w / 3, y - h * 0.45, cx - w / 2 - 14, y - 10);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y - h, 0, y);
    g.addColorStop(0, col); g.addColorStop(1, colS);
    ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    if (trim) {
      ctx.save(); ctx.strokeStyle = trim; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 - 12, y - 9); ctx.quadraticCurveTo(cx - w / 2 + 10, y + 1, cx - w / 2 + 30, y - 1);
      ctx.lineTo(cx + w / 2 - 30, y - 1); ctx.quadraticCurveTo(cx + w / 2 - 10, y + 1, cx + w / 2 + 12, y - 9);
      ctx.stroke();
      ctx.restore();
    }
  }
  Level.roof = roof;

  function arlongFlag(ctx, x, y, s, t) {
    // bandera de los Piratas de Arlong: sol con fauces de tiburón
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineWidth = 2;
    A.line(ctx, [0, 0, 0, 70], 3, '#2a1a12');
    const wv = (k) => Math.sin(t * 3 + k) * 3;
    ctx.beginPath();
    ctx.moveTo(1, 2);
    ctx.quadraticCurveTo(22, 2 + wv(0), 44, 4 + wv(1));
    ctx.lineTo(44, 34 + wv(1));
    ctx.quadraticCurveTo(22, 32 + wv(0), 1, 32);
    ctx.closePath();
    ctx.fillStyle = '#1b1426'; ctx.fill(); ctx.strokeStyle = A.OUT; ctx.stroke();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.arc(22, 18 + wv(0.5) * 0.5, 8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8e0d0'; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; ctx.beginPath(); ctx.moveTo(22 + Math.cos(a) * 9, 18 + Math.sin(a) * 9); ctx.lineTo(22 + Math.cos(a) * 12.5, 18 + Math.sin(a) * 12.5); ctx.stroke(); }
    ctx.fillStyle = '#1b1426';
    ctx.beginPath(); ctx.moveTo(15, 18); for (let i = 0; i < 5; i++) { ctx.lineTo(16.5 + i * 3, 21); ctx.lineTo(18 + i * 3, 18); } ctx.lineTo(30, 18); ctx.quadraticCurveTo(22, 26, 15, 18); ctx.fill();
    ctx.restore();
  }
  Level.arlongFlag = arlongFlag;

  function palm(ctx, x, y, h, t, dark) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineWidth = 1.7; ctx.strokeStyle = BGLINE;
    const sw = Math.sin(t * 0.8 + x) * 3;
    ctx.beginPath();
    ctx.moveTo(-7, 0); ctx.quadraticCurveTo(-4, -h * 0.5, 6 + sw, -h); ctx.lineTo(12 + sw, -h); ctx.quadraticCurveTo(6, -h * 0.5, 7, 0); ctx.closePath();
    ctx.fillStyle = dark ? '#3a2a30' : '#8a6a48'; ctx.fill(); ctx.stroke();
    if (!dark) { ctx.save(); ctx.strokeStyle = '#5e4630'; ctx.lineWidth = 1.2; for (let i = 1; i < 8; i++) { const yy = -h * i / 8; ctx.beginPath(); ctx.moveTo(-5 + i * 0.6, yy); ctx.lineTo(5 + i * 0.9, yy - 3); ctx.stroke(); } ctx.restore(); }
    const cx = 9 + sw, cy = -h;
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.62 + Math.sin(t * 1.2 + i) * 0.04;
      const L = 58 + (i % 2) * 12;
      const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.55 + 24;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a) * L * 0.5, cy + Math.sin(a) * L * 0.5 - 18, ex, ey);
      ctx.quadraticCurveTo(cx + Math.cos(a) * L * 0.45, cy + Math.sin(a) * L * 0.45 - 4, cx, cy + 4);
      ctx.fillStyle = dark ? '#1f2a2a' : (i % 2 ? '#3f9a4a' : '#2f7d3c'); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- capas lejanas
  Level.prototype.drawSky = function (ctx, camX, t) {
    // el atardecer avanza con el nivel: el sol se hunde y el cielo se vuelve nocturno
    const nk = G.nightK = U.clamp((camX - 1200) / 5400, 0, 1);
    const M = A.mix;
    const g = ctx.createLinearGradient(0, 0, 0, 310);
    g.addColorStop(0, M('#1d1640', '#0a0820', nk)); g.addColorStop(0.35, M('#4f2f6e', '#24184e', nk));
    g.addColorStop(0.7, M('#c9566a', '#7a2c5e', nk)); g.addColorStop(1, M('#f9a95e', '#e2683e', nk));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 312);
    // primeras estrellas del anochecer
    ctx.save();
    for (let i = 0; i < 42; i++) {
      const sxx = ((hash(i * 3.1) * 1400 - camX * 0.01) % 1400 + 1400) % 1400 - 200;
      const syy = hash(i * 7.7) * 120 + 4;
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.5 + hash(i) * 2) + i));
      ctx.globalAlpha = tw * (1 - syy / 130) * (0.9 + nk * 0.6) * (syy < 60 + nk * 90 ? 1 : 0.3);
      ctx.fillStyle = '#fff4e0';
      const r = 0.6 + hash(i * 1.3) * 1.1;
      ctx.beginPath(); ctx.arc(sxx, syy, r, 0, Math.PI * 2); ctx.fill();
      if (r > 1.4) { ctx.fillRect(sxx - r * 2.5, syy - 0.3, r * 5, 0.6); ctx.fillRect(sxx - 0.3, syy - r * 2.5, 0.6, r * 5); }
    }
    ctx.restore();
    // sol poniente
    const sx = 700 - camX * 0.02, sy = 268 + nk * 34;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 200);
    sg.addColorStop(0, 'rgba(255,240,180,.9)'); sg.addColorStop(0.25, 'rgba(255,190,110,.45)'); sg.addColorStop(1, 'rgba(255,140,90,0)');
    ctx.fillStyle = sg; ctx.fillRect(0, 60, W, 260);
    // rayos de luz que salen del sol
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < (G.lowFx ? 0 : 9); i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.3 + Math.sin(t * 0.15 + i * 1.7) * 0.05;
      const w = 0.035 + 0.025 * (0.5 + 0.5 * Math.sin(t * 0.6 + i * 2.3));
      const len = 520 + (i % 3) * 90;
      const rg = ctx.createRadialGradient(sx, sy, 40, sx, sy, len);
      rg.addColorStop(0, `rgba(255,215,150,${0.22 * (1 - nk * 0.55)})`); rg.addColorStop(1, 'rgba(255,190,130,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len);
      ctx.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(sx, sy, 46, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,230,.8)'; ctx.beginPath(); ctx.arc(sx, sy, 36, 0, Math.PI * 2); ctx.fill();
    // nubes anime
    const off = (camX * 0.05 + t * 6) % 1400;
    for (let i = -1; i < 3; i++) {
      const bx = i * 700 - off;
      this.cloud(ctx, bx + 120, 92, 1.05, 0);
      this.cloud(ctx, bx + 460, 158, 0.85, 1);
      this.cloud(ctx, bx + 640, 58, 0.62, 2);
      this.cloud(ctx, bx + 330, 210, 0.5, 2);
    }
    this.stratus(ctx, camX, t);
    // gaviotas a lo lejos
    ctx.save();
    ctx.strokeStyle = '#3a2240'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const bx = ((i * 290 + t * (18 + i * 3)) % 1500) - 250 - (camX * 0.05) % 1500;
      const by = 95 + i * 27 + Math.sin(t * 0.9 + i * 2) * 10;
      const f = Math.sin(t * 7 + i * 1.3) * 5, sz = 6 + (i % 3) * 2;
      ctx.beginPath();
      ctx.moveTo(bx - sz, by - f); ctx.quadraticCurveTo(bx - sz * 0.4, by - sz * 0.5 - f * 0.3, bx, by);
      ctx.quadraticCurveTo(bx + sz * 0.4, by - sz * 0.5 - f * 0.3, bx + sz, by - f);
      ctx.stroke();
    }
    ctx.restore();
  };
  // nube de atardecer: alargada, base plana con el borde inferior encendido por el sol bajo
  const CLOUDS = [
    [[0, -8, 20], [-30, -4, 15], [30, -6, 17], [-60, -2, 10], [62, -2, 12], [-12, -18, 15], [16, -20, 16], [-88, 0, 6], [90, 0, 7]],
    [[0, -6, 16], [-26, -3, 12], [26, -4, 13], [-48, -1, 8], [50, -1, 9], [8, -15, 12], [-70, 0, 5]],
    [[0, -5, 12], [-20, -2, 9], [20, -3, 10], [6, -11, 9], [-36, 0, 5], [38, 0, 6]],
  ];
  Level.prototype.cloud = function (ctx, x, y, s, v = 0) {
    const pts = CLOUDS[v % CLOUDS.length];
    const puffs = (dx, dy, k) => { ctx.beginPath(); for (const [px, py, r] of pts) { ctx.moveTo(px + dx + r * k, py + dy); ctx.arc(px + dx, py + dy, r * k, 0, Math.PI * 2); } };
    ctx.save();
    ctx.translate(x, y); ctx.scale(s * 1.25, s * 0.8);
    ctx.beginPath(); ctx.rect(-130, -60, 260, 62); ctx.clip();               // base plana
    ctx.fillStyle = 'rgba(112,64,128,.82)'; puffs(0, 0, 1); ctx.fill();        // cuerpo en sombra
    ctx.fillStyle = 'rgba(186,98,140,.72)'; puffs(-4, -5, 0.8); ctx.fill();    // tono medio
    ctx.fillStyle = 'rgba(255,170,150,.38)'; puffs(-8, -10, 0.45); ctx.fill(); // brillo superior
    ctx.restore();
    // borde inferior dorado
    ctx.save();
    ctx.translate(x, y + 1); ctx.scale(s * 1.25, s * 0.8);
    const w = v === 0 ? 92 : v === 1 ? 70 : 42;
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, 'rgba(255,200,130,0)'); g.addColorStop(0.5, 'rgba(255,214,150,.95)'); g.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(4, 0, w, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  // estratos finos cerca del horizonte
  Level.prototype.stratus = function (ctx, camX, t) {
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const y = 205 + i * 14 + Math.sin(i * 2.3) * 4;
      const len = 160 + hash(i * 4.1) * 220;
      const x = ((hash(i * 9.7) * 1400 - camX * (0.03 + i * 0.006) - t * 3) % 1400 + 1400) % 1400 - 250;
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, 'rgba(255,180,140,0)'); g.addColorStop(0.5, `rgba(255,${190 + i * 6},${150 + i * 5},${0.35 + i * 0.05})`); g.addColorStop(1, 'rgba(255,180,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x + len / 2, y, len / 2, 2 + i * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  Level.prototype.drawSea = function (ctx, camX, t) {
    const hy = 300;
    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, '#6a5a8a'); g.addColorStop(0.15, '#33507e'); g.addColorStop(1, '#122648');
    ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
    // reflejo del sol
    const sx = 700 - camX * 0.02;
    for (let i = 0; i < 9; i++) {
      const yy = hy + 6 + i * 9, w = 90 - i * 6 + Math.sin(t * 2 + i) * 10;
      ctx.fillStyle = `rgba(255,210,140,${0.5 - i * 0.045})`;
      ctx.fillRect(sx - w / 2 + Math.sin(t * 1.5 + i * 2) * 6, yy, w, 2.5);
    }
    // islas lejanas
    ctx.fillStyle = '#3b2c58';
    const io = camX * 0.06;
    ctx.beginPath();
    ctx.moveTo(-io % 1600 - 200, hy);
    for (let k = -1; k < 3; k++) {
      const bx = k * 800 - (io % 800);
      ctx.lineTo(bx + 40, hy); ctx.quadraticCurveTo(bx + 120, hy - 50, bx + 230, hy - 18); ctx.quadraticCurveTo(bx + 300, hy - 30, bx + 380, hy);
      ctx.lineTo(bx + 520, hy); ctx.quadraticCurveTo(bx + 580, hy - 24, bx + 660, hy);
    }
    ctx.lineTo(W + 200, hy); ctx.lineTo(W + 200, hy + 2); ctx.lineTo(-200, hy + 2); ctx.closePath();
    ctx.fill();
    this.drawCocoyashi(ctx, 150 - camX * 0.05, hy, t);
    // destellos en el reflejo del sol
    ctx.save();
    ctx.fillStyle = '#fff6d8';
    for (let i = 0; i < 10; i++) {
      const ph = (t * 1.3 + hash(i) * 10) % 1;
      const a = Math.sin(ph * Math.PI);
      if (a < 0.2) continue;
      const gx = sx + (hash(i * 5.3 + Math.floor(t * 1.3 + hash(i) * 10)) - 0.5) * 160;
      const gy = hy + 8 + hash(i * 2.9) * 60;
      const r = a * 3.5;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(gx - r * 2, gy); ctx.lineTo(gx, gy - r * 0.5); ctx.lineTo(gx + r * 2, gy); ctx.lineTo(gx, gy + r * 0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(gx, gy - r * 1.3); ctx.lineTo(gx + r * 0.35, gy); ctx.lineTo(gx, gy + r * 1.3); ctx.lineTo(gx - r * 0.35, gy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // olas: guiones que se mueven más rápido cuanto más cerca
    ctx.save();
    for (let r = 0; r < 7; r++) {
      const y = hy + 12 + r * r * 4.2 + r * 6;
      const sp = 70 + r * 26, wd = 10 + r * 6, par = 0.08 + r * 0.05;
      const off = (t * (6 + r * 4) + camX * par) % sp;
      ctx.strokeStyle = `rgba(255,${210 - r * 10},${190 - r * 6},${0.16 + r * 0.03})`;
      ctx.lineWidth = 1 + r * 0.35;
      ctx.beginPath();
      for (let x = -sp - off + (r % 2) * sp * 0.5; x < W + sp; x += sp) {
        const yy = y + Math.sin(t * 1.5 + x * 0.03 + r) * 1.5;
        ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + wd / 2, yy - 2.5, x + wd, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    // espuma de las olas rompiendo contra la orilla
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const y = 446 + i * 5, ph = t * (1.2 + i * 0.3) + i;
      ctx.fillStyle = `rgba(240,248,255,${0.55 - i * 0.12})`;
      ctx.beginPath(); ctx.moveTo(-10, H);
      for (let x = -10; x <= W + 10; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.045 + ph * 2 + camX * 0.02) * 3 + Math.sin(x * 0.11 - ph * 3) * 1.5);
      ctx.lineTo(W + 10, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    this.drawMerry(ctx, 430 - camX * 0.07 + Math.sin(t * 0.08) * 30, hy + 6 + Math.sin(t * 1.4) * 1.2, t);
  };
  // Isla de Cocoyashi: colinas, el mandarinal de Bell-mère, su casita y un molino
  Level.prototype.drawCocoyashi = function (ctx, x, hy, t) {
    if (x < -420 || x > W + 200) return;
    ctx.save();
    ctx.translate(x, hy);
    // colinas
    const hill = new Path2D();
    hill.moveTo(-220, 2); hill.quadraticCurveTo(-170, -46, -100, -52); hill.quadraticCurveTo(-40, -58, 10, -78);
    hill.quadraticCurveTo(60, -96, 110, -70); hill.quadraticCurveTo(160, -46, 200, -40); hill.quadraticCurveTo(250, -30, 300, 2); hill.closePath();
    const hg = ctx.createLinearGradient(0, -96, 0, 0);
    hg.addColorStop(0, '#4a3a6e'); hg.addColorStop(1, '#2e2450');
    ctx.fillStyle = hg; ctx.fill(hill);
    ctx.strokeStyle = 'rgba(255,170,120,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-100, -52); ctx.quadraticCurveTo(-40, -58, 10, -78); ctx.quadraticCurveTo(60, -96, 110, -70); ctx.quadraticCurveTo(160, -46, 200, -40); ctx.stroke();
    // mandarinal: arbolitos redondos con frutas naranjas
    for (let i = 0; i < 12; i++) {
      const tx = -150 + i * 16 + (i % 2) * 6, ty = -40 - Math.sin(i * 0.5) * 8 - (i > 6 ? (i - 6) * 3 : 0);
      ctx.fillStyle = '#2f5a3e'; ctx.beginPath(); ctx.arc(tx, ty, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4a7a4e'; ctx.beginPath(); ctx.arc(tx - 1.5, ty - 2, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff9a2a';
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(tx + Math.cos(j * 2.1 + i) * 3.5, ty + Math.sin(j * 2.1 + i) * 3.5, 1.2, 0, Math.PI * 2); ctx.fill(); }
    }
    // casita de Bell-mère
    ctx.fillStyle = '#c99a7a'; ctx.fillRect(-60, -64, 16, 12);
    ctx.fillStyle = '#7a3a3a'; ctx.beginPath(); ctx.moveTo(-63, -64); ctx.lineTo(-52, -73); ctx.lineTo(-41, -64); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd88a'; ctx.fillRect(-56, -60, 4, 4);
    // molino con aspas girando
    ctx.fillStyle = '#d8c4b0'; ctx.beginPath(); ctx.moveTo(70, -86); ctx.lineTo(82, -86); ctx.lineTo(85, -60); ctx.lineTo(67, -60); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a3a3a'; ctx.beginPath(); ctx.moveTo(67, -86); ctx.lineTo(76, -96); ctx.lineTo(85, -86); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(76, -88); ctx.rotate(t * 0.8);
    ctx.strokeStyle = '#f2e6d8'; ctx.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -15); ctx.stroke(); ctx.fillStyle = 'rgba(242,230,216,.7)'; ctx.fillRect(0, -15, 4, 10); }
    ctx.restore();
    // reflejo de la isla en el agua
    ctx.globalAlpha = 0.25; ctx.scale(1, -0.35); ctx.fillStyle = '#2e2450'; ctx.fill(hill);
    ctx.restore();
  };
  // El Going Merry fondeado a lo lejos (guiño para fans)
  Level.prototype.drawMerry = function (ctx, x, y, t) {
    if (x < -120 || x > W + 120) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.4) * 0.03);
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#2a1838'; ctx.lineJoin = 'round';
    // reflejo
    ctx.fillStyle = 'rgba(40,20,60,.35)';
    ctx.beginPath(); ctx.ellipse(0, 4, 30, 3, 0, 0, Math.PI * 2); ctx.fill();
    // casco
    ctx.fillStyle = '#c99a5e';
    ctx.beginPath(); ctx.moveTo(-28, -10); ctx.lineTo(24, -10); ctx.quadraticCurveTo(22, 2, 10, 3); ctx.lineTo(-22, 3); ctx.quadraticCurveTo(-30, -2, -28, -10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5a8a'; ctx.fillRect(-27, -12, 50, 3);
    // mástil, vela y bandera pirata
    ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-2, -10); ctx.lineTo(-2, -52); ctx.stroke();
    ctx.fillStyle = '#f4ece0'; ctx.strokeStyle = '#2a1838'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-18, -46); ctx.quadraticCurveTo(-2, -40 + Math.sin(t * 2) * 1.5, 14, -46); ctx.lineTo(14, -18); ctx.quadraticCurveTo(-2, -12, -18, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a1020'; ctx.fillRect(-2, -60, 11, 7);
    ctx.fillStyle = '#f2d060'; ctx.fillRect(1, -59, 5, 1.5);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3.5, -56, 1.5, 0, Math.PI * 2); ctx.fill();
    // mascarón de oveja
    ctx.fillStyle = '#f6f0e4'; ctx.strokeStyle = '#2a1838';
    ctx.beginPath(); ctx.arc(28, -14, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(26, -15, 2.2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };
  // Torre principal de Arlong Park, siempre visible a lo lejos (la meta)
  Level.prototype.drawFarTower = function (ctx, camX, t, collapse) {
    const x = 1150 - camX * 0.08, base = 312 + (collapse || 0) * 260;
    if (x < -260 || x > W + 260) return;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 2; ctx.strokeStyle = '#2a1838';
    const wall = '#8a5a6e', wallS = '#5e3a52', roofC = '#3c5a7a', roofS = '#243a56';
    // muralla
    ctx.fillStyle = wallS; ctx.fillRect(x - 230, base - 40, 460, 40); ctx.strokeRect(x - 230, base - 40, 460, 40);
    // cuerpo central
    const fl = [[150, 70], [118, 62], [86, 54]];
    let y = base - 40;
    fl.forEach(([w, h], i) => {
      const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
      g.addColorStop(0, wall); g.addColorStop(1, wallS);
      ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h); ctx.strokeRect(x - w / 2, y - h, w, h);
      ctx.fillStyle = '#2a1838';
      for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * w * 0.28 - 5, y - h * 0.7, 10, h * 0.4);
      roof(ctx, x, y - h, w + 40, 26 - i * 3, roofC, roofS, '#c9a24a');
      y -= h + 22 - i * 3;
    });
    // pináculo y bandera
    A.line(ctx, [x, y + 6, x, y - 30], 3, '#2a1838');
    arlongFlag(ctx, x, y - 34, 0.6, t);
    // torres laterales
    for (const sx of [-180, 180]) {
      ctx.fillStyle = wallS; ctx.fillRect(x + sx - 26, base - 110, 52, 70); ctx.strokeRect(x + sx - 26, base - 110, 52, 70);
      roof(ctx, x + sx, base - 110, 74, 22, roofC, roofS, '#c9a24a');
    }
    ctx.restore();
  };
  // Capa media: muralla exterior con motivo de olas
  Level.prototype.drawMid = function (ctx, camX, t) {
    const px = camX * 0.45;
    const top = 300;
    ctx.save();
    ctx.lineWidth = 2; ctx.strokeStyle = '#2a1838';
    // sólo a partir de la puerta (en el exterior se ve el mar)
    const startX = 1350 * 0.45 + 0 - px; // posición en pantalla donde empieza la muralla
    const sx = Math.max(-20, startX);
    if (sx < W) {
      const g = ctx.createLinearGradient(0, top, 0, GY);
      g.addColorStop(0, '#7a4a62'); g.addColorStop(1, '#4a2c44');
      ctx.fillStyle = g; ctx.fillRect(sx, top, W - sx + 20, GY - top);
      // motivo de olas
      ctx.strokeStyle = 'rgba(255,220,200,.25)'; ctx.lineWidth = 2;
      for (let x = sx - ((sx - startX) % 40) ; x < W + 40; x += 40) {
        ctx.beginPath(); ctx.arc(x, top + 34, 14, Math.PI, 0); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 20, top + 34, 8, Math.PI, 0); ctx.stroke();
      }
      ctx.strokeStyle = '#2a1838'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, top); ctx.lineTo(W + 20, top); ctx.stroke();
      // torretas cada 520px
      const seg = 520;
      const first = Math.floor((px - 1350 * 0.45) / seg) - 1;
      for (let k = Math.max(0, first); k < first + 4; k++) {
        const tx = 1350 * 0.45 + 200 + k * seg - px;
        if (tx < sx - 40) continue;
        ctx.fillStyle = '#5e3a52'; ctx.fillRect(tx - 30, top - 70, 60, 70); ctx.strokeRect(tx - 30, top - 70, 60, 70);
        ctx.fillStyle = '#2a1838'; ctx.fillRect(tx - 6, top - 52, 12, 22);
        roof(ctx, tx, top - 70, 84, 26, '#3f6a8a', '#25405e', '#d9b25a');
        if (k % 2 === 0) arlongFlag(ctx, tx, top - 150, 0.75, t + k);
      }
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- base de la torre principal (paralaje 0.85)
  // Se eleva tras el muro en la segunda mitad del nivel: tejados de pagoda y ventanas encendidas.
  Level.prototype.drawTowerBase = function (ctx, camX, t) {
    const P = 0.85, Lx0 = 4250, Lx1 = 6450;
    const sx0 = Lx0 - camX * P, sx1 = Lx1 - camX * P;
    if (sx1 < -40 || sx0 > W + 40) return;
    ctx.save();
    ctx.translate(0, (this.collapse || 0) * 320);
    ctx.lineWidth = 1.7; ctx.strokeStyle = BGLINE;
    const top = 78;
    const g = ctx.createLinearGradient(0, top, 0, 215);
    g.addColorStop(0, '#8a5462'); g.addColorStop(1, '#4a2a3e');
    ctx.fillStyle = g; ctx.fillRect(sx0, top, sx1 - sx0, 215 - top); ctx.strokeRect(sx0, top, sx1 - sx0, 215 - top);
    // ventanas de celosía con luz cálida
    for (let L = Lx0 + 70; L < Lx1 - 40; L += 105) {
      const x = L - camX * P;
      if (x < -60 || x > W + 60) continue;
      const h = hash(L * 0.11);
      for (const wy of [102, 160]) {
        const lit = h > 0.22 || wy === 160;
        const fl = 0.85 + 0.15 * Math.sin(t * (3 + h * 4) + L);
        ctx.fillStyle = '#2a1426'; ctx.fillRect(x - 22, wy - 4, 44, 44);
        if (lit) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const hg = ctx.createRadialGradient(x, wy + 18, 4, x, wy + 18, 48);
          hg.addColorStop(0, `rgba(255,180,90,${0.35 * fl})`); hg.addColorStop(1, 'rgba(255,140,60,0)');
          ctx.fillStyle = hg; ctx.fillRect(x - 50, wy - 30, 100, 96);
          ctx.restore();
          const wg = ctx.createLinearGradient(0, wy, 0, wy + 36);
          wg.addColorStop(0, '#ffe2a0'); wg.addColorStop(1, '#ffb050');
          ctx.fillStyle = wg; ctx.fillRect(x - 17, wy, 34, 36);
          // vigía hombre-pez en algunas ventanas
          if (h > 0.82 && wy === 102) {
            ctx.fillStyle = '#3a1e3a';
            ctx.beginPath(); ctx.moveTo(x - 8, wy + 36); ctx.quadraticCurveTo(x - 10, wy + 14, x, wy + 12); ctx.lineTo(x - 2, wy + 4); ctx.lineTo(x + 4, wy + 11); ctx.quadraticCurveTo(x + 12, wy + 16, x + 10, wy + 36); ctx.closePath(); ctx.fill();
          }
        } else { ctx.fillStyle = '#3a2238'; ctx.fillRect(x - 17, wy, 34, 36); }
        ctx.strokeStyle = '#5a2e22'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x, wy); ctx.lineTo(x, wy + 36); ctx.moveTo(x - 17, wy + 12); ctx.lineTo(x + 17, wy + 12); ctx.moveTo(x - 17, wy + 24); ctx.lineTo(x + 17, wy + 24); ctx.stroke();
        ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 2; ctx.strokeRect(x - 17, wy, 34, 36);
      }
    }
    // cornisa intermedia de tejas y tejado superior con aleros levantados
    ctx.fillStyle = '#35587a'; ctx.fillRect(sx0 - 8, 146, sx1 - sx0 + 16, 8); ctx.strokeRect(sx0 - 8, 146, sx1 - sx0 + 16, 8);
    ctx.beginPath();
    ctx.moveTo(sx0 - 40, top - 4); ctx.quadraticCurveTo(sx0 - 10, top + 4, sx0 + 20, top);
    ctx.lineTo(sx1 - 20, top); ctx.quadraticCurveTo(sx1 + 10, top + 4, sx1 + 40, top - 4);
    ctx.lineTo(sx1 - 10, top - 34); ctx.lineTo(sx0 + 10, top - 34); ctx.closePath();
    const rg = ctx.createLinearGradient(0, top - 34, 0, top);
    rg.addColorStop(0, '#4a7a9a'); rg.addColorStop(1, '#25405e');
    ctx.fillStyle = rg; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e0b85a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx0 - 36, top - 4); ctx.quadraticCurveTo(sx0 - 10, top + 2, sx0 + 20, top - 1); ctx.lineTo(sx1 - 20, top - 1); ctx.quadraticCurveTo(sx1 + 10, top + 2, sx1 + 36, top - 4); ctx.stroke();
    ctx.restore();
  };

  // ---------------------------------------------------------------- capa cercana (fondo del área jugable)
  Level.prototype.drawNear = function (ctx, camX, t) {
    const x0 = camX - 100, x1 = camX + W + 100;
    ctx.save();
    ctx.translate(-camX, 0);
    ctx.lineWidth = 1.7; ctx.strokeStyle = BGLINE;
    // Exterior: palmeras, rocas y postes con farolillos
    if (x0 < 1500) this.drawCritters(ctx, x0, x1, t);
    for (const px of this.palms) if (px > x0 - 100 && px < x1 + 100) palm(ctx, px, GY, 150 + (px % 3) * 18, t);
    for (const b of this.breakables) {
      if (b.kind !== 'lantern' || b.x < x0 || b.x > x1) continue;
      // poste o cuerda del que cuelga
      if (b.x < 1520) {
        ctx.fillStyle = '#6a4630';
        ctx.fillRect(b.x - 34, b.y - 40, 8, GY - b.y + 40); ctx.strokeRect(b.x - 34, b.y - 40, 8, GY - b.y + 40);
        ctx.fillRect(b.x - 36, b.y - 44, 40, 7); ctx.strokeRect(b.x - 36, b.y - 44, 40, 7);
      } else {
        A.line(ctx, [b.x, 0, b.x, b.y - 30], 1.6, '#2a1a12');
      }
    }
    // Muro interior de Arlong Park (a partir de la puerta)
    const wx0 = Math.max(1600, x0), wx1 = Math.min(6720, x1);
    if (wx1 > wx0) {
      const top = 215;
      const g = ctx.createLinearGradient(0, top, 0, GY);
      g.addColorStop(0, '#b77f6a'); g.addColorStop(0.6, '#93604f'); g.addColorStop(1, '#6a3f38');
      ctx.fillStyle = g; ctx.fillRect(wx0, top, wx1 - wx0, GY - top);
      // sillares
      ctx.save();
      ctx.strokeStyle = 'rgba(60,20,30,.35)'; ctx.lineWidth = 1.5;
      for (let y = top + 40, r = 0; y < GY; y += 36, r++) {
        ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke();
        const off = r % 2 ? 40 : 0;
        for (let x = Math.floor((wx0 - off) / 80) * 80 + off; x < wx1; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 36); ctx.stroke(); }
      }
      for (let y = top + 40, r = 0; y < GY; y += 36, r++) {
        const off = r % 2 ? 40 : 0;
        for (let x = Math.floor((wx0 - off) / 80) * 80 + off; x < wx1; x += 80) {
          const h = hash(x * 0.13 + r * 7.1);
          if (h < 0.3) { ctx.fillStyle = 'rgba(40,10,25,.10)'; ctx.fillRect(x + 1, y + 1, 78, 34); }
          else if (h > 0.78) { ctx.fillStyle = 'rgba(255,220,190,.08)'; ctx.fillRect(x + 1, y + 1, 78, 34); }
          if (h > 0.93) { ctx.fillStyle = 'rgba(90,130,80,.35)'; ctx.beginPath(); ctx.ellipse(x + 40, y + 34, 22, 4, 0, Math.PI, 0); ctx.fill(); }
        }
      }
      ctx.restore();
      // friso de olas azul
      ctx.fillStyle = '#2f5f8a'; ctx.fillRect(wx0, top, wx1 - wx0, 34);
      ctx.save(); ctx.strokeStyle = '#9fd0f0'; ctx.lineWidth = 2.5;
      for (let x = Math.floor(wx0 / 48) * 48; x < wx1; x += 48) {
        ctx.beginPath(); ctx.arc(x + 24, top + 30, 16, Math.PI, Math.PI * 1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + 30, top + 26, 6, Math.PI, Math.PI * 2.2); ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(wx0, top); ctx.lineTo(wx1, top); ctx.moveTo(wx0, top + 34); ctx.lineTo(wx1, top + 34); ctx.stroke();
      // remate superior con tejas
      ctx.fillStyle = '#3f6a8a';
      ctx.beginPath(); ctx.moveTo(wx0, top); ctx.lineTo(wx0, top - 16); ctx.lineTo(wx1, top - 16); ctx.lineTo(wx1, top); ctx.closePath(); ctx.fill(); ctx.stroke();
      // arcos / ventanas y estandartes
      for (let x = Math.floor(wx0 / 320) * 320 + 160; x < wx1 + 160; x += 320) {
        if (x < 1650 || x > 6680) continue;
        ctx.fillStyle = '#2a1626';
        ctx.beginPath(); ctx.moveTo(x - 40, GY); ctx.lineTo(x - 40, 335); ctx.quadraticCurveTo(x, 285, x + 40, 335); ctx.lineTo(x + 40, GY); ctx.closePath(); ctx.fill(); ctx.stroke();
        // mar visto a través del arco
        ctx.save(); ctx.clip();
        const sg = ctx.createLinearGradient(0, 300, 0, GY);
        sg.addColorStop(0, '#f2a26a'); sg.addColorStop(0.4, '#4a5a8a'); sg.addColorStop(1, '#142a4a');
        ctx.fillStyle = sg; ctx.fillRect(x - 40, 280, 80, GY - 280);
        ctx.restore();
        // moldura de piedra clara y clave del arco
        ctx.save();
        ctx.beginPath(); ctx.moveTo(x - 44, GY); ctx.lineTo(x - 44, 335); ctx.quadraticCurveTo(x, 280, x + 44, 335); ctx.lineTo(x + 44, GY);
        ctx.strokeStyle = BGLINE; ctx.lineWidth = 9; ctx.stroke();
        ctx.strokeStyle = '#d4ac90'; ctx.lineWidth = 6.5; ctx.stroke();
        ctx.strokeStyle = 'rgba(120,70,60,.6)'; ctx.lineWidth = 1.5; ctx.translate(1.5, 1.5); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#e0bc9c'; ctx.beginPath(); ctx.moveTo(x - 8, 300); ctx.lineTo(x + 8, 300); ctx.lineTo(x + 6, 316); ctx.lineTo(x - 6, 316); ctx.closePath(); ctx.fill(); ctx.stroke();
        if ((x / 320) % 2 === 1 || Math.round(x / 320) % 2 === 1) {
          // estandarte con el emblema
          const bx = x + 160;
          if (bx < 6680) {
            ctx.fillStyle = '#1b1426';
            const sw = Math.sin(t * 2 + x) * 2;
            ctx.beginPath(); ctx.moveTo(bx - 22, 249); ctx.lineTo(bx + 22, 249); ctx.lineTo(bx + 22 + sw, 340); ctx.lineTo(bx + sw, 356); ctx.lineTo(bx - 22 + sw, 340); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e8e0d0'; ctx.beginPath(); ctx.arc(bx + sw * 0.5, 290, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1b1426';
            ctx.beginPath(); ctx.moveTo(bx - 8, 290); for (let i = 0; i < 5; i++) { ctx.lineTo(bx - 6 + i * 3.6, 294); ctx.lineTo(bx - 4 + i * 3.6, 290); } ctx.quadraticCurveTo(bx, 301, bx - 8, 290); ctx.fill();
          }
        }
      }
    }
    if (wx1 > wx0) this.drawWallDressing(ctx, wx0, wx1, t);
    // Puerta de Arlong Park
    if (x1 > 1420 && x0 < 1760) this.drawGate(ctx, 1590, t, false);
    // Fachada del edificio principal en la arena final
    if (x1 > 6700) this.drawFacade(ctx, 7200, t);
    ctx.restore();
  };
  // columnas lacadas, guirnaldas de banderines y sombra en la base del muro
  Level.prototype.drawWallDressing = function (ctx, wx0, wx1, t) {
    const top = 215;
    // sombra bajo el friso y en la base (oclusión ambiental)
    let g = ctx.createLinearGradient(0, top + 34, 0, top + 70);
    g.addColorStop(0, 'rgba(30,8,24,.45)'); g.addColorStop(1, 'rgba(30,8,24,0)');
    ctx.fillStyle = g; ctx.fillRect(wx0, top + 34, wx1 - wx0, 36);
    g = ctx.createLinearGradient(0, GY - 55, 0, GY);
    g.addColorStop(0, 'rgba(30,8,24,0)'); g.addColorStop(1, 'rgba(30,8,24,.5)');
    ctx.fillStyle = g; ctx.fillRect(wx0, GY - 55, wx1 - wx0, 55);
    // guirnaldas de banderines entre las columnas
    const cols = ['#e8392c', '#ffd84a', '#3fa3b0', '#f2f0e6'];
    for (let x = Math.floor(wx0 / 320) * 320; x < wx1 + 320; x += 320) {
      if (x < 1600 || x + 320 > 6720) continue;
      const y0 = 262, sag = 26 + Math.sin(t * 1.2 + x) * 2;
      const pt = (k) => ({ x: x + 320 * k, y: y0 + Math.sin(k * Math.PI) * sag });
      ctx.save();
      ctx.strokeStyle = '#3a2418'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 160, y0 + sag * 2, x + 320, y0); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = A.OUT;
      for (let i = 1; i < 14; i++) {
        const k = i / 14, a = pt(k);
        const sw = Math.sin(t * 3 + i + x) * 2;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.moveTo(a.x - 6, a.y); ctx.lineTo(a.x + 6, a.y); ctx.lineTo(a.x + sw, a.y + 13); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    // haces de luz del atardecer que entran por los arcos y caen sobre el suelo
    if (!G.lowFx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fade = 1 - (G.nightK || 0) * 0.6;
      for (let x = Math.floor(wx0 / 320) * 320 + 160; x < wx1 + 160; x += 320) {
        if (x < 1650 || x > 6680) continue;
        const g2 = ctx.createLinearGradient(x, 300, x - 90, GY);
        g2.addColorStop(0, `rgba(255,190,120,${0.22 * fade})`); g2.addColorStop(1, 'rgba(255,170,100,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.moveTo(x - 36, 320); ctx.lineTo(x + 36, 320); ctx.lineTo(x - 40, GY + 2); ctx.lineTo(x - 150, GY + 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = `rgba(255,190,120,${0.18 * fade})`;
        ctx.beginPath(); ctx.ellipse(x - 95, GY + 1, 60, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // columnas rojas lacadas con capitel y basa doradas
    for (let x = Math.floor(wx0 / 640) * 640; x < wx1 + 40; x += 640) {
      if (x < 1700 || x > 6600) continue;
      const cg = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
      cg.addColorStop(0, '#d4433a'); cg.addColorStop(0.3, '#f06a58'); cg.addColorStop(0.45, '#c8352e'); cg.addColorStop(0.62, '#9a2424'); cg.addColorStop(1, '#6a1818');
      ctx.fillStyle = cg; ctx.fillRect(x - 14, top + 34, 28, GY - top - 34); ctx.strokeRect(x - 14, top + 34, 28, GY - top - 34);
      for (const yy of [top + 34, GY - 22]) {
        const gg = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
        gg.addColorStop(0, '#f6d27a'); gg.addColorStop(0.5, '#e0b04a'); gg.addColorStop(1, '#a87a22');
        ctx.fillStyle = gg; ctx.fillRect(x - 19, yy, 38, 22); ctx.strokeRect(x - 19, yy, 38, 22);
        ctx.beginPath(); ctx.moveTo(x - 19, yy + 11); ctx.lineTo(x + 19, yy + 11); ctx.save(); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      }
    }
  };
  // cangrejitos que corretean por la arena y gaviotas posadas en los postes
  Level.prototype.drawCritters = function (ctx, x0, x1, t) {
    const px = G.game && G.game.player ? G.game.player.x : -9999;
    ctx.save();
    ctx.lineWidth = 1.4; ctx.strokeStyle = '#1a0e1e';
    for (const base of [260, 760, 1150]) {
      const cx = base + Math.sin(t * 0.6 + base) * 40, cy = GY - 4;
      if (cx < x0 || cx > x1) continue;
      const scared = Math.abs(px - cx) < 70;
      const x = scared ? cx + Math.sign(cx - px) * 30 : cx;
      ctx.save(); ctx.translate(x, cy);
      const lg = Math.sin(t * 18 + base) * 1.5;
      ctx.beginPath();
      for (const d of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.moveTo(d * (3 + i * 2), 1); ctx.lineTo(d * (7 + i * 2), 4 + (i % 2 ? lg : -lg)); }
      ctx.stroke();
      ctx.fillStyle = '#e8503a'; ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.5, 0, Math.PI, 0); ctx.lineTo(7, 1); ctx.lineTo(-7, 1); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-8, -4, 2.5, 0, Math.PI * 2); ctx.arc(8, -4, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1a0e1e'; ctx.fillRect(-3, -6, 1.6, 2.4); ctx.fillRect(1.6, -6, 1.6, 2.4);
      ctx.restore();
    }
    // gaviotas posadas sobre los postes de los farolillos; vuelan si te acercas
    for (const b of this.breakables) {
      if (b.kind !== 'lantern' || b.x > 1520 || b.x < x0 || b.x > x1) continue;
      const near = Math.abs(px - (b.x - 16)) < 90;
      if (!this.gullFled) this.gullFled = {};
      if (near) this.gullFled[b.x] = this.gullFled[b.x] || t;
      const fled = this.gullFled[b.x];
      let gx = b.x - 16, gy = b.y - 48;
      if (fled) { const ft = t - fled; if (ft > 3) continue; gx += ft * 120; gy -= ft * 90 + Math.sin(ft * 10) * 4; }
      ctx.save(); ctx.translate(gx, gy);
      ctx.fillStyle = '#f4f2ee';
      if (fled) {
        const f = Math.sin((t - fled) * 22) * 6;
        ctx.beginPath(); ctx.moveTo(-10, -f); ctx.quadraticCurveTo(-4, -4, 0, 0); ctx.quadraticCurveTo(4, -4, 10, -f); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(6, -5, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.moveTo(9, -5); ctx.lineTo(13, -4); ctx.lineTo(9, -3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#6a6a7a'; ctx.beginPath(); ctx.ellipse(-2, -1, 5, 3, -0.2, 0, Math.PI); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  };
  Level.prototype.drawGate = function (ctx, cx, t, front) {
    ctx.lineWidth = 1.7; ctx.strokeStyle = BGLINE;
    const pil = (x) => {
      const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
      g.addColorStop(0, '#c48a6a'); g.addColorStop(0.6, '#a06a52'); g.addColorStop(0.61, '#7a4a3a'); g.addColorStop(1, '#6a3f32');
      ctx.fillStyle = g; ctx.fillRect(x - 26, 140, 52, GY - 140); ctx.strokeRect(x - 26, 140, 52, GY - 140);
      ctx.fillStyle = '#2f5f8a'; ctx.fillRect(x - 30, 130, 60, 20); ctx.strokeRect(x - 30, 130, 60, 20);
    };
    pil(cx - 110); pil(cx + 110);
    roof(ctx, cx, 132, 300, 48, '#3f6a8a', '#25405e', '#e0b85a');
    // cartel
    ctx.fillStyle = '#f2e2b0'; ctx.fillRect(cx - 92, 146, 184, 40); ctx.strokeRect(cx - 92, 146, 184, 40);
    ctx.fillStyle = '#1a3a6a'; ctx.font = '32px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ARLONG PARK', cx, 168);
    arlongFlag(ctx, cx - 110, 30, 0.9, t);
    arlongFlag(ctx, cx + 110, 30, 0.9, t + 1);
  };
  Level.prototype.drawFacade = function (ctx, cx, t) {
    ctx.lineWidth = 1.7; ctx.strokeStyle = BGLINE;
    const c = this.collapse || 0;
    ctx.save();
    ctx.translate(0, c * 300);
    // cuerpo del edificio
    const g = ctx.createLinearGradient(cx - 420, 0, cx + 420, 0);
    g.addColorStop(0, '#c48a6a'); g.addColorStop(1, '#8a5546');
    ctx.fillStyle = g; ctx.fillRect(cx - 440, 120, 880, GY - 120); ctx.strokeRect(cx - 440, 120, 880, GY - 120);
    ctx.fillStyle = '#2f5f8a'; ctx.fillRect(cx - 440, 120, 880, 30); ctx.strokeRect(cx - 440, 120, 880, 30);
    // sillares con variación y sombra en la base
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 440, 150, 880, GY - 150); ctx.clip();
    ctx.strokeStyle = 'rgba(70,25,25,.32)'; ctx.lineWidth = 1.4;
    for (let y = 150, r = 0; y < GY; y += 34, r++) {
      ctx.beginPath(); ctx.moveTo(cx - 440, y); ctx.lineTo(cx + 440, y); ctx.stroke();
      for (let x = cx - 440 + (r % 2) * 38; x < cx + 440; x += 76) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 34); ctx.stroke();
        const h = hash(x * 0.21 + r * 3.3);
        if (h < 0.28) { ctx.fillStyle = 'rgba(60,15,20,.10)'; ctx.fillRect(x + 1, y + 1, 74, 32); }
        else if (h > 0.8) { ctx.fillStyle = 'rgba(255,225,200,.10)'; ctx.fillRect(x + 1, y + 1, 74, 32); }
      }
    }
    const ao = ctx.createLinearGradient(0, GY - 60, 0, GY);
    ao.addColorStop(0, 'rgba(30,8,24,0)'); ao.addColorStop(1, 'rgba(30,8,24,.55)');
    ctx.fillStyle = ao; ctx.fillRect(cx - 440, GY - 60, 880, 60);
    const ao2 = ctx.createLinearGradient(0, 150, 0, 190);
    ao2.addColorStop(0, 'rgba(30,8,24,.5)'); ao2.addColorStop(1, 'rgba(30,8,24,0)');
    ctx.fillStyle = ao2; ctx.fillRect(cx - 440, 150, 880, 40);
    ctx.restore();
    // columnas rojas lacadas con volumen
    for (const k of [-360, -200, 200, 360]) {
      const x = cx + k;
      const cg = ctx.createLinearGradient(x - 14, 0, x + 14, 0);
      cg.addColorStop(0, '#d4433a'); cg.addColorStop(0.3, '#f06a58'); cg.addColorStop(0.45, '#c8352e'); cg.addColorStop(0.62, '#9a2424'); cg.addColorStop(1, '#6a1818');
      ctx.fillStyle = cg; ctx.fillRect(x - 14, 150, 28, GY - 150); ctx.strokeRect(x - 14, 150, 28, GY - 150);
      for (const yy of [150, GY - 22]) {
        const gg = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
        gg.addColorStop(0, '#f6d27a'); gg.addColorStop(0.5, '#e0b04a'); gg.addColorStop(1, '#a87a22');
        ctx.fillStyle = gg; ctx.fillRect(x - 19, yy, 38, 22); ctx.strokeRect(x - 19, yy, 38, 22);
      }
    }
    // gran portón de madera con remaches y aldabas
    ctx.save();
    const door = new Path2D();
    door.moveTo(cx - 110, GY); door.lineTo(cx - 110, 268); door.quadraticCurveTo(cx, 206, cx + 110, 268); door.lineTo(cx + 110, GY); door.closePath();
    const dg = ctx.createLinearGradient(cx - 110, 0, cx + 110, 0);
    dg.addColorStop(0, '#5a2e22'); dg.addColorStop(0.48, '#7a3e2a'); dg.addColorStop(0.5, '#3a1a14'); dg.addColorStop(0.52, '#6a3424'); dg.addColorStop(1, '#4a2418');
    ctx.fillStyle = dg; ctx.fill(door); ctx.stroke(door);
    ctx.clip(door);
    ctx.strokeStyle = 'rgba(30,10,8,.6)'; ctx.lineWidth = 1.5;
    for (let x = cx - 100; x < cx + 110; x += 22) { ctx.beginPath(); ctx.moveTo(x, 220); ctx.lineTo(x, GY); ctx.stroke(); }
    ctx.fillStyle = '#3a2a2a'; ctx.strokeStyle = A.OUT; ctx.lineWidth = 2;
    for (const y of [300, 380]) { ctx.fillRect(cx - 112, y, 224, 12); ctx.strokeRect(cx - 112, y, 224, 12); }
    ctx.fillStyle = '#e0b04a';
    for (const y of [306, 386]) for (let x = cx - 100; x < cx + 105; x += 20) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    ctx.save();
    for (const d of [-1, 1]) {
      ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx + d * 26, 352, 11, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#c8962e'; ctx.beginPath(); ctx.arc(cx + d * 26, 340, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = A.OUT; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
    // emblema de los Piratas de Arlong pintado sobre la puerta
    ctx.save();
    ctx.translate(cx, 236);
    ctx.fillStyle = '#1b1426';
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; ctx.beginPath(); ctx.moveTo(Math.cos(a - 0.12) * 18, Math.sin(a - 0.12) * 18); ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30); ctx.lineTo(Math.cos(a + 0.12) * 18, Math.sin(a + 0.12) * 18); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.moveTo(-13, 1); for (let i = 0; i < 7; i++) { ctx.lineTo(-11 + i * 3.7, 7); ctx.lineTo(-9 + i * 3.7, 1); } ctx.lineTo(13, 1); ctx.quadraticCurveTo(0, 17, -13, 1); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-6, -6, 2.6, 3.6, 0, 0, Math.PI * 2); ctx.ellipse(6, -6, 2.6, 3.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // farolillos colgando entre columnas
    ctx.save();
    for (const k of [-280, 280]) {
      const lx = cx + k;
      A.line(ctx, [lx, 150, lx, 238], 1.5, '#2a1a12');
      ctx.save(); ctx.translate(lx, 255); A.drawLantern(ctx, t * 1.3 + k, false); ctx.restore();
    }
    ctx.restore();
    ctx.lineWidth = 1.7; ctx.strokeStyle = BGLINE;
    // tejados superiores (se salen de la pantalla)
    roof(ctx, cx, 120, 980, 70, '#3f6a8a', '#25405e', '#e0b85a');
    ctx.fillStyle = '#a06a52'; ctx.fillRect(cx - 260, -40, 520, 90); ctx.strokeRect(cx - 260, -40, 520, 90);
    roof(ctx, cx, 50, 600, 60, '#3f6a8a', '#25405e', '#e0b85a');
    // cartel
    ctx.fillStyle = '#f2e2b0'; ctx.fillRect(cx - 130, 158, 260, 50); ctx.strokeRect(cx - 130, 158, 260, 50);
    ctx.fillStyle = '#1a3a6a'; ctx.font = '42px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ARLONG PARK', cx, 185);
    arlongFlag(ctx, cx - 300, 200, 1, t);
    arlongFlag(ctx, cx + 300, 200, 1, t + 2);
    ctx.restore();
  };

  // ---------------------------------------------------------------- suelo, bloques y plataformas
  Level.prototype.drawTerrain = function (ctx, camX) {
    const x0 = camX - 20, x1 = camX + W + 20;
    ctx.save();
    ctx.translate(-camX, 0);
    ctx.lineWidth = 2.4; ctx.strokeStyle = A.OUT;
    // fondo oscuro de las pozas
    for (const p of this.pits) {
      if (p.x > x1 || p.x + p.w < x0) continue;
      const g = ctx.createLinearGradient(0, GY, 0, H);
      g.addColorStop(0, '#2a1a2a'); g.addColorStop(1, '#0a0610');
      ctx.fillStyle = g; ctx.fillRect(p.x, GY - 2, p.w, H - GY + 2);
    }
    for (const s of this.solids) {
      if (s.x > x1 || s.x + s.w < x0) continue;
      if (s.kind === 'crate') { this.drawCrate(ctx, s); continue; }
      const outside = s.x + s.w <= 1600 && s.kind === 'ground';
      const top = s.y, h = H - s.y;
      const g = ctx.createLinearGradient(0, top, 0, H);
      if (outside) { g.addColorStop(0, '#c8a878'); g.addColorStop(0.15, '#a08058'); g.addColorStop(1, '#5a4030'); }
      else { g.addColorStop(0, '#a89488'); g.addColorStop(0.15, '#7d685e'); g.addColorStop(1, '#3e2c2c'); }
      ctx.fillStyle = g;
      ctx.fillRect(s.x, top, s.w, h + 10);
      // baldosas
      const cx0 = Math.max(s.x, x0), cx1 = Math.min(s.x + s.w, x1);
      ctx.save();
      ctx.beginPath(); ctx.rect(s.x, top, s.w, h + 10); ctx.clip();
      ctx.strokeStyle = outside ? 'rgba(70,40,20,.35)' : 'rgba(30,15,25,.4)'; ctx.lineWidth = 1.5;
      for (let y = top + 14, r = 0; y < H; y += 26, r++) {
        ctx.beginPath(); ctx.moveTo(cx0, y); ctx.lineTo(cx1, y); ctx.stroke();
        const off = r % 2 ? 32 : 0;
        for (let x = Math.floor((cx0 - off) / 64) * 64 + off; x < cx1; x += 64) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 26); ctx.stroke(); }
      }
      ctx.restore();
      // borde superior iluminado
      ctx.fillStyle = outside ? '#e2c69a' : '#c8b4a4';
      ctx.fillRect(s.x, top, s.w, 6);
      ctx.beginPath(); ctx.moveTo(s.x, H + 10); ctx.lineTo(s.x, top); ctx.lineTo(s.x + s.w, top); ctx.lineTo(s.x + s.w, H + 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s.x, top + 6); ctx.lineTo(s.x + s.w, top + 6); ctx.save(); ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      this.drawGroundDetails(ctx, s, cx0, cx1, outside);
    }
    for (const p of this.oneways) {
      if (p.x > x1 || p.x + p.w < x0) continue;
      // repisa de piedra con ménsulas
      const g = ctx.createLinearGradient(0, p.y, 0, p.y + 16);
      g.addColorStop(0, '#c8b4a4'); g.addColorStop(1, '#7d685e');
      ctx.fillStyle = g; ctx.fillRect(p.x, p.y, p.w, 16); ctx.strokeRect(p.x, p.y, p.w, 16);
      ctx.fillStyle = '#5e4a44';
      for (const bx of [p.x + 14, p.x + p.w - 26]) {
        ctx.beginPath(); ctx.moveTo(bx, p.y + 16); ctx.lineTo(bx + 12, p.y + 16); ctx.lineTo(bx + 6, p.y + 34); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  };
  // hierba, musgo, grietas y guijarros repartidos de forma estable (pseudoaleatoria)
  Level.prototype.drawGroundDetails = function (ctx, s, x0, x1, outside) {
    const top = s.y;
    ctx.save();
    ctx.lineWidth = 1.2;
    for (let x = Math.floor(x0 / 23) * 23; x < x1; x += 23) {
      const h1 = hash(x * 0.37 + s.y), h2 = hash(x * 1.91 + 3.1);
      if (x < s.x + 6 || x > s.x + s.w - 6) continue;
      if (outside && h1 < 0.55) {
        // mata de hierba
        const hgt = 7 + h2 * 9;
        ctx.fillStyle = h2 > 0.5 ? '#5d9a3e' : '#4a8434';
        ctx.strokeStyle = '#1f3a1a';
        ctx.beginPath();
        ctx.moveTo(x - 6, top + 1);
        ctx.quadraticCurveTo(x - 5, top - hgt * 0.6, x - 8, top - hgt);
        ctx.quadraticCurveTo(x - 2, top - hgt * 0.5, x, top - hgt * 1.15);
        ctx.quadraticCurveTo(x + 2, top - hgt * 0.5, x + 7, top - hgt * 0.85);
        ctx.quadraticCurveTo(x + 4, top - hgt * 0.4, x + 6, top + 1);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        if (h1 < 0.08) { ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(x, top - hgt * 1.15, 2.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      } else if (!outside && h1 < 0.22) {
        // musgo en la junta de las losas
        ctx.fillStyle = 'rgba(90,140,80,.75)';
        ctx.beginPath(); ctx.ellipse(x, top + 2, 6 + h2 * 6, 2.4, 0, Math.PI, 0); ctx.fill();
      } else if (!outside && h1 > 0.86) {
        // grieta
        ctx.strokeStyle = 'rgba(30,15,25,.55)';
        ctx.beginPath(); ctx.moveTo(x, top + 8); ctx.lineTo(x + 4, top + 15); ctx.lineTo(x + 1, top + 22); ctx.lineTo(x + 6, top + 30); ctx.stroke();
      }
      if (h2 > 0.9) {
        ctx.fillStyle = outside ? '#a88a68' : '#8a7a70'; ctx.strokeStyle = 'rgba(30,15,25,.6)';
        ctx.beginPath(); ctx.ellipse(x + 10, top - 1.5, 3.5, 2.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  };
  Level.prototype.drawCrate = function (ctx, s) {
    const g = ctx.createLinearGradient(s.x, s.y, s.x + s.w, s.y + s.h);
    g.addColorStop(0, '#c89058'); g.addColorStop(0.6, '#a87040'); g.addColorStop(0.61, '#8a5a32'); g.addColorStop(1, '#7a4a28');
    ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, s.h); ctx.strokeRect(s.x, s.y, s.w, s.h);
    ctx.save(); ctx.lineWidth = 1.5;
    ctx.strokeRect(s.x + 5, s.y + 5, s.w - 10, s.h - 10);
    ctx.beginPath(); ctx.moveTo(s.x + 5, s.y + 5); ctx.lineTo(s.x + s.w - 5, s.y + s.h - 5); ctx.stroke();
    ctx.restore();
  };

  // ---------------------------------------------------------------- columnas que cierran una arena de jefe
  Level.prototype.drawArenaWalls = function (ctx, camX, arena) {
    const wW = G.ARENA_WALL || 34;
    ctx.save();
    ctx.translate(-camX, 0);
    ctx.lineWidth = 2.4; ctx.strokeStyle = A.OUT;
    for (const x of [arena.x0, arena.x1 - wW]) {
      const g = ctx.createLinearGradient(x, 0, x + wW, 0);
      g.addColorStop(0, '#c8b4a4'); g.addColorStop(0.55, '#a08a7c'); g.addColorStop(0.56, '#7d685e'); g.addColorStop(1, '#5e4a44');
      ctx.fillStyle = g;
      ctx.fillRect(x, 60, wW, GY - 60); ctx.strokeRect(x, 60, wW, GY - 60);
      ctx.fillStyle = '#b0302c'; ctx.fillRect(x - 4, 60, wW + 8, 16); ctx.strokeRect(x - 4, 60, wW + 8, 16);
      ctx.fillStyle = '#e0b85a'; ctx.fillRect(x - 6, 44, wW + 12, 16); ctx.strokeRect(x - 6, 44, wW + 12, 16);
      ctx.fillStyle = '#e0b85a'; ctx.fillRect(x - 4, GY - 18, wW + 8, 18); ctx.strokeRect(x - 4, GY - 18, wW + 8, 18);
      ctx.save(); ctx.strokeStyle = 'rgba(40,20,20,.35)'; ctx.lineWidth = 1.4;
      for (let y = 110; y < GY - 20; y += 48) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + wW, y); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- agua de las pozas (se pinta sobre las entidades)
  Level.prototype.drawWater = function (ctx, camX, t) {
    ctx.save();
    ctx.translate(-camX, 0);
    for (const p of this.pits) {
      if (p.x > camX + W || p.x + p.w < camX) continue;
      // sombras de peces nadando bajo el agua
      ctx.save();
      ctx.beginPath(); ctx.rect(p.x, WATER_Y, p.w, H - WATER_Y); ctx.clip();
      ctx.fillStyle = 'rgba(10,30,60,.55)';
      for (let i = 0; i < 2; i++) {
        const sp = 30 + i * 18, dir = i % 2 ? 1 : -1;
        const fx = p.x + ((t * sp * dir + i * 70 + p.x) % p.w + p.w) % p.w, fy = WATER_Y + 22 + i * 12 + Math.sin(t * 2 + i) * 3;
        ctx.save(); ctx.translate(fx, fy); ctx.scale(dir, 1);
        ctx.beginPath(); ctx.ellipse(0, 0, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-17, -5 + Math.sin(t * 12 + i) * 2); ctx.lineTo(-17, 5 + Math.sin(t * 12 + i) * 2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(p.x, H);
      for (let x = p.x; x <= p.x + p.w; x += 8) ctx.lineTo(x, WATER_Y + Math.sin(t * 3 + x * 0.06) * 3);
      ctx.lineTo(p.x + p.w, H);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, WATER_Y, 0, H);
      g.addColorStop(0, 'rgba(90,170,230,.88)'); g.addColorStop(1, 'rgba(10,40,90,.95)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(220,245,255,.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = p.x; x <= p.x + p.w; x += 8) {
        const y = WATER_Y + Math.sin(t * 3 + x * 0.06) * 3;
        if (x === p.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < p.w / 40; i++) {
        const x = p.x + 14 + i * 40 + Math.sin(t + i) * 8;
        ctx.fillRect(x, WATER_Y + 14 + (i % 2) * 10, 16, 2);
      }
      // reflejo cálido del atardecer y espuma contra las paredes
      const rg = ctx.createLinearGradient(0, WATER_Y, 0, WATER_Y + 26);
      rg.addColorStop(0, 'rgba(255,170,110,.35)'); rg.addColorStop(1, 'rgba(255,170,110,0)');
      ctx.fillStyle = rg; ctx.fillRect(p.x, WATER_Y, p.w, 26);
      ctx.fillStyle = 'rgba(240,250,255,.85)';
      for (const ex of [p.x + 4, p.x + p.w - 4]) {
        for (let i = 0; i < 3; i++) {
          const fy = WATER_Y + Math.sin(t * 4 + i * 2 + ex) * 2;
          ctx.beginPath(); ctx.ellipse(ex + (ex > p.x + 10 ? -i * 5 : i * 5), fy, 5 - i, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- primer plano (parallax > 1)
  Level.prototype.drawFront = function (ctx, camX, t) {
    // guirnaldas de farolillos muy cerca de la cámara (sólo en el patio), para dar profundidad
    const P = 1.35;
    for (let L = 2100; L < 9000; L += 1150) {
      const x0 = L - camX * P, x1 = x0 + 700;
      if (x1 < -60 || x0 > W + 60) continue;
      const y0 = -10, sag = 70;
      ctx.save();
      ctx.strokeStyle = '#140a18'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + sag * 2, x1, y0); ctx.stroke();
      for (let i = 1; i < 5; i++) {
        const k = i / 5, lx = x0 + (x1 - x0) * k, ly = y0 + Math.sin(k * Math.PI) * sag + 24;
        const sw = Math.sin(t * 1.6 + i + L) * 0.08;
        ctx.save(); ctx.translate(lx, ly); ctx.rotate(sw);
        // halo cálido
        ctx.globalCompositeOperation = 'lighter';
        const hg = ctx.createRadialGradient(0, 10, 4, 0, 10, 70);
        hg.addColorStop(0, 'rgba(255,150,70,.35)'); hg.addColorStop(1, 'rgba(255,110,40,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 10, 70, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        // farolillo grande en semipenumbra con el borde inferior encendido
        ctx.strokeStyle = '#140a18'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(0, -4); ctx.stroke();
        const lg = ctx.createLinearGradient(0, -4, 0, 44);
        lg.addColorStop(0, '#3a0e16'); lg.addColorStop(0.6, '#8a1c1c'); lg.addColorStop(1, '#ff6a3a');
        ctx.fillStyle = lg; ctx.beginPath(); ctx.ellipse(0, 20, 20, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a1410'; ctx.fillRect(-10, -6, 20, 6); ctx.fillRect(-10, 42, 20, 6);
        ctx.restore();
      }
      ctx.restore();
    }
    for (const fx of this.fg) {
      const sx = fx * 1.3 - camX * 1.3;
      if (sx < -220 || sx > W + 220) continue;
      ctx.save();
      ctx.translate(sx, H + 14);
      // hojas grandes de primer plano, oscuras y con borde iluminado por el sol
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.33 + Math.sin(t * 1.1 + i + fx) * 0.04;
        const L = 52 + (i % 3) * 18;
        const ex = Math.cos(a) * L, ey = Math.sin(a) * L;
        const nx = -Math.sin(a), ny = Math.cos(a);
        ctx.beginPath();
        ctx.moveTo(-4 + i * 2, 0);
        ctx.quadraticCurveTo(ex * 0.5 + nx * 16, ey * 0.5 + ny * 16, ex, ey);
        ctx.quadraticCurveTo(ex * 0.5 - nx * 10, ey * 0.5 - ny * 10, 4 + i * 2, 0);
        ctx.closePath();
        ctx.fillStyle = '#160a1c'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,150,90,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-4 + i * 2, 0); ctx.quadraticCurveTo(ex * 0.5 + nx * 16, ey * 0.5 + ny * 16, ex, ey); ctx.stroke();
        ctx.strokeStyle = 'rgba(80,40,90,.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex * 0.92, ey * 0.92); ctx.stroke();
      }
      ctx.restore();
    }
  };
})();
