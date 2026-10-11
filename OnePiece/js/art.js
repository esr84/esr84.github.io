'use strict';
// Arte vectorial estilo anime: rig esquelético, contornos y sombreado cel-shading.
// NADA de pixel art: todo se dibuja con trazos suaves a la resolución nativa de la pantalla.
(function () {
  const A = G.art = {};
  const U = G.U;
  const OUT = A.OUT = '#1a0e1e';
  A.LW = 2.3;
  A.HEAD_SCALE = 1.1;          // cabezas algo más grandes para que las expresiones se lean
  A.flash = false;                       // true = silueta blanca (impacto); string = color de tinte
  const fc = A.flashCol = () => (typeof A.flash === 'string' ? A.flash : '#fff6e6');
  const c = A.c = (col) => (A.flash ? fc() : col);

  // ---------------------------------------------------------------- color
  const mixCache = new Map();
  // mezcla dos colores hexadecimales (con caché, se usa en cada fotograma)
  A.mix = function (a, b, k) {
    const key = a + b + k;
    let v = mixCache.get(key);
    if (v) return v;
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - k) + ((pb >> sh) & 255) * k);
    v = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
    mixCache.set(key, v);
    return v;
  };
  A.RIM = '#ffb070';        // contraluz cálido del atardecer
  A.rimK = 0.38;
  const rim = (dark) => (dark[0] === '#' && dark.length === 7 ? A.mix(dark, A.RIM, A.rimK) : dark);

  // ---------------------------------------------------------------- primitivas
  // Degradado de corte duro perpendicular a un segmento: luz arriba-izquierda, sombra abajo-derecha
  // y una banda fina de contraluz en el borde en sombra.
  A.cel = function (ctx, cx, cy, ang, r, light, dark) {
    if (A.flash) return fc();
    let nx = -Math.sin(ang), ny = Math.cos(ang);
    if (nx * 0.45 + ny * 0.9 < 0) { nx = -nx; ny = -ny; }
    const g = ctx.createLinearGradient(cx - nx * r, cy - ny * r, cx + nx * r, cy + ny * r);
    g.addColorStop(0, light); g.addColorStop(0.58, light);
    g.addColorStop(0.58, dark); g.addColorStop(0.84, dark);
    g.addColorStop(0.84, rim(dark)); g.addColorStop(1, rim(dark));
    return g;
  };
  A.celR = function (ctx, cx, cy, r, light, dark, cut = 0.64) {
    if (A.flash) return fc();
    const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx - r * 0.25, cy - r * 0.3, r * 1.35);
    g.addColorStop(0, light); g.addColorStop(cut, light);
    g.addColorStop(cut, dark); g.addColorStop(1, dark);
    return g;
  };
  // Envuelve una función de dibujo de personaje: primero una silueta engrosada (contorno exterior
  // grueso, como en el anime) y después el personaje normal encima.
  A.outlined = function (fn) {
    return function (ctx, p, t, o) {
      if (!A.flash && !A.noOutline) {
        const lw = A.LW;
        A.flash = OUT; A.LW = lw + 2.6;
        ctx.save(); fn(ctx, p, t, o); ctx.restore();
        A.LW = lw; A.flash = false;
      }
      return fn(ctx, p, t, o);
    };
  };
  // Cápsula cónica (extremidades).
  A.limb = function (ctx, x1, y1, x2, y2, r1, r2, light, dark) {
    const dx = x2 - x1, dy = y2 - y1;
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.arc(x1, y1, r1, ang + Math.PI / 2, ang + Math.PI * 1.5);
    ctx.arc(x2, y2, r2, ang - Math.PI / 2, ang + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = dark ? A.cel(ctx, (x1 + x2) / 2, (y1 + y2) / 2, ang, Math.max(r1, r2), light, dark) : c(light);
    ctx.fill();
    ctx.stroke();
  };
  A.circle = function (ctx, x, y, r, light, dark, stroke = true) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = dark ? A.celR(ctx, x, y, r, light, dark) : c(light);
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  A.ellipse = function (ctx, x, y, rx, ry, rot, fill, stroke = true) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = typeof fill === 'string' ? c(fill) : fill;
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  A.fillStroke = function (ctx, fill, stroke = true) {
    ctx.fillStyle = typeof fill === 'string' ? c(fill) : fill;
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  A.line = function (ctx, pts, w, col) {
    ctx.save();
    ctx.lineWidth = w;
    ctx.strokeStyle = col || OUT;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
    ctx.restore();
  };
  A.shadow = function (ctx, w, alpha = 0.28) {
    if (G.reflecting) return;
    ctx.save();
    ctx.fillStyle = `rgba(10,0,20,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  A.begin = function (ctx) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = A.LW;
  };

  // ---------------------------------------------------------------- rig
  // Ángulos absolutos: 0 = hacia abajo, positivo = hacia delante (+x). Codos/rodillas relativos.
  const seg = (b, a, l) => ({ x: b.x + Math.sin(a) * l, y: b.y + Math.cos(a) * l });
  A.solve = function (p, d) {
    const J = {};
    const hip = J.hip = { x: p.hx || 0, y: -d.leg + (p.hy || 0) };
    const ta = J.ta = p.torso || 0;
    J.neck = { x: hip.x + Math.sin(ta) * d.torso, y: hip.y - Math.cos(ta) * d.torso };
    const sd = d.torso - d.sDrop;
    const sh = { x: hip.x + Math.sin(ta) * sd, y: hip.y - Math.cos(ta) * sd };
    J.shF = { x: sh.x + d.sW * Math.cos(ta), y: sh.y + d.sW * Math.sin(ta) };
    J.shB = { x: sh.x - d.sW * Math.cos(ta), y: sh.y - d.sW * Math.sin(ta) };
    J.hipF = { x: hip.x + 2, y: hip.y };
    J.hipB = { x: hip.x - 2, y: hip.y };
    const aF = p.aF ?? 0.1, aB = p.aB ?? -0.1;
    J.elF = seg(J.shF, aF, d.ua); J.faF = aF + (p.eF ?? 0.3); J.haF = seg(J.elF, J.faF, d.fa + (p.stretchF || 0));
    J.elB = seg(J.shB, aB, d.ua); J.faB = aB + (p.eB ?? 0.3); J.haB = seg(J.elB, J.faB, d.fa + (p.stretchB || 0));
    const lF = p.lF ?? 0.05, lB = p.lB ?? -0.08;
    J.knF = seg(J.hipF, lF, d.thigh); J.snF = lF + (p.kF ?? -0.05); J.ftF = seg(J.knF, J.snF, d.shin + (p.stretchL || 0));
    J.knB = seg(J.hipB, lB, d.thigh); J.snB = lB + (p.kB ?? -0.05); J.ftB = seg(J.knB, J.snB, d.shin);
    J.ha = ta + (p.head || 0);
    return J;
  };
  // punto en el marco de la cabeza -> marco de la entidad
  A.headPoint = function (J, lx, ly) {
    const cs = Math.cos(J.ha), sn = Math.sin(J.ha);
    return { x: J.neck.x + lx * cs - ly * sn, y: J.neck.y + lx * sn + ly * cs };
  };

  // ---------------------------------------------------------------- mezcla de poses
  // Interpola todas las claves numéricas; las que faltan tienden a su valor por defecto.
  const POSE_DEF = { aF: 0.1, aB: -0.1, eF: 0.3, eB: 0.3, lF: 0.05, lB: -0.08, kF: -0.05, kB: -0.05 };
  A.blend = function (a, b, k) {
    if (!a) return b;
    const out = {};
    for (const key in b) {
      const vb = b[key], va = a[key];
      if (typeof vb === 'number') out[key] = typeof va === 'number' ? va + (vb - va) * k : vb;
      else out[key] = vb;
    }
    for (const key in a) {
      if (key in out || typeof a[key] !== 'number') continue;
      const d = POSE_DEF[key] ?? 0;
      const v = a[key] + (d - a[key]) * k;
      if (Math.abs(v - d) > 0.01) out[key] = v;
    }
    return out;
  };

  // Tubo curvo (brazo de goma): curva cuadrática con contorno y sombreado.
  A.tube = function (ctx, x1, y1, cx, cy, x2, y2, r, light, dark) {
    ctx.save();
    ctx.lineCap = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); };
    path(); ctx.strokeStyle = A.OUT; ctx.lineWidth = r * 2 + A.LW * 2; ctx.stroke();
    path(); ctx.strokeStyle = c(light); ctx.lineWidth = r * 2; ctx.stroke();
    if (!A.flash) {
      const ang = Math.atan2(y2 - y1, x2 - x1);
      let nx = -Math.sin(ang), ny = Math.cos(ang);
      if (nx * 0.45 + ny * 0.9 < 0) { nx = -nx; ny = -ny; }
      ctx.translate(nx * r * 0.45, ny * r * 0.45);
      path(); ctx.strokeStyle = dark; ctx.lineWidth = r * 0.9; ctx.stroke();
      ctx.translate(-nx * r * 1.0, -ny * r * 1.0);
      path(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = r * 0.35; ctx.stroke();
    }
    ctx.restore();
  };

  // Brillo anime sobre el pelo: banda clara curva.
  A.shine = function (ctx, x, y, w, rot, col = 'rgba(255,255,255,.55)') {
    if (A.flash) return;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-w, 0); ctx.quadraticCurveTo(0, -w * 0.35, w, 0);
    ctx.lineTo(w * 0.7, w * 0.22); ctx.quadraticCurveTo(0, -w * 0.05, -w * 0.7, w * 0.22);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  // ---------------------------------------------------------------- poses genéricas
  const P = A.pose = {};
  P.idle = (t) => {
    const b = Math.sin(t * 3.2), b2 = Math.sin(t * 1.6);
    return {
      hy: b * 0.9 + 0.5, torso: 0.04 + b2 * 0.015, head: -0.02 + Math.sin(t * 3.2 - 0.6) * 0.03,
      aF: 0.22 + b * 0.04, eF: 0.45 + b * 0.05, aB: -0.12 - b * 0.03, eB: 0.4 + b * 0.04,
      lF: 0.14, kF: -0.1 - b * 0.02, lB: -0.14, kB: -0.04 - b * 0.02,
    };
  };
  P.run = (t, k = 1) => {
    const ph = t * 13 * k, s = Math.sin(ph), c = Math.cos(ph);
    // la rodilla se dobla al adelantar la pierna y un poco al impulsar
    const leg = (sv, cv) => ({ th: sv * 0.95 + 0.1, kn: -0.2 - Math.max(0, cv) * 1.45 - Math.max(0, -sv) * 0.3 });
    const F = leg(s, c), B = leg(-s, -c);
    return {
      hy: Math.abs(c) * 4 - 1, torso: 0.26 + Math.sin(ph * 2) * 0.03, head: -0.18 - Math.sin(ph * 2) * 0.04,
      aF: -s * 1.05, eF: 1.3 + s * 0.35, aB: s * 1.05, eB: 1.3 - s * 0.35,
      lF: F.th, kF: F.kn, lB: B.th, kB: B.kn,
    };
  };
  const JUMP_UP = { torso: 0.1, head: -0.12, aF: 2.5, eF: 0.4, aB: -0.7, eB: 0.8, lF: 1.25, kF: -1.75, lB: 0.2, kB: -0.7, hy: -4 };
  const JUMP_TOP = { torso: 0.22, head: 0.02, aF: 1.9, eF: 0.9, aB: -0.4, eB: 1.0, lF: 1.15, kF: -1.9, lB: 0.7, kB: -1.7, hy: -8 };
  const JUMP_DOWN = { torso: 0.12, head: 0.08, aF: 1.4, eF: 0.5, aB: -1.4, eB: 0.5, lF: 0.55, kF: -0.5, lB: -0.15, kB: -0.25, hy: -2 };
  P.jump = (vy) => {
    if (vy < -150) return A.blend(JUMP_UP, JUMP_TOP, U.clamp((vy + 700) / 550, 0, 1));
    return A.blend(JUMP_TOP, JUMP_DOWN, U.clamp((vy + 150) / 600, 0, 1));
  };
  P.land = () => ({ hy: 14, torso: 0.32, head: -0.15, aF: 0.6, eF: 0.9, aB: -0.5, eB: 0.7, lF: 0.95, kF: -1.7, lB: 0.25, kB: -1.25 });
  P.skid = () => ({ hy: 7, torso: -0.38, head: 0.18, aF: -0.9, eF: 0.7, aB: 0.6, eB: 0.9, lF: 0.75, kF: -0.05, lB: -0.35, kB: -1.1 });
  P.crouch = () => ({
    hy: 20, torso: 0.38, head: -0.3, aF: 0.6, eF: 1.0, aB: 0.2, eB: 1.1,
    lF: 1.25, kF: -2.35, lB: 0.55, kB: -2.0,
  });
  P.hurt = (t) => ({
    hy: -2, torso: -0.45, head: -0.35, aF: -2.2, eF: -0.6, aB: -2.6, eB: -0.4,
    lF: 0.5, kF: -0.9, lB: -0.3, kB: -0.6, face: 'hurt',
  });
  P.dead = () => ({
    hy: 0, torso: -1.45, head: -0.2, aF: -2.6, eF: 0.1, aB: -2.9, eB: 0.2,
    lF: 1.3, kF: -0.2, lB: 1.1, kB: -0.2, face: 'ko',
  });

  // ---------------------------------------------------------------- LUFFY
  const LD = A.LUFFY_DIMS = { thigh: 23, shin: 22, leg: 49, torso: 33, sDrop: 5, sW: 2.5, ua: 16, fa: 15 };
  const LF = { skin: '#fcd2a8', skinS: '#e3a172', shorts: '#3d74cc', shortsS: '#27529f', cuff: '#7fa7e8', cuffS: '#5584cf' };
  const LBk = { skin: '#e9b98d', skinS: '#c98a5c', shorts: '#30609f', shortsS: '#1f427f', cuff: '#6a92d0', cuffS: '#4a72b5' };
  const VEST = '#dc3129', VESTS = '#a51d1f', HAIR = '#17131d', STRAW = '#f6d25c', STRAWS = '#d39d2e', BAND = '#cc2a2a';

  function luffyLeg(ctx, hip, kn, ft, sa, P) {
    // espinilla + pie con sandalia
    A.limb(ctx, kn.x, kn.y, ft.x, ft.y, 4.7, 3.9, P.skin, P.skinS);
    const fx = Math.cos(sa), fy = -Math.sin(sa);
    const toe = { x: ft.x + fx * 9, y: ft.y + fy * 9 };
    A.limb(ctx, ft.x - fx * 1.5, ft.y - fy * 1.5, toe.x, toe.y, 3.9, 3.1, P.skin, P.skinS);
    ctx.save();
    ctx.lineWidth = 2.6; ctx.strokeStyle = c('#6b3c1f');
    ctx.beginPath();
    ctx.moveTo(ft.x - fx * 3 - fy * 3.6, ft.y - fy * 3 + fx * 3.6);
    ctx.lineTo(toe.x + fx * 2.5 - fy * 3.2, toe.y + fy * 2.5 + fx * 3.2);
    ctx.stroke();
    ctx.restore();
    // pantalón corto con dobladillo
    A.limb(ctx, hip.x, hip.y, kn.x, kn.y, 8.2, 7.2, P.shorts, P.shortsS);
    const ux = (kn.x - hip.x) / 23, uy = (kn.y - hip.y) / 23;
    A.limb(ctx, kn.x - ux * 3.5, kn.y - uy * 3.5, kn.x + ux * 0.5, kn.y + uy * 0.5, 7.9, 7.9, P.cuff, P.cuffS);
    if (!A.flash) {
      ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(20,30,80,.55)';
      const px = -uy, py = ux;
      ctx.beginPath();
      ctx.moveTo(hip.x + ux * 9 + px * 2, hip.y + uy * 9 + py * 2); ctx.lineTo(hip.x + ux * 14 - px * 3, hip.y + uy * 14 - py * 3);
      ctx.moveTo(hip.x + ux * 13 + px * 4, hip.y + uy * 13 + py * 4); ctx.lineTo(hip.x + ux * 17 + px * 0.5, hip.y + uy * 17 + py * 0.5);
      ctx.stroke(); ctx.restore();
    }
  }
  function fist(ctx, x, y, r, ang, P) {
    A.circle(ctx, x, y, r, P.skin, P.skinS);
    ctx.save();
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const cx = Math.cos(ang), sy = Math.sin(ang);
    for (let i = -1; i <= 1; i++) {
      const ox = x + Math.cos(ang + Math.PI / 2) * i * r * 0.45, oy = y + Math.sin(ang + Math.PI / 2) * i * r * 0.45;
      ctx.moveTo(ox + cx * r * 0.2, oy + sy * r * 0.2);
      ctx.lineTo(ox + cx * r * 0.75, oy + sy * r * 0.75);
    }
    ctx.stroke();
    ctx.restore();
  }
  function luffyArm(ctx, sh, el, ha, P, stretch, punch, sag) {
    A.limb(ctx, sh.x, sh.y, el.x, el.y, 4.7, 4.1, P.skin, P.skinS);
    const ang = Math.atan2(ha.y - el.y, ha.x - el.x);
    if (stretch > 10) {
      // brazo de goma: tubo curvo que se comba y vibra al recogerse
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      const mx = (el.x + ha.x) / 2 + nx * (sag || 0), my = (el.y + ha.y) / 2 + ny * (sag || 0);
      const r = U.clamp(3.9 - stretch / 80, 2.7, 3.9);
      A.tube(ctx, el.x, el.y, mx, my, ha.x, ha.y, r, P.skin, P.skinS);
      // pliegues de goma cerca del codo y del puño
      if (!A.flash) {
        ctx.save(); ctx.lineWidth = 0.9; ctx.globalAlpha = 0.55;
        for (const tt of [0.12, 0.2, 0.82, 0.9]) {
          const bx = (1 - tt) * (1 - tt) * el.x + 2 * (1 - tt) * tt * mx + tt * tt * ha.x;
          const by = (1 - tt) * (1 - tt) * el.y + 2 * (1 - tt) * tt * my + tt * tt * ha.y;
          ctx.beginPath(); ctx.moveTo(bx + nx * r, by + ny * r); ctx.lineTo(bx - nx * r, by - ny * r); ctx.stroke();
        }
        ctx.restore();
      }
    } else {
      A.limb(ctx, el.x, el.y, ha.x, ha.y, 4.0, 3.6, P.skin, P.skinS);
    }
    fist(ctx, ha.x, ha.y, punch ? 6.6 : 5, ang, P);
  }
  function luffyTorso(ctx, J) {
    ctx.save();
    ctx.translate(J.hip.x, J.hip.y);
    ctx.rotate(J.ta);
    // piel del torso
    ctx.beginPath();
    ctx.moveTo(-8.5, -2);
    ctx.lineTo(-9.5, -21);
    ctx.quadraticCurveTo(-10, -32, -3.5, -33.5);
    ctx.lineTo(5, -33.5);
    ctx.quadraticCurveTo(11, -32, 10.5, -21);
    ctx.lineTo(9.5, -2);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 0, -18, 17, LF.skin, LF.skinS));
    // pecho / abdomen
    ctx.save(); ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(5.5, -23); ctx.quadraticCurveTo(8, -20.5, 10, -22.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7.5, -15); ctx.lineTo(8.2, -9); ctx.stroke();
    ctx.restore();
    // chaleco rojo abierto
    ctx.beginPath();
    ctx.moveTo(-9.6, 0);
    ctx.lineTo(-10.5, -21);
    ctx.quadraticCurveTo(-11, -33, -3.5, -34.5);
    ctx.lineTo(2.5, -34);
    ctx.lineTo(3.8, -25);
    ctx.lineTo(5, -12);
    ctx.lineTo(5.8, 0);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -4, -20, 17, VEST, VESTS));
    // solapa lejana
    ctx.beginPath();
    ctx.moveTo(9.4, -31); ctx.quadraticCurveTo(11.2, -26, 11, -18); ctx.lineTo(10.6, 0); ctx.lineTo(9.2, 0); ctx.lineTo(9.6, -18); ctx.closePath();
    A.fillStroke(ctx, VESTS);
    // sisa
    ctx.save(); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-6, -31); ctx.quadraticCurveTo(-1, -25, 1.5, -31); ctx.stroke();
    ctx.restore();
    // botones
    A.circle(ctx, 4.2, -21, 1.5, '#ffd84a', null);
    A.circle(ctx, 5.0, -12, 1.5, '#ffd84a', null);
    // cintura del pantalón
    ctx.beginPath();
    ctx.moveTo(-10.5, -5);
    ctx.quadraticCurveTo(0, -6.5, 10.5, -5);
    ctx.lineTo(11.5, 7);
    ctx.quadraticCurveTo(0, 11, -11.5, 7);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -2, 0, 12, LF.shorts, LF.shortsS));
    ctx.restore();
  }
  function luffyFace(ctx, face, t) {
    // ojos
    if (face === 'hurt' || face === 'ko') {
      ctx.save(); ctx.lineWidth = 1.8;
      if (face === 'ko') {
        A.line(ctx, [7.5, -17, 11.5, -13], 1.6); A.line(ctx, [11.5, -17, 7.5, -13], 1.6);
        A.line(ctx, [1.5, -17, 4.5, -13.5], 1.4); A.line(ctx, [4.5, -17, 1.5, -13.5], 1.4);
      } else {
        A.line(ctx, [7.5, -17.5, 11.5, -15, 7.5, -12.8], 1.7);
        A.line(ctx, [4.5, -17.5, 1.5, -15, 4.5, -12.8], 1.5);
      }
      ctx.restore();
    } else {
      const blink = (t % 3.7) < 0.12;
      if (blink) {
        A.line(ctx, [7.6, -15, 11.6, -15], 1.6); A.line(ctx, [1.6, -15.2, 4.4, -15.2], 1.4);
      } else {
        ctx.fillStyle = c(OUT);
        ctx.beginPath(); ctx.ellipse(9.6, -15.2, 2.3, 3.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3, -15.4, 1.9, 3.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(10.3, -16.6, 0.95, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3.6, -16.7, 0.75, 0, Math.PI * 2); ctx.fill();
      }
    }
    // cejas
    if (face === 'angry' || face === 'shout') {
      A.line(ctx, [7, -21.5, 12.4, -19.4], 1.9); A.line(ctx, [0.6, -20, 4.6, -21], 1.6);
    } else {
      A.line(ctx, [7.4, -20.6, 12, -20.8], 1.6); A.line(ctx, [0.8, -20.5, 4.6, -20.8], 1.4);
    }
    // cicatriz bajo el ojo
    ctx.save(); ctx.lineWidth = 0.7; ctx.strokeStyle = c('#7a3b2a');
    ctx.beginPath(); ctx.moveTo(1.4, -10.2); ctx.quadraticCurveTo(3, -9.7, 4.8, -10.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2.5, -10.9); ctx.lineTo(2.4, -9.4); ctx.moveTo(3.7, -10.9); ctx.lineTo(3.7, -9.4); ctx.stroke();
    ctx.restore();
    // nariz
    A.line(ctx, [13.9, -12.6, 14.6, -11.2], 1.1);
    // boca
    ctx.save(); ctx.lineWidth = 1.3;
    if (face === 'shout') {
      ctx.beginPath(); ctx.ellipse(9.5, -5.6, 3.6, 3.2, 0, 0, Math.PI * 2);
      A.fillStroke(ctx, '#6b1520');
      ctx.beginPath(); ctx.ellipse(9.8, -3.8, 2, 1.1, 0, 0, Math.PI * 2); ctx.fillStyle = c('#e86a6a'); ctx.fill();
    } else if (face === 'angry') {
      ctx.beginPath(); ctx.moveTo(5.2, -8); ctx.lineTo(12.8, -8.6); ctx.lineTo(12.4, -4.6); ctx.lineTo(5.6, -4.4); ctx.closePath();
      A.fillStroke(ctx, '#fff');
      ctx.beginPath(); ctx.moveTo(5.4, -6.4); ctx.lineTo(12.6, -6.6);
      for (let x = 7; x < 12.5; x += 1.8) { ctx.moveTo(x, -8.2); ctx.lineTo(x, -4.5); }
      ctx.stroke();
    } else if (face === 'hurt' || face === 'ko') {
      A.line(ctx, [5.5, -5.5, 7.5, -7, 9.5, -5.5, 11.5, -7, 13, -5.6], 1.3);
    } else {
      // sonrisa enorme
      ctx.beginPath();
      ctx.moveTo(4.2, -7.8);
      ctx.quadraticCurveTo(9, -7, 13.4, -9);
      ctx.quadraticCurveTo(11.5, -1.6, 5.2, -4.6);
      ctx.closePath();
      A.fillStroke(ctx, '#6b1520');
      ctx.beginPath();
      ctx.moveTo(4.6, -7.6); ctx.quadraticCurveTo(9, -6.8, 13.1, -8.7);
      ctx.lineTo(12.4, -7.2); ctx.quadraticCurveTo(9, -5.6, 5.3, -6.3);
      ctx.closePath();
      ctx.fillStyle = c('#fff'); ctx.fill();
    }
    ctx.restore();
  }
  function luffyHead(ctx, J, p, t) {
    ctx.save();
    ctx.translate(J.neck.x, J.neck.y);
    ctx.rotate(J.ha);
    ctx.scale(A.HEAD_SCALE, A.HEAD_SCALE); ctx.translate(0, 1.5);
    // pelo trasero
    ctx.beginPath();
    ctx.moveTo(-4, -28);
    const sp = [-13, -26, -10.5, -22, -17, -19, -11, -15.5, -16.5, -11, -9.5, -9.5, -12, -4, -5, -6.5, -2, -10];
    for (let i = 0; i < sp.length; i += 2) ctx.lineTo(sp[i], sp[i + 1]);
    ctx.closePath();
    A.fillStroke(ctx, HAIR);
    A.shine(ctx, -9, -21, 4.5, -1.0, 'rgba(150,140,210,.6)');
    // cuello
    A.limb(ctx, 0, 5, 1, -6, 4.3, 4.3, LF.skin, LF.skinS);
    // cara
    ctx.beginPath();
    ctx.moveTo(-9, -15);
    ctx.bezierCurveTo(-10, -30, 14, -33, 15, -17);
    ctx.bezierCurveTo(15.5, -10, 12, -3, 6, -1.6);
    ctx.bezierCurveTo(0, -0.6, -8, -6, -9, -15);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 4, -17, 16, LF.skin, LF.skinS, 0.7));
    // oreja
    A.ellipse(ctx, -6.2, -12.8, 2.4, 3.4, 0.15, LF.skinS);
    A.line(ctx, [-6.3, -14, -5.6, -11.8], 0.8);
    luffyFace(ctx, p.face || 'grin', t);
    // flequillo
    ctx.beginPath();
    ctx.moveTo(-10, -22);
    const bg = [-8, -16.5, -5, -20, -2.5, -15.8, 1, -19.6, 4.2, -16.6, 7, -20, 10.5, -17.6, 12.5, -21, 15, -19, 15.4, -24, -10, -26];
    for (let i = 0; i < bg.length; i += 2) ctx.lineTo(bg[i], bg[i + 1]);
    ctx.closePath();
    A.fillStroke(ctx, HAIR);
    // sombrero de paja
    if (!p.noHat) drawStrawHat(ctx, 2.5, -24.5 - (p.hatLift || 0), -0.07 + (p.hatRot || 0));
    ctx.restore();
  }
  function drawStrawHat(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // ala
    ctx.beginPath();
    ctx.ellipse(0, 0, 23.5, 4.8, 0, 0, Math.PI * 2);
    A.fillStroke(ctx, A.celR(ctx, -4, -1, 22, STRAW, STRAWS, 0.68));
    // copa
    ctx.beginPath();
    ctx.moveTo(-12.5, -1);
    ctx.bezierCurveTo(-13.5, -16, 13.5, -16, 12.5, -1);
    ctx.quadraticCurveTo(0, 1.5, -12.5, -1);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -3, -9, 13, STRAW, STRAWS, 0.66));
    // cinta roja
    ctx.beginPath();
    ctx.moveTo(-12.6, -1.2);
    ctx.lineTo(-12.9, -5.6);
    ctx.quadraticCurveTo(0, -8.4, 12.9, -5.6);
    ctx.lineTo(12.6, -1.2);
    ctx.quadraticCurveTo(0, 1.2, -12.6, -1.2);
    ctx.closePath();
    A.fillStroke(ctx, BAND);
    // textura de paja
    if (!A.flash) {
      ctx.save(); ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(140,90,20,.55)';
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * 5.5, 1.5); ctx.lineTo(i * 6.6, 3.8); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(-8, -10); ctx.quadraticCurveTo(0, -12.5, 8, -10); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  A.drawStrawHat = drawStrawHat;

  A.drawLuffy = function (ctx, p, t) {
    A.begin(ctx);
    const J = A.solve(p, LD);
    luffyArm(ctx, J.shB, J.elB, J.haB, LBk, p.stretchB || 0, (p.stretchB || 0) > 10, p.sagB);
    luffyLeg(ctx, J.hipB, J.knB, J.ftB, J.snB, LBk);
    luffyLeg(ctx, J.hipF, J.knF, J.ftF, J.snF, LF);
    luffyTorso(ctx, J);
    luffyHead(ctx, J, p, t);
    if (p.gatling) {
      // ráfaga de puños (Gomu Gomu no Gatling)
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const k = Math.sin(t * 97 + i * 13.7), k2 = Math.cos(t * 71 + i * 7.3);
        const ang = Math.PI / 2 + k * 0.42;
        const len = 55 + (k2 * 0.5 + 0.5) * 75;
        const hx = J.shF.x + Math.sin(ang) * len, hy = J.shF.y + Math.cos(ang) * len;
        ctx.globalAlpha = 0.35 + 0.35 * (i % 3) / 2;
        A.limb(ctx, J.shF.x, J.shF.y, hx, hy, 3.6, 3.2, LF.skin, LF.skinS);
        fist(ctx, hx, hy, 6, ang, LF);
        if (!A.flash) {
          // estelas detrás de cada puño
          ctx.save(); ctx.globalAlpha *= 0.9; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.6;
          const ux = Math.sin(ang), uy = Math.cos(ang);
          for (const o of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(hx - ux * 9 - uy * o, hy - uy * 9 + ux * o); ctx.lineTo(hx - ux * 26 - uy * o, hy - uy * 26 + ux * o); ctx.stroke(); }
          ctx.restore();
        }
      }
      ctx.restore();
    }
    luffyArm(ctx, J.shF, J.elF, J.haF, LF, p.stretchF || 0, (p.stretchF || 0) > 10, p.sagF);
    return J;
  };

  // ---------------------------------------------------------------- DANIELA (aspecto de Sanji)
  const DD = A.DANI_DIMS = { thigh: 25, shin: 25, leg: 54, torso: 32, sDrop: 5, sW: 2.5, ua: 16, fa: 15 };
  const DF = { suit: '#2a2f42', suitS: '#161926', skin: '#f9d4ae', skinS: '#dda376', shoe: '#0e0e13', cuff: '#6a9ae0' };
  const DBk = { suit: '#1f2333', suitS: '#0f111a', skin: '#e3b78e', skinS: '#c08a60', shoe: '#09090c', cuff: '#4f7cc0' };
  const BLOND = '#fbe27d', BLONDS = '#d9b241', SHIRT = '#5f93dc', SHIRTS = '#3f6cb4';

  function daniLeg(ctx, hip, kn, ft, sa, P) {
    A.limb(ctx, kn.x, kn.y, ft.x, ft.y, 5.3, 4.5, P.suit, P.suitS);
    const fx = Math.cos(sa), fy = -Math.sin(sa);
    const toe = { x: ft.x + fx * 12, y: ft.y + fy * 12 };
    A.limb(ctx, ft.x - fx * 2, ft.y - fy * 2, toe.x, toe.y, 3.9, 2.4, P.shoe, '#000');
    if (!A.flash) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ft.x + fx * 3 + fy * 1.5, ft.y + fy * 3 - fx * 1.5); ctx.lineTo(ft.x + fx * 8 + fy * 1, ft.y + fy * 8 - fx * 1); ctx.stroke(); ctx.restore(); }
    A.limb(ctx, hip.x, hip.y, kn.x, kn.y, 6.4, 5.4, P.suit, P.suitS);
    if (!A.flash) {
      ctx.save(); ctx.lineWidth = 0.9; ctx.strokeStyle = 'rgba(120,130,170,.45)';
      ctx.beginPath(); ctx.moveTo(hip.x + (kn.x - hip.x) * 0.15 + 1.5, hip.y + (kn.y - hip.y) * 0.15);
      ctx.lineTo(kn.x + 1.2, kn.y); ctx.lineTo(kn.x + (ft.x - kn.x) * 0.85 + 1, kn.y + (ft.y - kn.y) * 0.85); ctx.stroke();
      ctx.restore();
    }
  }
  function daniArm(ctx, sh, el, ha, P, pocket) {
    A.limb(ctx, sh.x, sh.y, el.x, el.y, 4.9, 4.3, P.suit, P.suitS);
    A.limb(ctx, el.x, el.y, ha.x, ha.y, 4.3, 4.0, P.suit, P.suitS);
    if (!pocket) {
      const ang = Math.atan2(ha.y - el.y, ha.x - el.x);
      A.limb(ctx, ha.x - Math.cos(ang) * 1, ha.y - Math.sin(ang) * 1, ha.x + Math.cos(ang) * 1.2, ha.y + Math.sin(ang) * 1.2, 3.6, 3.6, P.cuff, null);
      A.circle(ctx, ha.x + Math.cos(ang) * 3.6, ha.y + Math.sin(ang) * 3.6, 3.3, P.skin, P.skinS);
    }
  }
  function daniTorso(ctx, J, p) {
    ctx.save();
    ctx.translate(J.hip.x, J.hip.y);
    ctx.rotate(J.ta);
    const flap = p.flap || 0;
    // faldón trasero de la chaqueta
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.lineTo(-11 - flap * 6, 11 + flap * 1);
    ctx.quadraticCurveTo(-4, 13, 0, 9);
    ctx.lineTo(1, -4);
    ctx.closePath();
    A.fillStroke(ctx, DBk.suit);
    // camisa visible
    ctx.beginPath();
    ctx.moveTo(1, -32.5); ctx.lineTo(10, -32); ctx.lineTo(10, -4); ctx.lineTo(3, -4); ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 6, -20, 12, SHIRT, SHIRTS));
    // corbata
    ctx.beginPath();
    ctx.moveTo(6.2, -31); ctx.lineTo(8.4, -31); ctx.lineTo(8.8, -16); ctx.lineTo(7.2, -13.5); ctx.lineTo(5.8, -16); ctx.closePath();
    A.fillStroke(ctx, '#21173a');
    // chaqueta
    ctx.beginPath();
    ctx.moveTo(-9.6, 2);
    ctx.lineTo(-10.5, -21);
    ctx.quadraticCurveTo(-11, -33, -3, -34);
    ctx.lineTo(3, -33.5);
    ctx.lineTo(5, -18);
    ctx.lineTo(6.5, 3);
    ctx.quadraticCurveTo(-2, 5, -9.6, 2);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -4, -20, 17, DF.suit, DF.suitS));
    // solapa
    ctx.beginPath(); ctx.moveTo(3, -33.5); ctx.lineTo(0.5, -24); ctx.lineTo(4.2, -21); ctx.lineTo(5, -18); ctx.closePath();
    A.fillStroke(ctx, '#3a4058');
    // solapa lejana
    ctx.beginPath(); ctx.moveTo(10, -32); ctx.quadraticCurveTo(11.6, -20, 10.8, -4); ctx.lineTo(9.6, -4); ctx.lineTo(9.2, -26); ctx.closePath();
    A.fillStroke(ctx, DF.suitS);
    // botón
    A.circle(ctx, 4.7, -9, 1.2, '#6c7088', null);
    // bolsillo
    A.line(ctx, [-6, -6, 0, -6.4], 1.1, '#0b0c12');
    ctx.restore();
  }
  function daniHead(ctx, J, p, t) {
    ctx.save();
    ctx.translate(J.neck.x, J.neck.y);
    ctx.rotate(J.ha);
    ctx.scale(A.HEAD_SCALE, A.HEAD_SCALE); ctx.translate(0, 1.5);
    const face = p.face || 'cool';
    // pelo trasero
    ctx.beginPath();
    ctx.moveTo(-3, -30);
    ctx.bezierCurveTo(-14, -28, -14, -12, -11, -3);
    ctx.lineTo(-7, -6); ctx.lineTo(-6, -1.5); ctx.lineTo(-2, -7);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -8, -18, 12, BLOND, BLONDS));
    // cuello + cuello de camisa
    A.limb(ctx, 0.5, 5, 1, -6, 4, 4, DF.skin, DF.skinS);
    ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(1, -1); ctx.lineTo(6, 4); ctx.lineTo(1, 7); ctx.closePath();
    A.fillStroke(ctx, SHIRT);
    // cara
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.bezierCurveTo(-9, -30, 13, -32, 13.5, -17);
    ctx.bezierCurveTo(14, -10, 11.5, -3, 6, -1.2);
    ctx.bezierCurveTo(0, -0.5, -7, -6, -8, -15);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 4, -17, 15, DF.skin, DF.skinS, 0.7));
    // oreja
    A.ellipse(ctx, -5.6, -12.8, 2.3, 3.3, 0.15, DF.skinS);
    // ojo visible + ceja rizada
    if (face === 'hurt' || face === 'ko') {
      A.line(ctx, [7.5, -16.5, 11.5, -14.5, 7.8, -12.5], 1.6);
    } else if (face === 'heart') {
      drawHeart(ctx, 10, -15, 3.4);
    } else {
      const blink = (t % 4.1) < 0.12;
      if (blink) A.line(ctx, [7.4, -15, 11.8, -15.3], 1.6);
      else {
        ctx.fillStyle = c('#fff');
        ctx.beginPath(); ctx.ellipse(9.8, -14.8, 2.6, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c(OUT);
        ctx.beginPath(); ctx.ellipse(10.6, -14.6, 1.3, 1.9, 0, 0, Math.PI * 2); ctx.fill();
        A.line(ctx, [7, -16.8, 12.6, -17.3], face === 'angry' ? 2.2 : 1.9);
      }
    }
    // ceja con espiral
    ctx.save(); ctx.lineWidth = 1.4;
    ctx.beginPath();
    const by = face === 'angry' ? -20.4 : -20.8;
    ctx.moveTo(12.6, by + (face === 'angry' ? 1.4 : 0)); ctx.lineTo(8.6, by - 0.3);
    ctx.arc(7.6, by + 0.6, 1.4, -0.6, Math.PI * 1.5, true);
    ctx.stroke();
    ctx.restore();
    // nariz y boca
    A.line(ctx, [13.3, -12.6, 13.9, -11], 1.1);
    if (face === 'shout') {
      ctx.beginPath(); ctx.ellipse(9.5, -5.6, 3.2, 2.8, 0, 0, Math.PI * 2); A.fillStroke(ctx, '#6b1520');
    } else if (face === 'hurt' || face === 'ko') {
      A.line(ctx, [6.5, -5.5, 8.5, -6.8, 10.5, -5.4, 12.2, -6.4], 1.2);
    } else {
      A.line(ctx, [7.5, -6.2, 11, -6.4, 12.2, -7.6], 1.3);
    }
    // perilla
    ctx.beginPath(); ctx.moveTo(4.5, -2); ctx.lineTo(7.5, -2.6); ctx.lineTo(6, 1.2); ctx.closePath();
    A.fillStroke(ctx, BLOND);
    // cigarro
    if (!p.noCig) {
      A.limb(ctx, 11.6, -6.3, 18.6, -5.2, 1.15, 1.1, '#f4f1ea', null);
      ctx.fillStyle = c('#ff7a2a');
      ctx.beginPath(); ctx.arc(18.9, -5.15, 1.25, 0, Math.PI * 2); ctx.fill();
    }
    // flequillo que tapa un ojo (se balancea con el movimiento)
    ctx.save();
    ctx.translate(-2, -30); ctx.rotate((p.hairSway || 0) * 0.09); ctx.translate(2, 30);
    ctx.beginPath();
    ctx.moveTo(-9, -21);
    ctx.bezierCurveTo(-10, -35, 10, -37, 14.5, -23);
    ctx.lineTo(12.4, -21.6);
    ctx.quadraticCurveTo(8.5, -24.6, 6, -21);
    ctx.quadraticCurveTo(6.4, -12, 4, -6.5);
    ctx.lineTo(1.2, -9.5);
    ctx.quadraticCurveTo(-1, -12, -3.5, -13);
    ctx.lineTo(-6, -11);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -1, -26, 15, BLOND, BLONDS, 0.6));
    if (!A.flash) {
      ctx.save(); ctx.lineWidth = 0.9; ctx.strokeStyle = '#b48e2c';
      ctx.beginPath(); ctx.moveTo(-3, -30); ctx.quadraticCurveTo(4, -28, 7, -22); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -24); ctx.quadraticCurveTo(4.4, -18, 3, -11); ctx.stroke();
      ctx.restore();
    }
    A.shine(ctx, 2, -30.5, 7, 0.22, 'rgba(255,255,235,.85)');
    ctx.restore();
    ctx.restore();
  }
  function drawHeart(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.9);
    ctx.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.8, -s * 1.4, 0, -s * 0.5);
    ctx.bezierCurveTo(s * 0.8, -s * 1.4, s * 1.6, -s * 0.2, 0, s * 0.9);
    A.fillStroke(ctx, '#ff3d6e');
    ctx.restore();
  }
  A.drawHeart = drawHeart;

  A.drawDaniela = function (ctx, p, t) {
    A.begin(ctx);
    const J = A.solve(p, DD);
    daniArm(ctx, J.shB, J.elB, J.haB, DBk, p.pocketB);
    daniLeg(ctx, J.hipB, J.knB, J.ftB, J.snB, DBk);
    if (!p.frontLegLast) daniLeg(ctx, J.hipF, J.knF, J.ftF, J.snF, DF);
    daniTorso(ctx, J, p);
    if (p.frontLegLast) daniLeg(ctx, J.hipF, J.knF, J.ftF, J.snF, DF);
    daniHead(ctx, J, p, t);
    daniArm(ctx, J.shF, J.elF, J.haF, DF, p.pocketF);
    if (p.fire && !A.flash) {
      // pierna en llamas al patear fuerte (efecto visual)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const k = i / 5;
        const x = J.knF.x + (J.ftF.x - J.knF.x) * k, y = J.knF.y + (J.ftF.y - J.knF.y) * k;
        const r = 7 + Math.sin(t * 40 + i) * 2;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,240,150,.8)'); g.addColorStop(0.5, 'rgba(255,120,30,.5)'); g.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    return J;
  };
  // ---------------------------------------------------------------- NAMI
  const ND = A.NAMI_DIMS = { thigh: 23, shin: 22, leg: 49, torso: 30, sDrop: 5, sW: 2.2, ua: 15, fa: 14 };
  const NF = { skin: '#fcd6b0', skinS: '#e2a37a' }, NBk = { skin: '#e8bc94', skinS: '#c48a62' };
  const NHAIR = '#ff8a2a', NHAIRS = '#d8601a', SKIRT = '#ff9a3a', SKIRTS = '#d86a1a';
  function namiLeg(ctx, hip, kn, ft, sa, P) {
    A.limb(ctx, kn.x, kn.y, ft.x, ft.y, 4.2, 3.4, P.skin, P.skinS);
    const fx = Math.cos(sa), fy = -Math.sin(sa);
    A.limb(ctx, ft.x - fx * 1.5, ft.y - fy * 1.5, ft.x + fx * 9, ft.y + fy * 9, 3.3, 2.5, '#7a4a2a', '#4a2a14');
    A.limb(ctx, hip.x, hip.y, kn.x, kn.y, 5.6, 4.6, P.skin, P.skinS);
  }
  function namiArm(ctx, sh, el, ha, P, tattoo) {
    A.limb(ctx, sh.x, sh.y, el.x, el.y, 3.8, 3.3, P.skin, P.skinS);
    if (tattoo && !A.flash) {
      // tatuaje de los Piratas de Arlong en el hombro
      const mx = sh.x + (el.x - sh.x) * 0.4, my = sh.y + (el.y - sh.y) * 0.4;
      ctx.save(); ctx.fillStyle = '#2a4a9a'; ctx.beginPath(); ctx.arc(mx, my, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a4a9a'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 2.6, my + Math.sin(a) * 2.6); ctx.lineTo(mx + Math.cos(a) * 3.8, my + Math.sin(a) * 3.8); ctx.stroke(); }
      ctx.restore();
    }
    A.limb(ctx, el.x, el.y, ha.x, ha.y, 3.3, 2.9, P.skin, P.skinS);
    A.circle(ctx, ha.x, ha.y, 3.2, P.skin, P.skinS);
  }
  function namiTorso(ctx, J) {
    ctx.save();
    ctx.translate(J.hip.x, J.hip.y); ctx.rotate(J.ta);
    // minifalda naranja
    ctx.beginPath();
    ctx.moveTo(-9, -4); ctx.lineTo(9, -4); ctx.lineTo(12, 12); ctx.quadraticCurveTo(0, 15, -12, 12); ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -2, 2, 12, SKIRT, SKIRTS));
    // camiseta de rayas azules y blancas, entallada
    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.quadraticCurveTo(-6.5, -14, -9, -22);
    ctx.quadraticCurveTo(-10, -31, -3, -31.5);
    ctx.lineTo(4, -31.5);
    ctx.quadraticCurveTo(11, -30, 10.5, -22);
    ctx.quadraticCurveTo(7, -14, 8, -2);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -1, -18, 16, '#f6f4ee', '#c6ccdc'));
    if (!A.flash) {
      ctx.save(); ctx.clip();
      ctx.fillStyle = '#3a6ad8';
      for (let y = -29; y < 0; y += 5.5) ctx.fillRect(-12, y, 26, 2.4);
      ctx.restore();
      ctx.stroke();
    }
    ctx.restore();
  }
  function namiHead(ctx, J, p, t) {
    ctx.save();
    ctx.translate(J.neck.x, J.neck.y); ctx.rotate(J.ha);
    ctx.scale(A.HEAD_SCALE, A.HEAD_SCALE); ctx.translate(0, 1.5);
    const face = p.face || 'smile';
    // pelo trasero corto
    ctx.beginPath();
    ctx.moveTo(-4, -30); ctx.bezierCurveTo(-15, -28, -14, -12, -11, -4); ctx.lineTo(-6, -6); ctx.lineTo(-4, -2); ctx.lineTo(-1, -8); ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -8, -18, 12, NHAIR, NHAIRS));
    A.limb(ctx, 0.5, 5, 1, -6, 3.4, 3.4, NF.skin, NF.skinS);
    // cara
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.bezierCurveTo(-9, -30, 13, -32, 13.5, -17);
    ctx.bezierCurveTo(14, -10, 11, -3, 5.5, -1.2);
    ctx.bezierCurveTo(0, -0.5, -7, -6, -8, -15);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 4, -17, 15, NF.skin, NF.skinS, 0.7));
    // ojos grandes con pestañas
    if (face === 'cry' || face === 'smile' || face === 'happy') {
      if (face === 'happy') {
        A.line(ctx, [7.3, -15, 9.6, -17, 11.9, -15], 1.6); A.line(ctx, [1.2, -15, 3, -16.6, 4.8, -15], 1.4);
      } else {
        ctx.fillStyle = c('#fff'); ctx.beginPath(); ctx.ellipse(9.6, -15, 2.6, 3.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3, -15.2, 2.1, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c('#6a3a1a'); ctx.beginPath(); ctx.ellipse(10.1, -14.6, 1.7, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(3.4, -14.8, 1.4, 2.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c('#fff'); ctx.beginPath(); ctx.arc(10.6, -15.6, 0.8, 0, Math.PI * 2); ctx.fill();
        A.line(ctx, [6.8, -18.4, 9.6, -19.2, 12.6, -18], 1.8);
        A.line(ctx, [1, -18.2, 3, -18.8, 5, -18.2], 1.5);
      }
      if (face === 'cry' && !A.flash) {
        // lágrimas a chorro
        ctx.save(); ctx.fillStyle = 'rgba(160,220,255,.9)'; ctx.strokeStyle = 'rgba(40,100,180,.8)'; ctx.lineWidth = 0.8;
        const k = (t * 3) % 1;
        ctx.beginPath(); ctx.moveTo(8.5, -12); ctx.quadraticCurveTo(7, -4, 8 + k, 2 + k * 3); ctx.lineTo(10.5 + k, 2 + k * 3); ctx.quadraticCurveTo(9.5, -4, 11, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    // cejas
    if (face === 'cry') { A.line(ctx, [7.2, -19.6, 12.4, -20.6], 1.3); A.line(ctx, [1.2, -20, 4.6, -19.4], 1.1); }
    A.line(ctx, [13.2, -12.4, 13.8, -11.2], 1);
    // boca
    if (face === 'cry') { ctx.beginPath(); ctx.ellipse(9, -5.6, 2.6, 2, 0, 0, Math.PI * 2); A.fillStroke(ctx, '#7a2030'); }
    else { ctx.beginPath(); ctx.moveTo(6, -6.4); ctx.quadraticCurveTo(9.5, -3.4, 12.4, -6.8); A.fillStroke(ctx, '#ffffff'); }
    // flequillo naranja
    ctx.beginPath();
    ctx.moveTo(-9, -20);
    ctx.bezierCurveTo(-10, -35, 12, -37, 15, -22);
    ctx.lineTo(13.5, -20.5); ctx.lineTo(11.5, -23.5); ctx.lineTo(9, -20.6); ctx.lineTo(6.5, -24); ctx.lineTo(4, -20.4); ctx.lineTo(1.5, -23.6); ctx.lineTo(-1.5, -19.6); ctx.lineTo(-5, -21);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 0, -27, 15, NHAIR, NHAIRS, 0.62));
    A.shine(ctx, 1, -30, 6.5, 0.2, 'rgba(255,240,200,.75)');
    ctx.restore();
  }
  A.drawNami = function (ctx, p, t) {
    A.begin(ctx);
    const J = A.solve(p, ND);
    namiArm(ctx, J.shB, J.elB, J.haB, NBk, false);
    namiLeg(ctx, J.hipB, J.knB, J.ftB, J.snB, NBk);
    namiLeg(ctx, J.hipF, J.knF, J.ftF, J.snF, NF);
    namiTorso(ctx, J);
    namiHead(ctx, J, p, t);
    namiArm(ctx, J.shF, J.elF, J.haF, NF, true);
    return J;
  };
  A.drawNami = A.outlined(A.drawNami);
  A.drawLuffy = A.outlined(A.drawLuffy);
  A.drawDaniela = A.outlined(A.drawDaniela);
})();
