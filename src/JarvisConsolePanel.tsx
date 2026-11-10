/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, User } from 'lucide-react';
import { CoreState } from './types';
import { jarvisAudio } from './audio';

interface ChatMessage {
  id: string;
  sender: 'user' | 'jarvis';
  senderName: string;
  text: string;
  time: string;
}

interface JarvisConsolePanelProps {
  coreState: CoreState;
  onSyncState: (state: CoreState, autoReturnDelay?: number) => void;
}

// Custom Jarvis Robotic / AI Visage Icon matching screenshot
function JarvisAvatarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className || 'w-5 h-5'}
    >
      {/* Outer Head Contour */}
      <path d="M12 3a8 8 0 0 0-8 8c0 3.2 1.9 6 4.7 7.2l.8 2.8h5l.8-2.8A8.02 8.02 0 0 0 20 11a8 8 0 0 0-8-8z" />
      {/* Visor / Cyber Brow */}
      <path d="M7.5 9h9" />
      {/* Glowing Eyes */}
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      {/* Cyber Chin / Smile line */}
      <path d="M10 15.5h4" />
      {/* Neural Ear Nodes */}
      <line x1="3" y1="11" x2="4" y2="11" />
      <line x1="20" y1="11" x2="21" y2="11" />
    </svg>
  );
}

