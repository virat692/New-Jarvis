// Web Audio API and Indian English ("en-IN" / "hi-IN") "Charon" Voice Profile Manager for JARVIS HUD

export const JARVIS_VOICE_SETUP = {
  voiceName: 'Charon',
  languageCode: 'en-IN',
  fallbackVoices: ['Charon', 'Puck', 'Aoede'],
  systemInstruction:
    'Accent & Phonetics: You must strictly speak with an authentic, clear, and natural Indian English accent. Use standard Indian English phonetics, intonation, and rhythm (similar to a sophisticated Indian tech specialist). Avoid American rhoticity, flat US vowels, or Western drawls. Maintain clear Indian inflection across all spoken words. Always communicate in natural Indian English. When Hindi words or names are used, pronounce them with native Hindi phonetics.',
};

class JarvisAudioManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private isSpeaking: boolean = false;
  private externalSpeaking: boolean = false;
  private soundEnabled: boolean = true;
  private activeSpeechId: number = 0;
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private activeHtmlAudio: HTMLAudioElement | null = null;
  private wavBufferCache: Map<string, AudioBuffer> = new Map();
  private wavBase64Cache: Map<string, string> = new Map();
  private voiceName: string = 'Charon';
  private locale: string = 'en-IN';
  private unlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Pre-load system voices as early as possible for fallback
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.getVoices();
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
          };
        } catch {}
      }

      // Automatically unlock Web Audio API on the very first user click, tap, or keypress
      const unlockHandler = () => {
        this.unlock();
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
      window.addEventListener('touchstart', unlockHandler, { passive: true });
      window.addEventListener('click', unlockHandler, { passive: true });
    }
  }

  public getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ sampleRate: 24000 });
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Unlocks the browser's AudioContext and speechSynthesis during a synchronous user gesture.
   */
  public unlock() {
    try {
      const ctx = this.getContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        if (!this.unlocked) {
          const silentBuffer = ctx.createBuffer(1, 1, 24000);
          const source = ctx.createBufferSource();
          source.buffer = silentBuffer;
          source.connect(ctx.destination);
          source.start(0);
          this.unlocked = true;
        }
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
      }
    } catch {}
  }

  public setExternalSpeaking(speaking: boolean) {
    this.externalSpeaking = speaking;
  }

  public getVoiceName(): string {
    return this.voiceName;
  }

  public getLocale(): string {
    return this.locale;
  }

  public setSoundEnabled(val: boolean) {
    this.soundEnabled = val;
    if (!val) {
      this.cancelSpeech();
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  // Silent no-ops: all synthetic click/beep oscillator sounds removed so only clean JARVIS voice plays
  public playStateSound(_state: string) {}

  public playClick() {}

  public playBeep(_freq = 880, _duration = 0.05) {}

  /**
   * Selects the best available Indian English (en-IN) or Hindi (hi-IN) voice on the user's system
   * when falling back to browser SpeechSynthesis.
   */
  private selectIndianVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
    if (!voices || voices.length === 0) return undefined;

    const normLang = (v: SpeechSynthesisVoice) => (v.lang || '').replace('_', '-').toLowerCase();
    const normName = (v: SpeechSynthesisVoice) => (v.name || '').toLowerCase();

    // 1. Prioritize Hindi (hi-IN) male or Google Hindi voice
    const hindiMaleOrGoogle =
      voices.find(
        (v) =>
          normLang(v).startsWith('hi-in') &&
          (normName(v).includes('madhur') ||
            normName(v).includes('hemant') ||
            normName(v).includes('male') ||
            normName(v).includes('google'))
      ) ||
      voices.find((v) => normLang(v).startsWith('hi') || normName(v).includes('hindi'));
    if (hindiMaleOrGoogle) return hindiMaleOrGoogle;

    // 2. Fallback to Indian English (en-IN) male voice
    const indianMale = voices.find(
      (v) =>
        (normLang(v).startsWith('en-in') || normName(v).includes('india')) &&
        (normName(v).includes('prabhat') ||
          normName(v).includes('ravi') ||
          normName(v).includes('male') ||
          normName(v).includes('rishi') ||
          normName(v).includes('google'))
    );
    if (indianMale) return indianMale;

    const anyIndianEnglish = voices.find(
      (v) =>
        normLang(v).startsWith('en-in') ||
        normName(v).includes('india') ||
        normName(v).includes('ravi') ||
        normName(v).includes('prabhat') ||
        normName(v).includes('rishi') ||
        normName(v).includes('neerja') ||
        normName(v).includes('heera')
    );
    if (anyIndianEnglish) return anyIndianEnglish;

    return (
      voices.find(
        (v) =>
          normLang(v).startsWith('en') &&
          !normLang(v).includes('us') &&
          !normName(v).includes('united states') &&
          !normName(v).includes('us english')
      ) || voices[0]
    );
  }

  /**
   * Plays a base64-encoded 24kHz 16-bit mono WAV file from Gemini TTS ('Charon' voice)
   * using Web Audio API (with HTMLAudioElement fallback).
   */
  public async playWavBase64(
    base64Wav: string,
    speechId: number,
    cacheKey?: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<boolean> {
    if (this.activeSpeechId !== speechId || !this.soundEnabled) return false;

    try {
      const ctx = this.getContext();
      if (ctx) {
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        let audioBuffer = cacheKey ? this.wavBufferCache.get(cacheKey) : undefined;
        if (!audioBuffer) {
          const binaryString = window.atob(base64Wav);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          try {
            audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
          } catch {
            // Fallback manual PCM decode if headerless
            const offset =
              len > 44 &&
              bytes[0] === 0x52 &&
              bytes[1] === 0x49 &&
              bytes[2] === 0x46 &&
              bytes[3] === 0x46
                ? 44
                : 0;
            const sampleCount = Math.floor((len - offset) / 2);
            audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
            const channelData = audioBuffer.getChannelData(0);
            const view = new DataView(bytes.buffer, offset, sampleCount * 2);
            for (let i = 0; i < sampleCount; i++) {
              channelData[i] = view.getInt16(i * 2, true) / 32768.0;
            }
          }

          // Apply 4ms (96 samples) smooth fade-in/fade-out to prevent any start/stop audio pop
          if (audioBuffer && audioBuffer.length > 200) {
            const ch = audioBuffer.getChannelData(0);
            const fadeSamples = 96;
            for (let i = 0; i < fadeSamples; i++) {
              const ramp = i / fadeSamples;
              ch[i] *= ramp;
              ch[ch.length - 1 - i] *= ramp;
            }
          }

          if (cacheKey && audioBuffer) {
            this.wavBufferCache.set(cacheKey, audioBuffer);
          }
        }

        if (this.activeSpeechId !== speechId || !audioBuffer) return false;

        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        gainNode.gain.value = 1.35; // Crisp, clear volume
        source.buffer = audioBuffer;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        if (this.analyser) {
          gainNode.connect(this.analyser);
        }

        this.activeBufferSource = source;
        this.isSpeaking = true;
        if (onStart) onStart();

        source.onended = () => {
          if (this.activeBufferSource === source) {
            this.activeBufferSource = null;
          }
          if (this.activeSpeechId === speechId) {
            this.isSpeaking = false;
            if (onEnd) onEnd();
          }
        };

        source.start(0);
        return true;
      }
    } catch {}

    // Fallback: HTMLAudioElement playback of data:audio/wav;base64
    try {
      if (this.activeSpeechId !== speechId) return false;
      const audio = new Audio(`data:audio/wav;base64,${base64Wav}`);
      audio.volume = 1.0;
      this.activeHtmlAudio = audio;
      this.isSpeaking = true;
      if (onStart) onStart();

      audio.onended = () => {
        if (this.activeHtmlAudio === audio) this.activeHtmlAudio = null;
        if (this.activeSpeechId === speechId) {
          this.isSpeaking = false;
          if (onEnd) onEnd();
        }
      };
      audio.onerror = () => {
        if (this.activeHtmlAudio === audio) this.activeHtmlAudio = null;
        if (this.activeSpeechId === speechId) {
          this.isSpeaking = false;
          if (onEnd) onEnd();
        }
      };

      await audio.play();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Speaks text using Gemini's 'Charon' Indian English voice (via /api/jarvis/tts or pre-supplied WAV),
   * with automatic fallback to browser SpeechSynthesis if offline.
   */
  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void,
    preloadedWavBase64?: string | null
  ) {
    if (!this.soundEnabled) {
      if (onEnd) onEnd();
      return;
    }

    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^[#>*-\s]+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    this.cancelSpeech();
    this.unlock();
    const speechId = ++this.activeSpeechId;
    const cacheKey = cleanText.toLowerCase();

    const runSpeech = async () => {
      // 1. Check preloaded WAV or client-side cache
      const cachedB64 = preloadedWavBase64 || this.wavBase64Cache.get(cacheKey);
      if (cachedB64) {
        this.wavBase64Cache.set(cacheKey, cachedB64);
        const played = await this.playWavBase64(cachedB64, speechId, cacheKey, onStart, onEnd);
        if (played) return;
      }

      // 2. Fetch real 'Charon' Hindi & Indian English WAV from /api/jarvis/tts
      try {
        const res = await fetch('/api/jarvis/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanText }),
        });

        if (this.activeSpeechId !== speechId) return;

        if (res.ok) {
          const data = await res.json();
          if (data?.audioWavBase64 && typeof data.audioWavBase64 === 'string') {
            this.wavBase64Cache.set(cacheKey, data.audioWavBase64);
            const played = await this.playWavBase64(
              data.audioWavBase64,
              speechId,
              cacheKey,
              onStart,
              onEnd
            );
            if (played) return;
          }
        }
      } catch {
        // Proceed to local speechSynthesis fallback
      }

      if (this.activeSpeechId !== speechId) return;

      // 3. Fallback to browser SpeechSynthesis (with 35ms delay after cancel() to avoid Chromium queue freeze)
      this.speakWithBrowserSynthesis(cleanText, speechId, onStart, onEnd, onError);
    };

    runSpeech();
  }

  private speakWithBrowserSynthesis(
    cleanText: string,
    speechId: number,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: () => void
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onStart) onStart();
      setTimeout(() => {
        if (this.activeSpeechId === speechId && onEnd) onEnd();
      }, 1500);
      return;
    }

    window.setTimeout(() => {
      if (this.activeSpeechId !== speechId) return;
      try {
        window.speechSynthesis.resume();
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'hi-IN';
        utterance.rate = 1.05;
        utterance.pitch = 0.92;
        utterance.volume = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const preferredIndianVoice = this.selectIndianVoice(voices);
        if (preferredIndianVoice) {
          utterance.voice = preferredIndianVoice;
          if (preferredIndianVoice.lang) {
            utterance.lang = preferredIndianVoice.lang;
          }
        }

        utterance.onstart = () => {
          if (this.activeSpeechId !== speechId) return;
          this.isSpeaking = true;
          if (onStart) onStart();
        };

        utterance.onend = () => {
          if (this.activeSpeechId !== speechId) return;
          this.isSpeaking = false;
          if (onEnd) onEnd();
        };

        utterance.onerror = () => {
          if (this.activeSpeechId !== speechId) return;
          this.isSpeaking = false;
          if (onError) onError();
          else if (onEnd) onEnd();
        };

        this.isSpeaking = true;
        window.speechSynthesis.speak(utterance);
      } catch {
        this.isSpeaking = false;
        if (onEnd) onEnd();
      }
    }, 35);
  }

  public cancelSpeech() {
    this.activeSpeechId++;
    this.isSpeaking = false;
    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch {}
      this.activeBufferSource = null;
    }
    if (this.activeHtmlAudio) {
      try {
        this.activeHtmlAudio.pause();
        this.activeHtmlAudio.src = '';
      } catch {}
      this.activeHtmlAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  // Get audio energy level: returns natural syllabic modulation when speaking
  public getSpeakingVolume(time: number): number {
    if (!this.isSpeaking && !this.externalSpeaking) return 0;
    if (this.analyser && this.freqData && this.isSpeaking) {
      try {
        this.analyser.getByteFrequencyData(this.freqData);
        let sum = 0;
        for (let i = 0; i < this.freqData.length; i++) {
          sum += this.freqData[i];
        }
        const avg = sum / (this.freqData.length * 255);
        if (avg > 0.05) {
          return Math.min(1.0, 0.2 + avg * 1.6);
        }
      } catch {}
    }
    const base = Math.sin(time * 12) * 0.4 + Math.sin(time * 25) * 0.3 + 0.5;
    return Math.max(0.15, Math.min(1.0, base));
  }

  public cleanup() {
    this.cancelSpeech();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.analyser = null;
    }
  }
}

export const jarvisAudio = new JarvisAudioManager();
