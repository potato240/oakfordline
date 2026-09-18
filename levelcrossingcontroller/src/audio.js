// Minimal synthesised audio - no sound files, matching Oakford Line's own
// approach, but much smaller: just a warning ding and a crash thud.

let context = null;

export function startAudio() {
  if (!context) context = new (window.AudioContext || window.webkitAudioContext)();
  if (context.state === 'suspended') context.resume();
}

function tone(frequency, duration, gainPeak, type = 'sine', delaySeconds = 0) {
  if (!context) return;
  const start = context.currentTime + delaySeconds;

  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);

  const gain = context.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainPeak, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

export function playWarningDing() {
  tone(880, 0.5, 0.3, 'triangle');
  tone(1320, 0.5, 0.14, 'triangle', 0.06);
}

export function playCrash() {
  tone(90, 0.6, 0.5, 'sawtooth');
  tone(60, 0.7, 0.4, 'square', 0.05);
}

export function playCarPass() {
  tone(520, 0.12, 0.08, 'sine');
}
