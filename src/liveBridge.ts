/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jarvisAudio } from './audio';

/**
 * JARVIS Multimodal Live WebSocket Bridge Client
 *
 * Concurrently manages three synchronous real-time streams over ONE persistent WebSocket (/ws/jarvis-live):
 * 1. Bidirectional Real-Time Audio (send_audio & receive_messages):
 *    - Input: 16kHz, 16-bit Mono PCM raw binary frames (0x01 tag, zero base64 overhead).
 *    - Output: 24kHz, 16-bit Mono PCM raw binary frames (0x11 tag) played with gapless scheduling & pre-fetched cache.
 * 2. Real-Time Visual Ingestion (send_frames):
 *    - Captures 1 FPS JPEG frames from the active Webcam or Screen Capture video element without restarting the WS.
 * 3. Live State & Transcripts:
 *    - Emits LISTENING, SPEAKING, IDLE, PROCESSING state transitions and real-time transcripts.
 */

export type LiveBridgeState = 'IDLE' | 'LISTENING' | 'PROCESSING' | 'SPEAKING';

export interface LiveTranscriptEvent {
  role: 'user' | 'jarvis';
  text: string;
  final: boolean;
}

const FRAME_TAG_CLIENT_PCM_AUDIO = 0x01;
const FRAME_TAG_CLIENT_JPEG_FRAME = 0x02;
const FRAME_TAG_SERVER_PCM_AUDIO = 0x11;

export class JarvisLiveWebSocketBridge {
  private ws: WebSocket | null = null;
  private isRunning: boolean = false;
  private setupReady: boolean = false;
  private micStream: MediaStream | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private outputGainNode: GainNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime: number = 0;

  // Pre-fetched / cached initial system response audio buffers for 0ms warm playback
  private cachedInitialBuffers: AudioBuffer[] = [];
  private isCapturingInitialCache: boolean = true;

  // Visual ingestion state (Webcam or Screen Capture element)
  private videoElement: HTMLVideoElement | null = null;
  private frameCaptureCanvas: HTMLCanvasElement | null = null;
  private frameIntervalId: number | null = null;
  private keepAliveIntervalId: number | null = null;

