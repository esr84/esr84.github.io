'use strict';
// Juego: máquina de estados, cámara, colisiones, guiones de jefes y bucle principal.
(function () {
  const U = G.U, I = G.input, W = G.W, H = G.H;
  const STEP = 1 / 60;

  const Game = G.game = {
    state: 'title', time: 0, selIndex: 0, goIndex: 0, storyI: 0, storyT: 0,
    level: new G.Level(),
    cam: { x: 0, y: 0 },
    paused: false, stopT: 0, timeScale: 1, fade: 0, fadeDir: 0, fadeCb: null,
    // sensaciones: trauma de cámara, retroceso, zoom, fotograma de impacto, líneas de concentración
    trauma: 0, kickX: 0, kickY: 0, zoom: 1, zoomV: 0, zoomFX: W / 2, zoomFY: H / 2,
    impactT: 0, lastImpact: -9, focusT: 0, comboN: 0, comboT: 0, comboPop: 0, hurtT: 0, hudHp: 16, hudDelay: 0,
    godMode: G.params.has('god'),
    defeated: { hatchan: false, arlong: false },

    // ------------------------------------------------------------ ciclo de partida
    newGame(kind) {
      this.player = new G.Player(kind);
      this.lives = 3; this.score = 0; this.kills = 0; this.playTime = 0; this.nextLife = 20000;
      this.gateDone = false;
      this.checkpoint = 0;
      this.defeated = { hatchan: false, arlong: false };
      const at = G.params.get('at');
      if (at === 'hatchan') this.checkpoint = 1;
      if (at === 'arlong' || at === 'boss') { this.checkpoint = 2; this.defeated.hatchan = true; }
      this.startFromCheckpoint();
      if (at && !isNaN(Number(at))) { this.player.x = Number(at); this.cam.x = U.clamp(this.player.x - W * 0.42, 0, this.level.width - W); }
      this.setState('play');
    },
    startFromCheckpoint() {
      this.level = new G.Level();
      for (const a of this.level.arenas) a.done = !!this.defeated[a.boss];
      this.enemies = []; this.projectiles = []; this.pickups = []; this.props = [];
      this.breakables = this.level.breakables.map((b) => Object.assign({}, b, { broken: false, flashT: 0 }));
      this.boss = null; this.arena = null; this.dialog = null; this.script = null;
      this.storm = false; this.stormK = 0; this.boltT = 0; this.nextBolt = 2;
      this.timeScale = 1; this.vicT = 0; this.trauma = 0; this.zoom = 1; this.comboN = 0; this.impactT = 0; this.focusT = 0;
      G.fx.reset();
      const cp = this.level.checkpoints[this.checkpoint];
      const p = this.player;
      const keepEnergy = Math.max(20, p.energy);
      p.reset(cp.x, G.Level.GY);
      p.energy = keepEnergy;
      this.hudHp = p.hp;
      this.specReady = p.energy >= 10;
      // en el punto de control ya no aparecen enemigos que estén por detrás
      for (const s of this.level.spawns) if (s.x < cp.x + 200) s.done = true;
      this.cam.x = U.clamp(p.x - W * 0.3, 0, this.level.width - W);
      G.audio.playMusic('stage');
      this.stamp = null; if (this.checkpoint > 0) this.gateDone = true;
      this.banner = { t: 0, title: 'ARLONG PARK', sub: this.checkpoint === 0 ? '¡Libera Cocoyashi!' : 'Punto de control ' + this.checkpoint };
    },
    setState(s) {
      this.state = s; this.stateT = 0;
      G.touchUI.setVisible(s === 'play');
      if (s === 'title') G.audio.playMusic('title');
      if (s === 'gameover') { G.audio.playMusic('gameover'); this.goIndex = 0; }
    },
    controlsEnabled() { return this.state === 'play' && !this.dialog && !this.script && !this.paused; },
    togglePause() {
      if (this.state !== 'play') return;
      this.paused = !this.paused;
      G.audio.sfx('pause');
      document.getElementById('btnPause').textContent = this.paused ? '▶' : '❚❚';
    },

    // ------------------------------------------------------------ utilidades de juego
    shake(n) { this.trauma = Math.min(1, this.trauma + n / (G.reduceMotion ? 40 : 16)); },
    kick(dx, dy = 0) { this.kickX += dx; this.kickY += dy; },
    punchZoom(a, wx, wy) { this.zoom = Math.min(1.35, this.zoom + a); if (wx !== undefined) { this.zoomFX = wx - this.cam.x; this.zoomFY = wy; } },
    impact(t = 0.07) { if (!G.reduceMotion && this.time - this.lastImpact > 0.5) { this.impactT = t; this.lastImpact = this.time; } },
    focusLines(t) { this.focusT = Math.max(this.focusT, t); },
    slowmo(dur, scale) { if (this.script) return; this.slowT = dur; this.timeScale = scale; },
    onPlayerHurt() { this.hurtT = 0.4; this.comboN = 0; this.hudDelay = 0.45; G.rumble(70); },
    hitstop(t) { this.stopT = Math.max(this.stopT, t); },
    addScore(n, x, y) {
      this.score += n;
      if (x !== undefined) G.fx.text(x, y, '+' + n, { size: 18, color: '#ffe14a', life: 0.7, rise: 30 });
      if (this.score >= this.nextLife) {
        this.nextLife += 20000; this.lives++;
        G.audio.sfx('oneup'); G.fx.text(this.player.x, this.player.y - 140, '¡1UP!', { size: 30, color: '#7aff8a' });
      }
    },
    addProjectile(p) { p.t = 0; this.projectiles.push(p); },
    spawnPickup(x, y, kind, vx = 0, vy = -320) { this.pickups.push({ x, y, vx, vy, kind, t: 0, landed: false }); },
    groundBelow(x, y) {
      let best = null;
      for (const s of this.level.solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 4 && (best === null || s.y < best)) best = s.y;
      for (const p of this.level.oneways) if (x >= p.x && x <= p.x + p.w && p.y >= y - 4 && (best === null || p.y < best)) best = p.y;
      return best;
    },
    say(lines, onDone) {
      this.dialog = { lines, i: 0, chars: 0, onDone };
    },
    run(steps) { this.script = { steps, i: 0, t: 0 }; },
    fadeTo(cb) { this.fadeDir = 1; this.fadeCb = cb; },

    // ------------------------------------------------------------ eventos
    playerFell(p) {
      G.fx.splash(p.x, G.Level.WATER_Y, true);
      G.audio.sfx('splash');
      G.fx.text(p.x, G.Level.WATER_Y - 60, p.kind === 'luffy' ? '¡NO SÉ NADAR!' : '¡PUAJ, AGUA SALADA!', { size: 24, color: '#9fd8ff', life: 1.2 });
      p.hp -= 3;
      if (p.hp <= 0 && !this.godMode) {
        p.hp = 0; p.setState('dead'); p.deadNotified = true; p.y = G.H + 200; p.vy = 0;
        this.onPlayerDead();
        return;
      }
      if (this.godMode) p.hp = Math.max(1, p.hp);
      p.x = p.lastSafeX; p.y = p.lastSafeY; p.vx = 0; p.vy = 0;
      p.invuln = 1.6; p.setState('normal');
      G.audio.sfx('hurt');
    },
    onPlayerDead() {
      this.lives--;
      if (this.lives > 0) {
        this.fadeTo(() => { this.player.hp = this.player.maxHp; this.startFromCheckpoint(); });
      } else {
        this.fadeTo(() => this.setState('gameover'));
      }
    },
    onBossDefeated(b) {
      this.addScore(b.score, b.x, b.y - 200);
      this.kills++;
      G.audio.stopMusic();
      G.audio.sfx('explode');
      this.shake(16);
      if (!G.reduceMotion) { this.impactT = 0.1; this.lastImpact = this.time; }
      this.focusLines(1.2);
      this.punchZoom(0.22, b.x, b.y - 90);
      G.fx.flash('#fff', 0.5, 0.9, 0.12);
      this.projectiles.length = 0;
      if (b instanceof G.Hatchan) {
        this.run([
          { wait: 1.4 },
          { say: [{ who: 'HATCHAN', text: '¡Nyuuu~! Mis seis espadas... ¡Lo siento, Arlong-san!', face: 'ko' }] },
          { fn: () => {
            this.defeated.hatchan = true;
            const a = this.level.arenas.find((x) => x.id === 'hatchan'); a.done = true;
            this.arena = null;
            this.props.push(this.boss);   // Hatchan queda K.O. en el suelo
            this.boss = null;
            G.audio.playMusic('stage');
            G.fx.text(this.cam.x + W - 140, 220, '¡ADELANTE! ➜', { size: 34, color: '#ffe14a', life: 2.2, rise: 0, screen: false });
          } },
        ]);
      } else {
        this.timeScale = 0.3;
        this.run([
          { wait: 0.6 },
          { fn: () => { G.fx.explosion(b.x, b.y - 100, 1.5); this.shake(20); G.audio.sfx('explode'); } },
          { wait: 0.6 },
          { fn: () => { this.timeScale = 1; } },
          { wait: 1.2 },
          { say: [{ who: 'ARLONG', text: 'Imposible... ¿Derrotado... por un ser inferior...?', face: 'ko' }] },
          { fn: () => this.startVictory() },
        ]);
      }
    },
    startVictory() {
      this.defeated.arlong = true;
      this.setState('victory');
      G.touchUI.setVisible(false);
      this.vicT = 0;
      this.player.victory = true;
      this.nami = { x: this.cam.x + W + 60, t: 0, moving: true };
      G.audio.playMusic('victory');
      const L = this.player.kind === 'luffy';
      this.victoryLine = L ? '¡NAMI! ¡ERES MI NAKAMA!' : 'Nami-san, ya eres libre. ¿Te preparo algo de comer?';
    },

    // ------------------------------------------------------------ arenas de jefe
    checkArenas() {
      const p = this.player;
      for (const a of this.level.arenas) {
        if (a.done || this.arena) continue;
        // Arlong ya está sentado en su tumbona antes de entrar
        if (a.boss === 'arlong' && !this.boss && this.cam.x > 6000) {
          this.boss = new G.Arlong(7330, G.Level.GY);
        }
        if (p.x > a.trigger && p.state !== 'dead') this.startArena(a);
      }
    },
    startArena(a) {
      this.arena = { x0: a.camX, x1: a.camX + W, def: a };
      // los enemigos comunes huyen
      for (const e of this.enemies) if (!e.dead) { e.remove = true; G.fx.dust(e.x, e.y, 6); }
      this.projectiles.length = 0;
      const p = this.player;
      const L = p.kind === 'luffy';
      if (a.boss === 'hatchan') {
        G.audio.stopMusic();
        this.run([
          { fn: () => { p.auto = 1; } }, { wait: 0.35 }, { fn: () => { p.auto = 0; } },
          { fn: () => { this.boss = new G.Hatchan(a.camX + 720, -140); G.audio.sfx('whoosh'); } },
          { until: () => this.boss.onGround },
          { fn: () => { this.shake(12); G.fx.dust(this.boss.x, this.boss.y, 12); G.fx.crack(this.boss.x, this.boss.y, 60); G.audio.sfx('bighit'); G.fx.text(this.boss.x, this.boss.y - 150, '¡DON!', { size: 44, color: '#ff9ab0', life: 0.8 }); } },
          { wait: 0.6 },
          { say: [
            { who: 'HATCHAN', text: '¡Nyu~! ¡Alto ahí! Nadie se acerca a Arlong-san sin vencer antes a Hatchan, ¡el maestro de las seis espadas!' },
            L ? { who: 'LUFFY', text: '¡Apártate, pulpo! ¡He venido a por Arlong!', face: 'angry' }
              : { who: 'DANIELA', text: 'Un pulpo con seis espadas... Quedarías genial en un takoyaki, pero tengo prisa.', face: 'cool' },
            { who: 'HATCHAN', text: '¡Rokutoryu! ¡Prepárate!', face: 'angry' },
          ] },
          { fn: () => { this.boss.active = true; this.boss.setState('idle'); G.audio.playMusic('boss'); } },
        ]);
      } else {
        G.audio.stopMusic();
        if (!(this.boss instanceof G.Arlong)) this.boss = new G.Arlong(7330, G.Level.GY);
        this.run([
          { fn: () => { p.auto = 1; } }, { wait: 0.5 }, { fn: () => { p.auto = 0; } },
          { wait: 0.5 },
          { say: [
            { who: 'ARLONG', text: 'Shahahaha... Así que tú eres quien ha armado tanto alboroto en mi parque.' },
            L ? { who: 'LUFFY', text: '¡Arlong! ¡Has hecho llorar a Nami! ¡Te voy a mandar a volar!', face: 'shout' }
              : { who: 'DANIELA', text: 'Me llamo Daniela. Has hecho llorar a Nami-san... y eso no te lo pienso perdonar.', face: 'angry' },
            { who: 'ARLONG', text: '¡Los humanos sois seres inferiores! ¡Os enseñaré el verdadero poder de los hombres-pez!', face: 'shout' },
          ] },
          { fn: () => { this.boss.setState('rise'); G.audio.playMusic('boss'); this.focusLines(1.1); this.punchZoom(0.1, this.boss.x, this.boss.y - 100); } },
        ]);
      }
    },

    // ------------------------------------------------------------ actualización
    update(dt) {
      this.time += dt;
      if (I.pressed.mute) { document.getElementById('btnMute').click(); }
      // fundido
      if (this.fadeDir) {
        this.fade += this.fadeDir * dt * 2.5;
        if (this.fade >= 1 && this.fadeDir > 0) { this.fade = 1; this.fadeDir = -1; const cb = this.fadeCb; this.fadeCb = null; if (cb) cb(); }
        if (this.fade <= 0 && this.fadeDir < 0) { this.fade = 0; this.fadeDir = 0; }
      }
      const confirm = I.anyPressed('start', 'jump', 'attack');
      switch (this.state) {
        case 'title':
          this.stateT += dt;
          G.fx.update(dt);
          if (confirm) { G.audio.sfx('confirm'); this.setState('select'); }
          break;
        case 'select':
          if (I.pressed.left || I.pressed.right) { this.selIndex = 1 - this.selIndex; G.audio.sfx('select'); }
          if (confirm) this.confirmSelect();
          break;
        case 'story':
          this.storyT += dt;
          if (confirm || I.pressed.special) this.advanceStory();
          break;
        case 'play':
          if (I.pressed.pause) this.togglePause();
          if (!this.paused && !this.fadeDir) this.updatePlay(dt);
          else if (this.fadeDir) G.fx.update(dt);
          break;
        case 'gameover':
          if (I.pressed.left || I.pressed.right) { this.goIndex = 1 - this.goIndex; G.audio.sfx('select'); }
          if (confirm && this.stateT > 0.5) this.confirmGameOver();
          this.stateT += dt;
          break;
        case 'victory':
          this.vicT += dt;
          this.level.collapse = Math.min(1, (this.level.collapse || 0) + dt * 0.12);
          if (this.level.collapse < 1 && Math.random() < 0.3) { this.shake(4); G.fx.dust(this.cam.x + U.rand(250, 950), U.rand(150, 440), 2); }
          this.player.update(dt, this);
          if (this.nami) {
            const n = this.nami, tx = this.player.x + 120;
            n.t += dt;
            n.moving = Math.abs(n.x - tx) > 4;
            if (n.moving) n.x = U.approach(n.x, tx, 190 * dt);
            if (n.moving && Math.random() < 0.2) G.fx.dust(n.x, G.Level.GY, 1, 1);
          }
          G.fx.update(dt);
          if (this.vicT > 2.5 && confirm) this.fadeTo(() => { this.player.victory = false; this.level.collapse = 0; this.setState('title'); });
          break;
      }
    },
    confirmSelect() {
      G.audio.sfx('confirm');
      this.chosen = this.selIndex === 0 ? 'luffy' : 'daniela';
      this.storyI = 0; this.storyT = 0;
      this.setState('story');
    },
    advanceStory() {
      if (this.storyT < 0.25) return;
      this.storyI++; this.storyT = 0;
      G.audio.sfx('select');
      if (this.storyI >= G.ui.STORY.length) this.fadeTo(() => this.newGame(this.chosen));
    },
    confirmGameOver() {
      G.audio.sfx('confirm');
      if (this.goIndex === 0) {
        this.fadeTo(() => { this.lives = 3; this.score = 0; this.nextLife = 20000; this.player.hp = this.player.maxHp; this.setState('play'); this.startFromCheckpoint(); });
      } else this.fadeTo(() => this.setState('title'));
    },
    tap(x, y) {
      switch (this.state) {
        case 'title': G.audio.sfx('confirm'); this.setState('select'); break;
        case 'select':
          G.ui.selectRects.forEach((r, i) => { if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { this.selIndex = i; this.confirmSelect(); } });
          break;
        case 'story': this.advanceStory(); break;
        case 'play': if (this.dialog) this.advanceDialog(); break;
        case 'gameover':
          G.ui.goRects.forEach((r, i) => { if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { this.goIndex = i; this.confirmGameOver(); } });
          break;
        case 'victory': if (this.vicT > 2.5) this.fadeTo(() => { this.player.victory = false; this.level.collapse = 0; this.setState('title'); }); break;
      }
    },
    advanceDialog() {
      const d = this.dialog; if (!d) return;
      const line = d.lines[d.i];
      if (d.chars < line.text.length) { d.chars = line.text.length; return; }
      d.i++; d.chars = 0;
      G.audio.sfx('select');
      if (d.i >= d.lines.length) { this.dialog = null; if (d.onDone) d.onDone(); }
    },

    updatePlay(dtRaw) {
      const p = this.player;
      this.playTime += dtRaw;
      if (this.banner) this.banner.t += dtRaw;
      // diálogo: el mundo se congela
      if (this.dialog) {
        const d = this.dialog, line = d.lines[d.i];
        const before = Math.floor(d.chars);
        d.chars = Math.min(line.text.length, d.chars + dtRaw * 48);
        if (Math.floor(d.chars) !== before && before % 3 === 0) G.audio.sfx('text');
        if (I.anyPressed('jump', 'attack', 'start')) this.advanceDialog();
        if (this.boss) this.boss.t += dtRaw;
        G.fx.update(dtRaw);
        return;
      }
      // guion (cinemáticas cortas)
      if (this.script) this.runScript(dtRaw);
      this.updateFeel(dtRaw);
      if (this.stopT > 0) {
        this.stopT -= dtRaw;
        for (const e of this.enemies) if (e.hitShake > 0) e.hitShake -= dtRaw * 0.5;
        if (this.boss && this.boss.hitShake > 0) this.boss.hitShake -= dtRaw * 0.5;
        return;
      }
      const dt = dtRaw * this.timeScale;

      p.update(dt, this);
      this.updateCamera(dtRaw);
      this.checkArenas();
      this.updateSpawns(dt);

      // momento único al cruzar la puerta de Arlong Park
      if (!this.gateDone && p.x > 1600 && this.checkpoint === 0) {
        this.gateDone = true;
        this.stamp = { t: 0, text: '¡ARLONG PARK!', sub: 'Territorio de los hombres-pez' };
        this.focusLines(0.8); this.shake(8); this.punchZoom(0.05, p.x, p.y - 60);
        G.audio.sfx('roar');
      }
      if (this.stamp) { this.stamp.t += dt; if (this.stamp.t > 2.2) this.stamp = null; }
      // checkpoints
      const cps = this.level.checkpoints;
      for (let i = this.checkpoint + 1; i < cps.length; i++) if (p.x > cps[i].x) this.checkpoint = i;

      for (const e of this.enemies) { e.update(dt, this); e.animate(dt); }
      if (this.boss) { this.boss.update(dt, this); this.boss.animate(dt); }
      for (const pr of this.projectiles) G.updateProjectile(pr, dt, this);
      for (const it of this.pickups) G.updatePickup(it, dt, this);
      for (const b of this.breakables) if (b.flashT > 0) b.flashT -= dt;
      this.collisions();
      this.enemies = this.enemies.filter((e) => !e.remove);
      this.projectiles = this.projectiles.filter((x) => !x.dead);
      this.pickups = this.pickups.filter((x) => !x.dead);
      this.ambient(dt);
      G.fx.update(dt);
    },
    // ambiente: motas de luz flotando y brasas que suben de los braseros
    ambient(dt) {
      const cam = this.cam;
      if (!G.lowFx && Math.random() < dt * 5) {
        G.fx.add({ type: 'mote', x: cam.x + U.rand(0, W), y: U.rand(140, 450), vx: U.rand(-10, 10), vy: U.rand(-14, -4), r: U.rand(0.8, 1.8), life: U.rand(2.5, 4.5), alpha: 0.55, layer: 1 });
      }
      for (const b of this.breakables) {
        if (b.broken || b.kind !== 'brazier' || b.x < cam.x - 40 || b.x > cam.x + W + 40) continue;
        if (Math.random() < dt * 7) {
          G.fx.add({ type: 'mote', x: b.x + U.rand(-7, 7), y: b.y - 42, vx: U.rand(-14, 14), vy: -U.rand(40, 80), r: U.rand(0.9, 1.6), life: U.rand(0.8, 1.5), color: 'rgba(255,170,60,1)', alpha: 0.9, layer: 1 });
        }
      }
    },
    updateFeel(dt) {
      // tormenta de la fase final
      const sTarget = this.storm && this.state !== 'victory' ? 1 : 0;
      this.stormK = U.approach(this.stormK || 0, sTarget, dt * 0.5);
      if (this.boltT > 0) this.boltT -= dt;
      if (this.stormK > 0.6) {
        this.nextBolt -= dt;
        if (this.nextBolt <= 0) {
          this.nextBolt = U.rand(3, 6); this.boltT = 0.22;
          this.boltX = U.rand(120, W - 120); this.boltSeed = Math.random() * 1000;
          G.audio.sfx('thunder'); this.shake(3);
        }
        if (Math.random() < dt * 30) G.fx.add({ type: 'drop', x: this.cam.x + U.rand(0, W), y: G.Level.GY - 2, vx: U.rand(-60, 60), vy: -U.rand(60, 140), g: 900, r: 1.6, life: 0.25, layer: 1 });
      }
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0 && !this.script) this.timeScale = 1; }
      this.trauma = Math.max(0, this.trauma - dt * 1.4);
      const kd = Math.exp(-dt * 14);
      this.kickX *= kd; this.kickY *= kd;
      this.zoomV += ((1 - this.zoom) * 90 - this.zoomV * 14) * dt;
      this.zoom += this.zoomV * dt;
      if (this.impactT > 0) this.impactT -= dt;
      if (this.focusT > 0) this.focusT -= dt;
      if (this.hurtT > 0) this.hurtT -= dt;
      if (this.comboPop < 1) this.comboPop = Math.min(1, this.comboPop + dt * 5);
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.comboN = 0; }
      const p = this.player;
      if (p) {
        if (this.hudDelay > 0) this.hudDelay -= dt;
        else if (this.hudHp > p.hp) this.hudHp = Math.max(p.hp, this.hudHp - dt * 10);
        if (this.hudHp < p.hp) this.hudHp = p.hp;
        if (p.energy >= 10 && !this.specReady) { this.specReady = true; G.audio.sfx('energy'); G.fx.text(p.x, p.y - 125, '¡ESPECIAL LISTO!', { size: 18, color: '#8fe6ff', life: 0.9 }); }
        if (p.energy < 10) this.specReady = false;
      }
      const b = this.boss;
      if (b) {
        if (this.bossHud === undefined || this.bossHud < b.hp) this.bossHud = b.hp;
        else if (this.bossHud > b.hp) this.bossHud = Math.max(b.hp, this.bossHud - dt * 12);
      } else this.bossHud = undefined;
    },
    runScript(dt) {
      const sc = this.script;
      const st = sc.steps[sc.i];
      if (!st) { this.script = null; return; }
      sc.t += dt;
      let next = false;
      if (st.wait !== undefined) next = sc.t >= st.wait;
      else if (st.until) next = st.until();
      else if (st.fn) { st.fn(); next = true; }
      else if (st.say) { if (!st.started) { st.started = true; this.say(st.say, () => { st.finished = true; }); } next = st.finished; }
      if (next) { sc.i++; sc.t = 0; if (sc.i >= sc.steps.length) this.script = null; }
    },
    updateCamera(dt) {
      const p = this.player, cam = this.cam;
      let target;
      if (this.arena) target = this.arena.x0;
      else {
        target = p.x - W * 0.42 + p.facing * 40;
        for (const a of this.level.arenas) if (!a.done) target = Math.min(target, a.camX);
      }
      target = U.clamp(target, 0, this.level.width - W);
      cam.x += (target - cam.x) * Math.min(1, dt * (this.arena ? 4 : 7));
    },
    updateSpawns(dt) {
      const lv = this.level, cam = this.cam, p = this.player;
      for (const s of lv.spawns) {
        if (s.done) continue;
        if (s.x < cam.x + W + 40 && s.x > cam.x - 40) {
          s.done = true;
          const y = s.y || G.Level.GY;
          if (s.type === 'grunt') this.enemies.push(new G.Grunt(s.x, y, s.v));
          else if (s.type === 'harpooner') this.enemies.push(new G.Harpooner(s.x, y, s.v));
        }
      }
      if (this.arena || this.script) return;
      for (const sp of lv.leapSpawners) {
        const d = Math.abs(p.x - sp.x);
        if (d > 90 && d < 460) {
          sp.cd -= dt;
          if (sp.cd <= 0) {
            sp.cd = U.rand(3, 5);
            const alive = this.enemies.filter((e) => e instanceof G.Leaper && Math.abs(e.x - sp.x) < 300).length;
            if (alive < 1 && !sp.pending) sp.pending = { x: sp.x + U.rand(-sp.w / 4, sp.w / 4), t: 0.75 };
          }
        }
      }
      for (const sp of lv.leapSpawners) {
        if (!sp.pending) continue;
        const pd = sp.pending;
        pd.t -= dt;
        if (Math.random() < 0.6) G.fx.add({ type: 'bubble', x: pd.x + U.rand(-14, 14), y: G.Level.WATER_Y + 2, vy: -U.rand(20, 50), r: U.rand(2, 4.5), life: 0.35, layer: 1 });
        if (pd.t <= 0) { sp.pending = null; this.enemies.push(new G.Leaper(pd.x, H + 30, U.randi(0, 3), p.x < pd.x ? -1 : 1)); }
      }
      for (const z of lv.flyZones) {
        if (p.x > z.x0 && p.x < z.x1) {
          z.cd -= dt;
          if (z.cd <= 0) {
            z.cd = U.rand(2.2, 3.6);
            const fromRight = p.facing > 0;
            this.enemies.push(new G.Flyfish(fromRight ? cam.x + W + 40 : cam.x - 40, U.rand(300, 370), fromRight ? -1 : 1));
          }
        }
      }
    },

    // ------------------------------------------------------------ colisiones
    collisions() {
      const p = this.player;
      const pbox = U.box(p);
      const hurtBox = { x: pbox.x + 4, y: pbox.y + (p.crouch ? 30 : 6), w: pbox.w - 8, h: pbox.h - (p.crouch ? 30 : 6) };
      const atk = p.attackBox();
      const targets = this.boss ? this.enemies.concat([this.boss]) : this.enemies;
      if (atk) {
        for (const e of targets) {
          if (e.dead) continue;
          if (U.overlap(atk.box, e.box())) {
            if (e.hurt(atk, this)) {
              const hx = U.clamp(p.x + p.facing * 40, e.x - e.w / 2, e.x + e.w / 2);
              const hy = U.clamp(atk.box.y + atk.box.h / 2, e.y - e.h, e.y - 10);
              const big = atk.dmg >= 3;
              G.fx.hit(hx, hy, big, p.facing);
              if (big && !atk.multi && Math.random() < 0.45) G.fx.text(hx + p.facing * 30, hy - 60, U.choose(['¡PAM!', '¡ZAS!', '¡BAM!', '¡CRAC!']), { size: 32, color: U.choose(['#ffe14a', '#fff', '#ff9a3a']), life: 0.55, rise: 18, layer: 2 });
              G.fx.text(hx + U.rand(-8, 8), hy - 26, String(atk.dmg), { size: big ? 26 : 20, color: big ? '#ffb02e' : '#fff', life: 0.55, rise: 34, layer: 2 });
              this.hitstop(e.isBoss ? 0.05 + atk.dmg * 0.012 : 0.03 + atk.dmg * 0.018);
              this.shake(big ? 5 : 3);
              this.kick(p.facing * (big ? 6 : 3.5), big ? 2 : 1);
              e.hitShake = 0.14;
              this.comboN++; this.comboT = 1.6; this.comboPop = 0;
              if (this.comboN >= 3) this.addScore(this.comboN * 10);
              G.rumble(big ? 35 : 18);
              if (atk.dmg >= 4) { this.impact(0.06); this.punchZoom(0.04, e.x, e.y - 60); }
              if (e.dead && !e.isBoss) { this.kills++; this.kick(p.facing * 6, 0); }
              p.onHitSomething(e, atk, this);
              if (atk.dmg >= 2 && !atk.multi) p.energy = Math.min(p.maxEnergy, p.energy + 1);
            }
          }
        }
        for (const b of this.breakables) {
          if (b.broken) continue;
          if (U.overlap(atk.box, G.breakBox(b))) {
            b.broken = true;
            G.audio.sfx('break');
            const by = b.kind === 'lantern' ? b.y : b.y - 30;
            G.fx.debris(b.x, by, b.kind === 'lantern' ? ['#e8392c', '#a81e1e', '#e8b84a'] : ['#8a8098', '#ffb347'], 10);
            G.fx.hit(b.x, by, false);
            if (b.kind === 'lantern') for (let i = 0; i < 6; i++) G.fx.add({ type: 'flame', x: b.x + U.rand(-8, 8), y: by + U.rand(-8, 8), vx: U.rand(-90, 90), vy: -U.rand(40, 160), r: U.rand(8, 14), life: U.rand(0.25, 0.45), drag: 0.9, layer: 1 });
            this.spawnPickup(b.x, by, b.drop);
            for (let i = 0; i < 3; i++) this.spawnPickup(b.x, by, 'berry', U.rand(-160, 160), -U.rand(250, 420));
            this.addScore(50);
            this.shake(2);
          }
        }
        for (const pr of this.projectiles) {
          if (pr.kind === 'shock' || pr.dead) continue;
          if (U.overlap(atk.box, G.projBox(pr))) {
            pr.dead = true;
            G.fx.hit(pr.x, pr.y, false);
            G.audio.sfx('hit');
            this.addScore(10);
          }
        }
      }
      if (p.state === 'dead') return;
      // daño al jugador
      for (const e of targets) {
        if (e.dead) continue;
        const ab = e.attackBox();
        if (ab && U.overlap(ab, hurtBox)) { p.damage(ab.dmg, e.x, this); continue; }
        if (e.isBoss && !e.active) continue;
        const eb = e.box();
        const shr = { x: eb.x + 6, y: eb.y + 8, w: eb.w - 12, h: eb.h - 8 };
        if (U.overlap(shr, hurtBox)) p.damage(e.contact, e.x, this);
      }
      for (const pr of this.projectiles) {
        if (pr.dead) continue;
        if (U.overlap(G.projBox(pr), hurtBox)) {
          if (p.damage(pr.dmg, pr.x - pr.vx * 0.01, this)) {
            if (pr.kind !== 'shock') pr.dead = true;
            if (pr.kind === 'water' || pr.kind === 'uchimizu') G.fx.splash(pr.x, pr.y);
          }
        }
      }
      // objetos
      for (const it of this.pickups) {
        if (it.dead) continue;
        const ib = { x: it.x - 16, y: it.y - 34, w: 32, h: 34 };
        if (U.overlap(ib, pbox)) this.collect(it);
      }
    },
    collect(it) {
      const p = this.player;
      it.dead = true;
      const info = G.PICKUP_INFO[it.kind];
      switch (it.kind) {
        case 'meat': p.heal(p.kind === 'luffy' ? p.maxHp : 8); G.audio.sfx('heal'); break;
        case 'mikan': p.heal(5); G.audio.sfx('heal'); break;
        case 'coin': this.addScore(500); G.audio.sfx('coin'); break;
        case 'berry': this.addScore(50); G.audio.sfx('berry'); break;
        case 'bigcoin': this.addScore(2000); G.audio.sfx('coin'); break;
        case 'energy': p.energy = Math.min(p.maxEnergy, p.energy + 12); G.audio.sfx('energy'); break;
        case 'hat': this.lives++; G.audio.sfx('oneup'); break;
      }
      if (it.kind === 'berry') { G.fx.add({ type: 'spark', x: it.x, y: it.y - 12, life: 0.15, size: 9, points: 4, color: '#fff6c0', edge: '#ffb02e', layer: 2 }); return; }
      G.fx.text(it.x, it.y - 40, info.text, { size: 22, color: info.color, life: 0.8 });
      G.fx.add({ type: 'ring', x: it.x, y: it.y - 14, life: 0.3, r0: 6, r1: 34, w: 3, color: info.color, layer: 2 });
    },

    // ------------------------------------------------------------ dibujo
    render() {
      const ctx = G.ctx, S = G.renderScale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
      ctx.setTransform(S, 0, 0, S, 0, 0);
      switch (this.state) {
        case 'title': G.ui.drawTitle(ctx, this); G.post.vignette(ctx); break;
        case 'select': G.ui.drawSelect(ctx, this); G.post.vignette(ctx); break;
        case 'story': G.ui.drawStory(ctx, this); G.post.vignette(ctx); break;
        case 'play': case 'gameover': case 'victory':
          this.renderWorld(ctx);
          if (this.state === 'play') {
            if (this.banner && this.banner.t < 2.6) this.renderBanner(ctx);
            if (this.stamp) this.renderStamp(ctx);
            G.ui.drawHUD(ctx, this);
            G.ui.drawDialog(ctx, this);
            if (this.paused) G.ui.drawPause(ctx, this);
          }
          if (this.state === 'gameover') G.ui.drawGameOver(ctx, this);
          if (this.state === 'victory') this.renderVictory(ctx);
          break;
      }
      if (this.fade > 0) this.renderTransition(ctx);
      if (G.debug) this.renderDebug(ctx);
    },
    renderWorld(ctx) {
      const camX = Math.round(this.cam.x * 2) / 2, t = this.time, lv = this.level;
      ctx.save();
      // cámara: zoom de impacto + sacudida suave con trauma (ruido senoidal y leve giro)
      const tr = this.trauma * this.trauma, n = this.time * 30;
      const shx = (Math.sin(n * 1.3) + Math.sin(n * 2.7 + 1.7) * 0.5) * 14 * tr + this.kickX;
      const shy = (Math.sin(n * 1.7 + 3) + Math.sin(n * 3.1 + 0.4) * 0.5) * 10 * tr + this.kickY;
      const rot = Math.sin(n * 1.1 + 5) * 0.022 * tr;
      const z = Math.max(1, this.zoom) * (1 + 0.04 * tr);
      if (z !== 1) { ctx.translate(this.zoomFX, this.zoomFY); ctx.scale(z, z); ctx.translate(-this.zoomFX, -this.zoomFY); }
      ctx.translate(W / 2 + shx, H / 2 + shy); ctx.rotate(rot); ctx.translate(-W / 2, -H / 2);
      lv.drawSky(ctx, camX, t);
      lv.drawSea(ctx, camX, t);
      lv.drawFarTower(ctx, camX, t, lv.collapse);
      lv.drawMid(ctx, camX, t);
      lv.drawTowerBase(ctx, camX, t);
      lv.drawNear(ctx, camX, t);
      lv.drawTerrain(ctx, camX);
      for (const b of this.breakables) if (!b.broken && b.x > camX - 60 && b.x < camX + W + 60) G.drawBreakable(ctx, b, camX, t);
      G.fx.draw(ctx, camX, 0, 0);
      for (const it of this.pickups) G.drawPickup(ctx, it, camX);
      if (this.boss instanceof G.Arlong && this.boss.chairX > camX - 100 && this.boss.chairX < camX + W + 100) {
        ctx.save(); ctx.translate(this.boss.chairX - camX + 20, G.Level.GY); ctx.scale(-1.1, 1.1); G.art.drawArlongChair(ctx); ctx.restore();
      }
      for (const e of this.props) if (e.x > camX - 150 && e.x < camX + W + 150) e.draw(ctx, camX);
      for (const e of this.enemies) if (e.x > camX - 150 && e.x < camX + W + 150) e.draw(ctx, camX);
      if (this.boss) this.boss.draw(ctx, camX);
      if (this.player) this.player.draw(ctx, camX, this);
      if (this.nami && this.state === 'victory') {
        const n = this.nami;
        ctx.save(); ctx.translate(n.x - camX, G.Level.GY); G.art.shadow(ctx, 15); ctx.scale(-1, 1);
        const pose = n.moving ? G.art.pose.run(n.t, 0.9) : Object.assign(G.art.pose.idle(n.t), { face: 'happy', aF: 0.5, eF: 1.6, aB: -0.4, eB: 1.2, head: -0.05 });
        G.art.drawNami(ctx, pose, n.t);
        ctx.restore();
      }
      for (const pr of this.projectiles) {
        ctx.save(); ctx.translate(pr.x - camX, pr.y);
        G.art.drawProjectile(ctx, pr, t);
        ctx.restore();
      }
      this.renderLights(ctx, camX, t);
      if (this.arena) lv.drawArenaWalls(ctx, camX, this.arena);
      lv.drawWater(ctx, camX, t);
      this.renderReflections(ctx, camX, t);
      G.fx.draw(ctx, camX, 0, 1);
      G.fx.draw(ctx, camX, 0, 2);
      lv.drawFront(ctx, camX, t);
      ctx.restore();
      if (this.stormK > 0.01) this.renderStorm(ctx, t);
      G.post.draw(ctx, this);
      G.fx.draw(ctx, camX, 0, 3);
    },
    // luz de braseros y farolillos que también ilumina a los personajes cercanos
    renderLights(ctx, camX, t) {
      if (G.lowFx) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const nk = G.nightK || 0;
      for (const b of this.breakables) {
        if (b.broken || b.x < camX - 140 || b.x > camX + W + 140) continue;
        const fl = 0.85 + Math.sin(t * 17 + b.x) * 0.08 + Math.sin(t * 7.3 + b.x) * 0.07;
        const isB = b.kind === 'brazier';
        const lx = b.x - camX, ly = isB ? b.y - 44 : b.y;
        const R = (isB ? 130 : 95) * (1 + nk * 0.25);
        const g = ctx.createRadialGradient(lx, ly, 6, lx, ly, R);
        g.addColorStop(0, `rgba(255,160,70,${(isB ? 0.2 : 0.12) * fl * (1 + nk * 0.6)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, R, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    // tormenta: cielo oscurecido, lluvia oblicua y relámpagos
    renderStorm(ctx, t) {
      const k = this.stormK;
      ctx.save();
      const sg = ctx.createLinearGradient(0, 0, 0, H);
      sg.addColorStop(0, `rgba(10,10,40,${0.45 * k})`); sg.addColorStop(1, `rgba(10,10,40,${0.15 * k})`);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      if (this.boltT > 0) {
        // relámpago quebrado y destello
        const a = this.boltT / 0.22;
        ctx.globalAlpha = a * 0.45; ctx.fillStyle = '#e8eeff'; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = Math.min(1, a * 1.6);
        let r = this.boltSeed;
        const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
        let x = this.boltX, y = 0;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.shadowColor = '#9fc8ff'; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(x, y);
        while (y < 230) { x += (rnd() - 0.5) * 60; y += 18 + rnd() * 22; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      // lluvia oblicua en dos capas de profundidad
      ctx.globalAlpha = k;
      for (const [n, sp, len, col, w] of [[70, 900, 16, 'rgba(170,190,255,.35)', 1], [40, 1300, 26, 'rgba(210,225,255,.5)', 1.6]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const x = ((i * 137.7 + t * sp * 0.3) % (W + 80)) - 40;
          const y = ((i * 71.3 + t * sp) % (H + 60)) - 30;
          ctx.moveTo(x, y); ctx.lineTo(x - len * 0.3, y + len);
        }
        ctx.stroke();
      }
      ctx.restore();
    },
    // reflejos invertidos y ondulantes de los personajes en las pozas
    renderReflections(ctx, camX, t) {
      if (G.lowFx) return;
      const WY = G.Level.WATER_Y;
      const ents = [this.player].concat(this.enemies.filter((e) => !(e instanceof G.Flyfish)));
      for (const p of this.level.pits) {
        if (p.x > camX + W || p.x + p.w < camX) continue;
        const near = ents.filter((e) => e && e.x > p.x - 60 && e.x < p.x + p.w + 60 && e.y < WY && e.y > WY - 220);
        if (!near.length) continue;
        ctx.save();
        ctx.beginPath(); ctx.rect(p.x - camX, WY + 2, p.w, H - WY); ctx.clip();
        ctx.globalAlpha = 0.32;
        G.reflecting = true;
        // varias franjas desplazadas para simular la ondulación
        for (let band = 0; band < 6; band++) {
          const y0 = WY + 2 + band * 9;
          ctx.save();
          ctx.beginPath(); ctx.rect(p.x - camX, y0, p.w, 9); ctx.clip();
          ctx.translate(Math.sin(t * 3 + band * 1.3) * (1.5 + band * 0.6), WY);
          ctx.scale(1, -0.28);
          ctx.translate(0, -WY);
          for (const e of near) e === this.player ? e.draw(ctx, camX, this) : e.draw(ctx, camX);
          ctx.restore();
        }
        G.reflecting = false;
        ctx.restore();
      }
    },
    // transición de iris (círculo que se cierra sobre el personaje), como en el anime clásico
    renderTransition(ctx) {
      const f = U.smooth(Math.min(1, this.fade));
      let cx = W / 2, cy = H / 2;
      if (this.player && (this.state === 'play' || this.state === 'gameover' || this.state === 'victory')) {
        cx = U.clamp(this.player.x - this.cam.x, 80, W - 80); cy = U.clamp(this.player.y - 50, 80, H - 80);
      }
      const R = Math.hypot(W, H) * (1 - f);
      ctx.save();
      ctx.fillStyle = '#0b0612';
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      if (R > 0.5) ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      if (R > 0.5) {
        ctx.strokeStyle = '#ffe14a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    },
    // sello que se estampa en pantalla (estilo manga)
    renderStamp(ctx) {
      const st = this.stamp, t = st.t;
      const k = t < 0.18 ? U.easeOutBack(t / 0.18) : 1;
      const a = t > 1.8 ? Math.max(0, 1 - (t - 1.8) / 0.4) : 1;
      const sc = t < 0.18 ? 2.2 - 1.2 * (t / 0.18) : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(W / 2, 250); ctx.rotate(-0.08); ctx.scale(sc * k, sc * k);
      ctx.fillStyle = '#c8202a'; ctx.strokeStyle = '#1a0e1e'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(-250, -46); ctx.lineTo(260, -52); ctx.lineTo(250, 48); ctx.lineTo(-260, 52); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff2d8'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-238, -36); ctx.lineTo(247, -41); ctx.lineTo(239, 38); ctx.lineTo(-248, 41); ctx.closePath(); ctx.stroke();
      G.ui.text(ctx, st.text, 0, -6, 66, '#fff2d8', 'center', '#1a0e1e', 'Bangers, Impact, sans-serif', 10);
      G.ui.text(ctx, st.sub, 0, 34, 20, '#ffd2a0', 'center', '#1a0e1e', 'Bangers, Impact, sans-serif', 5);
      ctx.restore();
    },
    renderBanner(ctx) {
      const b = this.banner, t = b.t;
      const a = t < 0.3 ? t / 0.3 : t > 2.1 ? (2.6 - t) / 0.5 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, 'rgba(10,4,20,0)'); g.addColorStop(0.5, 'rgba(10,4,20,.75)'); g.addColorStop(1, 'rgba(10,4,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 170, W, 120);
      const slide = (1 - U.easeOutCubic(Math.min(1, t / 0.4))) * 60;
      G.ui.text(ctx, b.title, W / 2 - slide, 214, 58, '#ffe14a', 'center', '#1a0e1e');
      G.ui.text(ctx, b.sub, W / 2 + slide, 262, 26, '#fff', 'center', '#1a0e1e');
      ctx.restore();
    },
    renderVictory(ctx) {
      G.ui.drawVictory(ctx, this);
      if (this.vicT > 1.3) {
        G.ui.panel(ctx, 60, 450, W - 120, 70, 14);
        G.ui.portrait(ctx, this.player.name, 104, 485, 30, this.time);
        G.ui.text(ctx, this.victoryLine, W / 2 + 30, 485, 26, '#ffe14a');
      }
    },
    renderDebug(ctx) {
      if (this.state !== 'play') return;
      const camX = this.cam.x, p = this.player;
      ctx.save();
      ctx.strokeStyle = 'lime'; ctx.lineWidth = 1;
      const b = U.box(p); ctx.strokeRect(b.x - camX, b.y, b.w, b.h);
      const a = p.attackBox(); if (a) { ctx.strokeStyle = 'red'; ctx.strokeRect(a.box.x - camX, a.box.y, a.box.w, a.box.h); }
      for (const e of this.enemies.concat(this.boss ? [this.boss] : [])) {
        const eb = e.box(); ctx.strokeStyle = 'yellow'; ctx.strokeRect(eb.x - camX, eb.y, eb.w, eb.h);
        const ab = e.attackBox(); if (ab) { ctx.strokeStyle = 'magenta'; ctx.strokeRect(ab.x - camX, ab.y, ab.w, ab.h); }
      }
      ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
      ctx.fillText(`x:${p.x.toFixed(0)} y:${p.y.toFixed(0)} st:${p.state} cam:${camX.toFixed(0)} en:${this.enemies.length} fps:${G.fps}`, 10, H - 10);
      ctx.restore();
    },
  };

  // ---------------------------------------------------------------- simulación determinista (pruebas)
  // G.sim(segundos, {right:true, attack:'tap'}) avanza el juego sin depender del tiempo real.
  G.sim = function (sec, inputs = {}, each) {
    const n = Math.round(sec / STEP);
    for (let i = 0; i < n; i++) {
      for (const k in inputs) {
        const v = inputs[k];
        const on = v === 'tap' ? i === 0 : v === 'mash' ? i % 8 === 0 : !!v;
        I.set(k, 'sim', on);
      }
      Game.update(STEP);
      I.consume();
      if (each && each(i) === false) break;
    }
    for (const k in inputs) I.set(k, 'sim', false);
    return Game;
  };

  // ---------------------------------------------------------------- arranque
  if (G.params.has('bot')) { const s = document.createElement('script'); s.src = 'tests/bot.js'; document.body.appendChild(s); }
  document.addEventListener('visibilitychange', () => { G.slowSecs = 0; G.fastSecs = 0; });
  if (G.params.has('low')) G.lowFx = true;
  function boot() {
    const ch = G.params.get('char');
    if (ch === 'luffy' || ch === 'daniela') { Game.chosen = ch; Game.newGame(ch); }
    else Game.setState('title');
    let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0;
    function frame(now) {
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.25) dt = 0.25;
      fpsT += dt; fpsN++;
      if (fpsT >= 1) {
        G.fps = fpsN; fpsN = 0; fpsT = 0;
        // calidad adaptativa: si va lento varios segundos seguidos, se apagan los efectos caros
        // (se ignora con la página oculta: el navegador limita los fotogramas en segundo plano)
        if (Game.state === 'play' && !G.freeze && !document.hidden) {
          G.slowSecs = G.fps < 45 ? (G.slowSecs || 0) + 1 : 0;
          G.fastSecs = G.fps >= 56 ? (G.fastSecs || 0) + 1 : 0;
          if (G.slowSecs >= 3 && !G.lowFx) { G.lowFx = true; G.fastSecs = 0; G.lowFxCount = (G.lowFxCount || 0) + 1; console.info('Calidad reducida para mantener la fluidez'); }
          if (G.lowFx && G.fastSecs >= 8 && (G.lowFxCount || 0) < 2 && !G.params.has('low')) { G.lowFx = false; G.slowSecs = 0; console.info('Calidad completa restaurada'); }
        }
      }
      acc += dt;
      G.pollGamepads();
      let steps = 0;
      if (G.freeze) acc = 0;   // depuración: congela la simulación pero sigue dibujando
      while (acc >= STEP && steps < 5) {
        try { Game.update(STEP); } catch (err) { console.error(err); G.lastError = err; }
        I.consume();
        acc -= STEP; steps++;
      }
      if (steps >= 5) acc = 0;
      try { Game.render(); } catch (err) { console.error(err); G.lastError = err; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  // espera a las fuentes (máx. 1,5 s; sin conexión se usan las de respaldo)
  const bootOnce = () => { if (G.booted) return; G.booted = true; boot(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(bootOnce, bootOnce);
  setTimeout(bootOnce, 1500);
})();
