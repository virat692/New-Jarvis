/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CoreState } from './types';
import { jarvisAudio } from './audio';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'jarvis';
  name: string;
  text: string;
  time: string;
  isStreaming?: boolean;
}

interface JarvisChatConsoleProps {
  onStateTrigger?: (state: CoreState, durationMs?: number) => void;
  coreState?: CoreState;
}

export const JarvisChatConsole: React.FC<JarvisChatConsoleProps> = ({
  onStateTrigger,
  coreState = 'idle',
}) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isJarvisSpeaking, setIsJarvisSpeaking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'user',
      name: 'You',
      text: 'Hello Jarvis!',
      time: '09:55 PM',
    },
    {
      id: '2',
      sender: 'jarvis',
      name: 'Jarvis',
      text: 'Hello! How can I help you today?',
      time: '09:55 PM',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const typingTimerRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isListening, isJarvisSpeaking]);

  const getCurrentFormattedTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Speech Recognition setup (Web Speech API)
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          if (onStateTrigger) onStateTrigger('listening');
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            handleSendMessage(transcript);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch {}
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      if (onStateTrigger) onStateTrigger('idle');
    } else {
      setIsListening(true);
      jarvisAudio.playBeep(880, 0.08);
      if (onStateTrigger) onStateTrigger('listening', 5000);

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {}
      } else {
        setTimeout(() => {
          setIsListening(false);
        }, 4000);
      }
    }
  };

  // Stream Jarvis response text letter by letter
  const streamJarvisResponse = useCallback(
    (fullText: string) => {
      setIsJarvisSpeaking(true);
      const msgId = String(Date.now() + 1);
      const currentTime = getCurrentFormattedTime();

      // Add empty message first
      setMessages((prev) => [
        ...prev,
        {
          id: msgId,
          sender: 'jarvis',
          name: 'Jarvis',
          text: '',
          time: currentTime,
          isStreaming: true,
        },
      ]);

      if (onStateTrigger) {
        onStateTrigger('speaking', Math.max(2500, fullText.length * 50));
      }

      jarvisAudio.speak(fullText, () => {
        setIsJarvisSpeaking(true);
      }, () => {
        setIsJarvisSpeaking(false);
      });

      let charIndex = 0;
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);

      typingTimerRef.current = setInterval(() => {
        charIndex++;
        const currentSlice = fullText.slice(0, charIndex);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  text: currentSlice,
                  isStreaming: charIndex < fullText.length,
                }
              : m
          )
        );

        if (charIndex >= fullText.length) {
          clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
          setTimeout(() => {
            setIsJarvisSpeaking(false);
          }, 600);
        }
      }, 32);
    },
    [onStateTrigger]
  );

  const handleSendMessage = useCallback(
    (textToSend?: string) => {
      const text = (textToSend || inputText).trim();
      if (!text) return;

      const userTime = getCurrentFormattedTime();
      const newMsg: ChatMessage = {
        id: String(Date.now()),
        sender: 'user',
        name: 'You',
        text,
        time: userTime,
      };

      setMessages((prev) => [...prev, newMsg]);
      setInputText('');
      setIsListening(false);
      jarvisAudio.playBeep(640, 0.06);

      if (onStateTrigger) {
        onStateTrigger('thinking', 1200);
      }

      setTimeout(() => {
        const lower = text.toLowerCase();
        let reply = 'All systems operating at peak efficiency, Sir.';

        if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
          reply = 'Greetings. All diagnostic conduits report optimal status.';
        } else if (lower.includes('camera') || lower.includes('capture') || lower.includes('vision') || lower.includes('optic')) {
          reply = 'Optical feed is active in the upper-right sector. Ready for capture.';
        } else if (lower.includes('status') || lower.includes('report') || lower.includes('diagnostic')) {
          reply = 'Core temperature stable. Arc reactor output nominal at 100%.';
        } else if (lower.includes('power') || lower.includes('energy') || lower.includes('reactor')) {
          reply = 'Power levels optimal. Central flux aligned with Dhruva reactor core.';
        } else if (lower.includes('alert') || lower.includes('danger') || lower.includes('threat')) {
          reply = 'Perimeter scan negative. Defense protocols engaged on standby.';
          if (onStateTrigger) onStateTrigger('alert', 3500);
        } else if (lower.includes('help') || lower.includes('what can you do')) {
          reply = 'I manage HUD telemetry, optical sensor matrices, voice channels, and core stabilization.';
        } else if (lower.includes('who are you') || lower.includes('jarvis')) {
          reply = 'I am J.A.R.V.I.S., your autonomous intelligent companion.';
        }

        streamJarvisResponse(reply);
      }, 700);
    },
    [inputText, onStateTrigger, streamJarvisResponse]
  );

  const isWaveActive = isListening || isJarvisSpeaking || coreState === 'listening' || coreState === 'speaking';

  return (
    <div className="relative w-full h-full flex flex-col justify-between font-sans select-none pointer-events-auto">
      {/* 
        ========================================================================
        1. CONVERSATION LOG PANEL (Matches Screenshot_20261101_224736_737bc567.jpg)
        Transparent floating cyber frame with luminous cyan borders
        ========================================================================
      */}
      <div className="relative flex-1 w-full flex flex-col justify-between overflow-hidden pb-1">
        {/* Left Cyber Border with Corner Chamfer */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-28 h-[2px] bg-gradient-to-r from-cyan-400 via-cyan-300 to-transparent shadow-[0_0_8px_#22d3ee]" />
          {/* Left vertical border */}
          <div className="absolute top-0 bottom-3 left-0 w-[2px] bg-gradient-to-b from-cyan-400 via-cyan-400/80 to-transparent shadow-[0_0_8px_#22d3ee]" />
          {/* Bottom horizontal border line */}
          <div className="absolute bottom-3 left-0 w-48 h-[1.5px] bg-gradient-to-r from-cyan-400 via-cyan-400/60 to-transparent shadow-[0_0_6px_#22d3ee]" />
        </div>

        {/* Scrollable Conversation Stream */}
        <div className="flex-1 overflow-y-auto space-y-2.5 px-3 pt-1.5 scrollbar-none">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-start gap-3 rounded-lg px-2 py-1.5 bg-gradient-to-r from-cyan-950/35 via-cyan-900/15 to-transparent backdrop-blur-[2px] border-l border-cyan-400/20"
            >
              {/* Avatar Icon */}
              {msg.sender === 'user' ? (
                /* User Avatar: Glowing circular user silhouette */
                <div className="relative shrink-0 w-8 h-8 rounded-full bg-gradient-to-b from-cyan-500/25 to-blue-700/30 border border-cyan-400/80 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.5)] mt-0.5">
                  <svg className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_6px_#22d3ee]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                </div>
              ) : (
                /* Jarvis Avatar: Robotic AI face matching reference */
                <div className="relative shrink-0 w-8 h-8 rounded-full bg-gradient-to-b from-cyan-500/25 to-blue-700/30 border border-cyan-400/80 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.5)] mt-0.5">
                  <svg className="w-4 h-4 text-cyan-300 drop-shadow-[0_0_6px_#22d3ee]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="6" width="14" height="12" rx="4" />
                    <circle cx="9" cy="11" r="1.5" fill="currentColor" />
                    <circle cx="15" cy="11" r="1.5" fill="currentColor" />
                    <path d="M10 15h4" strokeLinecap="round" />
                    <line x1="12" y1="3" x2="12" y2="6" strokeLinecap="round" />
                  </svg>
                </div>
              )}

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between leading-none mb-1">
                  <span
                    className={`text-[12px] font-bold tracking-wide ${
                      msg.sender === 'jarvis'
                        ? 'text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]'
                        : 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                    }`}
                  >
                    {msg.name}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-300/70 tracking-wider">
                    {msg.time}
                  </span>
                </div>
                <p className="text-[12px] text-cyan-100 leading-snug break-words drop-shadow-[0_0_4px_rgba(6,182,212,0.3)]">
                  {msg.text}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-300 animate-pulse shadow-[0_0_6px_#22d3ee]" />
                  )}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 
          Listening... and dynamic cyan audio waveform row (Exact match to screenshot)
        */}
        <div className="shrink-0 px-3 pt-1.5 pb-1 flex items-center gap-2.5">
          {/* Wave Icon */}
          <div className="shrink-0 flex items-center gap-0.5 text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]">
            <span className={`w-[2px] h-3 bg-cyan-300 rounded-full ${isWaveActive ? 'animate-pulse' : ''}`} />
            <span className={`w-[2px] h-4 bg-cyan-400 rounded-full ${isWaveActive ? 'animate-[pulse_0.8s_ease-in-out_infinite]' : ''}`} />
            <span className={`w-[2px] h-5 bg-cyan-200 rounded-full ${isWaveActive ? 'shadow-[0_0_8px_#22d3ee]' : ''}`} />
            <span className={`w-[2px] h-4 bg-cyan-400 rounded-full ${isWaveActive ? 'animate-[pulse_0.9s_ease-in-out_infinite]' : ''}`} />
            <span className={`w-[2px] h-3 bg-cyan-300 rounded-full ${isWaveActive ? 'animate-pulse' : ''}`} />
          </div>

          <span className="text-xs font-bold text-cyan-300 tracking-wider drop-shadow-[0_0_10px_rgba(34,211,238,0.9)]">
            {isListening ? 'Listening...' : isJarvisSpeaking ? 'Transmitting...' : 'Listening...'}
          </span>

          {/* Undulating audio waveform spanning to the right */}
          <div className="flex-1 flex items-center justify-center gap-[2px] h-5 overflow-hidden px-1">
            {Array.from({ length: 32 }).map((_, i) => {
              const distFromCenter = Math.abs(i - 15.5) / 15.5;
              const envelope = Math.max(0.1, Math.cos(distFromCenter * Math.PI * 0.5));
              const animDuration = 0.5 + ((i % 6) * 0.12);
              const dynamicH = isWaveActive ? Math.max(3, Math.round(18 * envelope)) : Math.max(2, Math.round(12 * envelope));

              return (
                <div
                  key={i}
                  className="w-[2px] bg-gradient-to-t from-cyan-500 via-cyan-300 to-cyan-100 rounded-full shadow-[0_0_5px_#22d3ee]"
                  style={{
                    height: `${dynamicH}px`,
                    animation: isWaveActive ? `pulse ${animDuration}s ease-in-out infinite alternate` : 'none',
                    animationDelay: `${(i * 0.03).toFixed(2)}s`,
                    opacity: 0.35 + envelope * 0.65,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* 
        ========================================================================
        2. POINTED HEXAGON COMMAND CAPSULE (Exact replica of screenshot)
           [🎤]  Type a command...  [➤]
        ========================================================================
      */}
      <div
        className="relative w-full h-[46px] sm:h-[48px] bg-[#020b18]/90 border border-cyan-400/90 shadow-[0_0_18px_rgba(6,182,212,0.5)] flex items-center px-2.5 gap-2.5 mt-1 backdrop-blur-md"
        style={{
          clipPath:
            'polygon(14px 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 14px 100%, 0 50%)',
        }}
      >
        {/* Glowing Circular Microphone Button */}
        <button
          onClick={toggleListening}
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            isListening
              ? 'bg-red-500/30 border border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.9)] text-red-200 animate-pulse'
              : 'bg-cyan-950/80 hover:bg-cyan-900/90 border border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.5)] text-cyan-300 hover:text-white'
          }`}
          title={isListening ? 'Click to Stop Listening' : 'Click to Speak'}
        >
          <svg className="w-4 h-4 drop-shadow-[0_0_6px_currentColor]" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Input Command Field */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Type a command..."
          className="flex-1 bg-transparent border-none outline-none text-xs sm:text-[13px] text-cyan-100 placeholder-cyan-300/60 font-sans tracking-wide"
        />

        {/* Glowing Paper Airplane Send Button */}
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
            inputText.trim()
              ? 'text-cyan-300 hover:text-cyan-100 hover:scale-110 drop-shadow-[0_0_10px_#22d3ee]'
              : 'text-cyan-600/50 cursor-default'
          }`}
          title="Send Command"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