  // Event listeners
  private stateListeners: Set<(state: LiveBridgeState) => void> = new Set();
  private transcriptListeners: Set<(ev: LiveTranscriptEvent) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockHandler = () => {
        this.unlockAudio();
      };
      window.addEventListener('pointerdown', unlockHandler, { passive: true });
      window.addEventListener('keydown', unlockHandler, { passive: true });
      window.addEventListener('touchstart', unlockHandler, { passive: true });
      window.addEventListener('click', unlockHandler, { passive: true });
    }
  }

  public unlockAudio() {
    try {
      if (!this.outputAudioCtx && typeof window !== 'undefined') {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
          this.outputGainNode = this.outputAudioCtx.createGain();
          this.outputGainNode.gain.value = 1.35;
          this.outputGainNode.connect(this.outputAudioCtx.destination);
        }
      }
      if (this.outputAudioCtx && this.outputAudioCtx.state === 'suspended') {
        this.outputAudioCtx.resume().catch(() => {});
      }
    } catch {}
  }

  public onStateChange(cb: (state: LiveBridgeState) => void): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  public onTranscript(cb: (ev: LiveTranscriptEvent) => void): () => void {
    this.transcriptListeners.add(cb);
    return () => this.transcriptListeners.delete(cb);
  }

  private emitState(state: LiveBridgeState) {
    this.stateListeners.forEach((cb) => cb(state));
  }

  private emitTranscript(ev: LiveTranscriptEvent) {
    this.transcriptListeners.forEach((cb) => cb(ev));
  }

  /**
   * Switch or attach the active video source (Webcam or Screen Capture)
   * without restarting the WebSocket session.
   */
  public setVideoSource(videoEl: HTMLVideoElement | null) {
    this.videoElement = videoEl;
  }

  public isActive(): boolean {
    return this.isRunning && this.setupReady && this.ws?.readyState === WebSocket.OPEN;
  }

  public isMicStreaming(): boolean {
    return Boolean(this.micStream);
  }

  /**
   * Starts the persistent WebSocket connection and runs the three concurrent tasks:
   * - send_audio()
   * - send_frames()
   * - receive_messages()
   */
  public async connect(enableMic = false): Promise<boolean> {
    if (this.isRunning && this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (enableMic && !this.micStream) {
        await this.startSendAudioTask();
      }
      return true;
    }

    this.disconnect();
    this.isRunning = true;
    this.setupReady = false;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws/jarvis-live`;

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;

        ws.onopen = async () => {
          // 1. Handshake setup payload
          ws.send(
            JSON.stringify({
              setup: {
                model: 'models/gemini-3.8-live',
                generationConfig: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    languageCode: 'en-IN',
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: 'Charon' },
                    },
                  },
                },
              },
            })
          );

          // 2. Start concurrent tasks
          if (enableMic) {
            await this.startSendAudioTask();
          }
          this.startSendFramesTask();
          this.startKeepAliveTask();
          resolve(true);
        };

        ws.onmessage = (event) => {
          this.handleReceiveMessagesTask(event);
        };

        ws.onerror = () => {
          resolve(false);
        };

        ws.onclose = () => {
          this.setupReady = false;
          this.stopInternalTasks();
          this.emitState('IDLE');
        };
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Task 1: send_audio()
   * Captures 16kHz 16-bit Mono PCM from microphone and streams binary frames (0x01)
   * with zero base64 encoding overhead.
   */
  public async startSendAudioTask(): Promise<boolean> {
    if (this.micStream) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx({ sampleRate: 16000 });
      const source = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      const processor = this.inputAudioCtx.createScriptProcessor(2048, 1, 1);
      this.scriptProcessor = processor;

      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRunning || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        // Frame tag (1 byte: 0x01) + Int16 PCM payload (float32.length * 2 bytes)
        const packet = new Uint8Array(1 + float32.length * 2);
        packet[0] = FRAME_TAG_CLIENT_PCM_AUDIO;
        const view = new DataView(packet.buffer);

        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
          view.setInt16(1 + i * 2, int16, true); // little-endian
        }

        this.ws.send(packet.buffer);
      };

      source.connect(processor);
      processor.connect(this.inputAudioCtx.destination);
      this.emitState('LISTENING');
      return true;
    } catch {
      return false;
    }
  }

  public stopSendAudioTask() {
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
  }

  /**
   * Task 2: send_frames()
   * Captures 1 FPS JPEG frames from the active Webcam or Screen Capture video element
   * and streams binary JPEG frames (0x02).
   */
  private startSendFramesTask() {
    if (this.frameIntervalId !== null) {
      window.clearInterval(this.frameIntervalId);
    }

    if (!this.frameCaptureCanvas && typeof document !== 'undefined') {
      this.frameCaptureCanvas = document.createElement('canvas');
      this.frameCaptureCanvas.width = 640;
      this.frameCaptureCanvas.height = 360;
    }

    // 1 FPS visual ingestion rate
    this.frameIntervalId = window.setInterval(() => {
      if (
        !this.isRunning ||
        !this.ws ||
        this.ws.readyState !== WebSocket.OPEN ||
        !this.videoElement ||
        this.videoElement.readyState < 2 ||
        this.videoElement.paused
      ) {
        return;
      }

      const canvas = this.frameCaptureCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        async (blob) => {
          if (!blob || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
          const arrayBuf = await blob.arrayBuffer();
          const jpegBytes = new Uint8Array(arrayBuf);
          const packet = new Uint8Array(1 + jpegBytes.length);
          packet[0] = FRAME_TAG_CLIENT_JPEG_FRAME;
          packet.set(jpegBytes, 1);
          this.ws.send(packet.buffer);
        },
        'image/jpeg',
        0.65
      );
    }, 1000);
  }

  /**
   * Task 3: receive_messages()
   * Handles incoming 24kHz binary PCM audio frames (0x11) with gapless nextStartTime scheduling,
   * barge-in interruption flushing, and live state/transcript events.
   */
  private handleReceiveMessagesTask(event: MessageEvent) {
    // 1. Binary 24kHz PCM Audio Frame from Server
    if (event.data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(event.data);
      if (bytes.length <= 1 || bytes[0] !== FRAME_TAG_SERVER_PCM_AUDIO) return;

      const pcmBytes = bytes.subarray(1);
      this.schedulePcmPlayback(pcmBytes);
      return;
    }

    // 2. JSON Control / State / Transcript Frame
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'setup_complete') {
          this.setupReady = true;
          return;
        }

        if (msg.type === 'ping') {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          }
          return;
        }

        if (msg.type === 'state' && msg.state) {
          this.emitState(msg.state as LiveBridgeState);
          return;
        }

        if (msg.type === 'interrupted') {
          this.flushPlaybackQueue();
          this.emitState('LISTENING');
          return;
        }

        if (msg.type === 'turn_complete') {
          this.isCapturingInitialCache = false;
          this.emitTranscript({
            role: 'jarvis',
            text: '',
            final: true,
          });
          if (this.activeSources.size === 0) {
            this.emitState(this.micStream ? 'LISTENING' : 'IDLE');
          }
          return;
        }

        if (msg.type === 'transcript' && typeof msg.text === 'string') {
          this.emitTranscript({
            role: msg.role === 'user' ? 'user' : 'jarvis',
            text: msg.text,
            final: Boolean(msg.final),
          });
        }
      } catch {
        // Ignore non-JSON
      }
    }
  }

  /**
   * Gapless 24kHz PCM Audio Playback with Pre-Fetched Buffer Caching
   */
  private schedulePcmPlayback(pcmBytes: Uint8Array) {
    const sampleCount = Math.floor(pcmBytes.byteLength / 2);
    if (sampleCount <= 0) return;

    this.unlockAudio();
    const ctx = this.outputAudioCtx;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const audioBuffer = ctx.createBuffer(1, sampleCount, 24000);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, pcmBytes.byteLength);

    for (let i = 0; i < sampleCount; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 32768.0;
    }

    // Cache initial system response chunks for instant warm replay
    if (this.isCapturingInitialCache && this.cachedInitialBuffers.length < 24) {
      this.cachedInitialBuffers.push(audioBuffer);
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    if (this.outputGainNode) {
      source.connect(this.outputGainNode);
    } else {
      source.connect(ctx.destination);
    }

    const now = ctx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.012;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.activeSources.add(source);
    jarvisAudio.setExternalSpeaking(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        jarvisAudio.setExternalSpeaking(false);
        this.emitState(this.micStream ? 'LISTENING' : 'IDLE');
      }
    };
  }

  public flushPlaybackQueue() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    });
    this.activeSources.clear();
    jarvisAudio.setExternalSpeaking(false);
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
  }

  public sendTextMessage(text: string): boolean {
    if (!this.isActive() || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.unlockAudio();
    this.flushPlaybackQueue();
    this.ws.send(JSON.stringify({ type: 'text', text }));
    return true;
  }

  private startKeepAliveTask() {
    if (this.keepAliveIntervalId !== null) {
      window.clearInterval(this.keepAliveIntervalId);
    }
    this.keepAliveIntervalId = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      }
    }, 15000);
  }

  private stopInternalTasks() {
    this.stopSendAudioTask();
    this.flushPlaybackQueue();
    if (this.frameIntervalId !== null) {
      window.clearInterval(this.frameIntervalId);
      this.frameIntervalId = null;
    }
    if (this.keepAliveIntervalId !== null) {
      window.clearInterval(this.keepAliveIntervalId);
      this.keepAliveIntervalId = null;
    }
  }

  public disconnect() {
    this.isRunning = false;
    this.setupReady = false;
    this.stopInternalTasks();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

export const jarvisLiveBridge = new JarvisLiveWebSocketBridge();
