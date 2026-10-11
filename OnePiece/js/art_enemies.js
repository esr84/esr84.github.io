'use strict';
// Arte de enemigos (hombres-pez), Hatchan, Arlong, objetos, proyectiles y decorados.
(function () {
  const A = G.art;
  const OUT = A.OUT, c = A.c;

  // ---------------------------------------------------------------- armas
  // a = ángulo absoluto con el convenio del rig (0 abajo, + hacia delante)
  function toCanvasRot(a) { return Math.PI / 2 - a; }
  A.cutlass = function (ctx, x, y, a, len = 36) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(toCanvasRot(a));
    A.limb(ctx, -6, 0, 2, 0, 2.2, 2.2, '#7a4a2a', '#53301a');
    A.ellipse(ctx, 3, 0, 1.8, 5, 0, '#e8b84a');
    ctx.beginPath();
    ctx.moveTo(4, -2.6);
    ctx.quadraticCurveTo(len * 0.6, -5.5, len, -1);
    ctx.lineTo(len - 2, 2.4);
    ctx.quadraticCurveTo(len * 0.55, 1.8, 4, 2.6);
    ctx.closePath();
    A.fillStroke(ctx, A.cel(ctx, len / 2, 0, 0, 4, '#eef3f8', '#a3b2c2'));
    ctx.restore();
  };
  A.harpoon = function (ctx, x, y, a, len = 62) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(toCanvasRot(a));
    A.limb(ctx, -len * 0.35, 0, len * 0.65, 0, 2, 2, '#9b6a3c', '#6d4522');
    ctx.beginPath();
    const t = len * 0.65;
    ctx.moveTo(t - 2, -2); ctx.lineTo(t + 4, -6); ctx.lineTo(t + 2, -1.5); ctx.lineTo(t + 14, 0);
    ctx.lineTo(t + 2, 1.5); ctx.lineTo(t + 4, 6); ctx.lineTo(t - 2, 2); ctx.closePath();
    A.fillStroke(ctx, A.cel(ctx, t + 5, 0, 0, 5, '#dfe7ef', '#8796a6'));
    ctx.restore();
  };
  A.kiribachi = function (ctx, x, y, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(toCanvasRot(a));
    A.limb(ctx, -18, 0, 0, 0, 3.2, 3.2, '#5a3a22', '#3a2412');
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#c9a060';
    for (let i = -16; i < 0; i += 3) { ctx.beginPath(); ctx.moveTo(i, -3); ctx.lineTo(i + 2, 3); ctx.stroke(); }
    ctx.restore();
    A.ellipse(ctx, 1, 0, 3, 9, 0, '#c8a23c');
    ctx.beginPath();
    ctx.moveTo(3, -7);
    ctx.lineTo(96, -9);
    ctx.quadraticCurveTo(108, -6, 104, 4);
    // dientes de sierra en el filo
    for (let i = 100; i > 6; i -= 8) { ctx.lineTo(i, 10); ctx.lineTo(i - 4, 17); }
    ctx.lineTo(3, 9);
    ctx.closePath();
    A.fillStroke(ctx, A.cel(ctx, 50, 0, 0, 14, '#dfe6ee', '#8b98a8'));
    ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = c('#6d7a8a');
    ctx.beginPath(); ctx.moveTo(8, -1); ctx.lineTo(92, -2); ctx.stroke();
    ctx.restore();
    ctx.restore();
  };

  // ---------------------------------------------------------------- hombre-pez soldado
  const FD = A.FISH_DIMS = { thigh: 22, shin: 21, leg: 47, torso: 33, sDrop: 5, sW: 2.5, ua: 17, fa: 16 };
  const FISH_PAL = [
    { skin: '#6cc39a', skinS: '#3f9472', fin: '#2f8a8a', finS: '#1e6464' },
    { skin: '#c48ad8', skinS: '#9358ad', fin: '#7d3fa0', finS: '#5a2878' },
    { skin: '#f2a35f', skinS: '#c8743a', fin: '#d4542a', finS: '#a5381a' },
    { skin: '#7fb0e8', skinS: '#4f80bf', fin: '#3a5fb0', finS: '#27428a' },
  ];
  A.FISH_PAL = FISH_PAL;
  function darker(P) { return { skin: P.skinS, skinS: shade(P.skinS, -0.18), fin: P.finS, finS: shade(P.finS, -0.2) }; }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)));
    r = f(r); g = f(g); b = f(b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  A.shadeHex = shade;
  const PANTS = '#3c3f72', PANTSS = '#262856';

  function fishLeg(ctx, hip, kn, ft, sa, P, back) {
    A.limb(ctx, kn.x, kn.y, ft.x, ft.y, 5.6, 4.6, back ? PANTSS : PANTS, back ? '#1a1c40' : PANTSS);
    const fx = Math.cos(sa), fy = -Math.sin(sa);
    A.limb(ctx, ft.x - fx * 2, ft.y - fy * 2, ft.x + fx * 10, ft.y + fy * 10, 3.8, 3.4, P.skin, P.skinS);
    A.limb(ctx, hip.x, hip.y, kn.x, kn.y, 7, 6, back ? PANTSS : PANTS, back ? '#1a1c40' : PANTSS);
  }
  function fishArm(ctx, sh, el, ha, P) {
    A.limb(ctx, sh.x, sh.y, el.x, el.y, 5, 4.4, P.skin, P.skinS);
    A.limb(ctx, el.x, el.y, ha.x, ha.y, 4.4, 4, P.skin, P.skinS);
    A.circle(ctx, ha.x, ha.y, 4.6, P.skin, P.skinS);
  }
  function fishTorso(ctx, J, P, shirt) {
    ctx.save();
    ctx.translate(J.hip.x, J.hip.y);
    ctx.rotate(J.ta);
    ctx.beginPath();
    ctx.moveTo(-10, 2);
    ctx.lineTo(-11, -22);
    ctx.quadraticCurveTo(-11, -34, -2, -34.5);
    ctx.lineTo(4, -34.5);
    ctx.quadraticCurveTo(12, -33, 11.5, -20);
    ctx.quadraticCurveTo(12, -6, 9.5, 2);
    ctx.closePath();
    if (shirt) {
      A.fillStroke(ctx, A.celR(ctx, -2, -18, 18, '#f4f4f0', '#c4cad8'));
      // rayas marineras
      ctx.save();
      ctx.clip();
      ctx.fillStyle = c('#2f5fb0');
      for (let y = -30; y < 2; y += 7) ctx.fillRect(-14, y, 30, 3);
      ctx.restore();
      ctx.stroke();
      // tirantes / hombros de piel
      ctx.beginPath(); ctx.moveTo(-2, -34.5); ctx.quadraticCurveTo(4, -38, 8, -33); ctx.lineTo(4, -31); ctx.closePath();
      A.fillStroke(ctx, P.skin);
    } else {
      A.fillStroke(ctx, A.celR(ctx, -2, -18, 18, P.skin, P.skinS));
      ctx.beginPath(); ctx.moveTo(4, -26); ctx.quadraticCurveTo(10, -16, 6, -2); ctx.lineTo(10, -2); ctx.quadraticCurveTo(12, -16, 10, -26); ctx.closePath();
      A.fillStroke(ctx, A.shadeHex(P.skin, 0.35), false);
      // aleta dorsal
      ctx.beginPath(); ctx.moveTo(-10, -30); ctx.lineTo(-19, -24); ctx.lineTo(-15, -20); ctx.lineTo(-20, -15); ctx.lineTo(-10.5, -12); ctx.closePath();
      A.fillStroke(ctx, P.fin);
    }
    // faja
    ctx.beginPath();
    ctx.moveTo(-11, -4); ctx.quadraticCurveTo(0, -6, 11, -4); ctx.lineTo(11.5, 4); ctx.quadraticCurveTo(0, 6, -11.5, 4); ctx.closePath();
    A.fillStroke(ctx, shirt ? '#c8322c' : '#3a6b4a');
    ctx.restore();
  }
  function fishHead(ctx, J, p, P, t, v = 0) {
    ctx.save();
    ctx.translate(J.neck.x, J.neck.y);
    ctx.rotate(J.ha);
    A.limb(ctx, 0, 5, 1, -6, 5, 5, P.skin, P.skinS);
    // cresta (o aleta de tiburón en la variante 3)
    ctx.beginPath();
    if (v === 3) { ctx.moveTo(-8, -26); ctx.quadraticCurveTo(-8, -40, -16, -48); ctx.quadraticCurveTo(2, -42, 6, -29); }
    else { ctx.moveTo(-9, -24); ctx.lineTo(-13, -38); ctx.lineTo(-6, -33); ctx.lineTo(-4, -43); ctx.lineTo(1, -34); ctx.lineTo(5, -41); ctx.lineTo(7, -29); }
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -3, -34, 10, P.fin, P.finS));
    ctx.save(); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-8, -28); ctx.lineTo(-10, -35); ctx.moveTo(-4, -29); ctx.lineTo(-4, -39); ctx.moveTo(1, -29); ctx.lineTo(4, -37); ctx.stroke();
    ctx.restore();
    // cabeza con morro
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.bezierCurveTo(-11, -32, 13, -34, 15, -20);
    ctx.quadraticCurveTo(20, -15, 19, -10);
    ctx.quadraticCurveTo(17, -5, 13, -5);
    ctx.bezierCurveTo(8, -1, -2, 0, -6, -4);
    ctx.quadraticCurveTo(-10, -8, -10, -14);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 3, -18, 17, P.skin, P.skinS, 0.68));
    // labios
    ctx.beginPath(); ctx.moveTo(13, -11); ctx.quadraticCurveTo(20, -12, 19.5, -9); ctx.quadraticCurveTo(18, -6, 13, -7);
    A.fillStroke(ctx, A.shadeHex(P.fin, 0.2));
    A.line(ctx, [12, -9.2, 19, -9.2], 1.2);
    // branquias
    ctx.save(); ctx.lineWidth = 1.1;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-4 + i * 2.6, -9, 3.5, -1.2, 0.6); ctx.stroke(); }
    ctx.restore();
    // ojos saltones
    const angry = p.face === 'angry';
    if (p.face === 'hurt' || p.face === 'ko') {
      A.line(ctx, [6.5, -21, 10.5, -17.5], 1.6); A.line(ctx, [10.5, -21, 6.5, -17.5], 1.6);
    } else {
      A.circle(ctx, 1.5, -20, 3.4, '#fffbe8', null);
      A.circle(ctx, 8.8, -19.5, 4.6, '#fffbe8', '#d8d2b8');
      ctx.fillStyle = c(OUT);
      ctx.beginPath(); ctx.arc(10.5, -19.3, 1.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(2.6, -19.8, 1.4, 0, Math.PI * 2); ctx.fill();
      if (angry) { A.line(ctx, [5, -26, 13, -22.5], 2); }
    }
    // accesorios según la variante
    if (v === 0) {
      // pañuelo rojo anudado con puntas al viento
      ctx.beginPath(); ctx.moveTo(-10.5, -21); ctx.quadraticCurveTo(-2, -31, 14.5, -23); ctx.lineTo(15, -19.5); ctx.quadraticCurveTo(-2, -27, -10, -16.5); ctx.closePath();
      A.fillStroke(ctx, A.celR(ctx, 0, -26, 14, '#e8392c', '#a81e1e'));
      const wv = Math.sin(t * 9) * 2;
      ctx.beginPath(); ctx.moveTo(-10, -19); ctx.lineTo(-19, -22 + wv); ctx.lineTo(-17, -17 + wv); ctx.lineTo(-20, -13 + wv * 0.5); ctx.lineTo(-10, -16); ctx.closePath();
      A.fillStroke(ctx, '#c82a24');
      if (!A.flash) { ctx.save(); ctx.fillStyle = '#fff'; for (const [dx, dy] of [[-3, -25], [4, -26.5], [10, -24.5]]) { ctx.beginPath(); ctx.arc(dx, dy, 0.9, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    } else if (v === 1 && p.face !== 'hurt' && p.face !== 'ko') {
      // parche en el ojo y cicatriz
      A.line(ctx, [-8, -25, 15, -16], 1.3);
      A.ellipse(ctx, 9, -19.5, 5, 5.2, 0, '#1a1020');
      ctx.save(); ctx.strokeStyle = c('#7a2a3a'); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-1, -26); ctx.lineTo(4, -12); ctx.moveTo(0, -21); ctx.lineTo(3, -22); ctx.moveTo(1, -17); ctx.lineTo(4, -18); ctx.stroke(); ctx.restore();
    } else if (v === 2) {
      // gorra de marinero
      ctx.beginPath(); ctx.ellipse(1, -27, 13, 5.5, -0.12, Math.PI, 0); ctx.lineTo(14, -26); ctx.quadraticCurveTo(1, -22, -12, -26); ctx.closePath();
      A.fillStroke(ctx, A.celR(ctx, -2, -30, 12, '#f6f4ee', '#c6ccdc'));
      ctx.beginPath(); ctx.moveTo(-12.4, -26.4); ctx.quadraticCurveTo(1, -22.2, 14.2, -26.2); ctx.lineTo(14, -24); ctx.quadraticCurveTo(1, -20, -12, -24); ctx.closePath();
      A.fillStroke(ctx, '#2f5fb0');
    } else if (v === 3 && p.face !== 'hurt' && p.face !== 'ko') {
      // sonrisa de tiburón
      ctx.beginPath(); ctx.moveTo(6, -8.5); ctx.quadraticCurveTo(13, -7, 19, -9.5); ctx.quadraticCurveTo(14, -3.5, 7, -6); ctx.closePath();
      A.fillStroke(ctx, '#4a1020');
      if (!A.flash) { ctx.fillStyle = '#fff'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const x = 7.2 + i * 2.3; ctx.moveTo(x, -8.3); ctx.lineTo(x + 1.15, -6.2); ctx.lineTo(x + 2.3, -8.5); } ctx.fill(); }
    }
    ctx.restore();
  }
  // tipo: 'sword' | 'harpoon' | 'bare'
  A.drawFishman = function (ctx, p, t, opts = {}) {
    A.begin(ctx);
    const P = FISH_PAL[opts.v || 0], Pb = darker(P);
    const J = A.solve(p, FD);
    fishArm(ctx, J.shB, J.elB, J.haB, Pb);
    fishLeg(ctx, J.hipB, J.knB, J.ftB, J.snB, Pb, true);
    fishLeg(ctx, J.hipF, J.knF, J.ftF, J.snF, P, false);
    fishTorso(ctx, J, P, opts.kind !== 'bare');
    fishHead(ctx, J, p, P, t, opts.v || 0);
    if (opts.kind === 'harpoon' && !p.noWeapon) A.harpoon(ctx, J.haF.x, J.haF.y, p.wA ?? (J.faF + 1.6));
    fishArm(ctx, J.shF, J.elF, J.haF, P);
    if (opts.kind === 'sword') A.cutlass(ctx, J.haF.x, J.haF.y, p.wA ?? (J.faF + 1.9));
    return J;
  };

  // ---------------------------------------------------------------- pez volador
  A.drawFlyfish = function (ctx, t, flap) {
    A.begin(ctx);
    const w = Math.sin(t * 30) * 0.6;
    // ala trasera
    ctx.beginPath(); ctx.moveTo(2, -2); ctx.quadraticCurveTo(-6, -18 - w * 8, -18, -16 - w * 10); ctx.quadraticCurveTo(-8, -6, -4, 0); ctx.closePath();
    A.fillStroke(ctx, '#7fb6e6');
    // cuerpo
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.quadraticCurveTo(12, -8, -6, -5);
    ctx.lineTo(-16, -1);
    ctx.lineTo(-24, -9); ctx.lineTo(-21, 0); ctx.lineTo(-25, 8); ctx.lineTo(-16, 2);
    ctx.lineTo(-6, 5);
    ctx.quadraticCurveTo(12, 8, 18, 0);
    ctx.closePath();
    A.fillStroke(ctx, A.cel(ctx, 0, 0, 0, 6, '#3f78c8', '#eef4fa'));
    // ala delantera
    ctx.beginPath(); ctx.moveTo(6, 1); ctx.quadraticCurveTo(-2, -16 + w * 10, -16, -12 + w * 12); ctx.quadraticCurveTo(-4, -2, 0, 3); ctx.closePath();
    A.fillStroke(ctx, '#a8d4f6');
    A.circle(ctx, 11, -2, 2.6, '#fff', null);
    ctx.fillStyle = c(OUT); ctx.beginPath(); ctx.arc(11.8, -2, 1.3, 0, Math.PI * 2); ctx.fill();
    A.line(ctx, [16, 1.5, 13, 2.2], 1);
  };

  // ---------------------------------------------------------------- HATCHAN (pulpo, seis espadas)
  const HD = A.HATCH_DIMS = { thigh: 22, shin: 20, leg: 46, torso: 38, sDrop: 6, sW: 3, ua: 18, fa: 16 };
  const HP = { skin: '#f28f8a', skinS: '#cc6170' }, HPb = { skin: '#d97680', skinS: '#ad4c5c' };
  A.drawHatchan = function (ctx, p, t) {
    A.begin(ctx);
    const J = A.solve(p, HD);
    const arms = p.arms || [];
    const shoulder = (k, front) => {
      const d = HD.torso - 6 - k * 8;
      const base = { x: J.hip.x + Math.sin(J.ta) * d, y: J.hip.y - Math.cos(J.ta) * d };
      const off = front ? 3 : -3;
      return { x: base.x + off * Math.cos(J.ta), y: base.y + off * Math.sin(J.ta) };
    };
    const drawArm = (i, front) => {
      const a = arms[i] || { a: 0.3 + i * 0.3, e: 0.5 };
      const sh = shoulder(i % 3, front);
      const el = { x: sh.x + Math.sin(a.a) * HD.ua, y: sh.y + Math.cos(a.a) * HD.ua };
      const fa = a.a + a.e;
      const ha = { x: el.x + Math.sin(fa) * HD.fa, y: el.y + Math.cos(fa) * HD.fa };
      const Pc = front ? HP : HPb;
      A.limb(ctx, sh.x, sh.y, el.x, el.y, 4.6, 4.1, Pc.skin, Pc.skinS);
      A.limb(ctx, el.x, el.y, ha.x, ha.y, 4.1, 3.6, Pc.skin, Pc.skinS);
      if (!A.flash) {
        // ventosas de pulpo en el antebrazo
        ctx.save(); ctx.fillStyle = front ? '#ffd0c8' : '#e8a8a8'; ctx.lineWidth = 0.8;
        const nx = -Math.cos(fa), ny = Math.sin(fa);
        for (let k = 1; k <= 3; k++) {
          const px = el.x + (ha.x - el.x) * k / 4 + nx * 2.4, py = el.y + (ha.y - el.y) * k / 4 + ny * 2.4;
          ctx.beginPath(); ctx.arc(px, py, 1.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
      }
      A.cutlass(ctx, ha.x, ha.y, a.w ?? (fa + 1.8), 34);
      A.circle(ctx, ha.x, ha.y, 4.3, Pc.skin, Pc.skinS);
    };
    for (let i = 0; i < 3; i++) drawArm(i, false);
    // piernas
    const leg = (hip, kn, ft, sa, Pc, back) => {
      A.limb(ctx, kn.x, kn.y, ft.x, ft.y, 5.4, 4.6, Pc.skin, Pc.skinS);
      const fx = Math.cos(sa), fy = -Math.sin(sa);
      A.limb(ctx, ft.x - fx * 2, ft.y - fy * 2, ft.x + fx * 10, ft.y + fy * 10, 4, 3.4, '#5a3a22', '#3a2412');
      A.limb(ctx, hip.x, hip.y, kn.x, kn.y, 8.5, 7.5, back ? '#4a3a7a' : '#6650a6', back ? '#30245a' : '#463482');
    };
    leg(J.hipB, J.knB, J.ftB, J.snB, HPb, true);
    leg(J.hipF, J.knF, J.ftF, J.snF, HP, false);
    // torso (barriga redonda)
    ctx.save();
    ctx.translate(J.hip.x, J.hip.y); ctx.rotate(J.ta);
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.bezierCurveTo(-16, -20, -12, -40, 0, -40);
    ctx.bezierCurveTo(14, -40, 18, -16, 13, 2);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -2, -20, 20, '#f6f2e4', '#cfc6ad'));
    ctx.save(); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(4, -38); ctx.lineTo(6, -2); ctx.stroke();
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(-13, -4); ctx.quadraticCurveTo(0, -7, 14, -4); ctx.lineTo(14, 5); ctx.quadraticCurveTo(0, 7, -13, 5); ctx.closePath();
    A.fillStroke(ctx, '#6650a6');
    ctx.restore();
    // cabeza
    ctx.save();
    ctx.translate(J.neck.x, J.neck.y); ctx.rotate(J.ha);
    // manto de pulpo
    ctx.beginPath(); ctx.ellipse(-3, -30, 15, 12, -0.2, 0, Math.PI * 2);
    A.fillStroke(ctx, A.celR(ctx, -5, -32, 14, HP.skin, HP.skinS));
    A.line(ctx, [-15, -26, -3, -22, 9, -27], 1.4);
    ctx.beginPath(); ctx.ellipse(2, -15, 14, 13, 0, 0, Math.PI * 2);
    A.fillStroke(ctx, A.celR(ctx, 3, -16, 14, HP.skin, HP.skinS, 0.7));
    // pelo: el famoso moño en espiral
    ctx.beginPath(); ctx.arc(-4, -40, 5, 0, Math.PI * 2); A.fillStroke(ctx, '#2a1a2e');
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = '#6a4a6e'; ctx.beginPath(); ctx.arc(-4, -40, 2.4, 0, 5); ctx.stroke(); ctx.restore();
    // boca en tubo
    A.limb(ctx, 10, -9, 20, -10, 4.4, 5, HP.skin, HP.skinS);
    A.ellipse(ctx, 20.5, -10, 2.4, 4.4, 0, '#7a2a3a');
    // ojos
    if (p.face === 'ko') {
      // ojos en espiral y gota de sudor
      ctx.save(); ctx.lineWidth = 1.3;
      for (const [ex, ey] of [[8, -18], [1.5, -18.5]]) { ctx.beginPath(); for (let a = 0; a < 12; a += 0.4) ctx.lineTo(ex + Math.cos(a + t * 6) * a * 0.22, ey + Math.sin(a + t * 6) * a * 0.22); ctx.stroke(); }
      ctx.restore();
      if (!A.flash) { ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.moveTo(14, -28); ctx.quadraticCurveTo(18, -22, 14, -20); ctx.quadraticCurveTo(10, -22, 14, -28); ctx.fill(); ctx.stroke(); }
    } else {
      ctx.fillStyle = c(OUT);
      ctx.beginPath(); ctx.ellipse(8, -18, 1.6, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.5, -18.5, 1.3, 2.1, 0, 0, Math.PI * 2); ctx.fill();
      A.line(ctx, [4.5, -23, 11, -21.5], 1.6);
      if (!A.flash) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8.5, -19, 0.6, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    for (let i = 3; i < 6; i++) drawArm(i, true);
    return J;
  };

  // ---------------------------------------------------------------- ARLONG
  const AD = A.ARLONG_DIMS = { thigh: 30, shin: 29, leg: 64, torso: 48, sDrop: 7, sW: 3.5, ua: 25, fa: 24 };
  const AP = { skin: '#8fb8de', skinS: '#5f88b6', pants: '#3a3256', pantsS: '#231d3a' };
  const APb = { skin: '#7aa3ca', skinS: '#4c739f', pants: '#2c2644', pantsS: '#18132a' };
  const SHIRT = '#f6e9b4', SHIRTS = '#d6c17a';
  function arlongLeg(ctx, hip, kn, ft, sa, P) {
    A.limb(ctx, kn.x, kn.y, ft.x, ft.y, 8, 6.6, P.pants, P.pantsS);
    const fx = Math.cos(sa), fy = -Math.sin(sa);
    A.limb(ctx, ft.x - fx * 3, ft.y - fy * 3, ft.x + fx * 15, ft.y + fy * 15, 5.4, 4.4, P.skin, P.skinS);
    A.limb(ctx, hip.x, hip.y, kn.x, kn.y, 10.5, 9, P.pants, P.pantsS);
  }
  function arlongArm(ctx, sh, el, ha, P, front) {
    A.limb(ctx, sh.x, sh.y, el.x, el.y, 7.6, 6.6, P.skin, P.skinS);
    if (front) {
      // tatuaje del sol de los Piratas de Arlong
      const mx = (sh.x + el.x) / 2, my = (sh.y + el.y) / 2;
      ctx.save(); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(mx, my, 3.4, 0, Math.PI * 2); ctx.fillStyle = c('#2a3b78'); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = c('#2a3b78');
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * 4, my + Math.sin(a) * 4); ctx.lineTo(mx + Math.cos(a) * 6, my + Math.sin(a) * 6); ctx.stroke(); }
      ctx.restore();
    }
    // manga corta
    const ux = (el.x - sh.x) / AD.ua, uy = (el.y - sh.y) / AD.ua;
    A.limb(ctx, sh.x - ux * 2, sh.y - uy * 2, sh.x + ux * 9, sh.y + uy * 9, 8.6, 8.2, front ? SHIRT : SHIRTS, front ? SHIRTS : '#b39c58');
    if (!A.flash) {
      // estampado de flores y dobladillo de la manga
      ctx.save();
      const px = -uy, py = ux;
      for (const [k, o] of [[2.5, -3.5], [6, 3.2]]) {
        const fx = sh.x + ux * k + px * o, fy = sh.y + uy * k + py * o;
        ctx.fillStyle = front ? '#e2493a' : '#b8382c';
        for (let i = 0; i < 5; i++) { const a = i * 1.2566; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 1.6, fy + Math.sin(a) * 1.6, 1.3, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(fx, fy, 0.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,90,40,.8)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(sh.x + ux * 7.5 + px * 7.6, sh.y + uy * 7.5 + py * 7.6); ctx.lineTo(sh.x + ux * 7.5 - px * 7.6, sh.y + uy * 7.5 - py * 7.6); ctx.stroke();
      ctx.restore();
    }
    A.limb(ctx, el.x, el.y, ha.x, ha.y, 6.6, 6, P.skin, P.skinS);
    A.circle(ctx, ha.x, ha.y, 7, P.skin, P.skinS);
  }
  function arlongTorso(ctx, J) {
    ctx.save();
    ctx.translate(J.hip.x, J.hip.y); ctx.rotate(J.ta);
    // pecho musculoso
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.lineTo(-15, -30);
    ctx.quadraticCurveTo(-16, -50, -4, -50);
    ctx.lineTo(8, -50);
    ctx.quadraticCurveTo(20, -48, 17, -30);
    ctx.quadraticCurveTo(16, -12, 13, 0);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 2, -28, 26, AP.skin, AP.skinS));
    ctx.save(); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(2, -38); ctx.quadraticCurveTo(10, -31, 16, -36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -26); ctx.lineTo(13, -26); ctx.moveTo(6, -18); ctx.lineTo(12.5, -18); ctx.moveTo(9.5, -30); ctx.lineTo(9.5, -9); ctx.stroke();
    ctx.restore();
    // camisa abierta (hawaiana con flores)
    ctx.beginPath();
    ctx.moveTo(-14.5, 2);
    ctx.lineTo(-16.5, -30);
    ctx.quadraticCurveTo(-17.5, -52, -4, -52);
    ctx.lineTo(1.5, -51);
    ctx.quadraticCurveTo(-2, -36, 1, -20);
    ctx.quadraticCurveTo(2, -8, 0, 2);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -8, -28, 24, SHIRT, SHIRTS));
    if (!A.flash) {
      ctx.save(); ctx.clip();
      const flowers = [[-10, -40], [-4, -28], [-12, -16], [-3, -8], [-8, -48]];
      for (const [fx, fy] of flowers) {
        ctx.fillStyle = '#e2493a';
        for (let i = 0; i < 5; i++) { const a = i * 1.2566; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 2.2, fy + Math.sin(a) * 2.2, 1.8, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(fx, fy, 1.1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // solapa lejana
    ctx.beginPath(); ctx.moveTo(15, -46); ctx.quadraticCurveTo(19, -30, 15.5, 1); ctx.lineTo(13, 1); ctx.quadraticCurveTo(16, -26, 13, -46); ctx.closePath();
    A.fillStroke(ctx, SHIRTS);
    // fajín
    ctx.beginPath(); ctx.moveTo(-15, -5); ctx.quadraticCurveTo(0, -8, 15, -5); ctx.lineTo(15.5, 6); ctx.quadraticCurveTo(0, 9, -15.5, 6); ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 0, 0, 14, '#8a5a32', '#5e3a1c'));
    ctx.restore();
  }
  function arlongHead(ctx, J, p, t) {
    ctx.save();
    ctx.translate(J.neck.x, J.neck.y); ctx.rotate(J.ha);
    ctx.scale(1.12, 1.12);
    // melena negra hacia atrás
    ctx.beginPath();
    ctx.moveTo(4, -40);
    const hs = [-12, -42, -20, -36, -30, -34, -24, -28, -33, -22, -24, -18, -30, -10, -20, -10, -22, -2, -12, -6, -6, -10];
    ctx.bezierCurveTo(-4, -46, -8, -44, -12, -42);
    for (let i = 2; i < hs.length; i += 2) ctx.lineTo(hs[i], hs[i + 1]);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, -14, -28, 18, '#2a2436', '#141019'));
    A.limb(ctx, 0, 6, 2, -8, 8, 8, AP.skin, AP.skinS);
    // cara
    ctx.beginPath();
    ctx.moveTo(-12, -20);
    ctx.bezierCurveTo(-13, -42, 18, -44, 21, -26);
    ctx.quadraticCurveTo(24, -16, 22, -9);
    ctx.quadraticCurveTo(19, -1, 10, -1);
    ctx.bezierCurveTo(2, -1, -6, -4, -10, -9);
    ctx.quadraticCurveTo(-12, -14, -12, -20);
    ctx.closePath();
    A.fillStroke(ctx, A.celR(ctx, 6, -24, 22, AP.skin, AP.skinS, 0.7));
    // aleta-oreja
    ctx.beginPath(); ctx.moveTo(-4, -26); ctx.lineTo(-14, -30); ctx.lineTo(-10, -24); ctx.lineTo(-15, -19); ctx.lineTo(-4, -18); ctx.closePath();
    A.fillStroke(ctx, AP.skinS);
    // branquias
    ctx.save(); ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-3 + i * 3, -9, 4.2, -1.3, 0.5); ctx.stroke(); }
    ctx.restore();
    // boca: sonrisa de tiburón
    const open = p.face === 'shout' || p.bite ? 1 : 0;
    ctx.beginPath();
    ctx.moveTo(5, -13);
    ctx.quadraticCurveTo(14, -12 - 1, 23, -15);
    ctx.quadraticCurveTo(18, -4 + open * 4, 7, -7 + open * 2);
    ctx.closePath();
    A.fillStroke(ctx, '#5a1022');
    ctx.fillStyle = c('#fff');
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const x = 6.5 + i * 2.8; ctx.moveTo(x, -12.6); ctx.lineTo(x + 1.4, -9.8); ctx.lineTo(x + 2.8, -12.9); }
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) { const x = 8 + i * 2.8; const yb = -6.8 + open * 2 - i * 0.3; ctx.moveTo(x, yb); ctx.lineTo(x + 1.4, yb - 2.8); ctx.lineTo(x + 2.8, yb - 0.3); }
    ctx.fill();
    // nariz de sierra
    ctx.save();
    ctx.translate(19, -23);
    ctx.rotate(-0.06);
    ctx.beginPath();
    ctx.moveTo(0, -3.4);
    for (let i = 0; i < 7; i++) { const x = 4 + i * 5; ctx.lineTo(x, -3.4 + i * 0.25); ctx.lineTo(x + 2.5, -7.5 + i * 0.35); ctx.lineTo(x + 4, -3.2 + i * 0.25); }
    ctx.lineTo(42, -1.2);
    ctx.quadraticCurveTo(45, 0, 42, 1.4);
    for (let i = 6; i >= 0; i--) { const x = 4 + i * 5; ctx.lineTo(x + 4, 3 - i * 0.2); ctx.lineTo(x + 2.5, 7 - i * 0.3); ctx.lineTo(x, 3.2 - i * 0.2); }
    ctx.lineTo(0, 4);
    ctx.closePath();
    A.fillStroke(ctx, A.cel(ctx, 20, 0, 0, 6, '#d5e1ec', '#8ea4bb'));
    ctx.restore();
    // sombra de villano sobre la mirada
    if (!A.flash && p.face !== 'ko') {
      ctx.save();
      ctx.fillStyle = 'rgba(30,40,90,.28)';
      ctx.beginPath(); ctx.moveTo(-4, -38); ctx.quadraticCurveTo(10, -42, 21, -34); ctx.lineTo(21, -27); ctx.quadraticCurveTo(10, -30, -4, -28); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // ojos y cejas
    if (p.face === 'ko') {
      A.line(ctx, [10, -31, 16, -26], 2); A.line(ctx, [16, -31, 10, -26], 2);
    } else {
      ctx.beginPath(); ctx.moveTo(9.5, -28.5); ctx.quadraticCurveTo(13.5, -32.5, 18.5, -30); ctx.quadraticCurveTo(14.5, -25.5, 9.5, -28.5); ctx.closePath();
      A.fillStroke(ctx, '#fff8e0');
      ctx.fillStyle = c('#c0202a'); ctx.beginPath(); ctx.arc(15.2, -29, 1.7, 0, Math.PI * 2); ctx.fill();
      if (!A.flash) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const eg = ctx.createRadialGradient(15.2, -29, 0, 15.2, -29, 6); eg.addColorStop(0, 'rgba(255,60,40,.6)'); eg.addColorStop(1, 'rgba(255,40,40,0)'); ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(15.2, -29, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
      ctx.fillStyle = c(OUT); ctx.beginPath(); ctx.arc(15.4, -29, 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(3, -29); ctx.quadraticCurveTo(5.5, -31, 7.5, -29.5); ctx.quadraticCurveTo(5, -27.5, 3, -29); ctx.closePath();
      A.fillStroke(ctx, '#fff8e0');
      ctx.save(); ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.moveTo(8.5, -35.5); ctx.lineTo(19, -31.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(2, -33); ctx.lineTo(7.5, -34); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }
  A.drawArlong = function (ctx, p, t) {
    A.begin(ctx);
    ctx.lineWidth = A.LW + 0.3;
    const J = A.solve(p, AD);
    arlongArm(ctx, J.shB, J.elB, J.haB, APb, false);
    arlongLeg(ctx, J.hipB, J.knB, J.ftB, J.snB, APb);
    arlongLeg(ctx, J.hipF, J.knF, J.ftF, J.snF, AP);
    arlongTorso(ctx, J);
    arlongHead(ctx, J, p, t);
    if (p.sword) A.kiribachi(ctx, J.haF.x, J.haF.y, p.wA ?? (J.faF + 1.7));
    arlongArm(ctx, J.shF, J.elF, J.haF, AP, true);
    return J;
  };
  A.drawArlongChair = function (ctx) {
    A.begin(ctx);
    // tumbona de playa de Arlong
    A.limb(ctx, -40, -2, -30, -40, 3, 3, '#8a5a32', '#5e3a1c');
    A.limb(ctx, 40, -2, 32, -30, 3, 3, '#8a5a32', '#5e3a1c');
    ctx.beginPath();
    ctx.moveTo(-44, -76); ctx.lineTo(-30, -36); ctx.lineTo(44, -32); ctx.lineTo(48, -40); ctx.lineTo(-22, -44); ctx.lineTo(-34, -80); ctx.closePath();
    A.fillStroke(ctx, '#e8d9a8');
    ctx.save(); ctx.clip(); ctx.fillStyle = c('#3a8ad0');
    for (let i = -60; i < 60; i += 10) ctx.fillRect(i, -90, 5, 70);
    ctx.restore();
    ctx.stroke();
  };

  // ---------------------------------------------------------------- objetos
  A.drawItem = function (ctx, kind, t) {
    A.begin(ctx);
    ctx.lineWidth = 2;
    const bob = Math.sin(t * 4) * 1.5;
    ctx.save();
    ctx.translate(0, bob);
    if (kind === 'meat') {
      A.limb(ctx, -14, 4, 14, -6, 2.6, 2.6, '#fbf6ea', '#d6ccb4');
      A.circle(ctx, -15, 2, 3.2, '#fbf6ea', null); A.circle(ctx, -13, 7, 3.2, '#fbf6ea', null);
      A.circle(ctx, 15, -8, 3.2, '#fbf6ea', null); A.circle(ctx, 16, -3, 3.2, '#fbf6ea', null);
      ctx.beginPath(); ctx.ellipse(0, -1, 11, 9, -0.35, 0, Math.PI * 2);
      A.fillStroke(ctx, A.celR(ctx, 0, -1, 11, '#c8582e', '#8e3418'));
      if (!A.flash) {
        ctx.fillStyle = 'rgba(255,220,180,.7)'; ctx.beginPath(); ctx.ellipse(-3, -5, 4, 2, -0.4, 0, Math.PI * 2); ctx.fill();
        // vapor de carne recién hecha
        ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.8 + i * 0.33) % 1;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.8;
          ctx.beginPath(); ctx.moveTo(-5 + i * 5, -10 - ph * 14);
          ctx.quadraticCurveTo(-8 + i * 5 + Math.sin(t * 3 + i) * 3, -16 - ph * 14, -5 + i * 5, -22 - ph * 14); ctx.stroke();
        }
        ctx.restore();
      }
    } else if (kind === 'mikan') {
      A.circle(ctx, 0, 0, 9, '#ff9a1f', '#d86a08');
      ctx.beginPath(); ctx.moveTo(0, -9); ctx.quadraticCurveTo(6, -16, 11, -12); ctx.quadraticCurveTo(6, -8, 0, -9); A.fillStroke(ctx, '#3fa34a');
      if (!A.flash) { ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(-3, -3, 2, 0, Math.PI * 2); ctx.fill(); }
    } else if (kind === 'coin' || kind === 'bigcoin' || kind === 'berry') {
      const s = kind === 'bigcoin' ? 1.4 : kind === 'berry' ? 0.6 : 1;
      const sq = Math.abs(Math.cos(t * 5));
      ctx.scale(Math.max(0.15, sq) * s, s);
      A.circle(ctx, 0, 0, 8, '#ffd84a', '#d9a21c');
      ctx.fillStyle = c('#a8700c'); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('฿', 0, 0.5);
    } else if (kind === 'energy') {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
      g.addColorStop(0, 'rgba(120,220,255,.8)'); g.addColorStop(1, 'rgba(120,220,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
      A.circle(ctx, 0, 0, 7.5, '#8fe6ff', '#3aa6e0');
      ctx.save(); ctx.rotate(t * 3); ctx.fillStyle = '#fff'; star(ctx, 0, 0, 4, 1.8, 5); ctx.fill(); ctx.restore();
      if (!A.flash) {
        // anillo orbital
        ctx.save(); ctx.strokeStyle = 'rgba(200,245,255,.85)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, t * 2, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(Math.cos(t * 5) * 12 * Math.cos(t * 2) - Math.sin(t * 5) * 4 * Math.sin(t * 2), Math.cos(t * 5) * 12 * Math.sin(t * 2) + Math.sin(t * 5) * 4 * Math.cos(t * 2), 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (kind === 'hat') {
      if (!A.flash) {
        const hg = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
        hg.addColorStop(0, `rgba(255,230,120,${0.45 + Math.sin(t * 5) * 0.15})`); hg.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.scale(0.75, 0.75);
      A.drawStrawHat(ctx, 0, 4, 0);
    }
    ctx.restore();
  };
  function star(ctx, x, y, R, r, n) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
  }
  A.star = star;

  // ---------------------------------------------------------------- decorados rompibles
  A.drawLantern = function (ctx, t, broken) {
    A.begin(ctx);
    ctx.lineWidth = 2;
    const sw = Math.sin(t * 2) * 0.06;
    ctx.save();
    ctx.rotate(sw);
    A.line(ctx, [0, -30, 0, -14], 1.5, '#3a2a1a');
    // brillo
    if (!A.flash) {
      const nk = G.nightK || 0, R = 40 + nk * 22;
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R);
      g.addColorStop(0, `rgba(255,190,90,${0.45 + nk * 0.25})`); g.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    A.fillStroke(ctx, A.celR(ctx, -2, -2, 13, '#e8392c', '#a81e1e'));
    ctx.save(); ctx.lineWidth = 1; ctx.strokeStyle = c('#7a1414');
    for (const k of [-6, 0, 6]) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(k) < 1 ? 0.5 : 12 - Math.abs(k), 14, 0, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
    A.limb(ctx, -6, -14, 6, -14, 2.4, 2.4, '#e8b84a', null);
    A.limb(ctx, -6, 14, 6, 14, 2.4, 2.4, '#e8b84a', null);
    A.line(ctx, [0, 16, 0, 26], 2, '#e8b84a');
    ctx.restore();
  };
  A.drawBrazier = function (ctx, t) {
    A.begin(ctx);
    ctx.lineWidth = 2;
    if (!A.flash) {
      // charco de luz cálida en el suelo y halo alrededor del fuego
      const fl = 0.85 + Math.sin(t * 17) * 0.08 + Math.sin(t * 7.3) * 0.07;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gg = ctx.createRadialGradient(0, 0, 4, 0, 0, 80);
      gg.addColorStop(0, `rgba(255,150,60,${0.35 * fl})`); gg.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(0, 0, 80, 16, 0, 0, Math.PI * 2); ctx.fill();
      const hg = ctx.createRadialGradient(0, -44, 2, 0, -44, 70 * fl);
      hg.addColorStop(0, 'rgba(255,190,90,.35)'); hg.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, -44, 70 * fl, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    A.limb(ctx, -4, 0, -2, -30, 3, 3, '#5a5068', '#3a3248');
    A.limb(ctx, 4, 0, 2, -30, 3, 3, '#5a5068', '#3a3248');
    ctx.beginPath(); ctx.moveTo(-14, -34); ctx.lineTo(14, -34); ctx.lineTo(9, -26); ctx.lineTo(-9, -26); ctx.closePath();
    A.fillStroke(ctx, A.cel(ctx, 0, -30, 0, 6, '#8a8098', '#5a5068'));
    // fuego animado
    ctx.save();
    ctx.globalCompositeOperation = A.flash ? 'source-over' : 'lighter';
    for (let i = 0; i < 4; i++) {
      const h = 16 + Math.sin(t * 13 + i * 2) * 5;
      const x = -6 + i * 4;
      const g = ctx.createLinearGradient(0, -34, 0, -34 - h);
      g.addColorStop(0, 'rgba(255,200,80,.95)'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 5, -34); ctx.quadraticCurveTo(x, -34 - h * 1.3, x + 5, -34); ctx.fill();
    }
    ctx.restore();
  };

  // ---------------------------------------------------------------- proyectiles
  A.drawProjectile = function (ctx, pr, t) {
    A.begin(ctx);
    ctx.lineWidth = 2;
    if (pr.kind === 'water' || pr.kind === 'uchimizu') {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.save(); ctx.rotate(a);
      const r = pr.r;
      ctx.beginPath(); ctx.moveTo(r * 1.8, 0); ctx.quadraticCurveTo(0, -r * 1.1, -r, 0); ctx.quadraticCurveTo(0, r * 1.1, r * 1.8, 0);
      A.fillStroke(ctx, A.celR(ctx, 0, 0, r, '#bfeaff', '#4aa8e0'));
      ctx.restore();
    } else if (pr.kind === 'ink') {
      A.circle(ctx, 0, 0, pr.r, '#3a2a48', '#140c1c');
      if (!A.flash) { ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(-pr.r * 0.3, -pr.r * 0.3, pr.r * 0.3, 0, Math.PI * 2); ctx.fill(); }
    } else if (pr.kind === 'harpoon') {
      const a = Math.atan2(pr.vy, pr.vx);
      // cuerda ondulante detrás del arpón
      ctx.save(); ctx.strokeStyle = '#c8a878'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-34 * Math.cos(a), -34 * Math.sin(a));
      for (let i = 1; i <= 8; i++) { const d = 34 + i * 9, w = Math.sin(t * 20 + i) * 3; ctx.lineTo(-d * Math.cos(a) - w * Math.sin(a), -d * Math.sin(a) + w * Math.cos(a)); }
      ctx.stroke(); ctx.restore();
      A.harpoon(ctx, -20 * Math.cos(a), -20 * Math.sin(a), Math.PI / 2 - a, 50);
    } else if (pr.kind === 'shock') {
      // onda de choque del Kiribachi
      ctx.save();
      const h = pr.h || 40;
      const g = ctx.createLinearGradient(0, 0, 0, -h);
      g.addColorStop(0, 'rgba(160,220,255,.95)'); g.addColorStop(1, 'rgba(160,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-4 * pr.dir, -h, 10 * pr.dir, -h * 0.6); ctx.quadraticCurveTo(4, -h * 0.2, 16, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }
  };

  // banco de pruebas
  A.testItems = function (t) {
    const P = A.pose;
    return [
      ['fish sword', 'drawFishman', Object.assign(P.idle(t), { aF: 0.9, eF: 0.6 }), { kind: 'sword', v: 0 }],
      ['fish harpoon', 'drawFishman', P.idle(t), { kind: 'harpoon', v: 1 }],
      ['fish bare', 'drawFishman', P.run(t), { kind: 'bare', v: 2 }],
      ['fish v2', 'drawFishman', Object.assign(P.idle(t), { aF: 0.9, eF: 0.6 }), { kind: 'sword', v: 2 }],
      ['fish v3', 'drawFishman', Object.assign(P.idle(t), { aF: 0.9, eF: 0.6 }), { kind: 'sword', v: 3 }],
      ['hatchan', 'drawHatchan', Object.assign(P.idle(t), { arms: [{ a: 0.6, e: 0.6 }, { a: 1.2, e: 0.5 }, { a: 1.8, e: 0.3 }, { a: 0.5, e: 0.7 }, { a: 1.1, e: 0.6 }, { a: 1.9, e: 0.3 }] })],
      ['arlong', 'drawArlong', Object.assign(P.idle(t), { aF: 0.3, eF: 0.5 })],
      ['arlong sword', 'drawArlong', Object.assign(P.idle(t), { sword: 1, aF: 0.9, eF: 0.8, face: 'shout' })],
    ];
  };
  A.drawFishman = A.outlined(A.drawFishman);
  A.drawHatchan = A.outlined(A.drawHatchan);
  A.drawArlong = A.outlined(A.drawArlong);
})();
