/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CoreState } from './types';
import { jarvisAudio } from './audio';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'jarvis';
  text: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface ExternalChatEvent {
  id: string;
  userCommand?: string;
  jarvisReply?: string;
}

interface ChatStreamProps {
  coreState: CoreState;
  onTriggerState: (state: CoreState, autoReturnDelay?: number, speakDefaultPhrase?: boolean) => void;
  externalEvent?: ExternalChatEvent | null;
  telemetry?: { cpu: number; ram: number; disk: number };
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'user',
    text: 'नमस्ते जार्विस! कोर टेलीमेट्री चेक करो।',
    timestamp: '09:55 PM',
  },
  {
    id: 'msg-2',
    sender: 'jarvis',
    text: 'नमस्ते सर! सभी मैग्नेटिक कन्फाइनमेंट फील्ड्स सामान्य हैं और कोर एफिशिएंसी 99.4% पर स्थिर है। बताइए, आज मैं आपकी क्या मदद कर सकता हूँ?',
    timestamp: '09:55 PM',
  },
];

export const ChatStream: React.FC<ChatStreamProps> = ({
  onTriggerState,
  externalEvent,
  telemetry,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>(INITIAL_MESSAGES);
  const lastEventIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Smooth auto-scroll to bottom on incoming message updates or token stream
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isTyping]);

  /**
   * Authoritative Single-Turn Conversation Dispatcher
   * Streams responses in real time from /api/jarvis/chat/stream with zero double-talking.
   */
  const sendToJarvisAI = useCallback(
    async (userText: string, eventId: string) => {
      const cleanUserText = userText.trim();
      if (!cleanUserText) return;

      // Abort any prior in-flight generation to prevent message collisions
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      jarvisAudio.cancelSpeech();
      jarvisAudio.unlock();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const userTime = formatTime();
      const userMsg: ChatMessage = {
        id: `${eventId}-usr`,
        sender: 'user',
        text: cleanUserText,
        timestamp: userTime,
      };

      const jarvisMsgId = `${eventId}-jrv`;
      const jarvisPlaceholderMsg: ChatMessage = {
        id: jarvisMsgId,
        sender: 'jarvis',
        text: '',
        timestamp: userTime,
        isStreaming: true,
      };

      // Add user message and placeholder jarvis message to state
      const currentHistory = messagesRef.current.slice(-14);
      const nextMessages = [...currentHistory, userMsg, jarvisPlaceholderMsg];
      setMessages(nextMessages);
      setIsTyping(true);
      onTriggerState('thinking', undefined, false);

      let accumulatedText = '';
      let targetState: CoreState = 'speaking';
      let requestFailed = false;

      try {
        const response = await fetch('/api/jarvis/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: cleanUserText,
            sessionId: sessionIdRef.current,
            history: currentHistory.map((m) => ({ sender: m.sender, text: m.text })),
            telemetry,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith(':')) continue;

            if (trimmedLine.startsWith('data:')) {
              const jsonStr = trimmedLine.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);

                if (parsed.chunk) {
                  accumulatedText += parsed.chunk;
                  const currentText = accumulatedText;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === jarvisMsgId
                        ? { ...m, text: currentText, isStreaming: true }
                        : m
                    )
                  );
                  onTriggerState('speaking', undefined, false);
                }

                if (parsed.state && (parsed.state === 'vision' || parsed.state === 'reasoning' || parsed.state === 'alert')) {
                  targetState = parsed.state as CoreState;
                }

                if (parsed.done && parsed.fullReply) {
                  accumulatedText = parsed.fullReply;
                }
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        requestFailed = true;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }

      // If network stream failed or returned empty, generate fallback response
      if (requestFailed || !accumulatedText.trim()) {
        const fallback = 'जी सर, मैं यहाँ हूँ। बताइए आज मैं आपकी क्या सेवा कर सकता हूँ?';
        accumulatedText = fallback;
      }

      const finalText = accumulatedText.trim();
      setIsTyping(false);

      // Finalize the JARVIS message bubble
      setMessages((prev) =>
        prev.map((m) =>
          m.id === jarvisMsgId
            ? { ...m, text: finalText, isStreaming: false }
            : m
        )
      );

      // Trigger target state and speak ONCE cleanly (single-turn execution)
      onTriggerState(targetState, 5000, false);

      if (jarvisAudio.isSoundEnabled()) {
        jarvisAudio.speak(
          finalText,
          () => {
            onTriggerState(targetState, undefined, false);
          },
          () => {
            onTriggerState('idle', undefined, false);
          },
          () => {
            onTriggerState('idle', undefined, false);
          }
        );
      } else {
        setTimeout(() => onTriggerState('idle', undefined, false), 1500);
      }
    },
    [onTriggerState, telemetry]
  );

  // Handle incoming user commands (from BottomHudDock input or voice mic)
  useEffect(() => {
    if (!externalEvent || externalEvent.id === lastEventIdRef.current) return;
    lastEventIdRef.current = externalEvent.id;

    // Case 1: Conversational query from user
    if (externalEvent.userCommand && !externalEvent.jarvisReply) {
      sendToJarvisAI(externalEvent.userCommand, externalEvent.id);
      return;
    }

    // Case 2: Direct pre-computed system notification
    if (externalEvent.jarvisReply) {
      jarvisAudio.cancelSpeech();
      jarvisAudio.unlock();

      const nowStr = formatTime();
      const replyToSpeak = externalEvent.jarvisReply;

      setMessages((prev) => {
        const next = [...prev];
        if (externalEvent.userCommand) {
          next.push({
            id: `${externalEvent.id}-usr`,
            sender: 'user',
            text: externalEvent.userCommand,
            timestamp: nowStr,
          });
        }
        next.push({
          id: `${externalEvent.id}-jrv`,
          sender: 'jarvis',
          text: replyToSpeak,
          timestamp: nowStr,
          isStreaming: false,
        });
        return next.slice(-14);
      });

      if (jarvisAudio.isSoundEnabled()) {
        jarvisAudio.speak(
          replyToSpeak,
          () => {
            onTriggerState('speaking', undefined, false);
          },
          () => {
            onTriggerState('idle', undefined, false);
          },
          () => {
            onTriggerState('idle', undefined, false);
          }
        );
      }
    }
  }, [externalEvent, onTriggerState, sendToJarvisAI]);

  return (
    <div
      className="relative w-full h-full flex flex-col justify-start bg-transparent border-0 shadow-none outline-none select-none pointer-events-auto overflow-visible"
      style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}
    >
      {/* Holographic 'CHAT STREAM' Section Header */}
      <div className="shrink-0 px-3.5 pt-1 pb-2.5 bg-transparent select-none">
        <div className="flex items-center gap-3">
          {/* Glowing Cyan Circular Node */}
          <div className="w-6 h-6 rounded-full border border-cyan-400/90 bg-cyan-950/30 flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.75),inset_0_0_6px_rgba(0,229,255,0.45)] shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#e0faff] shadow-[0_0_8px_#00e5ff,0_0_14px_#ffffff]" />
          </div>

          {/* Bold 'CHAT STREAM' Title */}
          <span className="text-[15px] font-extrabold tracking-[0.07em] uppercase text-[#1ee3ff] drop-shadow-[0_0_8px_rgba(0,229,255,0.75)]">
            CHAT STREAM
          </span>
        </div>

        {/* Glowing Horizontal Cyan Underline with Left Node Dot & Center-Left Bright Highlight */}
        <div className="relative flex items-center w-[236px] mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#00e5ff] shrink-0" />
          <div className="relative flex-1 h-[1.5px] bg-gradient-to-r from-cyan-400/85 via-[#00d8ff] to-cyan-400/35">
            <div className="absolute left-7 top-1/2 -translate-y-1/2 w-24 h-[2.5px] rounded-full bg-cyan-200 shadow-[0_0_10px_#00e5ff,0_0_16px_#0099ff]" />
          </div>
        </div>
      </div>

      {/* Floating Holographic Conversation Stream */}
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto space-y-2.5 px-3.5 pt-1.5 pb-2 bg-transparent border-0 shadow-none scrollbar-none select-text"
        style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className="flex items-start gap-2.5 bg-transparent border-0 shadow-none"
            >
              {/* Glowing Holographic Avatar */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-transparent ${
                  isUser
                    ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                    : 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.95)]'
                }`}
              >
                {isUser ? (
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                    <path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z" />
                  </svg>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-cyan-400/80 bg-transparent flex items-center justify-center shadow-[0_0_10px_#22d3ee]">
                    <div className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_6px_#ffffff]" />
                  </div>
                )}
              </div>

              {/* Floating Holographic Text */}
              <div className="flex-1 min-w-0 bg-transparent border-0 shadow-none">
                <div className="flex items-baseline justify-between gap-2 bg-transparent">
                  <span
                    className={`text-xs font-semibold tracking-wide ${
                      isUser
                        ? 'text-slate-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                        : 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]'
                    }`}
                  >
                    {isUser ? 'You' : 'Jarvis'}
                  </span>
                  <span className="text-[10px] font-mono tabular-nums text-cyan-200/60 shrink-0">
                    {msg.timestamp}
                  </span>
                </div>
                <p className="text-xs leading-snug text-slate-100/95 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)] break-words bg-transparent whitespace-pre-wrap">
                  {msg.text}
                  {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                  )}
                </p>
              </div>
            </div>
          );
        })}

        {isTyping && !messages.some((m) => m.isStreaming && m.text.length > 0) && (
          <div className="flex items-center gap-2 pl-8 text-xs text-cyan-300 bg-transparent drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Jarvis is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};
