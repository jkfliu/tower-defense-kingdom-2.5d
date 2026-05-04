// Procedural Web Audio sound manager. All sounds are synthesised — no audio files needed.

let _ctx = null;
let _muted = localStorage.getItem('sfx_muted') === '1';

function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (_ctx.state === 'suspended') _ctx.resume();
  return _ctx;
}

function tone(freq, endFreq, duration, volume = 0.18, type = 'sine') {
  if (_muted) return;
  const ac = ctx();
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, ac.currentTime + duration);
  const g = ac.createGain();
  g.gain.setValueAtTime(volume, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  g.connect(ac.destination);
  osc.connect(g);
  osc.start();
  osc.stop(ac.currentTime + duration + 0.05);
}

function filteredNoise(duration, cutoff, volume = 0.15) {
  if (_muted) return;
  const ac = ctx();
  const bufLen = Math.ceil(ac.sampleRate * duration);
  const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  filter.Q.value = 1.5;
  const g = ac.createGain();
  g.gain.setValueAtTime(volume, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  g.connect(ac.destination);
  src.connect(filter);
  filter.connect(g);
  src.start();
}

export const soundManager = {
  isMuted() { return _muted; },

  setMuted(val) {
    _muted = val;
    localStorage.setItem('sfx_muted', val ? '1' : '0');
  },

  playArrowShot() {
    // From tower-defense-kingdom: bowstring twang + whoosh
    if (_muted) return;
    try {
      const ac = ctx();
      const t  = ac.currentTime;

      const twang     = ac.createOscillator();
      const twangGain = ac.createGain();
      twang.type = 'triangle';
      twang.frequency.setValueAtTime(80 + Math.random() * 20, t);
      twang.frequency.exponentialRampToValueAtTime(40, t + 0.06);
      twangGain.gain.setValueAtTime(0.18, t);
      twangGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      twang.connect(twangGain);
      twangGain.connect(ac.destination);
      twang.start(t);
      twang.stop(t + 0.07);

      const frames = Math.floor(ac.sampleRate * 0.05);
      const buf    = ac.createBuffer(1, frames, ac.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2);
      const whoosh     = ac.createBufferSource();
      whoosh.buffer    = buf;
      const whooshGain = ac.createGain();
      whooshGain.gain.setValueAtTime(0.08, t);
      whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      whoosh.connect(whooshGain);
      whooshGain.connect(ac.destination);
      whoosh.start(t);
    } catch (_) {}
  },

  playOrbShot() {
    // From tower-defense-kingdom: soft descending sine (magic basic tier)
    if (_muted) return;
    try {
      const ac = ctx();
      const t  = ac.currentTime;
      const osc  = ac.createOscillator();
      const g = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t); osc.stop(t + 0.13);
    } catch (_) {}
  },

  playBombShot() {
    // Low thud / launch
    tone(90, 55, 0.10, 0.20, 'sine');
    filteredNoise(0.06, 300, 0.08);
  },

  playExplosion() {
    // From tower-defense-kingdom: booming sine sweep + noise burst
    if (_muted) return;
    try {
      const ac = ctx();
      const t  = ac.currentTime;

      const boomOsc  = ac.createOscillator();
      const boomGain = ac.createGain();
      boomOsc.type = 'sine';
      boomOsc.frequency.setValueAtTime(90, t);
      boomOsc.frequency.exponentialRampToValueAtTime(18, t + 0.45);
      boomGain.gain.setValueAtTime(0.81, t);
      boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      boomOsc.connect(boomGain);
      boomGain.connect(ac.destination);
      boomOsc.start(t);
      boomOsc.stop(t + 0.46);

      const dur    = 0.28;
      const frames = Math.floor(ac.sampleRate * dur);
      const buf    = ac.createBuffer(1, frames, ac.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 1.5);
      const src       = ac.createBufferSource();
      src.buffer      = buf;
      const noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0.315, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(noiseGain);
      noiseGain.connect(ac.destination);
      src.start(t);
    } catch (_) {}
  },

  playEnemyHit() {
    if (_muted) return;
    try {
      const ac = ctx();
      const t  = ac.currentTime;

      // Tick: very short low-passed noise
      const frames = Math.floor(ac.sampleRate * 0.05);
      const buf    = ac.createBuffer(1, frames, ac.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2);
      const src    = ac.createBufferSource();
      src.buffer   = buf;
      const filter = ac.createBiquadFilter();
      filter.type  = 'lowpass';
      filter.frequency.value = 600;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(filter); filter.connect(g); g.connect(ac.destination);
      src.start(t);

      // Subtle pitch drop
      const osc = ac.createOscillator();
      const og  = ac.createGain();
      osc.type  = 'sine';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.05);
      og.gain.setValueAtTime(0.05, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(og); og.connect(ac.destination);
      osc.start(t); osc.stop(t + 0.06);
    } catch (_) {}
  },

  playEnemyDeath() {
    // Thud impact: shaped noise burst + low pitch drop
    if (_muted) return;
    try {
      const ac = ctx();
      const t  = ac.currentTime;

      // Body thud — short noise burst with fast decay
      const dur    = 0.12;
      const frames = Math.floor(ac.sampleRate * dur);
      const buf    = ac.createBuffer(1, frames, ac.sampleRate);
      const data   = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
      const src       = ac.createBufferSource();
      src.buffer      = buf;
      const filter    = ac.createBiquadFilter();
      filter.type     = 'lowpass';
      filter.frequency.value = 400;
      const noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0.28, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter); filter.connect(noiseGain); noiseGain.connect(ac.destination);
      src.start(t);

      // Low grunt tone: sine dropping fast
      const osc  = ac.createOscillator();
      const g    = ac.createGain();
      osc.type   = 'sine';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.10);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t); osc.stop(t + 0.11);
    } catch (_) {}
  },
};
