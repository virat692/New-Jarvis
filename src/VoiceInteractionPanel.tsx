/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, AlertTriangle, Radio, Terminal } from 'lucide-react';
import { VoicePanelState, VOICE_STATE_PROFILES, CoreState } from './types';
import { jarvisAudio } from './audio';

interface VoiceInteractionPanelProps {
  onSyncState: (coreState: CoreState) => void;
  externalState?: CoreState;
}

export function VoiceInteractionPanel({ onSyncState, externalState }: VoiceInteractionPanelProps) {
  const [voiceState, setVoiceState] = useState<VoicePanelState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [interimText, setInterimText] = useState<string>('');
  const [deviceStatus, setDeviceStatus] = useState<string>('MIC: READY · DEFAULT INPUT');
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(true);
  const recognitionRef = useRef<any>(null);
  const stateTimeoutRef = useRef<number | null>(null);

  // Sync with external state changes (e.g. from central reactor or keyboard hotkeys)
  useEffect(() => {
    if (!externalState) return;
    if (externalState === 'speaking') {
      setVoiceState('speaking');
    } else if (externalState === 'listening') {
      setVoiceState('listening');
    } else if (externalState === 'thinking') {
      setVoiceState('thinking');
    } else if (externalState === 'reasoning') {
      setVoiceState('transcribing');
    } else if (externalState === 'executing') {
      setVoiceState('executing');
    } else if (externalState === 'alert') {
      setVoiceState('alert');
    } else if (externalState === 'error') {
      setVoiceState('error');
    } else if (externalState === 'offline') {
      setVoiceState('offline');
    } else if (externalState === 'idle') {
      setVoiceState('idle');
    }
  }, [externalState]);

  // Clean timeout on unmount
  useEffect(() => {
    return () => {
      if (stateTimeoutRef.current) {
        clearTimeout(stateTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const profile = VOICE_STATE_PROFILES[voiceState] || VOICE_STATE_PROFILES.idle;

  // Start real browser speech recognition
  const startListening = useCallback(() => {
    if (!isMicEnabled) {
      setVoiceState('error');
      setDeviceStatus('MIC: MUTED BY USER');
      return;
    }

    setTranscript('');
    setInterimText('');
    setVoiceState('listening');
    onSyncState('listening');
    setDeviceStatus('MIC: ACTIVE · STREAMING 48kHz');
    jarvisAudio.playStateSound('listening');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Browser doesn't support SpeechRecognition API: run high-fidelity simulated voice command
      setDeviceStatus('MIC: SIMULATED (BROWSER API RESTRICTED)');
      stateTimeoutRef.current = window.setTimeout(() => {
        setVoiceState('speech_detected');
        setInterimText('Jarvis, initiate core diagnostics...');
        stateTimeoutRef.current = window.setTimeout(() => {
          setVoiceState('transcribing');
          setTranscript('Jarvis, initiate core diagnostics and report status.');
          setInterimText('');
          onSyncState('thinking');
          stateTimeoutRef.current = window.setTimeout(() => {
            setVoiceState('thinking');
            onSyncState('reasoning');
            stateTimeoutRef.current = window.setTimeout(() => {
              setVoiceState('speaking');
              onSyncState('speaking');
              jarvisAudio.speak(
                'Core diagnostics initialized. Quantum reactor efficiency measured at ninety-nine percent, sir.',
                undefined,
                () => {
                  setVoiceState('idle');
                  onSyncState('idle');
                  setDeviceStatus('MIC: READY · DEFAULT INPUT');
                }
              );
            }, 1200);
          }, 1000);
        }, 1200);
      }, 1000);
      return;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setVoiceState('listening');
        setDeviceStatus('MIC: RECORDING · CAPTURING SPEECH');
      };

      rec.onspeechstart = () => {
        setVoiceState('speech_detected');
        jarvisAudio.playStateSound('speech_detected');
      };

      rec.onresult = (event: any) => {
        setVoiceState('transcribing');
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) setInterimText(interim);
        if (final) {
          setTranscript(final);
          setInterimText('');
        }
      };

      rec.onerror = (event: any) => {
        setVoiceState('error');
        onSyncState('error');
        setDeviceStatus(`MIC ERROR: ${event.error?.toUpperCase() || 'PERMISSION DENIED'}`);
        jarvisAudio.playStateSound('error');

        stateTimeoutRef.current = window.setTimeout(() => {
          setVoiceState('idle');
          onSyncState('idle');
          setDeviceStatus('MIC: READY · DEFAULT INPUT');
        }, 3000);
      };

      rec.onend = () => {
        // When speech recognition finishes capturing
        const captured = transcript || interimText;
        if (captured) {
          setVoiceState('thinking');
          onSyncState('thinking');
          setDeviceStatus('AI: INTERPRETING COMMAND');

          stateTimeoutRef.current = window.setTimeout(() => {
            setVoiceState('speaking');
            onSyncState('speaking');
            setDeviceStatus('AI: DELIVERING RESPONSE');

            const reply = `Command received: "${captured}". Executing protocol immediately, sir.`;
            jarvisAudio.speak(
              reply,
              undefined,
              () => {
                setVoiceState('idle');
                onSyncState('idle');
                setDeviceStatus('MIC: READY · DEFAULT INPUT');
              },
              () => {
                setVoiceState('idle');
                onSyncState('idle');
                setDeviceStatus('MIC: READY · DEFAULT INPUT');
              }
            );
          }, 1000);
        } else {
          setVoiceState('idle');
          onSyncState('idle');
          setDeviceStatus('MIC: READY · DEFAULT INPUT');
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch {
      setVoiceState('error');
      setDeviceStatus('MIC: HARDWARE INITIALIZATION FAILED');
      stateTimeoutRef.current = window.setTimeout(() => {
        setVoiceState('idle');
        onSyncState('idle');
      }, 2500);
    }
  }, [isMicEnabled, onSyncState, transcript, interimText]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current);
    }
    jarvisAudio.cancelSpeech();
    setVoiceState('idle');
    onSyncState('idle');
    setDeviceStatus('MIC: STANDBY · DEFAULT INPUT');
  }, [onSyncState]);

  const toggleMic = () => {
    if (voiceState === 'listening' || voiceState === 'speech_detected') {
      stopListening();
    } else {
      startListening();
    }
  };

  // Mini Waveform Bars (14 bars inside panel)
  const [waveHeights, setWaveHeights] = useState<number[]>([
    4, 6, 8, 12, 16, 20, 24, 20, 16, 12, 8, 6, 4, 3,
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWaveHeights((prev) =>
        prev.map((_, i) => {
          const centerDist = Math.abs(i - 6.5) / 6.5;
          const envelope = Math.max(0.15, 1 - centerDist * 0.85);
          if (voiceState === 'listening' || voiceState === 'speech_detected') {
            return 4 + Math.floor(Math.random() * 22) * envelope;
          } else if (voiceState === 'speaking') {
            return 6 + Math.floor(Math.random() * 26) * envelope;
          } else if (voiceState === 'thinking' || voiceState === 'transcribing') {
            return 4 + Math.floor(Math.random() * 16) * envelope;
          } else if (voiceState === 'error' || voiceState === 'offline') {
            return 2;
          }
          // Idle breathing
          return 3 + Math.floor(Math.sin(Date.now() * 0.004 + i * 0.4) * 4 + 4) * envelope;
        })
      );
    }, 90);

    return () => clearInterval(interval);
  }, [voiceState]);

  const isAlert = profile.isAmber;
  const isError = profile.isError;
  const isOffline = profile.isOffline;

  return (
    <div
      className={`relative flex flex-col justify-between p-3.5 sm:p-4 rounded-2xl border transition-all duration-300 backdrop-blur-md shadow-2xl select-none ${
        isAlert
          ? 'bg-[#150f05]/90 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.3)]'
          : isError
          ? 'bg-[#180505]/90 border-red-500/70 shadow-[0_0_25px_rgba(239,68,68,0.3)]'
          : isOffline
          ? 'bg-[#080d16]/90 border-slate-700/60 shadow-none'
          : 'bg-[#061224]/90 border-cyan-500/60 shadow-[0_0_25px_rgba(6,182,212,0.25)]'
      }`}
      style={{
        width: '100%',
        height: '100%',
        minWidth: '280px',
      }}
    >
      {/* Sci-Fi Corner Bracket Accents */}
      <div
        className={`absolute top-1 left-2 w-3 h-3 border-t-2 border-l-2 pointer-events-none transition-colors ${
          isAlert
            ? 'border-amber-400'
            : isError
            ? 'border-red-400'
            : isOffline
            ? 'border-slate-500'
            : 'border-cyan-400'
        }`}
      />
      <div
        className={`absolute bottom-1 right-2 w-3 h-3 border-b-2 border-r-2 pointer-events-none transition-colors ${
          isAlert
            ? 'border-amber-400'
            : isError
            ? 'border-red-400'
            : isOffline
            ? 'border-slate-500'
            : 'border-cyan-400'
        }`}
      />

      {/* Top Header: Renamed to VOICE INTERACTION with Input Device Status */}
      <div className="flex items-center justify-between pb-2 border-b border-cyan-900/40">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isAlert ? 'bg-amber-400' : isError ? 'bg-red-400' : isOffline ? 'bg-slate-500' : 'bg-cyan-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isAlert ? 'bg-amber-400' : isError ? 'bg-red-400' : isOffline ? 'bg-slate-500' : 'bg-cyan-400'
              }`}
            />
          </span>
          <span className="text-[11px] font-hud font-bold tracking-wider text-cyan-300 uppercase">
            VOICE INTERACTION
          </span>
        </div>

        {/* Small Input Device Status Indicator */}
        <span
          className={`text-[9px] font-mono tracking-tight px-1.5 py-0.5 rounded border truncate max-w-[170px] ${
            isError
              ? 'bg-red-950/70 border-red-500/50 text-red-300'
              : isAlert
              ? 'bg-amber-950/70 border-amber-500/50 text-amber-300'
              : 'bg-cyan-950/60 border-cyan-800/50 text-cyan-400/80'
          }`}
          title={deviceStatus}
        >
          {deviceStatus}
        </span>
      </div>

      {/* Middle Row: Microphone Button + Dynamic Title & Description + Mini Waveform */}
      <div className="flex items-center justify-between gap-3 py-1">
        {/* Left: Microphone Enable/Disable Button */}
        <button
          onClick={toggleMic}
          className={`relative p-2.5 sm:p-3 rounded-full transition-all duration-300 cursor-pointer shrink-0 border ${
            voiceState === 'listening' || voiceState === 'speech_detected'
              ? 'bg-cyan-400 text-slate-950 shadow-[0_0_20px_#22d3ee] scale-105 border-cyan-300'
              : voiceState === 'speaking'
              ? 'bg-cyan-500/40 text-cyan-200 shadow-[0_0_15px_rgba(34,211,238,0.5)] border-cyan-300'
              : isError
              ? 'bg-red-950/80 text-red-300 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
              : isAlert
              ? 'bg-amber-950/80 text-amber-300 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
              : isOffline
              ? 'bg-slate-800 text-slate-400 border-slate-600'
              : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60 hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]'
          }`}
          title={voiceState === 'listening' ? 'Click to stop listening' : 'Click to talk with JARVIS'}
        >
          {voiceState === 'listening' && (
            <span className="absolute -inset-1 rounded-full border border-cyan-400 animate-ping opacity-75 pointer-events-none" />
          )}
          {isOffline ? (
            <MicOff className="w-4 h-4" />
          ) : voiceState === 'speaking' ? (
            <Volume2 className="w-4 h-4 animate-pulse" />
          ) : isError ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Center: Dynamic Title & Contextual Status Description */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <h4
              className={`text-xs font-hud font-bold tracking-wider uppercase truncate ${
                isAlert ? 'text-amber-300' : isError ? 'text-red-300' : isOffline ? 'text-slate-400' : 'text-white'
              }`}
            >
              {profile.title}
            </h4>
          </div>
          <p
            className={`text-[10px] sm:text-[11px] font-mono leading-tight truncate ${
              isAlert ? 'text-amber-300/80' : isError ? 'text-red-300/80' : 'text-cyan-300/80'
            }`}
          >
            {profile.description}
          </p>
        </div>

        {/* Right: Mini Waveform Animation */}
        <div className="flex items-center gap-0.5 h-7 px-1.5 bg-slate-950/60 border border-cyan-950/80 rounded-lg shrink-0">
          {waveHeights.map((h, i) => (
            <span
              key={i}
              style={{ height: `${h}px` }}
              className={`w-0.5 sm:w-1 rounded-full transition-all duration-100 ${
                isAlert
                  ? 'bg-amber-400'
                  : isError
                  ? 'bg-red-400'
                  : isOffline
                  ? 'bg-slate-600'
                  : 'bg-cyan-400 shadow-[0_0_6px_#22d3ee]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Bottom Row: Live Speech Transcription Box */}
      <div className="mt-1 pt-1.5 border-t border-cyan-900/30 flex items-center gap-1.5">
        <Terminal className="w-3 h-3 text-cyan-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono text-slate-300 truncate">
            {interimText ? (
              <span className="text-cyan-300 italic animate-pulse">"{interimText}"</span>
            ) : transcript ? (
              <span className="text-cyan-200">"{transcript}"</span>
            ) : (
              <span className="text-slate-500 italic">Awaiting voice command...</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
