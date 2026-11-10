export type CoreState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'reasoning'
  | 'speaking'
  | 'executing'
  | 'vision'
  | 'happy'
  | 'alert'
  | 'error'
  | 'offline';

export type VoicePanelState =
  | 'idle'
  | 'listening'
  | 'speech_detected'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'executing'
  | 'alert'
  | 'error'
  | 'offline';

export interface StateConfig {
  label: string;
  primaryRGB: string;
  accentRGB: string;
  textGlow: string;
  waveformSpeed: number;
  baseHeight: number;
  maxHeight: number;
  amberMix: number;
  isError?: boolean;
  isOffline?: boolean;
}

export interface VoiceStateInfo {
  title: string;
  description: string;
  primaryRGB: string;
  accentRGB: string;
  waveSpeed: number;
  isAmber?: boolean;
  isError?: boolean;
  isOffline?: boolean;
}

export const STATE_CONFIGS: Record<CoreState, StateConfig> = {
  idle: {
    label: 'JARVIS ONLINE',
    primaryRGB: '34, 211, 238', // cyan-400
    accentRGB: '56, 189, 248', // sky-400
    textGlow: '0 0 14px rgba(34, 211, 238, 0.9), 0 0 28px rgba(6, 182, 212, 0.6)',
    waveformSpeed: 1.0,
    baseHeight: 8,
    maxHeight: 28,
    amberMix: 0.0,
  },
  listening: {
    label: 'LISTENING...',
    primaryRGB: '34, 211, 238',
    accentRGB: '255, 255, 255',
    textGlow: '0 0 12px rgba(34, 211, 238, 0.9), 0 0 25px rgba(56, 189, 248, 0.6)',
    waveformSpeed: 2.2,
    baseHeight: 8,
    maxHeight: 30,
    amberMix: 0.0,
  },
  thinking: {
    label: 'PROCESSING...',
    primaryRGB: '34, 211, 238',
    accentRGB: '147, 197, 253',
    textGlow: '0 0 12px rgba(34, 211, 238, 0.8), 0 0 20px rgba(147, 197, 253, 0.5)',
    waveformSpeed: 3.0,
    baseHeight: 8,
    maxHeight: 28,
    amberMix: 0.05,
  },
  reasoning: {
    label: 'ANALYZING...',
    primaryRGB: '56, 189, 248',
    accentRGB: '34, 211, 238',
    textGlow: '0 0 12px rgba(56, 189, 248, 0.85), 0 0 22px rgba(34, 211, 238, 0.5)',
    waveformSpeed: 2.0,
    baseHeight: 8,
    maxHeight: 26,
    amberMix: 0.0,
  },
  speaking: {
    label: 'SPEAKING...',
    primaryRGB: '34, 211, 238',
    accentRGB: '255, 255, 255',
    textGlow: '0 0 15px rgba(34, 211, 238, 0.95), 0 0 28px rgba(6, 182, 212, 0.7)',
    waveformSpeed: 2.8,
    baseHeight: 8,
    maxHeight: 34,
    amberMix: 0.0,
  },
  executing: {
    label: 'EXECUTING COMMAND',
    primaryRGB: '34, 211, 238',
    accentRGB: '96, 165, 250',
    textGlow: '0 0 12px rgba(34, 211, 238, 0.85), 0 0 22px rgba(96, 165, 250, 0.6)',
    waveformSpeed: 3.5,
    baseHeight: 10,
    maxHeight: 30,
    amberMix: 0.1,
  },
  vision: {
    label: 'SCANNING ENVIRONMENT',
    primaryRGB: '56, 189, 248',
    accentRGB: '34, 211, 238',
    textGlow: '0 0 14px rgba(56, 189, 248, 0.9), 0 0 24px rgba(34, 211, 238, 0.5)',
    waveformSpeed: 2.5,
    baseHeight: 8,
    maxHeight: 28,
    amberMix: 0.0,
  },
  happy: {
    label: 'SYSTEMS OPTIMIZED',
    primaryRGB: '34, 211, 238',
    accentRGB: '255, 255, 255',
    textGlow: '0 0 16px rgba(34, 211, 238, 1.0), 0 0 30px rgba(56, 189, 248, 0.8)',
    waveformSpeed: 2.2,
    baseHeight: 10,
    maxHeight: 32,
    amberMix: 0.15,
  },
  alert: {
    label: 'ALERT DETECTED',
    primaryRGB: '245, 158, 11', // amber-500
    accentRGB: '251, 191, 36', // amber-400
    textGlow: '0 0 14px rgba(245, 158, 11, 0.9), 0 0 28px rgba(251, 191, 36, 0.6)',
    waveformSpeed: 4.0,
    baseHeight: 12,
    maxHeight: 32,
    amberMix: 0.85,
  },
  error: {
    label: 'SYSTEM ERROR',
    primaryRGB: '239, 68, 68', // red-500
    accentRGB: '248, 113, 113', // red-400
    textGlow: '0 0 14px rgba(239, 68, 68, 0.9), 0 0 28px rgba(248, 113, 113, 0.6)',
    waveformSpeed: 4.5,
    baseHeight: 10,
    maxHeight: 30,
    amberMix: 0.0,
    isError: true,
  },
  offline: {
    label: 'SYSTEM OFFLINE',
    primaryRGB: '100, 116, 139', // slate-500
    accentRGB: '71, 85, 105', // slate-600
    textGlow: '0 0 4px rgba(100, 116, 139, 0.4)',
    waveformSpeed: 0.2,
    baseHeight: 3,
    maxHeight: 4,
    amberMix: 0.0,
    isOffline: true,
  },
};

