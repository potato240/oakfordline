// All sound is synthesised at runtime - no audio files to load or ship.

let context = null;
let master = null;

// Browsers refuse to start audio without a user gesture, so this is called
// from the click that starts the game.
export function startAudio() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0.5;
    master.connect(context.destination);
  }

  if (context.state === 'suspended') context.resume();
  return true;
}

export function audioReady() {
  return context !== null && context.state === 'running';
}

// A struck bell: a few inharmonic partials over a fast exponential decay.
// Real bells are not harmonic, which is why a plain sine sounds like a beep
// and these ratios sound like metal.
const PARTIALS = [
  { ratio: 1.0, gain: 1.0 },
  { ratio: 2.76, gain: 0.55 },
  { ratio: 5.4, gain: 0.28 },
  { ratio: 8.93, gain: 0.14 },
];

export function playBell(volume = 1, frequency = 660) {
  if (!audioReady() || volume <= 0.001) return;

  const now = context.currentTime;
  const voice = context.createGain();
  voice.gain.value = volume * 0.32;
  voice.connect(master);

  for (const partial of PARTIALS) {
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * partial.ratio;

    const envelope = context.createGain();
    // Near-instant strike, then ring down.
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(partial.gain, now + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

    oscillator.connect(envelope);
    envelope.connect(voice);
    oscillator.start(now);
    oscillator.stop(now + 0.95);
  }

  // Let the voice node go once the tail has finished.
  window.setTimeout(() => voice.disconnect(), 1100);
}
