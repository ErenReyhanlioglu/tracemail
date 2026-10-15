// The part of the game's sound that runs before the game's code has loaded:
// the mute choice, and opening the audio device inside the envelope's click,
// as the reference does, so the device wakes during the intro and the first
// sounds are not late.

export const MUTE_KEY = "tm-mute";

export interface WebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

// An open, warmed audio device, or null when sound is off or unsupported.
export function openAudio(): AudioContext | null {
  if (readMuted()) return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    const a = new Ctor();
    const s = a.createBufferSource();
    s.buffer = a.createBuffer(1, 1, a.sampleRate);
    s.connect(a.destination);
    s.start();
    return a;
  } catch {
    return null;
  }
}
