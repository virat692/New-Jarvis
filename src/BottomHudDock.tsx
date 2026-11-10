/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { CoreState } from './types';
import { jarvisAudio } from './audio';
import { ExternalChatEvent } from './ChatStream';

interface BottomHudDockProps {
  coreState: CoreState;
  onTriggerState: (state: CoreState, autoReturnDelay?: number, speakDefaultPhrase?: boolean) => void;
  onDispatchCommand: (event: ExternalChatEvent) => void;
  voiceTriggerCount?: number;
}

// Base envelope for the 19 elements on each wing (from inner near-mic to outer dots)
// Matches the exact twin-peak + outer-dots waveform profile in the reference HUD image
const WING_BASE_ENVELOPE = [
  0.32, // 0: inner-most bar next to mic circle
  0.54, // 1
  0.78, // 2
  0.96, // 3: main tall inner-middle peak
  0.84, // 4
  0.62, // 5
  0.42, // 6: dip between peaks
  0.58, // 7: secondary middle peak
  0.72, // 8
  0.55, // 9
  0.38, // 10
  0.48, // 11: outer-middle small peak
  0.34, // 12
  0.22, // 13: last short bar
  0.14, // 14: dot 1
  0.12, // 15: dot 2
  0.10, // 16: dot 3
  0.09, // 17: dot 4
  0.08, // 18: outer-most dot
];

