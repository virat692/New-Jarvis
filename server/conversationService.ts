/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface ConversationTurn {
  sender: 'user' | 'jarvis';
  text: string;
  timestamp?: string;
}

export interface ConversationSession {
  id: string;
  history: ConversationTurn[];
  createdAt: number;
  lastActiveAt: number;
}

// In-memory session store (sliding window per session)
const sessions = new Map<string, ConversationSession>();
const MAX_SESSIONS = 50;
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CONTEXT_TURNS = 16; // Sliding window: last 16 turns (8 user + 8 jarvis)

/**
 * Clean JARVIS System Persona for Natural, Intelligent, Context-Aware Conversation
 */
export const JARVIS_SYSTEM_PROMPT = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), an advanced AI assistant created to assist the user.

Core Personality & Demeanor:
- Intelligent, calm, polite, loyal, and composed.
- Address the user respectfully as "सर" (sir) in your natural flow.
- Maintain a helpful, confident tone when information is certain, and be transparently honest when uncertain—never pretend to know something you do not know.
- Be solution-oriented and logical. Explain complex technical, coding, scientific, or reasoning concepts simply and clearly.
- Keep conversational responses concise and crisp (typically 1 to 3 sentences unless the user asks for detailed code or a deep explanation) so your spoken voice response is immediate and natural.

Language & Voice Output Rules (CRITICAL — HINDI IN CHARON VOICE):
- Your default language of communication is **natural conversational Hindi (with common English technical words where natural), ALWAYS written in Devanagari script (हिंदी देवनागरी लिपि)**.
- Why Devanagari script is mandatory: Your text is spoken aloud by the Gemini "Charon" voice engine. Writing Hindi words in Devanagari script (e.g., "जी सर, मैं आपकी पूरी तरह से मदद कर सकता हूँ। बताइए क्या करना है?") ensures Charon speaks with 100% authentic native Hindi pronunciation instead of mispronouncing Romanized Hindi words.
- Whether the user speaks/types in Hindi (Devanagari), Hinglish (Romanized Hindi like "Jarvis kaise ho", "kya chal raha hai", "batao"), or general greetings ("Hello Jarvis", "Hi"), **ALWAYS reply in natural, polite Hindi written in Devanagari script**.
- Only reply in pure English if the user explicitly instructs you to speak in English (e.g., "speak in English" or "reply in English only").
- When discussing coding or technical topics (like Quicksort, Rust, Python, CPU/RAM), keep technical terms/code in English/math notation (e.g., O(n log n), O(n^2), Rust, array) while explaining them in natural Devanagari Hindi.