export const VOICE_STATE_PROFILES: Record<VoicePanelState, VoiceStateInfo> = {
  idle: {
    title: 'VOICE INTERFACE',
    description: 'Say something or give a command.',
    primaryRGB: '34, 211, 238',
    accentRGB: '56, 189, 248',
    waveSpeed: 1.0,
  },
  listening: {
    title: 'LISTENING...',
    description: "I'm listening to you.",
    primaryRGB: '34, 211, 238',
    accentRGB: '255, 255, 255',
    waveSpeed: 2.5,
  },
  speech_detected: {
    title: 'VOICE DETECTED',
    description: 'Processing your speech.',
    primaryRGB: '34, 211, 238',
    accentRGB: '255, 255, 255',
    waveSpeed: 3.2,
  },
  transcribing: {
    title: 'TRANSCRIBING',
    description: 'Converting speech to text...',
    primaryRGB: '56, 189, 248',
    accentRGB: '34, 211, 238',
    waveSpeed: 2.8,
  },
  thinking: {
    title: 'UNDERSTANDING',
    description: 'Interpreting your request...',
    primaryRGB: '34, 211, 238',
    accentRGB: '147, 197, 253',
    waveSpeed: 2.6,
  },
  speaking: {
    title: 'JARVIS SPEAKING',
    description: 'Delivering voice response...',
    primaryRGB: '34, 211, 238',
    accentRGB: '255, 255, 255',
    waveSpeed: 3.0,
  },
  executing: {
    title: 'COMMAND EXECUTION',
    description: 'Performing requested action.',
    primaryRGB: '96, 165, 250',
    accentRGB: '34, 211, 238',
    waveSpeed: 3.2,
  },
  alert: {
    title: 'ATTENTION REQUIRED',
    description: 'Important notification.',
    primaryRGB: '245, 158, 11',
    accentRGB: '251, 191, 36',
    waveSpeed: 3.8,
    isAmber: true,
  },
  error: {
    title: 'VOICE ERROR',
    description: 'Check microphone permission or connection.',
    primaryRGB: '239, 68, 68',
    accentRGB: '248, 113, 113',
    waveSpeed: 0.5,
    isError: true,
  },
  offline: {
    title: 'VOICE OFFLINE',
    description: 'Voice service unavailable.',
    primaryRGB: '100, 116, 139',
    accentRGB: '71, 85, 105',
    waveSpeed: 0.1,
    isOffline: true,
  },
};
