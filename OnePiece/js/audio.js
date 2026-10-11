'use strict';
// Audio 100% sintetizado con WebAudio: efectos y música chiptune original.
(function () {
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  function freq(name) {
    const m = /^([A-G][#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Canciones: una ficha por corchea. '-' = silencio.
  const SONGS = {
    title: {
      bpm: 112, loop: true,
      lead: 'G4 - B4 D5 G5 - F#5 E5 D5 - B4 G4 A4 - - - C5 - E5 G5 F#5 - E5 D5 B4 - A4 F#4 G4 - - - ' +
            'E5 - D5 B4 C5 - A4 F#4 G4 - B4 D5 E5 - - - C5 - B4 A4 D5 - C5 A4 G4 - - - G4 - - -',
      bass: 'G2 D3 G2 D3 G2 D3 G2 D3 G2 D3 G2 D3 D2 A2 D2 A2 C3 G2 C3 G2 C3 G2 C3 G2 D3 A2 D3 A2 G2 D3 G2 - ' +
            'C3 G2 C3 G2 A2 E3 A2 E3 G2 D3 G2 D3 C3 G2 C3 G2 A2 E3 A2 E3 D3 A2 D3 A2 G2 D3 G2 D3 G2 - G2 -',
      drums: true,
    },
    stage: {
      bpm: 144, loop: true,
      lead: 'D5 - A4 D5 F5 E5 D5 C5 A#4 - A4 G4 A4 - - - G4 - A#4 D5 C5 A#4 A4 G4 A4 - C#5 E5 A5 - - - ' +
            'D5 - A4 D5 F5 E5 D5 F5 G5 - F5 E5 D5 - C5 A#4 A4 - G4 F4 E4 F4 G4 E4 D4 - - - D4 - - - ' +
            'F5 - F5 E5 F5 - A5 - G5 - E5 C5 G5 - - - F5 - D5 A#4 F5 - E5 D5 C#5 - E5 G5 A5 - - - ' +
            'A#5 - A5 G5 F5 - E5 D5 C5 - D5 E5 F5 - G5 A5 A#5 - A5 G5 F5 E5 D5 C#5 D5 - - - D5 - - -',
      bass: 'D2 D3 D2 D3 D2 D3 D2 D3 A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 G1 G2 G1 G2 G1 G2 G1 G2 A1 A2 A1 A2 A1 A2 C#3 A2 ' +
            'D2 D3 D2 D3 D2 D3 D2 D3 A#1 A#2 A#1 A#2 C2 C3 C2 C3 A1 A2 A1 A2 A1 A2 A1 A2 D2 D3 D2 D3 D2 - D2 - ' +
            'D2 D3 D2 D3 F2 F3 F2 F3 C2 C3 C2 C3 C2 C3 C2 C3 A#1 A#2 A#1 A#2 G1 G2 G1 G2 A1 A2 A1 A2 A1 A2 A1 A2 ' +
            'A#1 A#2 A#1 A#2 A#1 A#2 A#1 A#2 C2 C3 C2 C3 C2 C3 C2 C3 A#1 A#2 A#1 A#2 A1 A2 A1 A2 D2 D3 D2 D3 D2 - D2 -',
      drums: true,
    },
    boss: {
      bpm: 168, loop: true,
      lead: 'E5 E5 - E5 D5 E5 G5 E5 D5 - B4 - A4 - B4 - E5 E5 - E5 D5 E5 A5 G5 F#5 - D#5 - B4 - - - ' +
            'C5 C5 - C5 B4 C5 E5 C5 B4 - G4 - E4 - G4 - A4 - B4 - C5 - D5 - D#5 - F#5 - B5 - - - ' +
            'G5 - F#5 - E5 - B4 - C5 - D5 - E5 - - - A5 - G5 - F#5 - E5 - D#5 - F#5 - B4 - - - ' +
            'E5 - G5 - B5 - A5 G5 F#5 - E5 - D#5 - B4 - C5 - B4 - A4 - G4 - F#4 - D#4 - E4 - - -',
      bass: 'E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 E2 E3 D2 D3 D2 D3 E2 E3 E2 E3 E2 E3 E2 E3 B1 B2 B1 B2 B1 B2 B1 B2 ' +
            'C2 C3 C2 C3 C2 C3 C2 C3 E2 E3 E2 E3 E2 E3 E2 E3 A1 A2 A1 A2 A1 A2 A1 A2 B1 B2 B1 B2 B1 B2 B1 B2 ' +
            'E2 E3 E2 E3 G2 G3 G2 G3 C2 C3 C2 C3 C2 C3 C2 C3 A1 A2 A1 A2 C2 C3 C2 C3 B1 B2 B1 B2 B1 B2 B1 B2 ' +
            'E2 E3 E2 E3 E2 E3 E2 E3 B1 B2 B1 B2 B1 B2 B1 B2 A1 A2 A1 A2 A1 A2 A1 A2 B1 B2 B1 B2 E2 - E2 -',
      drums: true, heavy: true,
    },
    victory: {
      bpm: 132, loop: false,
      lead: 'C5 E5 G5 C6 - G5 C6 - A#5 - A5 - G5 - C6 - - - - - - - -',
      bass: 'C3 - C3 - C3 - C3 - A#2 - A#2 - C3 - C3 - - - - - - - -',
      drums: false,
    },
    gameover: {
      bpm: 90, loop: false,
      lead: 'A4 - G#4 - G4 - F#4 - F4 - - - E4 - - - - - - -',
      bass: 'A2 - - - G#2 - - - G2 - - - E2 - - - - - - -',
      drums: false,
    },
  };
  for (const k in SONGS) {
    SONGS[k].leadN = SONGS[k].lead.trim().split(/\s+/);
    SONGS[k].bassN = SONGS[k].bass.trim().split(/\s+/);
  }

  const A = G.audio = {
    ctx: null, muted: false, cur: null, wanted: null,
    unlock() {
      G.userActed = true;
      if (!this.ctx) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return;
          this.ctx = new AC();
          this.master = this.ctx.createGain();
          this.master.gain.value = this.muted ? 0 : 0.55;
          this.master.connect(this.ctx.destination);
          this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
          this.musBus = this.ctx.createGain(); this.musBus.gain.value = 0.42; this.musBus.connect(this.master);
          const len = this.ctx.sampleRate * 1;
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ctx = null; return; }
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.wanted && !this.cur) this.playMusic(this.wanted);
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
    },
    tone(f, dur, type = 'square', vol = 0.2, slideTo = 0, delay = 0, bus) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || this.sfxBus);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur, vol = 0.3, filt = 2000, type = 'lowpass', delay = 0, bus, q = 1) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = filt; f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },
    sfx(name) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'jump': this.tone(260, 0.14, 'square', 0.08, 560); break;
        case 'djump': this.tone(380, 0.14, 'triangle', 0.12, 820); this.noise(0.1, 0.08, 3000, 'highpass'); break;
        case 'land': this.noise(0.08, 0.12, 400); break;
        case 'stretch': this.tone(180, 0.09, 'sine', 0.22, 520); this.tone(520, 0.12, 'sine', 0.16, 220, 0.09); this.noise(0.1, 0.1, 1800, 'bandpass'); break;
        case 'kick': this.noise(0.09, 0.25, 1200, 'bandpass', 0, null, 0.8); this.tone(160, 0.07, 'square', 0.08, 80); break;
        case 'whoosh': this.noise(0.12, 0.18, 2500, 'bandpass', 0, null, 1.5); break;
        case 'hit': { const k = 0.85 + Math.random() * 0.3; this.tone(220 * k, 0.12, 'square', 0.16, 55); this.noise(0.12, 0.3, 1500 * k); this.tone(90, 0.08, 'sine', 0.25, 40); break; }
        case 'bighit': this.tone(160, 0.25, 'sawtooth', 0.2, 40); this.noise(0.3, 0.45, 900); this.tone(70, 0.2, 'sine', 0.35, 30); break;
        case 'berry': this.tone(1568 + Math.random() * 200, 0.06, 'square', 0.06); break;
        case 'enemyDie': [523, 392, 330, 262].forEach((f, i) => this.tone(f, 0.09, 'square', 0.1, 0, i * 0.05)); this.noise(0.25, 0.2, 700); break;
        case 'hurt': this.tone(420, 0.3, 'sawtooth', 0.15, 110); this.noise(0.15, 0.2, 1200); break;
        case 'coin': this.tone(988, 0.07, 'square', 0.09); this.tone(1319, 0.18, 'square', 0.09, 0, 0.06); break;
        case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.15, 0, i * 0.06)); break;
        case 'energy': [784, 988, 1175].forEach((f, i) => this.tone(f, 0.1, 'sine', 0.16, 0, i * 0.05)); break;
        case 'oneup': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.1, 'square', 0.1, 0, i * 0.08)); break;
        case 'special': this.tone(200, 0.4, 'sawtooth', 0.12, 900); this.noise(0.4, 0.15, 3000, 'bandpass'); break;
        case 'splash': this.noise(0.35, 0.3, 900); this.noise(0.2, 0.12, 4000, 'highpass', 0.03); break;
        case 'break': this.noise(0.18, 0.3, 2400, 'bandpass'); this.tone(1400, 0.1, 'triangle', 0.08, 2200, 0.02); break;
        case 'roar': this.tone(110, 0.8, 'sawtooth', 0.22, 60); this.tone(116, 0.8, 'square', 0.1, 55); this.noise(0.8, 0.2, 500); break;
        case 'slash': this.noise(0.16, 0.25, 4000, 'highpass'); this.tone(900, 0.1, 'sawtooth', 0.05, 300); break;
        case 'throw': this.noise(0.1, 0.15, 3000, 'bandpass'); break;
        case 'spit': this.tone(300, 0.1, 'sine', 0.15, 900); this.noise(0.1, 0.1, 2000, 'bandpass'); break;
        case 'explode': this.noise(0.9, 0.55, 600); this.tone(90, 0.7, 'sawtooth', 0.2, 30); break;
        case 'select': this.tone(660, 0.06, 'square', 0.08); break;
        case 'confirm': this.tone(523, 0.08, 'square', 0.1); this.tone(1047, 0.16, 'square', 0.1, 0, 0.07); break;
        case 'pause': this.tone(880, 0.08, 'triangle', 0.12); this.tone(660, 0.1, 'triangle', 0.12, 0, 0.08); break;
        case 'text': this.tone(700 + Math.random() * 120, 0.03, 'square', 0.03); break;
        case 'alert': this.tone(1200, 0.08, 'square', 0.1); this.tone(1200, 0.08, 'square', 0.1, 0, 0.12); break;
        case 'stuck': this.tone(140, 0.3, 'square', 0.18, 90); this.noise(0.3, 0.35, 700); break;
        case 'step': this.noise(0.05, 0.05, 600); break;
        case 'thunder': this.noise(1.6, 0.5, 300); this.noise(0.25, 0.4, 2500, 'bandpass'); this.tone(45, 1.4, 'sawtooth', 0.12, 30); break;
        default: break;
      }
    },
    // -------------------------------------------------------------- música
    playMusic(name) {
      this.wanted = name;
      if (!this.ctx) return;
      if (this.cur === name) return;
      this.stopMusic();
      this.wanted = name;
      const song = SONGS[name];
      if (!song) return;
      this.cur = name;
      this.song = song;
      this.step = 0;
      this.stepDur = 60 / song.bpm / 2;
      this.nextTime = this.ctx.currentTime + 0.06;
      this.timer = setInterval(() => this._tick(), 25);
    },
    stopMusic() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null; this.cur = null; this.wanted = null;
    },
    _tick() {
      if (!this.ctx || !this.song) return;
      const s = this.song;
      while (this.nextTime < this.ctx.currentTime + 0.15) {
        const len = s.leadN.length;
        if (this.step >= len) {
          if (s.loop) this.step = 0; else { this.stopMusic(); return; }
        }
        const t = this.nextTime - this.ctx.currentTime;
        const ln = s.leadN[this.step], bn = s.bassN[this.step % s.bassN.length];
        if (ln && ln !== '-') {
          // nota larga si las siguientes son silencios
          let hold = 1;
          while (hold < 4 && s.leadN[this.step + hold] === '-') hold++;
          const d = this.stepDur * hold * 0.92;
          this.tone(freq(ln), d, 'square', 0.055, 0, t, this.musBus);
          this.tone(freq(ln) * 1.005, d, 'triangle', 0.04, 0, t, this.musBus);
        }
        if (bn && bn !== '-') this.tone(freq(bn), this.stepDur * 0.9, 'triangle', s.heavy ? 0.2 : 0.16, 0, t, this.musBus);
        if (s.drums) {
          if (this.step % 2 === 1) this.noise(0.04, 0.05, 7000, 'highpass', t, this.musBus);
          if (this.step % 4 === 0) { this.tone(130, 0.11, 'sine', s.heavy ? 0.3 : 0.22, 45, t, this.musBus); }
          if (this.step % 8 === 4) this.noise(0.12, s.heavy ? 0.16 : 0.11, 1800, 'bandpass', t, this.musBus);
        }
        this.nextTime += this.stepDur;
        this.step++;
      }
    },
  };
})();
