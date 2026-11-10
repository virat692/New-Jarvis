/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { CoreState, STATE_CONFIGS, StateConfig } from './types';
import { jarvisAudio } from './audio';
import { CameraPreview } from './CameraPreview';
import { ChatStream, ExternalChatEvent } from './ChatStream';
import { BottomHudDock } from './BottomHudDock';
import { TopRightClockHud } from './TopRightClockHud';

interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  alpha: number;
  drift: number;
}

interface ArcDischarge {
  startAngle: number;
  r1: number;
  r2: number;
  points: { x: number; y: number }[];
  life: number;
  maxLife: number;
}

interface TrailPoint {
  x: number;
  y: number;
}

// Helper to draw the radiant 8-pointed Dhruva Star (North Star / Polaris)
function drawDhruvaStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  nucleusRadius: number,
  rayLength: number,
  colorRGB: string,
  bloom: number,
  rotation: number
) {
  ctx.save();
  ctx.translate(x, y);

  // Outer radiant star aura
  const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rayLength * 1.3);
  auraGrad.addColorStop(0, `rgba(${colorRGB}, ${0.8 * bloom})`);
  auraGrad.addColorStop(0.35, `rgba(${colorRGB}, ${0.3 * bloom})`);
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.beginPath();
  ctx.arc(0, 0, rayLength * 1.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.rotate(rotation);

  // 4 Primary Long Diamond Needles (0°, 90°, 180°, 270°)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -nucleusRadius * 0.9);
    ctx.lineTo(rayLength, 0);
    ctx.lineTo(0, nucleusRadius * 0.9);
    ctx.lineTo(-rayLength * 0.12, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(${colorRGB}, ${0.85 * bloom})`;
    ctx.shadowColor = `rgb(${colorRGB})`;
    ctx.shadowBlur = 12 * bloom;
    ctx.fill();

    // Incandescent white hot core needle
    ctx.beginPath();
    ctx.moveTo(0, -nucleusRadius * 0.35);
    ctx.lineTo(rayLength * 0.85, 0);
    ctx.lineTo(0, nucleusRadius * 0.35);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  // 4 Secondary Diagonal Needles (45°, 135°, 225°, 315°)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -nucleusRadius * 0.55);
    ctx.lineTo(rayLength * 0.52, 0);
    ctx.lineTo(0, nucleusRadius * 0.55);
    ctx.lineTo(-rayLength * 0.1, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(${colorRGB}, ${0.7 * bloom})`;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -nucleusRadius * 0.25);
    ctx.lineTo(rayLength * 0.42, 0);
    ctx.lineTo(0, nucleusRadius * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  // Blazing White Star Center (Dhruva Core)
  ctx.beginPath();
  ctx.arc(0, 0, nucleusRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = `rgb(${colorRGB})`;
  ctx.shadowBlur = 18 * bloom;
  ctx.fill();

  ctx.restore();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coreState, setCoreState] = useState<CoreState>('idle');
  const coreStateRef = useRef<CoreState>('idle');
  const [externalChatEvent, setExternalChatEvent] = useState<ExternalChatEvent | null>(null);
  const [voiceTriggerCount, setVoiceTriggerCount] = useState<number>(0);

  // Live System Resources telemetry state & boost/purge animation trigger
  const telemetryRef = useRef<{ cpu: number; ram: number; disk: number; cores: number }>({
    cpu: 28,
    ram: 42,
    disk: 31,
    cores: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 8,
  });
  const [liveTelemetry, setLiveTelemetry] = useState<{ cpu: number; ram: number; disk: number }>({
    cpu: 28,
    ram: 42,
    disk: 31,
  });
  const sysBoostFlashRef = useRef<number>(0);

  // Sync crisp DOM telemetry numbers smoothly at 300ms intervals
  useEffect(() => {
    const timer = window.setInterval(() => {
      const { cpu, ram, disk } = telemetryRef.current;
      setLiveTelemetry((prev) =>
        prev.cpu === cpu && prev.ram === ram && prev.disk === disk
          ? prev
          : { cpu, ram, disk }
      );
    }, 300);
    return () => clearInterval(timer);
  }, []);

  // Track active asynchronous operation timer to avoid state conflicts
  const operationTimeoutRef = useRef<number | null>(null);

  // Centralized state transition dispatcher with sound and auto-reset
  const transitionToState = useCallback(
    (nextState: CoreState, autoReturnDelay?: number, speakDefaultPhrase = true) => {
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
        operationTimeoutRef.current = null;
      }

      setCoreState(nextState);
      coreStateRef.current = nextState;
      jarvisAudio.playStateSound(nextState);

      // Only speak default demo phrase when manually cycling to 'speaking' (not during live chat replies)
      if (speakDefaultPhrase) {
        if (nextState === 'speaking') {
          const speechPhrases = [
            'जार्विस ऑनलाइन है सर। सभी कोर सब-सिस्टम्स और टेलीमेट्री कंड्यूट्स पूरी तरह से काम कर रहे हैं।',
            'डायग्नोस्टिक पूरा हुआ सर। न्यूरल रिएक्टर की एफिशिएंसी 99 प्रतिशत पर स्थिर है।',
            'कमांड सफलतापूर्वक पूरा हुआ सर। आपके अगले आदेश की प्रतीक्षा है।',
          ];
          const phrase = speechPhrases[Math.floor(Math.random() * speechPhrases.length)];
          jarvisAudio.speak(
            phrase,
            undefined,
            () => {
              transitionToState('idle', undefined, false);
            },
            () => {
              transitionToState('idle', undefined, false);
            }
          );
        } else {
          jarvisAudio.cancelSpeech();
        }
      }

      if (autoReturnDelay && nextState !== 'offline') {
        operationTimeoutRef.current = window.setTimeout(() => {
          setCoreState('idle');
          coreStateRef.current = 'idle';
          operationTimeoutRef.current = null;
        }, autoReturnDelay);
      }
    },
    []
  );

  // Sync state ref
  useEffect(() => {
    coreStateRef.current = coreState;
  }, [coreState]);

  // Keyboard shortcut listener (disabled when typing inside command input!)
  useEffect(() => {
    const states: CoreState[] = [
      'idle',
      'listening',
      'thinking',
      'reasoning',
      'speaking',
      'executing',
      'vision',
      'happy',
      'alert',
      'error',
      'offline',
    ];

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        const nextIdx = (states.indexOf(coreStateRef.current) + 1) % states.length;
        transitionToState(states[nextIdx]);
      } else if (e.key >= '0' && e.key <= '9') {
        const keyMap: Record<string, CoreState> = {
          '1': 'idle',
          '2': 'listening',
          '3': 'thinking',
          '4': 'reasoning',
          '5': 'speaking',
          '6': 'executing',
          '7': 'vision',
          '8': 'happy',
          '9': 'alert',
          '0': 'error',
        };
        if (keyMap[e.key]) {
          transitionToState(keyMap[e.key]);
        }
      } else if (e.key === '-' || e.key === '_') {
        transitionToState('offline');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (operationTimeoutRef.current) {
        clearTimeout(operationTimeoutRef.current);
      }
      jarvisAudio.cleanup();
    };
  }, [transitionToState]);

  // Dynamic canvas coordinate width to match full-screen viewport aspect ratio
  // while keeping height fixed at 842 so 1px X === 1px Y (Central Core stays 100% circular!)
  const computeCanvasWidth = useCallback(() => {
    if (typeof window === 'undefined') return 1514;
    const w = Math.max(320, window.innerWidth);
    const h = Math.max(240, window.innerHeight);
    return Math.max(1420, Math.round(842 * (w / h)));
  }, []);

  const [canvasWidth, setCanvasWidth] = useState<number>(computeCanvasWidth);
  const canvasWidthRef = useRef<number>(canvasWidth);

  useEffect(() => {
    const handleResize = () => {
      const nextW = computeCanvasWidth();
      canvasWidthRef.current = nextW;
      setCanvasWidth(nextW);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [computeCanvasWidth]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load full-screen base image where the outer border extends to the canvas edges
    const img = new Image();
    img.src = '/assets/aistudio/hud_fullscreen_base.png';

    let animationFrameId: number;
    let angleOuter = 0;
    let angleMiddle = 0;
    let angleInner = 0;
    let plasmaPhase = 0;
    let time = 0;

    // Source image reference center (in 1514 x 842 base asset)
    const origCx = 752;
    const cy = 357;
    const rOuter = 303; // Outer boundary of concentric ring structure
    const rMid = 222;   // Intermediate ring boundary
    const rInner = 175; // Innermost mechanical ring boundary
    const rCore = 138;  // Glass sphere core radius

    // Meteor / Dhruva Star Trail History
    const meteorTrail: TrailPoint[] = [];

    // Particle Cloud initialization
    const particleCount = 40;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 18 + Math.random() * (rCore - 28),
        speed: (Math.random() * 0.02 + 0.01) * (Math.random() > 0.5 ? 1 : -1),
        size: Math.random() * 2.0 + 0.8,
        alpha: Math.random() * 0.6 + 0.3,
        drift: Math.random() * 0.03,
      });
    }

    // Active electrical discharges
    const discharges: ArcDischarge[] = [];

    const startAnimation = () => {
      canvas.height = 842;
      canvas.width = canvasWidthRef.current;

      // 1. Pre-clean base HUD asset into an ALPHA-TRANSPARENT foreground canvas:
      // By converting the baked-in dark background pixels into alpha = 0 (transparent)
      // while keeping 100% of the glowing HUD lines, icons, text, Central Core rings,
      // and rays (kiran), drawing the Left, Center, and Right HUD zones over our continuous
      // Night Dark-Blue radial background produces ZERO rectangular panel edges or shadows!
      const hudSource = document.createElement('canvas');
      hudSource.width = 1514;
      hudSource.height = 842;
      const hudCtx = hudSource.getContext('2d');
      if (hudCtx) {
        hudCtx.drawImage(img, 0, 0);
        const imgData = hudCtx.getImageData(0, 0, 1514, 842);
        const data = imgData.data;

        for (let y = 0; y < 842; y++) {
          for (let x = 0; x < 1514; x++) {
            const idx = (y * 1514 + x) * 4;
            const distFromCore = Math.hypot(x - origCx, y - cy);

            // A. Outer border & 4 rounded corners -> 100% transparent
            const isOuterEdge =
              x < 22 ||
              x >= 1495 ||
              y < 20 ||
              y >= 822 ||
              (x < 42 && y < 42) ||
              (x >= 1472 && y < 42) ||
              (x < 42 && y >= 800) ||
              (x >= 1472 && y >= 800);

            // B. Lower-left Chat/Conversation & Voice Input rectangular patch area -> 100% transparent
            const isLowerLeftChatArea = x < 538 && y >= 510 && distFromCore > 345;

            // C. Bottom-center baked-in ghost waveform/chevron area (below y = 660) -> 100% transparent
            const isBottomCenterWaveArea =
              x >= 500 && x <= 1005 && y >= 660;

            // D. Old narrow/square right-side camera frame & left guide line -> 100% transparent
            // (Replaced by the wide widescreen CameraPreview HUD panel & SVG frame)
            const isOldSquareCameraFrame =
              (x >= 1106 && y >= 140 && y <= 575) ||
              (x >= 1106 && x <= 1245 && y >= 75 && y <= 145);

            // E. Static baked-in CPU / RAM / DISK labels, bars, static percentage numbers, AND bottom-right Upload [↑] icon -> 100% transparent
            const isStaticSystemResourceBars =
              (x >= 1134 && x <= 1398 && y >= 650 && y <= 762) ||
              (x >= 1398 && x <= 1465 && y >= 658 && y <= 750) ||
              (x >= 1390 && x <= 1488 && y >= 750 && y <= 815);

            if (
              isOuterEdge ||
              isLowerLeftChatArea ||
              isBottomCenterWaveArea ||
              isOldSquareCameraFrame ||
              isStaticSystemResourceBars
            ) {
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
              data[idx + 3] = 0;
              continue;
            }

            // D. Extract glowing HUD foreground & Central Core rays (kiran) with smooth alpha transparency:
            // D. Extract glowing HUD foreground, Central Core outer-line glowing foam, & rays (kiran):
            // Near the Central Core's outer ring (distFromCore <= 370), preserve the soft glowing cyan-blue
            // foam/aura while keeping outer background pixels (distFromCore > 370) at alpha = 0.
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const foamProximity = Math.max(0, Math.min(1, 1 - Math.max(0, distFromCore - 298) / 45));
            const gFloor = 18 - 3 * foamProximity;
            const bFloor = 44 - 6 * foamProximity;

            const dr = r;
            const dg = Math.max(0, g - gFloor);
            const db = Math.max(0, b - bFloor);
            const maxDelta = Math.max(dr, dg, db);

            const threshold = 4 - 1 * foamProximity;
            if (maxDelta <= threshold) {
              data[idx] = 0;
              data[idx + 1] = 0;
              data[idx + 2] = 0;
              data[idx + 3] = 0;
            } else {
              const alphaDivisor = 76 - 14 * foamProximity;
              const a = Math.min(1, (maxDelta - threshold) / alphaDivisor);
              if (a < 1) {
                data[idx] = Math.min(255, Math.round(dr / a));
                data[idx + 1] = Math.min(255, Math.round(dg / a));
                data[idx + 2] = Math.min(255, Math.round(db / a));
                data[idx + 3] = Math.round(a * 255);
              } else {
                data[idx + 3] = 255;
              }
            }
          }
        }
        hudCtx.putImageData(imgData, 0, 0);
      }

      // 2. Pre-build Center Slice (sx: 392..1106) with alpha-transparent background,
      // preserving all Central Core rays (kiran) and removing only the 'ASSISTANT' overhang at top-left.
      const centerSliceCanvas = document.createElement('canvas');
      centerSliceCanvas.width = 714;
      centerSliceCanvas.height = 842;
      const centerSliceCtx = centerSliceCanvas.getContext('2d');
      if (centerSliceCtx) {
        centerSliceCtx.drawImage(hudSource, 392, 0, 714, 842, 0, 0, 714, 842);
        const cData = centerSliceCtx.getImageData(0, 0, 714, 842);
        const cd = cData.data;

        for (let y = 0; y < 842; y++) {
          for (let x = 0; x < 714; x++) {
            const idx = (y * 714 + x) * 4;

            // Remove 'ASSISTANT' text & underline overhang (x: 0..132, y: 0..126) inside Center slice
            if (x < 132 && y < 126) {
              cd[idx] = 0;
              cd[idx + 1] = 0;
              cd[idx + 2] = 0;
              cd[idx + 3] = 0;
              continue;
            }

            // Softly feather alpha at extreme left (x < 18) and right (x > 696) slice edges
            // (excluding the horizontal crosshair ray at y = 340..374 so the ray stays 100% intact)
            if (Math.abs(y - cy) > 17) {
              if (x < 18) {
                cd[idx + 3] = Math.round(cd[idx + 3] * (x / 18));
              } else if (x > 696) {
                cd[idx + 3] = Math.round(cd[idx + 3] * ((713 - x) / 17));
              }
            }
          }
        }
        centerSliceCtx.putImageData(cData, 0, 0);
      }

      // Real-time smoothed System Resources metrics
      let liveCpu = 28;
      let liveRam = 42;
      let liveDisk = 31;
      let realRamBaseline = 42;
      let realDiskBaseline = 31;

      // Sample real browser storage quota if available
      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        navigator.storage
          .estimate()
          .then((est) => {
            if (est.usage && est.quota) {
              const pct = Math.round((est.usage / est.quota) * 100);
              if (pct >= 5 && pct <= 95) {
                realDiskBaseline = pct;
              }
            }
          })
          .catch(() => {});
      }

      const render = () => {
        time += 0.025;

        const targetW = canvasWidthRef.current;
        if (canvas.width !== targetW) {
          canvas.width = targetW;
          meteorTrail.length = 0;
          discharges.length = 0;
        }

        const extraW = targetW - 1514;
        const halfExtra = extraW / 2;
        const cx = origCx + halfExtra;

        const currentState = coreStateRef.current;
        const stateConf: StateConfig = STATE_CONFIGS[currentState];

        // Dynamic motion parameters derived directly from centralized state
        const isOffline = currentState === 'offline';
        const outerSpeed = isOffline ? 0.001 : 0.006 * stateConf.waveformSpeed;
        const middleSpeed = isOffline ? -0.001 : -0.009 * stateConf.waveformSpeed;
        const innerSpeed = isOffline ? 0.002 : 0.015 * stateConf.waveformSpeed;
        const plasmaSpeed = isOffline ? 0.005 : 0.03 * stateConf.waveformSpeed;
        const bloom = isOffline ? 0.25 : stateConf.isError ? 1.2 : 0.85;

        angleOuter += outerSpeed;
        angleMiddle += middleSpeed;
        angleInner += innerSpeed;
        plasmaPhase += plasmaSpeed;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // ==========================================
        // 1. AMBIENT BACKDROP INSIDE CORE APERTURE
        // ==========================================
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter + 3, 0, Math.PI * 2);
        ctx.clip();

        const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rOuter);
        bgGrad.addColorStop(0, '#04162e');
        bgGrad.addColorStop(0.65, '#020b18');
        bgGrad.addColorStop(1, '#02050c');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(cx - rOuter - 5, cy - rOuter - 5, (rOuter + 5) * 2, (rOuter + 5) * 2);

        // Fixed alignment crosshair lines
        ctx.strokeStyle = `rgba(${stateConf.primaryRGB}, ${0.35 + bloom * 0.15})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(cx - rOuter, cy);
        ctx.lineTo(cx + rOuter, cy);
        ctx.moveTo(cx, cy - rOuter);
        ctx.lineTo(cx, cy + rOuter);
        ctx.stroke();

        // Concentric acoustic / radar pulses for active states
        if (['listening', 'speaking', 'happy', 'alert'].includes(currentState)) {
          const rippleCount = 3;
          for (let w = 0; w < rippleCount; w++) {
            const waveProgress = ((time * 1.5 + w * 0.33) % 1.0);
            const waveR = rCore + waveProgress * (rOuter - rCore);
            const waveAlpha = (1.0 - waveProgress) * 0.35 * bloom;
            ctx.strokeStyle = `rgba(${stateConf.accentRGB}, ${waveAlpha})`;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(cx, cy, waveR, 0, Math.PI * 2);
            ctx.stroke();
          }
        }

        ctx.restore();

        // ==========================================
        // 2. LAYER 1: ACTUAL OUTER RING (rMid to rOuter)
        // ==========================================
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rOuter + 1, 0, Math.PI * 2, false);
        ctx.arc(cx, cy, rMid - 1, 0, Math.PI * 2, true);
        ctx.clip();

        ctx.translate(cx, cy);
        ctx.rotate(angleOuter);
        ctx.drawImage(img, -origCx, -cy);
        ctx.restore();

        // Sequential traveling light segment on outer ring
        if (!isOffline) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, rOuter, 0, Math.PI * 2, false);
          ctx.arc(cx, cy, rMid, 0, Math.PI * 2, true);
          ctx.clip();
          const pulseAngle = (time * 2.8) % (Math.PI * 2);
          const pulseGrad = ctx.createLinearGradient(
            cx + Math.cos(pulseAngle) * rOuter,
            cy + Math.sin(pulseAngle) * rOuter,
            cx + Math.cos(pulseAngle + 0.6) * rOuter,
            cy + Math.sin(pulseAngle + 0.6) * rOuter
          );
          pulseGrad.addColorStop(0, `rgba(${stateConf.primaryRGB}, 0)`);
          pulseGrad.addColorStop(0.5, `rgba(${stateConf.primaryRGB}, ${0.5 * bloom})`);
          pulseGrad.addColorStop(1, `rgba(${stateConf.primaryRGB}, 0)`);
          ctx.strokeStyle = pulseGrad;
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.arc(cx, cy, (rOuter + rMid) / 2 + 10, pulseAngle - 0.4, pulseAngle + 0.4);
          ctx.stroke();
          ctx.restore();
        }

        // ==========================================
        // 3. LAYER 2: ACTUAL MIDDLE RING (rInner to rMid)
        // ==========================================
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rMid + 1, 0, Math.PI * 2, false);
        ctx.arc(cx, cy, rInner - 1, 0, Math.PI * 2, true);
        ctx.clip();

        ctx.translate(cx, cy);
        ctx.rotate(-angleMiddle);
        ctx.drawImage(img, -origCx, -cy);
        ctx.restore();

        // Orbiting indicator dots on middle track
        if (!isOffline) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(-angleMiddle * 1.6);
          ctx.fillStyle = `rgb(${stateConf.primaryRGB})`;
          ctx.shadowColor = `rgb(${stateConf.primaryRGB})`;
          ctx.shadowBlur = 8;
          for (let d = 0; d < 4; d++) {
            const dAngle = (d * Math.PI) / 2;
            const dx = Math.cos(dAngle) * ((rMid + rInner) / 2);
            const dy = Math.sin(dAngle) * ((rMid + rInner) / 2);
            ctx.beginPath();
            ctx.arc(dx, dy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // ==========================================
        // 4. LAYER 3: INNER MECHANICAL RING (rCore to rInner)
        // ==========================================
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rInner + 1, 0, Math.PI * 2, false);
        ctx.arc(cx, cy, rCore - 1, 0, Math.PI * 2, true);
        ctx.clip();

        ctx.translate(cx, cy);
        ctx.rotate(angleInner);
        ctx.drawImage(img, -origCx, -cy);
        ctx.restore();

        // ==========================================
        // 5. ELECTRICAL ARCS / DISCHARGES
        // ==========================================
        const dischargeChance =
          currentState === 'alert'
            ? 0.35
            : currentState === 'error'
            ? 0.45
            : isOffline
            ? 0
            : 0.05;

        if (Math.random() < dischargeChance) {
          const arcAngle = Math.random() * Math.PI * 2;
          const arcSteps = 6;
          const points = [];
          for (let s = 0; s <= arcSteps; s++) {
            const frac = s / arcSteps;
            const dist = rCore + frac * (rMid - rCore);
            const jitter = (Math.random() - 0.5) * 16;
            points.push({
              x: cx + Math.cos(arcAngle) * dist - Math.sin(arcAngle) * jitter,
              y: cy + Math.sin(arcAngle) * dist + Math.cos(arcAngle) * jitter,
            });
          }
          discharges.push({
            startAngle: arcAngle,
            r1: rCore,
            r2: rMid,
            points,
            life: 0,
            maxLife: 4 + Math.floor(Math.random() * 4),
          });
        }

        ctx.save();
        for (let i = discharges.length - 1; i >= 0; i--) {
          const arc = discharges[i];
          arc.life++;
          const arcAlpha = 1.0 - arc.life / arc.maxLife;
          ctx.strokeStyle = `rgba(${stateConf.accentRGB}, ${arcAlpha * 0.9})`;
          ctx.shadowColor = `rgb(${stateConf.primaryRGB})`;
          ctx.shadowBlur = 10;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          arc.points.forEach((pt, pIdx) => {
            if (pIdx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
          if (arc.life >= arc.maxLife) {
            discharges.splice(i, 1);
          }
        }
        ctx.restore();

        // ==========================================
        // 6. INNER ENERGY CORE: GLASS SPHERE WITH DHRUVA STAR METEOR
        // ==========================================
        const pulse =
          1.0 + Math.sin(time * (isOffline ? 1.0 : stateConf.waveformSpeed * 1.5)) * 0.035;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rCore * pulse, 0, Math.PI * 2);
        ctx.clip();

        // Base image core sphere texture rotating
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        ctx.rotate(plasmaPhase * 0.25);
        ctx.drawImage(img, -origCx, -cy);
        ctx.restore();

        // Dhruva Star Meteor Orbit
        const starOrbitR = rCore * (isOffline ? 0.2 : 0.52);
        const starX = cx + Math.cos(plasmaPhase * 0.85) * starOrbitR;
        const starY = cy + Math.sin(plasmaPhase * 1.35) * (starOrbitR * 0.68);

        meteorTrail.unshift({ x: starX, y: starY });
        if (meteorTrail.length > 22) {
          meteorTrail.pop();
        }

        // Meteor Stardust Trail
        if (!isOffline && meteorTrail.length > 2) {
          ctx.save();
          for (let i = 0; i < meteorTrail.length - 1; i++) {
            const pt1 = meteorTrail[i];
            const pt2 = meteorTrail[i + 1];
            const frac = 1.0 - i / meteorTrail.length;
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.strokeStyle = `rgba(${stateConf.primaryRGB}, ${frac * 0.7 * bloom})`;
            ctx.lineWidth = frac * 7.5 + 1.2;
            ctx.shadowColor = `rgb(${stateConf.primaryRGB})`;
            ctx.shadowBlur = 12 * bloom;
            ctx.lineCap = 'round';
            ctx.stroke();
          }

          // White hot streak inside meteor head
          ctx.beginPath();
          ctx.moveTo(meteorTrail[0].x, meteorTrail[0].y);
          for (let i = 1; i < Math.min(10, meteorTrail.length); i++) {
            ctx.lineTo(meteorTrail[i].x, meteorTrail[i].y);
          }
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 2.2;
          ctx.shadowBlur = 6;
          ctx.stroke();

          // Stardust sparks
          for (let i = 2; i < meteorTrail.length; i += 2) {
            const pt = meteorTrail[i];
            const sparkFrac = 1.0 - i / meteorTrail.length;
            const jitterX = Math.sin(i * 4 + time * 6) * 5;
            const jitterY = Math.cos(i * 4 + time * 6) * 5;
            ctx.fillStyle = i % 4 === 0 ? '#ffffff' : `rgba(${stateConf.primaryRGB}, ${sparkFrac * 0.8})`;
            ctx.shadowColor = `rgb(${stateConf.primaryRGB})`;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(pt.x + jitterX, pt.y + jitterY, sparkFrac * 2.4 + 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // Radiant Dhruva Star
        const starRayLength =
          (isOffline ? 16 : 30 + Math.sin(time * 5) * 4) * (0.8 + bloom * 0.35);
        const starNucleus = (isOffline ? 3.5 : 5.2) + Math.sin(time * 6) * 0.8;
        const starRotation = time * (isOffline ? 0.2 : 0.8);

        drawDhruvaStar(
          ctx,
          starX,
          starY,
          starNucleus,
          starRayLength,
          stateConf.primaryRGB,
          bloom,
          starRotation
        );

        // Quantum particles
        ctx.save();
        for (let p = 0; p < particles.length; p++) {
          const part = particles[p];
          part.angle += part.speed * (isOffline ? 0.2 : stateConf.waveformSpeed);
          part.radius += Math.sin(time + p) * part.drift;

          if (part.radius > rCore - 12) part.radius = rCore - 15;
          if (part.radius < 10) part.radius = 12;

          const px = cx + Math.cos(part.angle) * part.radius;
          const py = cy + Math.sin(part.angle) * part.radius;

          ctx.fillStyle =
            p % 4 === 0
              ? 'rgba(255, 255, 255, 0.9)'
              : `rgba(${stateConf.accentRGB}, ${isOffline ? 0.3 : 0.75})`;
          ctx.shadowColor = `rgb(${stateConf.primaryRGB})`;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(px, py, part.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Central Volumetric Glow / Soft Cyan Bloom
        const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, rCore);
        coreGlow.addColorStop(0, `rgba(255, 255, 255, ${0.45 * bloom})`);
        coreGlow.addColorStop(0.35, `rgba(${stateConf.primaryRGB}, ${0.35 * bloom})`);
        coreGlow.addColorStop(0.75, `rgba(${stateConf.primaryRGB}, ${0.15 * bloom})`);
        coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, rCore, 0, Math.PI * 2);
        ctx.fill();

        // Glass sphere lens highlight
        const flareGrad = ctx.createRadialGradient(cx + 45, cy - 40, 2, cx + 45, cy - 40, 32);
        flareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
        flareGrad.addColorStop(0.4, 'rgba(186, 230, 253, 0.35)');
        flareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = flareGrad;
        ctx.beginPath();
        ctx.arc(cx + 45, cy - 40, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // Restore from rCore clip

        // ==========================================
        // 7. FULL-SCREEN 3-ZONE RESPONSIVE HUD MASK
        // Seamless #000d1c background with zero rectangular panels or seams
        // ==========================================
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.arc(cx, cy, rOuter, 0, Math.PI * 2, true);
        ctx.clip();

        // Continuous Full-Screen Deep Night Dark-Blue Background with Central Core Radial Illumination (Roshni):
        // Ultra-dark night-blue palette from #00091e right around the Core to #000105 at the outer edges.
        const maxBgRadius = Math.max(canvas.width, canvas.height) * 0.72;
        const hudBgGrad = ctx.createRadialGradient(
          cx,
          cy,
          rOuter * 0.85,
          cx,
          cy,
          maxBgRadius
        );
        if (isOffline) {
          hudBgGrad.addColorStop(0, '#00040d');
          hudBgGrad.addColorStop(0.45, '#000207');
          hudBgGrad.addColorStop(1, '#000103');
        } else {
          hudBgGrad.addColorStop(0, '#00091e');    // Deep night-blue core glow right around the rings
          hudBgGrad.addColorStop(0.25, '#000514'); // Very dark midnight blue
          hudBgGrad.addColorStop(0.55, '#00020b'); // Ultra-dark night blue
          hudBgGrad.addColorStop(1, '#000105');    // Deepest night dark-blue at outer screen edges
        }
        ctx.fillStyle = hudBgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const centerDx = Math.round(392 + halfExtra);
        const rightDx = canvas.width - 408;

        const sysResLeftDx = 24;

        // A. Center Core Surround, Crosshairs & Glowing Rays (kiran) (alpha-transparent background)
        ctx.drawImage(centerSliceCanvas, centerDx, 0);

        // B. Left Zone (JARVIS ASSISTANT, SYSTEM MODULES, and SYSTEM RESOURCES below it)
        ctx.drawImage(hudSource, 0, 0, 392, 510, 0, 0, 392, 510);
        ctx.drawImage(hudSource, 392, 0, 130, 126, 392, 0, 130, 126);
        ctx.drawImage(hudSource, 1106, 575, 408, 250, sysResLeftDx, 559, 408, 250);

        ctx.restore();

        // D. Subtle ('Halka Sa') Glowing Foam / Aura along the Central Core's Outer Line (rOuter = 303):
        if (!isOffline) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const foamInnerR = rOuter - 8;
          const foamOuterR = rOuter + 28;
          const outerFoamGrad = ctx.createRadialGradient(
            cx,
            cy,
            foamInnerR,
            cx,
            cy,
            foamOuterR
          );
          outerFoamGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          outerFoamGrad.addColorStop(0.18, `rgba(${stateConf.primaryRGB}, ${0.045 * bloom})`);
          outerFoamGrad.addColorStop(0.28, `rgba(${stateConf.accentRGB}, ${0.085 * bloom})`);
          outerFoamGrad.addColorStop(0.45, `rgba(${stateConf.primaryRGB}, ${0.055 * bloom})`);
          outerFoamGrad.addColorStop(0.72, `rgba(0, 110, 255, ${0.025 * bloom})`);
          outerFoamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = outerFoamGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, foamOuterR, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // ==========================================
        // 8. LIVE INTERACTIVE SYSTEM RESOURCES TELEMETRY PANEL
        // Real-time animated CPU, RAM, and DISK bars, percentages, & diagnostic sweep
        // ==========================================
        {
          // Sample real JS heap memory if supported by browser
          const perfMem = (performance as any)?.memory;
          if (perfMem && perfMem.usedJSHeapSize && perfMem.jsHeapSizeLimit) {
            const heapRatio = (perfMem.usedJSHeapSize / perfMem.jsHeapSizeLimit) * 100;
            realRamBaseline = Math.max(36, Math.min(78, 38 + heapRatio * 0.6));
          }

          // State-based dynamic workload modulation
          let stateCpuBoost = 0;
          let stateRamBoost = 0;
          let stateDiskBoost = 0;
          if (currentState === 'thinking' || currentState === 'reasoning') {
            stateCpuBoost = 44;
            stateRamBoost = 18;
            stateDiskBoost = 9;
          } else if (currentState === 'executing' || currentState === 'vision') {
            stateCpuBoost = 52;
            stateRamBoost = 24;
            stateDiskBoost = 18;
          } else if (currentState === 'speaking' || currentState === 'listening') {
            stateCpuBoost = 18;
            stateRamBoost = 8;
            stateDiskBoost = 4;
          } else if (currentState === 'alert' || currentState === 'error') {
            stateCpuBoost = 62;
            stateRamBoost = 28;
            stateDiskBoost = 15;
          }

          // Decay optimization/diagnostic flash
          if (sysBoostFlashRef.current > 0) {
            sysBoostFlashRef.current = Math.max(0, sysBoostFlashRef.current - 0.018);
          }
          const boostWave = sysBoostFlashRef.current;

          const targetCpu = isOffline
            ? 2
            : Math.min(
                98,
                Math.max(
                  12,
                  28 +
                    stateCpuBoost +
                    Math.sin(time * 2.1) * 5.5 +
                    Math.cos(time * 3.7) * 3.2 -
                    boostWave * 10
                )
              );

          const targetRam = isOffline
            ? 8
            : Math.min(
                96,
                Math.max(
                  18,
                  realRamBaseline +
                    stateRamBoost +
                    Math.sin(time * 1.1 + 1.2) * 2.8 +
                    Math.cos(time * 2.3) * 1.4 -
                    boostWave * 12
                )
              );

          const targetDisk = isOffline
            ? 5
            : Math.min(
                95,
                Math.max(
                  15,
                  realDiskBaseline +
                    stateDiskBoost +
                    Math.sin(time * 0.8 + 2.5) * 1.8 +
                    Math.abs(Math.sin(time * 1.9)) * 1.6
                )
              );

          liveCpu += (targetCpu - liveCpu) * 0.09;
          liveRam += (targetRam - liveRam) * 0.07;
          liveDisk += (targetDisk - liveDisk) * 0.07;

          telemetryRef.current.cpu = Math.round(liveCpu);
          telemetryRef.current.ram = Math.round(liveRam);
          telemetryRef.current.disk = Math.round(liveDisk);

          const sysResLeftDx = 24;
          const barStartX = sysResLeftDx + 110;
          const barMaxW = 170;
          const barH = 11;
          const barRadius = 5.5;

          const sysResOffsetY = -16;
          const resourceRows = [
            { label: 'CPU', y: 671.5 + sysResOffsetY, val: liveCpu, phase: 0 },
            { label: 'RAM', y: 705.5 + sysResOffsetY, val: liveRam, phase: 1.4 },
            { label: 'DISK', y: 741.5 + sysResOffsetY, val: liveDisk, phase: 2.8 },
          ];

          ctx.save();

          // Render each live telemetry bar (CPU, RAM, DISK) — text labels & percentages are rendered via crisp HiDPI DOM overlay
          for (const row of resourceRows) {
            const topY = row.y - barH / 2;

            // 1. Recessed Dark-Blue Capsule Track
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(barStartX, topY, barMaxW, barH, barRadius);
            ctx.fillStyle = 'rgba(0, 18, 44, 0.72)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = isOffline
              ? 'rgba(100, 116, 139, 0.25)'
              : 'rgba(0, 195, 255, 0.32)';
            ctx.stroke();
            ctx.restore();

            // 2. Live Glowing Progress Fill Capsule
            const fillW = Math.max(barH, (Math.max(2, row.val) / 100) * barMaxW);
            const isHighLoad = row.val > 82 || stateConf.isError;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(barStartX, topY, fillW, barH, barRadius);

            const fillGrad = ctx.createLinearGradient(
              barStartX,
              row.y,
              barStartX + fillW,
              row.y
            );
            if (isOffline) {
              fillGrad.addColorStop(0, '#334155');
              fillGrad.addColorStop(1, '#475569');
            } else if (isHighLoad) {
              fillGrad.addColorStop(0, '#0088ff');
              fillGrad.addColorStop(0.6, '#00e5ff');
              fillGrad.addColorStop(1, '#fbbf24');
            } else {
              fillGrad.addColorStop(0, '#0062ff');
              fillGrad.addColorStop(0.55, '#00c6ff');
              fillGrad.addColorStop(1, '#7ef9ff');
            }

            ctx.fillStyle = fillGrad;
            ctx.shadowColor = isHighLoad ? '#38bdf8' : '#00e5ff';
            ctx.shadowBlur = isOffline ? 0 : (10 + boostWave * 8) * bloom;
            ctx.fill();

            // 3. Traveling Energy Shimmer inside the active bar
            if (!isOffline) {
              ctx.clip();
              const shimmerPos = ((time * 1.35 + row.phase) % 1.4) - 0.2;
              const shimmerX = barStartX + shimmerPos * fillW;
              const shimmerGrad = ctx.createLinearGradient(
                shimmerX - 18,
                row.y,
                shimmerX + 18,
                row.y
              );
              shimmerGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
              shimmerGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.55)');
              shimmerGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
              ctx.fillStyle = shimmerGrad;
              ctx.fillRect(barStartX, topY, fillW, barH);
            }
            ctx.restore();
          }

          // Cleanly close the bottom-right chamfered frame border of SYSTEM RESOURCES (where the Upload icon was removed)
          ctx.save();
          ctx.strokeStyle = isOffline
            ? 'rgba(100, 116, 139, 0.35)'
            : 'rgba(0, 216, 255, 0.65)';
          ctx.lineWidth = 1.4;
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = isOffline ? 0 : 5 * bloom;
          ctx.beginPath();
          ctx.moveTo(sysResLeftDx + 210, 788 + sysResOffsetY);
          ctx.lineTo(sysResLeftDx + 354, 788 + sysResOffsetY);
          ctx.lineTo(sysResLeftDx + 368, 774 + sysResOffsetY);
          ctx.lineTo(sysResLeftDx + 368, 748 + sysResOffsetY);
          ctx.stroke();
          ctx.restore();

          // 5. Diagnostic / Purge Laser Sweep Effect when System Resources is clicked
          if (boostWave > 0.01) {
            ctx.save();
            const scanY = 584 + (1 - boostWave) * 185;
            const scanGrad = ctx.createLinearGradient(
              sysResLeftDx + 18,
              scanY - 14,
              sysResLeftDx + 18,
              scanY + 14
            );
            scanGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
            scanGrad.addColorStop(0.5, `rgba(165, 243, 252, ${boostWave * 0.45})`);
            scanGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
            ctx.fillStyle = scanGrad;
            ctx.fillRect(sysResLeftDx + 18, 584, 352, 185);
            ctx.restore();
          }

          ctx.restore();
        }

        animationFrameId = requestAnimationFrame(render);
      };

      render();
    };

    if (img.complete && img.naturalWidth > 0) {
      startAnimation();
    } else {
      img.onload = startAnimation;
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Handle interactive clicks on the HUD canvas
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const halfExtra = (canvas.width - 1514) / 2;
    const currentCx = 752 + halfExtra;

    // 1. Click on Central Core (r = 303 at currentCx, cy=357)
    const distCore = Math.hypot(clickX - currentCx, clickY - 357);
    if (distCore <= 303) {
      const states: CoreState[] = [
        'idle',
        'listening',
        'thinking',
        'reasoning',
        'speaking',
        'executing',
        'vision',
        'happy',
        'alert',
        'error',
        'offline',
      ];
      const nextIdx = (states.indexOf(coreStateRef.current) + 1) % states.length;
      transitionToState(states[nextIdx]);
      return;
    }

    // 2. Click directly on Waveform / Status text area
    if (
      clickX >= 593 + halfExtra &&
      clickX <= 913 + halfExtra &&
      clickY >= 664 &&
      clickY <= 782
    ) {
      const states: CoreState[] = [
        'idle',
        'listening',
        'thinking',
        'reasoning',
        'speaking',
        'executing',
        'vision',
        'happy',
        'alert',
        'error',
        'offline',
      ];
      const nextIdx = (states.indexOf(coreStateRef.current) + 1) % states.length;
      transitionToState(states[nextIdx]);
      return;
    }

    // 3. Click on System Modules (left column anchored at x = 0)
    if (clickX >= 53 && clickX <= 273) {
      if (clickY >= 254 && clickY <= 309) {
        // Voice Assistant module -> activate voice listening mic
        setVoiceTriggerCount((c) => c + 1);
      } else if (clickY >= 314 && clickY <= 369) {
        transitionToState('vision', 3500, false);
        setExternalChatEvent({
          id: `mod-vision-${Date.now()}`,
          userCommand: 'Engage Vision & OCR optical scan',
        });
      } else if (clickY >= 374 && clickY <= 429) {
        transitionToState('reasoning', 3000, false);
        setExternalChatEvent({
          id: `mod-llm-${Date.now()}`,
          userCommand: 'Check LLM Brain neural status',
        });
      } else if (clickY >= 434 && clickY <= 494) {
        transitionToState('executing', 3000, false);
        setExternalChatEvent({
          id: `mod-os-${Date.now()}`,
          userCommand: 'Run OS Control subsystem check',
        });
      }
      return;
    }

    // 4. Click on System Resources Panel (now in lower-left HUD zone below System Modules)
    const sysResLeftDx = 24;
    if (
      clickX >= sysResLeftDx + 8 &&
      clickX <= sysResLeftDx + 372 &&
      clickY >= 578 &&
      clickY <= 782
    ) {
      sysBoostFlashRef.current = 1.0;
      const { cpu, ram, disk, cores } = telemetryRef.current;

      // Check if user clicked the bottom-right corner of the panel to Purge / Boost
      if (clickX >= sysResLeftDx + 295 && clickY >= 726) {
        jarvisAudio.playBeep(1180, 0.1);
        transitionToState('executing', 3500);
        setExternalChatEvent({
          id: `sys-purge-${Date.now()}`,
          userCommand: 'सिस्टम रिसोर्सेज ऑप्टिमाइज़ करो और मेमोरी कैश साफ़ करो',
          jarvisReply: `सर, मेमोरी कैश सफलतापूर्वक साफ़ कर दिया गया है। CPU ${Math.max(18, cpu - 6)}% (${cores} कोर्स) पर स्थिर है, RAM ${Math.max(24, ram - 8)}% पर ऑप्टिमाइज़ हो गया है, और डिस्क ${disk}% पर पूरी तरह स्वस्थ है।`,
        });
      } else {
        jarvisAudio.playBeep(880, 0.08);
        transitionToState('reasoning', 3500);
        setExternalChatEvent({
          id: `sys-diag-${Date.now()}`,
          userCommand: 'सिस्टम रिसोर्सेज टेलीमेट्री डायग्नोस्टिक चलाओ',
          jarvisReply: `सर, सिस्टम रिसोर्सेज सक्रिय हैं — CPU: ${cpu}% (${cores} लॉजिकल कोर्स), RAM: ${ram}%, और Disk I/O: ${disk}%। सभी हार्डवेयर सिस्टम्स पूरी क्षमता से काम कर रहे हैं।`,
        });
      }
    }
  };

  // Exact percentage positions derived from dynamic canvasWidth so overlays stay locked
  // to the far-left and far-right HUD zones on any screen width!
  const extraRightSpace = Math.max(0, (canvasWidth - 1514) / 2);
  const cameraWidthPx = Math.round(378 + Math.min(32, extraRightSpace * 0.25));
  const cameraRightPct = `${(32 / canvasWidth) * 100}%`;
  const cameraWidthPct = `${(cameraWidthPx / canvasWidth) * 100}%`;
  const sysResLeftPct = `${(32 / canvasWidth) * 100}%`;
  const sysResWidthPct = `${(360 / canvasWidth) * 100}%`;
  const chatRightWidthPx = Math.round(396 + Math.min(64, extraRightSpace * 0.45));
  const chatRightPct = `${(32 / canvasWidth) * 100}%`;
  const chatWidthPct = `${(chatRightWidthPx / canvasWidth) * 100}%`;
  const isOfflineState = coreState === 'offline';

  return (
    <div className="relative w-screen h-screen bg-[#000105] flex items-center justify-center p-0 m-0 overflow-hidden select-none box-border">
      {/* 
        Full-Screen Responsive JARVIS Dashboard (No outer outline border):
        Stretches edge-to-edge across the entire viewport.
        Left panels anchor to the far-left, Right panels anchor to the far-right,
        and the Central Core stays 100% circular in the exact center.
      */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-transparent">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full h-full block select-none cursor-pointer"
        />

        {/* 
          Sleek Thin ('Patla Sa') Top HUD Border:
          Matches the GUI and BottomHudDock aesthetic with 45° chamfered top corners,
          fading vertical side wings, and a subtle central stepped micro-accent line.
        */}
        <div className="absolute inset-x-0 top-0 h-[14%] z-30 pointer-events-none select-none overflow-visible">
          <svg
            viewBox="0 0 1514 120"
            preserveAspectRatio="none"
            className="w-full h-full overflow-visible"
            fill="none"
          >
            <defs>
              <filter id="topBorderCyanGlow" x="-10%" y="-30%" width="120%" height="160%">
                <feGaussianBlur stdDeviation="2.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="topWingFadeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isOfflineState ? '#64748b' : '#00d8ff'}
                  stopOpacity={isOfflineState ? '0.45' : '0.88'}
                />
                <stop
                  offset="35%"
                  stopColor={isOfflineState ? '#475569' : '#0099ff'}
                  stopOpacity={isOfflineState ? '0.3' : '0.62'}
                />
                <stop offset="100%" stopColor="#0055ff" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="topCenterLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop
                  offset="0%"
                  stopColor={isOfflineState ? '#64748b' : '#00a8ff'}
                  stopOpacity={isOfflineState ? '0.4' : '0.78'}
                />
                <stop
                  offset="50%"
                  stopColor={isOfflineState ? '#94a3b8' : '#5ceeff'}
                  stopOpacity={isOfflineState ? '0.5' : '0.95'}
                />
                <stop
                  offset="100%"
                  stopColor={isOfflineState ? '#64748b' : '#00a8ff'}
                  stopOpacity={isOfflineState ? '0.4' : '0.78'}
                />
              </linearGradient>
            </defs>

            {/* 1. Primary Thin Top Chamfered Border Line (Full-Width with Fading Side Wings) */}
            <path
              d="M 10 116 L 10 26 L 28 7 L 1486 7 L 1504 26 L 1504 116"
              stroke="url(#topWingFadeGrad)"
              strokeWidth="1.25"
              filter={isOfflineState ? undefined : 'url(#topBorderCyanGlow)'}
            />

            {/* 2. Continuous Razor-Thin Top Horizontal Span */}
            <line
              x1="28"
              y1="7"
              x2="1486"
              y2="7"
              stroke="url(#topCenterLineGrad)"
              strokeWidth="1.15"
              filter={isOfflineState ? undefined : 'url(#topBorderCyanGlow)'}
            />

            {/* 3. Subtle GUI-Matching Inner Micro-Stepped Accent in Top-Center */}
            <path
              d="M 520 7 L 532 13.5 L 982 13.5 L 994 7"
              stroke={isOfflineState ? '#475569' : '#009dff'}
              strokeWidth="0.9"
              strokeOpacity={isOfflineState ? '0.35' : '0.55'}
            />

            {/* 4. Crisp Glowing Corner & Center Highlights */}
            {!isOfflineState && (
              <>
                {/* Top-Left Chamfer Highlight */}
                <path
                  d="M 10 38 L 10 26 L 28 7 L 64 7"
                  stroke="#9ef8ff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  filter="url(#topBorderCyanGlow)"
                />
                {/* Top-Right Chamfer Highlight */}
                <path
                  d="M 1450 7 L 1486 7 L 1504 26 L 1504 38"
                  stroke="#9ef8ff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  filter="url(#topBorderCyanGlow)"
                />
                {/* Top-Left Bar Accent from Reference HUD */}
                <line
                  x1="112"
                  y1="7"
                  x2="176"
                  y2="7"
                  stroke="#38e8ff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  filter="url(#topBorderCyanGlow)"
                />
                {/* Top-Center Subtle Energy Node Highlight */}
                <line
                  x1="692"
                  y1="7"
                  x2="822"
                  y2="7"
                  stroke="#c8fcff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  filter="url(#topBorderCyanGlow)"
                />
              </>
            )}
          </svg>
        </div>

        {/* 
          Futuristic Top-Right Digital Clock, "// LIVE" Status Lens,
          Slanted Interface Brackets, Live Useful Telemetry & "111111" Ticks:
        */}
        <div
          className="absolute z-30 pointer-events-auto overflow-hidden"
          style={{
            right: cameraRightPct,
            top: '1.2%',
            width: cameraWidthPct,
            height: '19.5%',
          }}
        >
          <TopRightClockHud
            coreState={coreState}
            cpuPct={liveTelemetry.cpu}
            ramPct={liveTelemetry.ram}
          />
        </div>

        {/* 
          Compact Wide Live Camera Viewport:
          Sleek landscape proportions in the upper-right HUD zone.
        */}
        <div
          className="absolute z-20 pointer-events-auto overflow-visible"
          style={{
            right: cameraRightPct,
            top: '21.8%',
            width: cameraWidthPct,
            height: '34.5%',
          }}
        >
          <CameraPreview />
        </div>

        {/* 
          Crystal-Clear HiDPI System Resources Text Overlay (Lower-Left HUD Zone):
          Renders razor-sharp native DOM typography for LIVE status, CPU/RAM/DISK labels, and live percentages
          with zero canvas scaling blur.
        */}
        <div
          className="absolute z-20 pointer-events-none select-none antialiased"
          style={{
            left: sysResLeftPct,
            top: '68.65%',
            width: sysResWidthPct,
            height: '23.04%',
          }}
        >
          {/* Crisp Header Status Indicator ('LIVE' / 'OFFLINE') */}
          <div
            className="absolute flex items-center gap-1.5 -translate-y-1/2"
            style={{ top: '16.5%', right: '5.5%' }}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOfflineState
                  ? 'bg-slate-500'
                  : 'bg-[#00f2fe] shadow-[0_0_6px_#00f2fe] animate-pulse'
              }`}
            />
            <span
              className={`text-[11px] font-sans font-bold tracking-[0.12em] uppercase antialiased ${
                isOfflineState ? 'text-slate-400' : 'text-[#e0faff]'
              }`}
            >
              {isOfflineState ? 'OFFLINE' : 'LIVE'}
            </span>
          </div>

          {/* Crisp CPU / RAM / DISK Labels & Percentage Readouts */}
          {[
            { label: 'CPU', pct: liveTelemetry.cpu, topPct: '40.0%' },
            { label: 'RAM', pct: liveTelemetry.ram, topPct: '57.5%' },
            { label: 'DISK', pct: liveTelemetry.disk, topPct: '76.0%' },
          ].map((item) => (
            <div key={item.label}>
              <span
                className={`absolute -translate-y-1/2 text-[13px] font-sans font-bold tracking-[0.06em] antialiased ${
                  isOfflineState ? 'text-slate-400' : 'text-slate-100'
                }`}
                style={{ top: item.topPct, left: '6.7%' }}
              >
                {item.label}
              </span>
              <span
                className={`absolute -translate-y-1/2 text-[13.5px] font-sans font-bold tabular-nums tracking-[0.04em] antialiased ${
                  isOfflineState ? 'text-slate-400' : 'text-white'
                }`}
                style={{ top: item.topPct, left: '80.5%' }}
              >
                {item.pct}%
              </span>
            </div>
          ))}
        </div>

        {/* 
          Real-Time Holographic AI Chat Stream (Lower-Right HUD Zone):
          Utilizes the spacious right side below CameraPreview with strictly transparent background.
        */}
        <div
          className="absolute z-20 pointer-events-auto bg-transparent border-0 shadow-none outline-none overflow-visible"
          style={{
            right: chatRightPct,
            top: '60.2%',
            width: chatWidthPct,
            height: '30.8%',
            background: 'transparent',
            boxShadow: 'none',
            border: 'none',
          }}
        >
          <ChatStream
            coreState={coreState}
            onTriggerState={transitionToState}
            externalEvent={externalChatEvent}
            telemetry={liveTelemetry}
          />
        </div>

        {/* 
          Bottom HUD Dock (Symmetrical Audio Wave, Central Mic Button, Stepped 'STANDBY MODE' Pedestal,
          Full-Width Chamfered Bottom Border, and Command Input Pill):
        */}
        <BottomHudDock
          coreState={coreState}
          onTriggerState={transitionToState}
          onDispatchCommand={setExternalChatEvent}
          voiceTriggerCount={voiceTriggerCount}
        />
      </div>
    </div>
  );
}
