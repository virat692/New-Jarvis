/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import http from 'http';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ConversationContextManager,
  ConversationTurn,
  buildPromptWithContext,
  buildFallbackResponse,
  JARVIS_SYSTEM_PROMPT,
} from './server/conversationService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | undefined = undefined;

let cachedBetaClient: GoogleGenAI | null = null;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient || cachedKey !== apiKey) {
    cachedKey = apiKey;
    cachedClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    cachedBetaClient = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        apiVersion: 'v1beta',
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedClient;
}

function getBetaGenAIClient(): GoogleGenAI | null {
  getGenAIClient();
  return cachedBetaClient;
}

const ttsWavCache = new Map<string, string>();
const inFlightTts = new Map<string, Promise<{ b64: string | null; err?: string }>>();
const MAX_TTS_CACHE_ITEMS = 60;

/**
 * Strips markdown characters so Charon TTS speaks natural sentences without reading formatting symbols.
 */
function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^[#>*-\s]+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Synthesizes 24kHz WAV audio using 'gemini-3.8-flash-lite-tts' with the 'Charon' voice
 * and caches the base64 WAV in RAM for instant playback.
 */
async function synthesizeCharonWav(text: string): Promise<{ b64: string | null; err?: string }> {
  const clean = cleanTextForSpeech(text);
  if (!clean) return { b64: null, err: 'empty' };

  const cacheKey = clean.toLowerCase();
  const cached = ttsWavCache.get(cacheKey);
  if (cached) return { b64: cached };

  const existingPromise = inFlightTts.get(cacheKey);
  if (existingPromise) return existingPromise;

  const task = (async (): Promise<{ b64: string | null; err?: string }> => {
    const betaAi = getBetaGenAIClient();
    if (!betaAi) return { b64: null, err: 'no_api_key' };

    const errors: string[] = [];

    // Attempt 1: betaAi with gemini-3.8-flash-lite-tts (Charon voice — native Hindi & Indian English)
    try {
      const res1 = await betaAi.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: clean,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
      });
      const b64 = res1.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        if (ttsWavCache.size >= MAX_TTS_CACHE_ITEMS) {
          const firstKey = ttsWavCache.keys().next().value;
          if (firstKey) ttsWavCache.delete(firstKey);
        }
        ttsWavCache.set(cacheKey, b64);
        return { b64 };
      }
    } catch (e: any) {
      errors.push(`beta-3.8-plain: ${e?.message || String(e)}`);
    }

    // Attempt 2: betaAi with gemini-2.5-flash-preview-tts
    try {
      const res2 = await betaAi.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: clean }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
      });
      const b64 = res2.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (b64) {
        ttsWavCache.set(cacheKey, b64);
        return { b64 };
      }
    } catch (e: any) {
      errors.push(`beta-2.5-tts: ${e?.message || String(e)}`);
    }

    return { b64: null, err: errors.join(' | ') };
  })();

  inFlightTts.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightTts.delete(cacheKey);
  }
}

