// ============================================================================
// Notification Sound Utility
// ============================================================================

export type NotificationSoundType = 'gentle' | 'pop' | 'chime' | 'ding' | 'subtle' | 'system' | 'owlivion' | 'whisper' | 'call' | 'moonlight';

// Audio context for Web Audio API
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play notification sound using Web Audio API
 * Real audio files for signature sounds with synthesized fallback
 */
export function playNotificationSound(soundType: NotificationSoundType, volume: number = 0.7) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Configure sound based on type
    switch (soundType) {
      case 'call':
        // Special handling for Owlivion Signature - use REAL owl sound!
        playRealOwlSound(volume);
        return;

      case 'moonlight':
        // Moonlight Chime - Crystal clear notes with owl theme
        playMoonlightChime(ctx, now, volume);
        return;
    }

    // Create oscillator and gain node for other sounds
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configure sound based on type
    switch (soundType) {
      case 'gentle':
        // Soft, professional notification (C major chord)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.setValueAtTime(659.25, now + 0.05); // E5
        gainNode.gain.setValueAtTime(volume * 0.6, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
        break;

      case 'pop':
        // Quick pop sound
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        oscillator.start(now);
        oscillator.stop(now + 0.15);
        break;

      case 'chime':
        // Melodic chime (ascending notes)
        playChimeSequence(ctx, now, volume);
        return; // Early return as sequence handles its own timing

      case 'ding':
        // Classic ding sound (bell-like)
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(1200, now);
        gainNode.gain.setValueAtTime(volume * 0.8, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
        oscillator.start(now);
        oscillator.stop(now + 0.8);
        break;

      case 'subtle':
        // Very soft, minimal notification
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, now); // A4
        gainNode.gain.setValueAtTime(volume * 0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        oscillator.start(now);
        oscillator.stop(now + 0.3);
        break;

      case 'system':
        // System beep (fallback to browser's default)
        // Some browsers block this, so we use a simple beep instead
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(800, now);
        gainNode.gain.setValueAtTime(volume * 0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;

      case 'owlivion':
        // Owlivion Signature - Owl hoot inspired melody
        // "Hoo-hoo-hooo" pattern (Low → Mid → Low)
        playOwlivionSignature(ctx, now, volume);
        return; // Early return as sequence handles its own timing

      case 'whisper':
        // Night Whisper - Soft, mysterious, ambient
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(220, now); // A3 (low, mysterious)
        oscillator.frequency.exponentialRampToValueAtTime(330, now + 0.15); // E4 (slightly higher)
        oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.35); // Back to A3
        gainNode.gain.setValueAtTime(volume * 0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(volume * 0.5, now + 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        oscillator.start(now);
        oscillator.stop(now + 0.6);
        break;
    }
  } catch (error) {
    console.error('Failed to play notification sound:', error);
  }
}

/**
 * Play REAL owl sound from audio file
 * Falls back to synthesized version if file not available
 */
async function playRealOwlSound(volume: number) {
  try {
    // Try OGG first (better web compatibility), fallback to MP3
    const audio = new Audio('/sounds/owlivion-signature.ogg');
    audio.volume = Math.min(volume, 1.0); // Already boosted in file

    // Play the real owl sound
    await audio.play();

    console.log('🦉 Playing REAL owl sound (2 sec, optimized)!');
  } catch (error) {
    console.warn('Real owl sound failed, using synthesized fallback:', error);
    // Fallback to synthesized version
    const ctx = getAudioContext();
    playOwlCall(ctx, ctx.currentTime, volume);
  }
}

/**
 * Play a melodic chime sequence (three ascending notes)
 */
function playChimeSequence(ctx: AudioContext, startTime: number, volume: number) {
  const notes = [
    { freq: 523.25, time: 0 },     // C5
    { freq: 659.25, time: 0.12 },  // E5
    { freq: 783.99, time: 0.24 },  // G5
  ];

  notes.forEach(({ freq, time }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime + time);

    gain.gain.setValueAtTime(volume * 0.5, startTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + time + 0.4);

    osc.start(startTime + time);
    osc.stop(startTime + time + 0.4);
  });
}

/**
 * Owlivion Signature - Owl hoot inspired melody
 * Pattern: Low "Hoo" → Mid "hoo" → Low "hooo" (descending)
 */
function playOwlivionSignature(ctx: AudioContext, startTime: number, volume: number) {
  const hoots = [
    { freq: 293.66, time: 0, duration: 0.25 },      // D4 - First "Hoo"
    { freq: 349.23, time: 0.28, duration: 0.2 },    // F4 - Second "hoo" (higher)
    { freq: 293.66, time: 0.5, duration: 0.4 },     // D4 - Final "hooo" (longer, back to low)
  ];

  hoots.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime + time);

    // Smooth attack and decay for natural owl-like sound
    gain.gain.setValueAtTime(0.001, startTime + time);
    gain.gain.exponentialRampToValueAtTime(volume * 0.6, startTime + time + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + time + duration);

    osc.start(startTime + time);
    osc.stop(startTime + time + duration);
  });
}