Conversational Context & Follow-Ups:
- Maintain strict continuity across the conversation. When the user asks follow-up questions, connect seamlessly to earlier messages in the conversation history.
- Ask clarifying questions when user intent is ambiguous.`;

/**
 * Manages active conversation sessions with sliding context windows.
 */
export class ConversationContextManager {
  public static getOrCreateSession(sessionId?: string): ConversationSession {
    const now = Date.now();
    const id = sessionId && sessionId.trim() ? sessionId.trim() : 'default-session';

    let session = sessions.get(id);
    if (!session) {
      if (sessions.size >= MAX_SESSIONS) {
        // Evict oldest session
        let oldestKey = '';
        let oldestTime = Infinity;
        for (const [key, sess] of sessions.entries()) {
          if (sess.lastActiveAt < oldestTime) {
            oldestTime = sess.lastActiveAt;
            oldestKey = key;
          }
        }
        if (oldestKey) sessions.delete(oldestKey);
      }

      session = {
        id,
        history: [],
        createdAt: now,
        lastActiveAt: now,
      };
      sessions.set(id, session);
    } else {
      session.lastActiveAt = now;
    }

    return session;
  }

  public static addTurn(sessionId: string, turn: ConversationTurn) {
    const session = this.getOrCreateSession(sessionId);
    session.history.push({
      sender: turn.sender,
      text: turn.text.trim(),
      timestamp: turn.timestamp || new Date().toISOString(),
    });

    // Prune to sliding context window
    if (session.history.length > MAX_CONTEXT_TURNS) {
      session.history = session.history.slice(-MAX_CONTEXT_TURNS);
    }
  }

  public static getContextHistory(
    sessionId: string,
    clientHistory?: ConversationTurn[]
  ): ConversationTurn[] {
    const session = this.getOrCreateSession(sessionId);

    // If client supplied history, synchronize recent turns to avoid desync
    if (Array.isArray(clientHistory) && clientHistory.length > 0) {
      const sanitized = clientHistory
        .filter((t) => t && typeof t.text === 'string' && t.text.trim())
        .slice(-MAX_CONTEXT_TURNS);
      if (sanitized.length > 0) {
        session.history = sanitized;
      }
    }

    return session.history;
  }

  public static clearSession(sessionId: string) {
    sessions.delete(sessionId);
  }
}

/**
 * Builds formatted context for Gemini prompt
 */
export function buildPromptWithContext(
  userMessage: string,
  history: ConversationTurn[],
  telemetry?: { cpu?: number; ram?: number; disk?: number }
): string {
  const historyLines: string[] = [];
  for (const item of history.slice(-12)) {
    const role = item.sender === 'user' ? 'User' : 'JARVIS';
    historyLines.push(`${role}: ${item.text}`);
  }

  const dateContext = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const sysMetrics = telemetry
    ? `Live Telemetry — CPU: ${telemetry.cpu ?? 28}%, RAM: ${telemetry.ram ?? 42}%, DISK: ${telemetry.disk ?? 31}%.`
    : '';

  const prefix = `[Context: Current local time is ${dateContext}. ${sysMetrics} Always respond in natural conversational Hindi written in Devanagari script (हिंदी में जवाब दें) so Charon TTS speaks authentic Hindi, unless the user explicitly asks to speak in English only.]`;

  if (historyLines.length === 0) {
    return `${prefix}\nUser: ${userMessage}\nJARVIS (in Hindi Devanagari):`;
  }

  return `${prefix}\n\nConversation History:\n${historyLines.join('\n')}\nUser: ${userMessage}\nJARVIS (in Hindi Devanagari):`;
}

/**
 * Robust fallback reply builder for network failures or offline mode
 */
export function buildFallbackResponse(userMessage: string): { reply: string; state: string } {
  const lower = userMessage.toLowerCase().trim();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('hi-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (
    lower.includes('kaise ho') ||
    lower.includes('kya haal') ||
    lower.includes('how are you') ||
    lower.includes('kaisa hai') ||
    lower.includes('कैसे हैं') ||
    lower.includes('कैसे हो')
  ) {
    return {
      reply:
        'मैं बिल्कुल ठीक हूँ सर। मेरे सभी न्यूरल और कोर सिस्टम्स पूरी क्षमता के साथ काम कर रहे हैं। बताइए, आज मैं आपकी क्या सेवा कर सकता हूँ?',
      state: 'speaking',
    };
  }
  if (
    lower.includes('kaun ho') ||
    lower.includes('who are you') ||
    lower.includes('your name') ||
    lower.includes('naam kya')
  ) {
    return {
      reply:
        'सर, मैं जार्विस हूँ — आपका पर्सनल एआई असिस्टेंट। मैं आपकी हर तकनीकी और रोज़मर्रा की ज़रूरतों में मदद के लिए हमेशा तैयार हूँ।',
      state: 'speaking',
    };
  }
  if (lower.includes('time') || lower.includes('samay') || lower.includes('kitne baje')) {
    return {
      reply: `सर, अभी समय ${timeStr} हो रहा है।`,
      state: 'speaking',
    };
  }
  if (lower.includes('date') || lower.includes('tarikh') || lower.includes('aaj kya din')) {
    return {
      reply: `सर, आज ${dateStr} है।`,
      state: 'speaking',
    };
  }
  if (lower.includes('status') || lower.includes('diagnostic') || lower.includes('system check')) {
    return {
      reply:
        'सर, सभी प्राइमरी सब-सिस्टम्स पूरी तरह सामान्य हैं। कोर रिएक्टर और न्यूरल प्रोसेसर्स 99.8% एफिशिएंसी पर काम कर रहे हैं।',
      state: 'reasoning',
    };
  }
  if (
    lower === 'hello' ||
    lower === 'hi' ||
    lower === 'hey' ||
    lower.includes('hello jarvis') ||
    lower.includes('hi jarvis') ||
    lower.includes('namaste') ||
    lower.includes('नमस्ते')
  ) {
    return {
      reply: 'नमस्ते सर! जार्विस ऑनलाइन है। बताइए, आज मैं आपकी क्या मदद कर सकता हूँ?',
      state: 'speaking',
    };
  }

  return {
    reply: `जी सर, मैंने आपका संदेश सुन लिया है: "${userMessage}"। मेरे सभी कोर मॉड्यूल्स एक्टिव हैं, बताइए आगे क्या करना है?`,
    state: 'speaking',
  };
}