// Waveform Equalizer Glyphs
function WaveformIcon({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-[2px] ${className || 'h-4'}`}>
      <span className="w-[2px] h-2 bg-cyan-400 rounded-full animate-pulse" />
      <span className="w-[2px] h-3.5 bg-cyan-300 rounded-full" />
      <span className="w-[2px] h-4 bg-cyan-200 rounded-full" />
      <span className="w-[2px] h-2.5 bg-cyan-300 rounded-full" />
      <span className="w-[2px] h-1.5 bg-cyan-400 rounded-full" />
    </div>
  );
}

export function JarvisConsolePanel({ coreState, onSyncState }: JarvisConsolePanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'user',
      senderName: 'You',
      text: 'Hello Jarvis!',
      time: '09:55 PM',
    },
    {
      id: 'msg-2',
      sender: 'jarvis',
      senderName: 'Jarvis',
      text: 'Hello! How can I help you today?',
      time: '09:55 PM',
    },
  ]);

  const [inputCommand, setInputCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync listening state from parent coreState
  useEffect(() => {
    if (coreState === 'listening') {
      setIsListening(true);
    } else {
      setIsListening(false);
    }
  }, [coreState]);

  // Keep chat scrolled smoothly
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Symmetrical Diamond / Rhombus Waveform Bars (27 bars) matching screenshot
  const [waveAmplitudes, setWaveAmplitudes] = useState<number[]>(() =>
    Array.from({ length: 27 }, (_, i) => {
      const center = 13;
      const dist = Math.abs(i - center);
      const envelope = Math.max(0.1, 1 - dist / 13);
      return Math.max(2, Math.round(18 * envelope));
    })
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setWaveAmplitudes((prev) =>
        prev.map((_, i) => {
          const center = 13;
          const dist = Math.abs(i - center);
          const envelope = Math.max(0.12, 1 - dist / 13);
          const t = Date.now() * 0.006;

          if (isListening || coreState === 'listening') {
            const raw = Math.sin(t * 2 + i * 0.5) * 0.5 + 0.5;
            return Math.max(2, Math.round((4 + Math.random() * 20 * raw) * envelope));
          } else if (coreState === 'speaking') {
            const raw = Math.sin(t * 3 + i * 0.7) * 0.6 + 0.4;
            return Math.max(3, Math.round((6 + Math.random() * 24 * raw) * envelope));
          } else if (coreState === 'thinking' || coreState === 'reasoning') {
            const wave = Math.sin(t * 1.5 + i * 0.3) * 0.5 + 0.5;
            return Math.max(2, Math.round((3 + 12 * wave) * envelope));
          }
          // Idle ambient gentle breathing
          const idleWave = Math.sin(t + i * 0.25) * 0.4 + 0.6;
          return Math.max(2, Math.round(14 * envelope * idleWave));
        })
      );
    }, 75);

    return () => clearInterval(interval);
  }, [isListening, coreState]);

  // Format current time as "09:55 PM"
  const getCurrentFormattedTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Dispatch AI Response with synthesis
  const respondFromJarvis = useCallback((userQuery: string) => {
    onSyncState('thinking', 1200);

    setTimeout(() => {
      const lower = userQuery.toLowerCase().trim();
      let replyText = 'All core subsystems nominal. Telemetry conduits are fully synchronized, sir.';

      if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        replyText = 'Hello! I am standing by for your instructions. How may I assist you, sir?';
      } else if (lower.includes('status') || lower.includes('report') || lower.includes('diagnostic')) {
        replyText = 'Diagnostic scan complete. Quantum reactor efficiency is at ninety-nine percent. Zero anomalies detected.';
      } else if (lower.includes('shield') || lower.includes('defense') || lower.includes('security')) {
        replyText = 'Defensive energy matrix is active. Perimeter surveillance engaged.';
      } else if (lower.includes('camera') || lower.includes('vision') || lower.includes('optical')) {
        replyText = 'Optical sensors and HUD visual telemetry stream are calibrated and live.';
      } else if (lower.includes('who are you') || lower.includes('identity')) {
        replyText = 'I am JARVIS: Just A Rather Very Intelligent System, your holographic tactical assistant.';
      } else {
        replyText = `Directive recognized: "${userQuery}". Processing telemetry and executing protocols immediately.`;
      }

      const jarvisReplyMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'jarvis',
        senderName: 'Jarvis',
        text: replyText,
        time: getCurrentFormattedTime(),
      };

      setMessages((prev) => [...prev, jarvisReplyMsg]);
      onSyncState('speaking');

      jarvisAudio.speak(
        replyText,
        () => onSyncState('speaking'),
        () => onSyncState('idle'),
        () => onSyncState('idle')
      );
    }, 1200);
  }, [onSyncState]);

  // Handle Command Submit
  const handleSendCommand = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputCommand.trim();
    if (!query) return;

    jarvisAudio.playStateSound('listening');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      senderName: 'You',
      text: query,
      time: getCurrentFormattedTime(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputCommand('');

    respondFromJarvis(query);
  };

  // Toggle Microphone / Speech Recognition
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      onSyncState('idle');
      return;
    }

    setIsListening(true);
    onSyncState('listening');
    jarvisAudio.playStateSound('listening');

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // High-fidelity fallback if SpeechRecognition not supported in browser environment
      setTimeout(() => {
        const simulatedVoice = 'Status report on all systems';
        const userMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          sender: 'user',
          senderName: 'You',
          text: simulatedVoice,
          time: getCurrentFormattedTime(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsListening(false);
        respondFromJarvis(simulatedVoice);
      }, 2500);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event: any) => {
        const speechResult = event.results[0][0].transcript;
        if (speechResult) {
          const userMsg: ChatMessage = {
            id: `msg-${Date.now()}`,
            sender: 'user',
            senderName: 'You',
            text: speechResult,
            time: getCurrentFormattedTime(),
          };
          setMessages((prev) => [...prev, userMsg]);
          setIsListening(false);
          respondFromJarvis(speechResult);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
        onSyncState('idle');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
    } catch {
      setIsListening(false);
      onSyncState('idle');
    }
  };

  return (
    <div className="relative flex flex-col justify-between w-full h-full p-1 select-none font-sans overflow-hidden">
      {/* 
        TOP CHAT PANEL:
        Sci-Fi Chamfered Hexagonal Frame with Glowing Blue/Cyan Borders
      */}
      <div
        className="relative flex-1 flex flex-col justify-between mb-2 p-2.5 sm:p-3 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(2, 14, 28, 0.88) 0%, rgba(1, 9, 20, 0.92) 100%)',
          backdropFilter: 'blur(8px)',
          clipPath:
            'polygon(16px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 16px)',
          boxShadow: 'inset 0 0 25px rgba(0, 229, 255, 0.08), 0 0 15px rgba(0, 180, 255, 0.25)',
        }}
      >
        {/* Glowing Vector Sci-Fi Outer Contour Line */}
        <div
          className="absolute inset-0 pointer-events-none rounded-[2px]"
          style={{
            border: '1.5px solid rgba(0, 229, 255, 0.65)',
            boxShadow: '0 0 12px rgba(0, 229, 255, 0.35)',
            clipPath:
              'polygon(16px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 16px)',
          }}
        />

        {/* Futuristic Top-Right Glow Accent Beam */}
        <div className="absolute top-0 right-3 w-16 h-[2px] bg-cyan-300 shadow-[0_0_8px_#22d3ee] pointer-events-none" />

        {/* Message Thread Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[145px] scrollbar-thin scrollbar-thumb-cyan-700/40">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            return (
              <div key={msg.id} className="flex items-start gap-2.5">
                {/* Glowing Circular Avatar */}
                <div
                  className={`relative flex items-center justify-center shrink-0 w-8 h-8 rounded-full border transition-all duration-300 ${
                    isUser
                      ? 'border-cyan-400/80 bg-cyan-950/70 shadow-[0_0_12px_rgba(34,211,238,0.5)] text-cyan-300'
                      : 'border-cyan-300 bg-cyan-900/60 shadow-[0_0_16px_rgba(0,229,255,0.7)] text-cyan-200'
                  }`}
                >
                  {isUser ? (
                    <User className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_4px_#22d3ee]" />
                  ) : (
                    <JarvisAvatarIcon className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_6px_#00e5ff]" />
                  )}
                  {/* Subtle inner glow circle */}
                  <div className="absolute inset-0.5 rounded-full border border-cyan-400/30 pointer-events-none" />
                </div>

                {/* Message Header + Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold tracking-wide ${
                        isUser
                          ? 'text-cyan-100 drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]'
                          : 'text-[#00e5ff] font-bold drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]'
                      }`}
                    >
                      {msg.senderName}
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400/70 tracking-wider">
                      {msg.time}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-cyan-50/95 leading-relaxed tracking-wide font-normal mt-0.5">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* 
          BOTTOM STATUS & WAVEFORM ROW:
          [Equalizer Icon] Listening...  [||||||||||||||||||||||]
        */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-cyan-900/40 shrink-0">
          <div className="flex items-center gap-2">
            <WaveformIcon className="text-cyan-400" />
            <span className="text-xs font-mono font-medium tracking-wide text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]">
              {isListening || coreState === 'listening'
                ? 'Listening...'
                : coreState === 'speaking'
                ? 'Speaking...'
                : coreState === 'thinking'
                ? 'Thinking...'
                : 'Listening...'}
            </span>
          </div>

          {/* Symmetrical Diamond Waveform Visualizer */}
          <div className="flex items-center justify-center gap-[2.5px] h-6 px-1.5 flex-1 max-w-[210px] ml-2">
            {waveAmplitudes.map((amp, idx) => (
              <span
                key={idx}
                style={{ height: `${amp}px` }}
                className="w-[2px] bg-cyan-400 rounded-full transition-all duration-75 shadow-[0_0_6px_#00e5ff]"
              />
            ))}
          </div>
        </div>
      </div>

      {/* 
        BOTTOM COMMAND INPUT BAR:
        Hexagonal / Chamfered Cyber Console Pill Box
      */}
      <form
        onSubmit={handleSendCommand}
        className="relative flex items-center justify-between h-[46px] sm:h-[48px] px-3 shrink-0"
        style={{
          background: 'linear-gradient(90deg, rgba(2, 16, 32, 0.92) 0%, rgba(1, 10, 22, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          clipPath:
            'polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%)',
          boxShadow: 'inset 0 0 18px rgba(0, 229, 255, 0.12), 0 0 16px rgba(0, 180, 255, 0.3)',
        }}
      >
        {/* Chamfered Glowing Blue Border */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            border: '1.5px solid rgba(0, 229, 255, 0.75)',
            boxShadow: '0 0 12px rgba(0, 229, 255, 0.45)',
            clipPath:
              'polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%)',
          }}
        />

        {/* Left: Glowing Microphone Button */}
        <button
          type="button"
          onClick={toggleListening}
          className={`relative flex items-center justify-center w-8 h-8 rounded-full border transition-all duration-200 cursor-pointer shrink-0 z-10 ${
            isListening
              ? 'bg-cyan-400 text-slate-950 border-cyan-300 shadow-[0_0_18px_#00e5ff] scale-105'
              : 'bg-cyan-950/80 text-cyan-300 border-cyan-400/80 hover:border-cyan-200 hover:shadow-[0_0_12px_rgba(0,229,255,0.7)]'
          }`}
          title={isListening ? 'Click to stop listening' : 'Click to speak a command'}
        >
          {isListening ? (
            <>
              <Mic className="w-4 h-4 text-slate-950 animate-pulse" />
              <span className="absolute -inset-1 rounded-full border border-cyan-300 animate-ping opacity-75 pointer-events-none" />
            </>
          ) : (
            <Mic className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_4px_#22d3ee]" />
          )}
        </button>

        {/* Center: Command Text Input */}
        <div className="flex-1 px-3 z-10">
          <input
            type="text"
            value={inputCommand}
            onChange={(e) => setInputCommand(e.target.value)}
            placeholder="Type a command..."
            className="w-full bg-transparent text-cyan-100 placeholder:text-cyan-400/60 font-sans text-xs sm:text-sm tracking-wide outline-none border-none focus:ring-0 select-text"
          />
        </div>

        {/* Right: Glowing Send Button */}
        <button
          type="submit"
          className="relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer text-cyan-300 hover:text-cyan-100 hover:scale-110 active:scale-95 shrink-0 z-10 drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]"
          title="Send command to Jarvis"
        >
          <Send className="w-4 h-4 text-cyan-300 transform rotate-12" />
        </button>
      </form>
    </div>
  );
}
