// Sound: every effect is synthesized in WebAudio (no audio files), and
// the car radio is four procedural synthwave stations — NEON FM, SUNSET
// DRIVE, BAY BASS and PALM LO-FI — each a tiny step sequencer over
// oscillators and filtered noise. Audio starts on the first user gesture.

import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let radioGain = null;
  let sfxGain = null;
  let muted = false;
  let station = 0;
  let radioOn = true;
  let seqTimer = null;
  let step = 0;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  // 16-step patterns per station: bass notes (semitones from A2), chord
  // roots, arp offsets and a hat pattern. Small, but each station sounds
  // like itself: tempo, wave and brightness differ.
  const STATIONS = [
    { name: RADIO_STATIONS[0], bpm: 112, wave: 'sawtooth', bass: [0, 0, 7, 10, 0, 0, 7, 12], chords: [0, 3, 5, 7], arp: [0, 3, 7, 12, 7, 3], bright: 0.9 },
    { name: RADIO_STATIONS[1], bpm: 96, wave: 'triangle', bass: [0, 5, 3, 7, 0, 5, 3, 10], chords: [0, 5, 3, 7], arp: [0, 7, 12, 7], bright: 0.6 },
    { name: RADIO_STATIONS[2], bpm: 128, wave: 'square', bass: [0, 0, 0, 7, 0, 10, 0, 12], chords: [0, 0, 5, 7], arp: [0, 12, 0, 12], bright: 0.7 },
    { name: RADIO_STATIONS[3], bpm: 76, wave: 'sine', bass: [0, 3, 5, 3, 0, 3, 7, 5], chords: [0, 3, 7, 10], arp: [0, 3, 7, 10, 12, 10], bright: 0.4 },
  ];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      radioGain = ctx.createGain();
      radioGain.gain.value = 0.16;
      radioGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.5;
      sfxGain.connect(master);
      startEngine();
      startSiren();
      startRadio();
      return true;
    } catch {
      return false;
    }
  }

  function note(freq, time, dur, type, gain, dest) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g);
    g.connect(dest || sfxGain);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  function noise(time, dur, gain, freq) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(sfxGain);
    src.start(time);
  }

  function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function startEngine() {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    engineOsc.connect(f);
    f.connect(engineGain);
    engineGain.connect(sfxGain);
    engineOsc.start();
  }

  function startSiren() {
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(sfxGain);
    sirenOsc.start();
  }

  function radioStep() {
    if (!ctx || !radioOn || muted) return;
    const st = STATIONS[station];
    const spb = 60 / st.bpm / 4;
    const now = ctx.currentTime + 0.05;
    const s = step % 16;
    const bassNote = st.bass[Math.floor(s / 2)] + 45;
    if (s % 2 === 0) note(midi(bassNote), now, spb * 1.8, st.wave, 0.5 * st.bright, radioGain);
    if (s % 4 === 0) {
      const root = st.chords[Math.floor(s / 4)] + 57;
      note(midi(root), now, spb * 3.6, 'triangle', 0.14, radioGain);
      note(midi(root + 7), now, spb * 3.6, 'triangle', 0.10, radioGain);
    }
    const arpNote = st.arp[s % st.arp.length] + 69;
    if (s % 2 === 1) note(midi(arpNote), now, spb * 0.9, 'sine', 0.16, radioGain);
    if (s % 4 === 2) noise(now, 0.03, 0.10, 6000);
    step += 1;
    seqTimer = setTimeout(radioStep, spb * 1000);
  }

  function startRadio() {
    if (seqTimer) clearTimeout(seqTimer);
    step = 0;
    radioStep();
  }

  function sfx(name) {
    if (!ctx || muted) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'shot':
        noise(now, 0.09, 0.5, 1800);
        note(180, now, 0.06, 'square', 0.2);
        break;
      case 'crash':
        noise(now, 0.25, 0.4, 400);
        break;
      case 'pickup-cash':
        note(880, now, 0.08, 'sine', 0.25);
        note(1320, now + 0.07, 0.12, 'sine', 0.25);
        break;
      case 'pickup-health':
        note(520, now, 0.1, 'sine', 0.25);
        note(780, now + 0.09, 0.14, 'sine', 0.25);
        break;
      case 'mission-complete':
        note(523, now, 0.12, 'triangle', 0.3);
        note(659, now + 0.1, 0.12, 'triangle', 0.3);
        note(784, now + 0.2, 0.2, 'triangle', 0.3);
        break;
      case 'mission-failed':
        note(330, now, 0.2, 'sawtooth', 0.2);
        note(220, now + 0.15, 0.3, 'sawtooth', 0.2);
        break;
      case 'checkpoint':
        note(1046, now, 0.1, 'sine', 0.3);
        break;
      case 'heli-down':
        noise(now, 0.6, 0.5, 300);
        note(110, now, 0.5, 'sawtooth', 0.3);
        break;
      case 'buy':
        note(660, now, 0.07, 'square', 0.2);
        note(990, now + 0.06, 0.1, 'square', 0.2);
        break;
      case 'click-empty':
        note(220, now, 0.05, 'square', 0.15);
        break;
      default:
        break;
    }
  }

  return {
    ensure,
    sfx,
    stationName() { return STATIONS[station].name; },
    stationCount() { return STATIONS.length; },
    nextStation() {
      station = (station + 1) % STATIONS.length;
      step = 0;
      return STATIONS[station].name;
    },
    setStation(i) {
      station = ((i % STATIONS.length) + STATIONS.length) % STATIONS.length;
      step = 0;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    setEngine(speed, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.05 + Math.min(0.12, Math.abs(speed) / 6000) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) / 6, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
      if (on) {
        const t = ctx.currentTime;
        sirenOsc.frequency.setValueAtTime(660, t);
        sirenOsc.frequency.linearRampToValueAtTime(880, t + 0.4);
        sirenOsc.frequency.linearRampToValueAtTime(660, t + 0.8);
      }
    },
  };
}
