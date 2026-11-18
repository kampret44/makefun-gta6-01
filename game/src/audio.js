export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let lastSiren = 0;
  let note = 0;
  let active = false;
  function boot() {
    if (context) { if (context.state === 'suspended') context.resume(); return; }
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.24;
    master.connect(context.destination);
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain).connect(master);
    engineOsc.start();
    const tones = [130.81, 164.81, 196, 220, 196, 164.81, 146.83, 174.61];
    musicTimer = window.setInterval(() => {
      if (!context || !active) return;
      const now = context.currentTime;
      const voice = context.createOscillator();
      const gain = context.createGain();
      voice.type = 'triangle';
      voice.frequency.value = tones[note++ % tones.length];
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      voice.connect(gain).connect(master);
      voice.start(now);
      voice.stop(now + 0.57);
    }, 430);
  }
  function ping(frequency, duration, wave = 'sine', volume = 0.13) {
    if (!context) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.52), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(now + duration + 0.03);
  }
  return {
    boot,
    setActive(value) {
      active = value;
      // Duck the master bus instead of cutting it: pausing fades the music and engine down.
      if (context && master) master.gain.setTargetAtTime(value ? 0.24 : 0.06, context.currentTime, 0.15);
    },
    engine(speed) {
      if (!context) return;
      engineOsc.frequency.setTargetAtTime(52 + Math.abs(speed) * 12, context.currentTime, 0.12);
      engineGain.gain.setTargetAtTime(Math.abs(speed) > 0.5 ? 0.025 + Math.abs(speed) * 0.0022 : 0, context.currentTime, 0.2);
    },
    siren(intensity) {
      if (intensity <= 0) return;
      const now = Date.now();
      if (now - lastSiren < 180) return;
      lastSiren = now;
      ping(480 + Math.sin(now / 230) * 160, 0.16, 'triangle', 0.025 * intensity);
    },
    gunshot() { ping(180, 0.11, 'square', 0.22); ping(71, 0.17, 'sawtooth', 0.13); },
    punch() { ping(115, 0.12, 'triangle', 0.17); },
    ui() { ping(620, 0.14, 'sine', 0.07); },
    mission() { ping(540, 0.28, 'triangle', 0.09); window.setTimeout(() => ping(780, 0.37, 'triangle', 0.08), 110); },
    // Drop every node of the closed context, so a later boot() builds fresh ones and
    // can never drive a dead oscillator or gain through a stale reference.
    stop() { active = false; if (musicTimer) { window.clearInterval(musicTimer); musicTimer = null; } if (context) context.close(); context = null; master = null; engineOsc = null; engineGain = null; note = 0; lastSiren = 0; },
  };
}
