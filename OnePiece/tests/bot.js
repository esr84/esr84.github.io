'use strict';
// Bot de pruebas de regresión: recorre el nivel completo y lucha contra los jefes.
// Uso: abrir /?bot y ejecutar en consola  runBot('luffy')  o  runBot('daniela', 400, false)
window.runBot = function (kind, maxSec = 400, god = true, opts = {}) {
  const g = G.game;
  g.newGame(kind);
  g.godMode = god;
  if (opts.at !== undefined) { g.checkpoint = opts.at; if (opts.at >= 2) g.defeated.hatchan = true; g.startFromCheckpoint(); }
  const log = [];
  let falls = 0, dmg = 0, deaths = 0;
  const of = g.playerFell.bind(g);
  g.playerFell = (p) => { falls++; log.push('caída x' + (p.x | 0)); of(p); };
  const od = g.onPlayerDead.bind(g);
  g.onPlayerDead = () => { deaths++; log.push('muerte x' + (g.player.x | 0) + ' vidas→' + (g.lives - 1)); od(); };
  let lastX = 0, stuckT = 0, t = 0, prevCp = -1, phase = '', lastHp = g.player.hp;
  const step = 1 / 60;
  const keys = ['left', 'right', 'jump', 'attack', 'special', 'down'];
  for (let i = 0; i < maxSec * 60; i++) {
    t += step;
    const p = g.player, lv = g.level;
    if (p.hp < lastHp) dmg += lastHp - p.hp;
    lastHp = p.hp;
    const inp = {};
    if (g.state === 'victory') { log.push('VICTORIA @' + t.toFixed(1)); break; }
    if (g.state !== 'play') { log.push('estado ' + g.state + ' @' + t.toFixed(1)); break; }
    if (g.fadeDir) { /* esperando fundido */ }
    else if (g.dialog) inp.attack = i % 10 === 0;
    else {
      const target = g.boss && g.arena ? g.boss : null;
      let dir = 1;
      if (target) {
        const dx = target.x - p.x;
        dir = Math.abs(dx) < (p.kind === 'luffy' ? 178 : 70) ? 0 : Math.sign(dx);
        if (p.kind === 'luffy' && Math.abs(dx) < 140) dir = -Math.sign(dx);
        if (dir === 0 && Math.sign(dx) !== p.facing) dir = Math.sign(dx);
        // alejarse un poco de los ataques cuerpo a cuerpo
        if (['saw', 'slash', 'punch'].includes(target.state) && target.stateT < 0.4 && Math.abs(dx) < 160) dir = -Math.sign(dx);
      }
      const foes = g.enemies.concat(g.boss && g.boss.active ? [g.boss] : []);
      const reach = p.kind === 'luffy' ? 175 : 95;
      const near = foes.some((e) => !e.dead && Math.abs(e.x - p.x) < reach && Math.abs((e.y - e.h / 2) - (p.y - 60)) < 50);
      // enemigo en el suelo delante: pararse, encararlo y atacar
      const ahead = foes.find((e) => !e.dead && !e.isBoss && Math.abs(e.x - p.x) < reach - 15 && Math.abs(e.y - p.y) < 60);
      if (ahead && !target) { dir = 0; if (Math.sign(ahead.x - p.x) !== p.facing) dir = Math.sign(ahead.x - p.x); }
      inp.right = dir > 0; inp.left = dir < 0;
      if (near && i % 12 === 0) inp.attack = true;
      if (target && target.active && p.energy >= 10 && i % 120 === 0) inp.special = true;
      // saltos: pozas, muros, ataques del jefe
      const look = p.x + (dir || p.facing) * 24;
      if ((lv.inPit(look) || p.hitWall) && p.onGround && dir) inp.jump = true;
      if (!p.onGround && p.vy < 0) inp.jump = true;
      if (target && target.state === 'darts' && target.dashStarted && Math.abs(target.x - p.x) < 260 && Math.sign(p.x - target.x) === target.facing && p.onGround) inp.jump = true;
      if (g.projectiles.some((pr) => pr.kind === 'shock' && Math.abs(pr.x - p.x) < 100 && Math.sign(pr.vx) === Math.sign(p.x - pr.x)) && p.onGround) inp.jump = true;
    }
    for (const k of keys) G.input.set(k, 'bot', !!inp[k]);
    g.update(step);
    G.input.consume();
    if (g.checkpoint !== prevCp) { log.push('checkpoint ' + g.checkpoint + ' @' + t.toFixed(1)); prevCp = g.checkpoint; }
    const ph = g.arena ? 'arena:' + g.arena.def.id : 'libre';
    if (ph !== phase) { log.push(ph + ' @' + t.toFixed(1) + ' x' + (p.x | 0) + ' hp' + p.hp); phase = ph; }
    if (Math.abs(p.x - lastX) < 1 && !g.arena && !g.dialog && !g.script && !g.fadeDir) {
      stuckT += step;
      if (stuckT > 8) { log.push('ATASCADO x' + (p.x | 0) + ' y' + (p.y | 0)); break; }
    } else stuckT = 0;
    lastX = p.x;
    if (falls > 8) { log.push('demasiadas caídas'); break; }
    if (G.lastError) { log.push('ERROR ' + (G.lastError.stack || G.lastError)); break; }
  }
  for (const k of keys) G.input.set(k, 'bot', false);
  const b = g.boss;
  log.push(`fin t=${t.toFixed(1)} x=${g.player.x | 0} puntos=${g.score} bajas=${g.kills} daño=${dmg} caídas=${falls} muertes=${deaths} jefe=${b ? b.name + ' hp' + b.hp + ' ' + b.state : '-'}`);
  return log.join('\n');
};