export const BottomHudDock: React.FC<BottomHudDockProps> = ({
  coreState,
  onTriggerState,
  onDispatchCommand,
  voiceTriggerCount = 0,
}) => {
  const [inputText, setInputText] = useState('');
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [waveTick, setWaveTick] = useState(0);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastVoiceTriggerRef = useRef<number>(voiceTriggerCount);
  const hasWokenUpRef = useRef<boolean>(false);

  const isOffline = coreState === 'offline';

  // Smooth real-time animation tick for the left & right audio waveforms
  useEffect(() => {
    const interval = window.setInterval(() => {
      setWaveTick((t) => t + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const isSubmittingRef = useRef(false);

  const submitCommand = (rawText?: string) => {
    const text = (rawText ?? inputText).trim();
    if (!text) return;

    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 400);

    if (!rawText) {
      setInputText('');
    }

    hasWokenUpRef.current = true;
    jarvisAudio.unlock();

    // Ensure Jarvis is powered ON when user sends a command
    if (isOffline) {
      jarvisAudio.setSoundEnabled(true);
    }

    onDispatchCommand({
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userCommand: text,
    });
  };

  const stopMicRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListeningMic(false);
  };

  const startMicRecognition = () => {
    hasWokenUpRef.current = true;
    jarvisAudio.unlock();
    jarvisAudio.cancelSpeech();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      inputRef.current?.focus();
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'hi-IN';

      let latestTranscript = '';
      let silenceTimer: number | null = null;
      let submitted = false;

      const clearSilenceTimer = () => {
        if (silenceTimer !== null) {
          window.clearTimeout(silenceTimer);
          silenceTimer = null;
        }
      };

      const finishAndSubmit = () => {
        if (submitted) return;
        submitted = true;
        clearSilenceTimer();
        const finalMsg = latestTranscript.trim();
        if (finalMsg) {
          setIsListeningMic(false);
          setInputText('');
          try {
            rec.stop();
          } catch {}
          submitCommand(finalMsg);
        }
      };

      rec.onstart = () => {
        jarvisAudio.cancelSpeech();
        setIsListeningMic(true);
        onTriggerState('listening', undefined, false);
      };

      rec.onresult = (e: any) => {
        let combined = '';
        let hasFinal = false;
        for (let i = 0; i < e.results.length; i++) {
          combined += e.results[i][0].transcript;
          if (e.results[i].isFinal) hasFinal = true;
        }
        latestTranscript = combined.trim();
        setInputText(latestTranscript);

        clearSilenceTimer();
        if (latestTranscript) {
          silenceTimer = window.setTimeout(finishAndSubmit, hasFinal ? 280 : 600);
        }
      };

      rec.onerror = () => {
        clearSilenceTimer();
        setIsListeningMic(false);
        if (coreState !== 'offline') {
          onTriggerState('idle', undefined, false);
        }
        inputRef.current?.focus();
      };

      rec.onend = () => {
        clearSilenceTimer();
        setIsListeningMic(false);
        if (!submitted && latestTranscript.trim()) {
          submitted = true;
          const finalMsg = latestTranscript.trim();
          setInputText('');
          submitCommand(finalMsg);
        } else if (!submitted && coreState !== 'offline') {
          onTriggerState('idle', undefined, false);
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch {
      setIsListeningMic(false);
      inputRef.current?.focus();
    }
  };

  // Bottom-Center Master Mic Button: Toggles JARVIS ON or OFF
  const toggleJarvisOnOff = () => {
    jarvisAudio.unlock();

    if (isOffline || !hasWokenUpRef.current) {
      // Wake up JARVIS
      hasWokenUpRef.current = true;
      jarvisAudio.setSoundEnabled(true);
      onTriggerState('speaking', 4000, false);
      onDispatchCommand({
        id: `jarvis-on-${Date.now()}`,
        jarvisReply:
          'नमस्ते सर! जार्विस ऑनलाइन है। बताइए, आज मैं आपकी क्या मदद कर सकता हूँ?',
      });
    } else {
      // Turn JARVIS OFF (Standby / Offline Mode)
      stopMicRecognition();
      jarvisAudio.cancelSpeech();
      jarvisAudio.setSoundEnabled(false);
      onTriggerState('offline', undefined, false);
    }
  };

  // Pill Input Mic Button & Left HUD Voice Assistant Module: Toggles Voice Dictation
  const toggleVoiceMic = () => {
    hasWokenUpRef.current = true;
    jarvisAudio.unlock();

    if (isOffline) {
      jarvisAudio.setSoundEnabled(true);
      onTriggerState('listening', undefined, false);
    }

    if (isListeningMic) {
      stopMicRecognition();
      onTriggerState('idle', undefined, false);
      return;
    }

    startMicRecognition();
  };

  // Allow Left HUD "Voice Assistant" button to trigger voice mic directly
  useEffect(() => {
    if (voiceTriggerCount > lastVoiceTriggerRef.current) {
      lastVoiceTriggerRef.current = voiceTriggerCount;
      toggleVoiceMic();
    }
  }, [voiceTriggerCount]);

  // Compute dynamic height (in px) for a given wing bar index (0 = inner near mic, 18 = outer dot)
  const getWingBarHeight = (idx: number, side: 'left' | 'right') => {
    const baseEnv = WING_BASE_ENVELOPE[idx];
    if (idx >= 14) {
      // Outer 5 alignment dots
      return 3.5;
    }
    if (isOffline) {
      return Math.max(4, Math.round(baseEnv * 10));
    }

    const t = waveTick * 0.18;
    const phaseOffset = side === 'left' ? idx * 0.45 : idx * 0.45 + 0.6;
    const isActiveVoice =
      isListeningMic ||
      coreState === 'listening' ||
      coreState === 'speaking' ||
      coreState === 'thinking' ||
      coreState === 'executing';

    const dynamicMod = isActiveVoice
      ? 0.55 + Math.abs(Math.sin(t * 2.2 + phaseOffset) * Math.cos(t * 1.4 - idx * 0.3)) * 0.85
      : 0.78 + Math.sin(t + phaseOffset) * 0.22;

    const maxBarH = isActiveVoice ? 44 : 36;
    return Math.max(4, Math.min(46, Math.round(baseEnv * maxBarH * dynamicMod)));
  };

  // Status label inside the stepped pedestal ("STANDBY MODE" by default in idle, or current active mode)
  const modeLabel = isOffline
    ? 'JARVIS OFFLINE'
    : isListeningMic
    ? 'LISTENING MODE'
    : coreState === 'idle'
    ? 'STANDBY MODE'
    : coreState === 'listening'
    ? 'LISTENING MODE'
    : coreState === 'thinking'
    ? 'THINKING MODE'
    : coreState === 'reasoning'
    ? 'REASONING MODE'
    : coreState === 'speaking'
    ? 'VOICE ACTIVE'
    : coreState === 'executing'
    ? 'EXECUTING MODE'
    : coreState === 'vision'
    ? 'OPTICAL SCAN'
    : coreState === 'alert'
    ? 'ALERT MODE'
    : 'DIAGNOSTIC ERROR';

  return (
    <div className="absolute inset-x-0 bottom-0 h-[21.8%] z-30 pointer-events-none select-none flex flex-col justify-end items-center overflow-visible">
      {/* 
        1. UPPER FLOATING AUDIO WAVEFORM + CENTRAL GLOWING MICROPHONE CIRCLE (JARVIS ON/OFF MASTER BUTTON)
      */}
      <div className="relative z-20 flex items-center justify-center gap-3.5 mb-1.5 pointer-events-auto">
        {/* Left Waveform Wing (outer dots -> inner tall bars) */}
        <div className="flex items-center gap-[5px] h-11">
          {[...WING_BASE_ENVELOPE].reverse().map((_, revIdx) => {
            const origIdx = WING_BASE_ENVELOPE.length - 1 - revIdx;
            const isDot = origIdx >= 14;
            const h = getWingBarHeight(origIdx, 'left');
            return (
              <span
                key={`left-${origIdx}`}
                style={{
                  height: isDot ? '3.5px' : `${h}px`,
                  width: isDot ? '3.5px' : '3px',
                }}
                className={`rounded-full transition-all duration-75 ${
                  isOffline
                    ? 'bg-slate-600'
                    : isDot
                    ? 'bg-[#38e8ff] shadow-[0_0_6px_#00d8ff]'
                    : h > 24
                    ? 'bg-gradient-to-b from-[#38e8ff] via-[#b8faff] to-[#38e8ff] shadow-[0_0_10px_#00e5ff,0_0_18px_rgba(0,180,255,0.65)]'
                    : 'bg-[#22d3ee] shadow-[0_0_8px_#00d8ff]'
                }`}
              />
            );
          })}
        </div>

        {/* Central Glowing Cyan Microphone Button — Master JARVIS ON / OFF Toggle */}
        <button
          type="button"
          onClick={toggleJarvisOnOff}
          title={isOffline ? 'Turn JARVIS ON' : 'Turn JARVIS OFF'}
          aria-label={isOffline ? 'Turn JARVIS ON' : 'Turn JARVIS OFF'}
          className={`relative w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 border-[1.8px] ${
            isOffline
              ? 'border-slate-500/75 bg-slate-950/85 hover:border-[#38e8ff] shadow-[0_0_10px_rgba(15,23,42,0.8)] opacity-75 hover:opacity-100'
              : isListeningMic || coreState === 'speaking'
              ? 'border-white bg-[#002b5e]/85 shadow-[0_0_24px_#00e5ff,inset_0_0_14px_#00e5ff] scale-105'
              : 'border-[#38e8ff]/90 bg-[#011028]/75 hover:border-white shadow-[0_0_18px_rgba(0,216,255,0.55),inset_0_0_10px_rgba(0,195,255,0.3)]'
          }`}
        >
          {/* Classic Glowing Cyan Microphone Icon */}
          <svg
            viewBox="0 0 24 24"
            className={`w-6 h-6 transition-colors ${
              isOffline
                ? 'text-slate-400'
                : 'text-[#7ef9ff] drop-shadow-[0_0_8px_#00e5ff]'
            }`}
            fill="currentColor"
          >
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5.25 11a.75.75 0 0 1 1.5 0 5.25 5.25 0 0 0 10.5 0 .75.75 0 0 1 1.5 0 6.75 6.75 0 0 1-6 6.709V20.25h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.541A6.75 6.75 0 0 1 5.25 11Z"
            />
            {/* Diagonal OFF Slash Indicator when Jarvis is Turned OFF */}
            {isOffline && (
              <line
                x1="4"
                y1="4"
                x2="20"
                y2="20"
                stroke="#f87171"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>

        {/* Right Waveform Wing (inner tall bars -> outer dots) */}
        <div className="flex items-center gap-[5px] h-11">
          {WING_BASE_ENVELOPE.map((_, idx) => {
            const isDot = idx >= 14;
            const h = getWingBarHeight(idx, 'right');
            return (
              <span
                key={`right-${idx}`}
                style={{
                  height: isDot ? '3.5px' : `${h}px`,
                  width: isDot ? '3.5px' : '3px',
                }}
                className={`rounded-full transition-all duration-75 ${
                  isOffline
                    ? 'bg-slate-600'
                    : isDot
                    ? 'bg-[#38e8ff] shadow-[0_0_6px_#00d8ff]'
                    : h > 24
                    ? 'bg-gradient-to-b from-[#38e8ff] via-[#b8faff] to-[#38e8ff] shadow-[0_0_10px_#00e5ff,0_0_18px_rgba(0,180,255,0.65)]'
                    : 'bg-[#22d3ee] shadow-[0_0_8px_#00d8ff]'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 
        2. FULL-WIDTH STEPPED 'STANDBY MODE' PEDESTAL & BOTTOM HUD BORDER + INPUT PILL
      */}
      <div className="relative w-full h-[108px] flex flex-col justify-end items-center pointer-events-none">
        {/* Precision SVG reproducing the exact stepped pedestal, shoulder neon highlights, tick marks, and full-width bottom border */}
        <svg
          viewBox="0 0 1514 114"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
          fill="none"
        >
          <defs>
            <filter id="dockCyanGlow" x="-20%" y="-30%" width="140%" height="160%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="dockIntenseGlow" x="-30%" y="-50%" width="160%" height="200%">
              <feGaussianBlur stdDeviation="4.5" result="blur1" />
              <feGaussianBlur stdDeviation="1.8" result="blur2" />
              <feMerge>
                <feMergeNode in="blur1" />
                <feMergeNode in="blur2" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="pedestalFillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00224d" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#000714" stopOpacity="0.68" />
            </linearGradient>
          </defs>

          {/* A. Outer Full-Width Stepped Pedestal & Bottom Wing Frame Fill */}
          <path
            d="M 74 64 L 478 64 L 522 24 L 585 24 L 602 8 L 912 8 L 929 24 L 992 24 L 1036 64 L 1440 64 L 1468 92 L 1448 106 L 66 106 L 46 92 Z"
            fill="url(#pedestalFillGrad)"
          />

          {/* B. Far-Left & Far-Right Outer Corner Chamfer Brackets */}
          {/* Far-Left Outer Corner Bracket */}
          <path
            d="M 4 58 L 32 90 L 58 64"
            stroke="#00a8ff"
            strokeWidth="1.4"
            strokeOpacity="0.7"
          />
          <path
            d="M 2 76 L 28 106 L 66 106 L 96 72"
            stroke="#00d8ff"
            strokeWidth="1.8"
            filter="url(#dockCyanGlow)"
          />
          <line
            x1="28"
            y1="106"
            x2="58"
            y2="106"
            stroke="#b8faff"
            strokeWidth="2.8"
            filter="url(#dockIntenseGlow)"
          />

          {/* Far-Right Outer Corner Bracket */}
          <path
            d="M 1510 58 L 1482 90 L 1456 64"
            stroke="#00a8ff"
            strokeWidth="1.4"
            strokeOpacity="0.7"
          />
          <path
            d="M 1512 76 L 1486 106 L 1448 106 L 1418 72"
            stroke="#00d8ff"
            strokeWidth="1.8"
            filter="url(#dockCyanGlow)"
          />
          <line
            x1="1456"
            y1="106"
            x2="1486"
            y2="106"
            stroke="#b8faff"
            strokeWidth="2.8"
            filter="url(#dockIntenseGlow)"
          />

          {/* C. Left & Right Long Horizontal Wing Trapezoids */}
          {/* Left Wing Frame */}
          <path
            d="M 96 64 L 478 64 L 516 26 L 584 26 L 602 8 L 912 8 L 930 26 L 998 26 L 1036 64 L 1418 64 L 1444 94 L 1430 105 L 84 105 L 70 94 Z"
            stroke="#00b4ff"
            strokeWidth="1.5"
            strokeOpacity="0.82"
            filter="url(#dockCyanGlow)"
          />

          {/* Inner Stepped Line under STANDBY MODE */}
          <path
            d="M 96 64 L 494 64 L 528 32 L 986 32 L 1020 64 L 1418 64"
            stroke="#0088ff"
            strokeWidth="1.1"
            strokeOpacity="0.55"
          />

          {/* Subtle Left & Right Wing Bottom Glow Highlights */}
          <line
            x1="84"
            y1="105"
            x2="155"
            y2="105"
            stroke="#7ef9ff"
            strokeWidth="2.4"
            filter="url(#dockCyanGlow)"
          />
          <line
            x1="1359"
            y1="105"
            x2="1430"
            y2="105"
            stroke="#7ef9ff"
            strokeWidth="2.4"
            filter="url(#dockCyanGlow)"
          />

          {/* D. Intense Glowing Cyan-White Shoulder Highlights on Pedestal Cap */}
          {/* Left Angled Shoulder Highlight */}
          <path
            d="M 578 26 L 594 26 L 610 8 L 626 8"
            stroke="#e0faff"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#dockIntenseGlow)"
          />
          {/* Right Angled Shoulder Highlight */}
          <path
            d="M 888 8 L 904 8 L 920 26 L 936 26"
            stroke="#e0faff"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#dockIntenseGlow)"
          />

          {/* Top Cap Horizontal Glowing Cyan Bar */}
          <line
            x1="602"
            y1="8"
            x2="912"
            y2="8"
            stroke="#38e8ff"
            strokeWidth="2"
            filter="url(#dockCyanGlow)"
          />

          {/* E. Micro-Telemetry Diagonal Tick Marks (///////  1101001  \\\\\\\) under Top Cap */}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line
              key={`ltick-${i}`}
              x1={624 + i * 9}
              y1={20}
              x2={628 + i * 9}
              y2={15}
              stroke="#38e8ff"
              strokeWidth="1.3"
              strokeOpacity="0.75"
            />
          ))}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line
              key={`rtick-${i}`}
              x1={822 + i * 9}
              y1={15}
              x2={826 + i * 9}
              y2={20}
              stroke="#38e8ff"
              strokeWidth="1.3"
              strokeOpacity="0.75"
            />
          ))}

          {/* Small Side Dash Accents flanking STANDBY MODE */}
          <line
            x1="572"
            y1="46"
            x2="584"
            y2="46"
            stroke="#38e8ff"
            strokeWidth="1.6"
            strokeOpacity="0.55"
          />
          <line
            x1="930"
            y1="46"
            x2="942"
            y2="46"
            stroke="#38e8ff"
            strokeWidth="1.6"
            strokeOpacity="0.55"
          />
        </svg>

        {/* Micro Binary Telemetry Readout under Top Cap */}
        <div className="relative z-10 text-[8px] font-mono tracking-[0.25em] text-cyan-300/70 mb-[3px] select-none">
          1101001101
        </div>

        {/* Crisp 'STANDBY MODE' Title inside Pedestal */}
        <div className="relative z-10 text-[13.5px] font-sans font-semibold tracking-[0.14em] uppercase text-[#7ec8ff] drop-shadow-[0_0_8px_rgba(0,195,255,0.45)] mb-2 select-none antialiased">
          {modeLabel}
        </div>

        {/* Bottom-Center Pill Command Input Bar ([Mic] Type a command... [Send]) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitCommand();
          }}
          className="relative z-20 w-[470px] max-w-[90vw] h-[36px] mb-[9px] rounded-[11px] border border-[#00b4ff]/70 bg-[#010b1e]/85 shadow-[0_0_16px_rgba(0,180,255,0.28),inset_0_0_12px_rgba(0,160,255,0.18)] flex items-center px-2 gap-2.5 pointer-events-auto"
        >
          {/* Left Pill Mic Button */}
          <button
            type="button"
            onClick={toggleVoiceMic}
            title={isListeningMic ? 'Stop Listening' : 'Voice Input'}
            className={`w-7 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
              isListeningMic
                ? 'bg-cyan-400/30 text-white shadow-[0_0_10px_#00e5ff]'
                : 'bg-[#041d42]/90 hover:bg-[#062b5e] text-[#38e8ff] border border-cyan-400/30'
            }`}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="2" width="6" height="11" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Command Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a command..."
            className="flex-1 min-w-0 bg-transparent border-0 text-[13px] font-sans text-cyan-50 placeholder:text-[#6ea8d6]/75 focus:outline-none antialiased"
          />

          {/* Right Paper-Plane Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            title="Send Command"
            className="w-7 h-7 flex items-center justify-center text-[#38e8ff] hover:text-white disabled:opacity-45 transition-all cursor-pointer shrink-0 drop-shadow-[0_0_6px_rgba(0,216,255,0.6)]"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 -rotate-12" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M22 2L11 13" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