function determineSuggestedState(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.includes('scan') || lower.includes('camera') || lower.includes('vision')) {
    return 'vision';
  } else if (lower.includes('alert') || lower.includes('security') || lower.includes('breach')) {
    return 'alert';
  } else if (
    lower.includes('status') ||
    lower.includes('diagnostic') ||
    lower.includes('analyze') ||
    lower.includes('explain') ||
    lower.includes('code')
  ) {
    return 'reasoning';
  }
  return 'speaking';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const httpServer = http.createServer(app);

  // ============================================================================
  // STEP 1 CONVERSATION STREAMING ROUTE: SSE (/api/jarvis/chat/stream)
  // Streams real-time tokens to the HUD with zero double-talking and full context
  // ============================================================================
  app.post('/api/jarvis/chat/stream', async (req, res) => {
    const {
      message,
      sessionId = 'default-session',
      history = [],
      telemetry,
      model = 'gemini-3.1-flash-lite',
    } = req.body as {
      message?: string;
      sessionId?: string;
      history?: ConversationTurn[];
      telemetry?: { cpu?: number; ram?: number; disk?: number };
      model?: string;
    };

    const userText = (message || '').trim();
    if (!userText) {
      res.status(400).json({ error: 'Message is required and cannot be empty.' });
      return;
    }

    // Configure Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const sendSSE = (event: string, data: Record<string, unknown>) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // Synchronize session context
    const contextTurns = ConversationContextManager.getContextHistory(sessionId, history);
    const fullPrompt = buildPromptWithContext(userText, contextTurns, telemetry);
    const suggestedState = determineSuggestedState(userText);

    // Save user message to session context
    ConversationContextManager.addTurn(sessionId, { sender: 'user', text: userText });

    const ai = getGenAIClient();
    if (!ai) {
      // Local smart fallback in SSE stream
      const fallback = buildFallbackResponse(userText);
      sendSSE('chunk', { chunk: fallback.reply, state: fallback.state });
      sendSSE('done', {
        done: true,
        fullReply: fallback.reply,
        state: fallback.state,
        voice: 'Charon',
        locale: 'en-IN',
      });
      ConversationContextManager.addTurn(sessionId, { sender: 'jarvis', text: fallback.reply });
      res.end();
      return;
    }

    let fullReply = '';
    let streamSucceeded = false;

    // Use fast gemini-3.1-flash-lite for instant <500ms time-to-first-token streaming
    try {
      const selectedModel =
        model && typeof model === 'string' && model.startsWith('gemini-')
          ? model
          : 'gemini-3.1-flash-lite';

      const config: Record<string, unknown> = {
        systemInstruction: JARVIS_SYSTEM_PROMPT,
      };
      if (selectedModel === 'gemini-3.1-flash-lite') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }

      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: fullPrompt,
        config,
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          fullReply += text;
          sendSSE('chunk', { chunk: text, state: suggestedState });
        }
      }
      streamSucceeded = true;
    } catch {
      // Fallback to local intelligent rules
      const fallback = buildFallbackResponse(userText);
      fullReply = fallback.reply;
      sendSSE('chunk', { chunk: fallback.reply, state: fallback.state });
    }

    const cleanReply = fullReply.trim();
    ConversationContextManager.addTurn(sessionId, { sender: 'jarvis', text: cleanReply });

    // Pre-start Charon Hindi TTS synthesis in background immediately so /api/jarvis/tts joins inFlightTts with zero delay
    if (cleanReply) {
      void synthesizeCharonWav(cleanReply);
    }

    sendSSE('done', {
      done: true,
      fullReply: cleanReply,
      state: suggestedState,
      voice: 'Charon',
      locale: 'hi-IN',
      streamed: streamSucceeded,
    });
    res.end();
  });

  // ============================================================================
  // STEP 1 STANDARD CONVERSATION ROUTE: JSON (/api/jarvis/chat)
  // Non-streaming endpoint for single-turn or batch consumers
  // ============================================================================
  app.post('/api/jarvis/chat', async (req, res) => {
    const {
      message,
      sessionId = 'default-session',
      history = [],
      telemetry,
      includeAudio = false,
      model = 'gemini-3.1-flash-lite',
    } = req.body as {
      message?: string;
      sessionId?: string;
      history?: ConversationTurn[];
      telemetry?: { cpu?: number; ram?: number; disk?: number };
      includeAudio?: boolean;
      model?: string;
    };

    const userText = (message || '').trim();
    if (!userText) {
      res.status(400).json({ error: 'Message is required and cannot be empty.' });
      return;
    }

    const contextTurns = ConversationContextManager.getContextHistory(sessionId, history);
    const fullPrompt = buildPromptWithContext(userText, contextTurns, telemetry);
    const suggestedState = determineSuggestedState(userText);

    ConversationContextManager.addTurn(sessionId, { sender: 'user', text: userText });

    const ai = getGenAIClient();
    if (!ai) {
      const fallback = buildFallbackResponse(userText);
      ConversationContextManager.addTurn(sessionId, { sender: 'jarvis', text: fallback.reply });
      res.json({
        reply: fallback.reply,
        state: fallback.state,
        audioWavBase64: null,
        voice: 'Charon',
        locale: 'en-IN',
      });
      return;
    }

    let replyText = '';
    try {
      const selectedModel =
        model && typeof model === 'string' && model.startsWith('gemini-')
          ? model
          : 'gemini-3.1-flash-lite';

      const config: Record<string, unknown> = {
        systemInstruction: JARVIS_SYSTEM_PROMPT,
      };
      if (selectedModel === 'gemini-3.1-flash-lite') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
      }

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: fullPrompt,
        config,
      });

      replyText = (response.text ?? '').trim();
    } catch {
      replyText = buildFallbackResponse(userText).reply;
    }

    if (!replyText) {
      replyText = buildFallbackResponse(userText).reply;
    }

    ConversationContextManager.addTurn(sessionId, { sender: 'jarvis', text: replyText });

    const ttsRes = includeAudio ? await synthesizeCharonWav(replyText) : { b64: null };

    res.json({
      reply: replyText,
      state: suggestedState,
      audioWavBase64: ttsRes.b64,
      voice: 'Charon',
      locale: 'hi-IN',
    });
  });

  // ============================================================================
  // CHARON HINDI & INDIAN ENGLISH TTS ENDPOINT (/api/jarvis/tts)
  // ============================================================================
  app.post('/api/jarvis/tts', async (req, res) => {
    const { text } = req.body as { text?: string };
    const cleanText = (text || '').trim();
    if (!cleanText) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    const { b64, err } = await synthesizeCharonWav(cleanText);
    res.json({
      audioWavBase64: b64 || null,
      voice: 'Charon',
      locale: 'hi-IN',
      ...(err ? { debugError: err } : {}),
    });
  });

  // ============================================================================
  // CONVERSATION SESSION RESET ROUTE (/api/jarvis/session/reset)
  // Clears conversation history for the given session ID
  // ============================================================================
  app.post('/api/jarvis/session/reset', (req, res) => {
    const { sessionId = 'default-session' } = req.body as { sessionId?: string };
    ConversationContextManager.clearSession(sessionId);
    res.json({ success: true, sessionId });
  });

  // ============================================================================
  // RESERVED STEP 2 WEBSOCKET HOOK (Preserved without interfering with Step 1 conversation)
  // ============================================================================
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = request.url ? request.url.split('?')[0] : '';
    if (pathname === '/ws/jarvis-live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    // Keep alive heartbeat only; chat runs exclusively through the authoritative Step 1 streaming API
    const keepAliveTimer = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 15000);

    clientWs.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          clientWs.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
        }
      } catch {}
    });

    clientWs.on('close', () => {
      clearInterval(keepAliveTimer);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`JARVIS HUD Server & Conversation System running on http://0.0.0.0:${PORT}`);
    // Pre-warm Charon Hindi greeting audio into RAM cache for instant playback
    void synthesizeCharonWav('नमस्ते सर! जार्विस ऑनलाइन है। बताइए, आज मैं आपकी क्या मदद कर सकता हूँ?');
  });
}

startServer();
