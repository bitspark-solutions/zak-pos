/**
 * Instant scan feedback: beep via expo-audio (SDK 54 replacement of expo-av).
 * A tiny pre-generated 1200Hz WAV lives at assets/sounds/beep.wav.
 * All failures are swallowed — a silent POS is better than a crash.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let audioModeConfigured = false;

function ensurePlayer(): AudioPlayer | null {
  try {
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/beep.wav'));
    }
    if (!audioModeConfigured) {
      audioModeConfigured = true;
      // Play over the silent ringer so shopkeepers hear scans in noisy shops.
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
    }
    return player;
  } catch {
    return null;
  }
}

export function playScanBeep(): void {
  const p = ensurePlayer();
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // ignore
  }
}