/**
 * Owl's Call - PREMIUM QUALITY (THE SIGNATURE SOUND!)
 * Rich, layered owl call with harmonics and natural vibrato
 * OPTIMIZED FOR HUMAN PERCEPTION: 650-1100 Hz sweet spot!
 */
function playOwlCall(ctx: AudioContext, startTime: number, volume: number) {
  const calls = [
    { baseFreq: 880, time: 0, duration: 0.35 },      // A5 - PERFECT sweet spot!
    { baseFreq: 659.25, time: 0.4, duration: 0.5 },  // E5 - Harmonic interval
  ];

  calls.forEach(({ baseFreq, time, duration }) => {
    // MULTI-LAYERED SOUND for richness
    const layers = [
      { freq: baseFreq, volume: 1.0, type: 'sine' as OscillatorType },           // Fundamental
      { freq: baseFreq * 2, volume: 0.3, type: 'sine' as OscillatorType },       // 2nd harmonic
      { freq: baseFreq * 3, volume: 0.15, type: 'sine' as OscillatorType },      // 3rd harmonic
      { freq: baseFreq * 0.5, volume: 0.2, type: 'sine' as OscillatorType },     // Sub-bass
    ];

    layers.forEach(({ freq, volume: layerVol, type }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      // Vibrato (more pronounced for main frequency)
      lfo.frequency.setValueAtTime(5, startTime + time);
      lfoGain.gain.setValueAtTime(freq === baseFreq ? 12 : 6, startTime + time);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime + time);

      // Premium ADSR envelope
      const attackTime = 0.08;
      const decayTime = 0.1;
      const sustainLevel = volume * 1.5 * layerVol * 0.7;

      gain.gain.setValueAtTime(0.001, startTime + time);
      // Attack
      gain.gain.exponentialRampToValueAtTime(
        volume * 1.5 * layerVol,
        startTime + time + attackTime
      );
      // Decay to sustain
      gain.gain.exponentialRampToValueAtTime(
        sustainLevel,
        startTime + time + attackTime + decayTime
      );
      // Release
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        startTime + time + duration
      );

      osc.start(startTime + time);
      lfo.start(startTime + time);
      osc.stop(startTime + time + duration + 0.1);
      lfo.stop(startTime + time + duration + 0.1);
    });

    // Add subtle "breathiness" with filtered noise
    const noise = ctx.createBufferSource();
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < output.length; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.1;
    }
    noise.buffer = noiseBuffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(baseFreq, startTime + time);
    noiseFilter.Q.setValueAtTime(2, startTime + time);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volume * 0.15, startTime + time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + time + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(startTime + time);
    noise.stop(startTime + time + duration);
  });
}

/**
 * Moonlight Chime - Crystal clear notes with owl/moon theme
 * Ascending then descending melody
 */
function playMoonlightChime(ctx: AudioContext, startTime: number, volume: number) {
  const notes = [
    { freq: 523.25, time: 0 },      // C5
    { freq: 659.25, time: 0.12 },   // E5
    { freq: 783.99, time: 0.24 },   // G5 (peak - moonlight)
    { freq: 659.25, time: 0.36 },   // E5 (descending)
    { freq: 523.25, time: 0.48 },   // C5 (back to earth)
  ];

  notes.forEach(({ freq, time }, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime + time);

    // Softer for first note, louder at peak, softer again
    const noteVolume = index === 2 ? volume * 0.7 : volume * 0.5;
    gain.gain.setValueAtTime(noteVolume, startTime + time);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + time + 0.35);

    osc.start(startTime + time);
    osc.stop(startTime + time + 0.35);
  });
}

/**
 * Get human-readable name for sound type
 */
export function getSoundName(soundType: NotificationSoundType): string {
  const names: Record<NotificationSoundType, string> = {
    gentle: 'Yumuşak',
    pop: 'Pop',
    chime: 'Zil',
    ding: 'Ding',
    subtle: 'Minimal',
    system: 'Sistem',
    owlivion: '🦉 Owl Hoot',
    whisper: '🌙 Night Whisper',
    call: '🦉 Owlivion Signature',
    moonlight: '✨ Moonlight Chime',
  };
  return names[soundType];
}

/**
 * Get description for sound type
 */
export function getSoundDescription(soundType: NotificationSoundType): string {
  const descriptions: Record<NotificationSoundType, string> = {
    gentle: 'Profesyonel ve yumuşak bildirim sesi',
    pop: 'Kısa ve dikkat çekici',
    chime: 'Melodik üç notalı zil',
    ding: 'Klasik çan sesi',
    subtle: 'Çok hafif, minimal bildirim',
    system: 'Basit sistem sesi',
    owlivion: 'Baykuş temalı yumuşak melodi - Hoo-hoo-hooo',
    whisper: 'Gizemli gece fısıltısı - Sakin ve ambient',
    call: 'GERÇEK baykuş sesi - %100 authentic! ⭐',
    moonlight: 'Ay ışığı melodisi - Kristal berraklığında',
  };
  return descriptions[soundType];
}
