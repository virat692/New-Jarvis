/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CoreState } from './types';
import { jarvisAudio } from './audio';

interface TopRightClockHudProps {
  coreState: CoreState;
  cpuPct?: number;
  ramPct?: number;
}

/**
 * 7-Segment map for digits 0-9:
 * Segments: [a (top), b (top-right), c (bottom-right), d (bottom), e (bottom-left), f (top-left), g (middle)]
 */
const DIGIT_SEGMENTS: Record<string, [number, number, number, number, number, number, number]> = {
  '0': [1, 1, 1, 1, 1, 1, 0],
  '1': [0, 1, 1, 0, 0, 0, 0],
  '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1],
  '4': [0, 1, 1, 0, 0, 1, 1],
  '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1],
  '7': [1, 1, 1, 0, 0, 0, 0],
  '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1],
};

// Beveled 7-segment polygon definitions inside a 15x26 unit coordinate space
const SEGMENT_POLYGONS = [
  // a: top horizontal
  '2.6,1.4 13.4,1.4 11.8,3.8 4.0,3.8',
  // b: top-right vertical
  '13.8,1.8 13.2,12.5 11.2,11.2 11.7,4.1',
  // c: bottom-right vertical
  '13.0,13.8 12.4,24.4 10.4,22.2 11.0,15.1',
  // d: bottom horizontal
  '1.6,24.8 12.2,24.8 10.4,22.4 3.2,22.4',
  // e: bottom-left vertical
  '1.9,13.8 3.9,15.1 3.4,22.2 1.4,24.4',
  // f: top-left vertical
  '2.4,1.8 4.2,4.1 3.7,11.2 1.8,12.5',
  // g: middle horizontal
  '2.6,13.1 4.1,11.9 11.3,11.9 12.6,13.1 11.1,14.3 3.9,14.3',
];

export const TopRightClockHud: React.FC<TopRightClockHudProps> = ({
  coreState,
  cpuPct = 28,
  ramPct = 42,
}) => {
  const [useRealTime, setUseRealTime] = useState(true);
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean }>({
    level: 96,
    charging: true,
  });
  const [netInfo, setNetInfo] = useState<{ online: boolean; type: string; rtt: number }>({
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    type: 'WIFI/4G',
    rtt: 18,
  });

  const isOffline = coreState === 'offline';

  // Live 1-second clock & network telemetry updater
  useEffect(() => {
    const updateAll = () => {
      setNowDate(new Date());
      if (typeof navigator !== 'undefined') {
        const conn = (navigator as any).connection;
        const effType = conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : 'HIGH-SPD';
        const rttVal = typeof conn?.rtt === 'number' && conn.rtt > 0 ? conn.rtt : 18;
        setNetInfo({
          online: navigator.onLine,
          type: effType,
          rtt: rttVal,
        });
      }
    };
    updateAll();
    const timer = window.setInterval(updateAll, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real Browser Battery API integration
  useEffect(() => {
    let mounted = true;
    if (typeof navigator !== 'undefined' && (navigator as any).getBattery) {
      (navigator as any)
        .getBattery()
        .then((bat: any) => {
          if (!mounted || !bat) return;
          const syncBat = () => {
            setBatteryInfo({
              level: Math.round((bat.level ?? 0.96) * 100),
              charging: Boolean(bat.charging ?? true),
            });
          };
          syncBat();
          bat.addEventListener?.('levelchange', syncBat);
          bat.addEventListener?.('chargingchange', syncBat);
        })
        .catch(() => {});
    }
    return () => {
      mounted = false;
    };
  }, []);

  // Format time string ("HH:MM:SS" live by default, or "21:55:04" when toggled)
  const timeStr = useRealTime
    ? `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(
        2,
        '0'
      )}:${String(nowDate.getSeconds()).padStart(2, '0')}`
    : '21:55:04';

  // Useful formatted date & system details
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dateFormatted = `${String(nowDate.getDate()).padStart(2, '0')} ${
    months[nowDate.getMonth()]
  } ${nowDate.getFullYear()}`;
  const dayFormatted = days[nowDate.getDay()];
  const coresCount =
    typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 8;

  const chars = timeStr.split('');
  const activeDigitColor = isOffline ? '#64748b' : '#64f4ff';
  const dimDigitColor = isOffline ? 'rgba(100,116,139,0.08)' : 'rgba(0, 195, 255, 0.11)';

  // Exact X positions inside the 390-wide SVG viewBox (matching CameraPreview's 390 width 1:1)
  // Spans x = 36..158, leaving a clean 22px–54px gap before the "// LIVE" slash at x = 180..212!
  const charXPositions = [36, 54, 72, 79, 97, 115, 122, 140];

  return (
    <div
      onClick={() => {
        jarvisAudio.playBeep(980, 0.05);
        setUseRealTime((prev) => !prev);
      }}
      title="Click to toggle between Live System Time and 21:55:04 preset"
      className="relative w-full h-full select-none pointer-events-auto cursor-pointer overflow-hidden"
    >
      <span className="sr-only">{timeStr} // LIVE</span>

      {/* 
        1. UNIFIED 390x150 SVG FRAME (Matches CameraPreview 390 width 1:1):
        Renders the 7-segment digital clock, slanted "// LIVE" panel, circular lens indicator,
        angled sci-fi brackets, diagnostic grid, and "111111" ticks strictly within x = 4..386.
      */}
      <svg
        viewBox="0 0 390 150"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        fill="none"
      >
        <defs>
          <filter id="trHudGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="trDigitGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.8" result="blur1" />
            <feGaussianBlur stdDeviation="1.1" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="trIntenseGlow" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="3.8" result="blur1" />
            <feGaussianBlur stdDeviation="1.4" result="blur2" />
            <feMerge>
              <feMergeNode in="blur1" />
              <feMergeNode in="blur2" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="trLiveBoxGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#002b5e" stopOpacity="0.44" />
            <stop offset="100%" stopColor="#00122e" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="trLeftBracketFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={isOffline ? '#64748b' : '#00c8ff'} stopOpacity="0.88" />
            <stop offset="75%" stopColor={isOffline ? '#475569' : '#0088ff'} stopOpacity="0.58" />
            <stop offset="100%" stopColor="#0051ff" stopOpacity="0" />
          </linearGradient>
          <pattern id="trMicroGrid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path
              d="M 12 0 L 0 0 0 12"
              fill="none"
              stroke="rgba(0, 195, 255, 0.07)"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>

        {/* Subtle Faded Diagnostic Grid Backdrop strictly inside the Telemetry Zone (x = 42..374) */}
        <rect
          x="42"
          y="54"
          width="332"
          height="72"
          fill="url(#trMicroGrid)"
          opacity={isOffline ? 0.25 : 0.75}
        />

        {/* 
          ANGLED TRAPEZOID FRAME AROUND "// LIVE [O]" (x = 180..372, y = 12..48)
        */}
        <path
          d="M 180 48 L 212 12 L 354 12 L 372 30 L 354 48 Z"
          fill="url(#trLiveBoxGrad)"
          stroke={isOffline ? '#64748b' : '#00b8ff'}
          strokeWidth="1.25"
          strokeOpacity="0.88"
          filter={isOffline ? undefined : 'url(#trHudGlow)'}
        />

        {/* Outer Right Angled Guide Wing aligned with CameraPreview's right edge (x = 384) */}
        <path
          d="M 360 6 L 384 30 L 384 144"
          stroke="url(#trLeftBracketFade)"
          strokeWidth="1.15"
        />

        {/* 
          DIGITAL TIME IN 7-SEGMENT CYBERNETIC GEOMETRY (x = 36..155, y = 14..40)
        */}
        {chars.map((ch, idx) => {
          const xPos = charXPositions[idx] ?? 36 + idx * 17;
          if (ch === ':') {
            return (
              <g
                key={`colon-${idx}`}
                transform={`translate(${xPos}, 14)`}
                filter={isOffline ? undefined : 'url(#trDigitGlow)'}
              >
                <rect
                  x="0.8"
                  y="7"
                  width="3"
                  height="3"
                  rx="0.5"
                  fill={isOffline ? '#64748b' : '#8ef9ff'}
                />
                <rect
                  x="0.8"
                  y="16.5"
                  width="3"
                  height="3"
                  rx="0.5"
                  fill={isOffline ? '#64748b' : '#8ef9ff'}
                />
              </g>
            );
          }

          const segs = DIGIT_SEGMENTS[ch] || [0, 0, 0, 0, 0, 0, 0];
          return (
            <g key={`digit-${idx}`} transform={`translate(${xPos}, 14)`}>
              {SEGMENT_POLYGONS.map((points, sIdx) => {
                const isLit = segs[sIdx] === 1;
                return (
                  <polygon
                    key={sIdx}
                    points={points}
                    fill={isLit ? activeDigitColor : dimDigitColor}
                    filter={isLit && !isOffline ? 'url(#trDigitGlow)' : undefined}
                  />
                );
              })}
            </g>
          );
        })}

        {/* 
          SLANTED CYBER ITALIC "// LIVE" TEXT & CIRCULAR LENS STATUS OVERLAY
        */}
        <text
          x="222"
          y="35.5"
          fill={isOffline ? '#94a3b8' : '#b8faff'}
          fontSize="15"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontStyle="italic"
          fontWeight="700"
          letterSpacing="2.2"
          filter={isOffline ? undefined : 'url(#trHudGlow)'}
        >
          // LIVE
        </text>

        {/* Circular Lens Status Overlay in the right side of the "// LIVE" housing (center at 334, 30) */}
        <g transform="translate(334, 30)">
          <circle
            r="11.5"
            stroke={isOffline ? '#64748b' : '#00c8ff'}
            strokeWidth="1"
            strokeOpacity="0.48"
            fill={isOffline ? 'rgba(30,41,59,0.4)' : 'rgba(0, 180, 255, 0.14)'}
          />
          <circle
            r="8"
            stroke={isOffline ? '#94a3b8' : '#5cf2ff'}
            strokeWidth="1.35"
            strokeOpacity="0.9"
            filter={isOffline ? undefined : 'url(#trHudGlow)'}
          />
          <circle
            r="4.6"
            fill={isOffline ? '#64748b' : '#c8fcff'}
            filter={isOffline ? undefined : 'url(#trIntenseGlow)'}
          />
        </g>

        {/* 
          CUSTOM HORIZONTAL UNDERLINE & SLANTED SCI-FI GEOMETRIC INTERFACE LINES
        */}
        {/* Horizontal underline directly beneath the digital clock */}
        <path
          d="M 32 48 L 180 48"
          stroke={isOffline ? '#64748b' : '#00c8ff'}
          strokeWidth="1.3"
          strokeOpacity="0.88"
          filter={isOffline ? undefined : 'url(#trHudGlow)'}
        />

        {/* Slanted Left Stepped Interface Bracket aligned with CameraPreview's left edge (x = 6..180) */}
        <path
          d="M 212 12 L 180 48 L 160 68 L 36 68 L 6 98 L 6 144"
          stroke="url(#trLeftBracketFade)"
          strokeWidth="1.45"
          filter={isOffline ? undefined : 'url(#trHudGlow)'}
        />

        {/* Secondary Inner Parallel Slanted Accent Line */}
        <path
          d="M 164 73 L 40 73 L 14 99 L 14 140"
          stroke={isOffline ? '#475569' : '#0095ff'}
          strokeWidth="0.95"
          strokeOpacity="0.52"
        />

        {/* Bright Glowing Cyan-White Junction Highlight Bar under the Diagonal Slash */}
        {!isOffline && (
          <>
            <line
              x1="178"
              y1="48"
              x2="220"
              y2="48"
              stroke="#d8fcff"
              strokeWidth="2.6"
              strokeLinecap="round"
              filter="url(#trIntenseGlow)"
            />
            <rect x="192" y="52" width="22" height="2" fill="#38e8ff" opacity="0.82" />
            <rect x="198" y="56" width="13" height="1.5" fill="#00a8ff" opacity="0.62" />
          </>
        )}

        {/* Top column accent lines inside the telemetry box (strictly within x = 42..370) */}
        <line
          x1="44"
          y1="76"
          x2="132"
          y2="76"
          stroke={isOffline ? '#475569' : '#00b4ff'}
          strokeWidth="0.8"
          strokeOpacity="0.45"
        />
        <line
          x1="158"
          y1="64"
          x2="254"
          y2="64"
          stroke={isOffline ? '#475569' : '#00b4ff'}
          strokeWidth="0.8"
          strokeOpacity="0.45"
        />
        <line
          x1="274"
          y1="64"
          x2="370"
          y2="64"
          stroke={isOffline ? '#475569' : '#00b4ff'}
          strokeWidth="0.8"
          strokeOpacity="0.45"
        />

        {/* 
          SUBTLE FADED DIAGNOSTIC FRAMING & TINY "111111" (//////) PATTERN AT BOTTOM (y = 132..144)
        */}
        <path
          d="M 22 144 L 34 132 L 356 132 L 368 144"
          stroke={isOffline ? '#475569' : '#00a8ff'}
          strokeWidth="1.0"
          strokeOpacity="0.45"
        />

        {/* The 6 Slanted "111111" / Parallelogram Telemetry Ticks on the Bottom-Right (x = 310..354) */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const x = 310 + i * 7;
          return (
            <polygon
              key={i}
              points={`${x},136 ${x + 4},136 ${x + 6.4},143 ${x + 2.4},143`}
              fill={isOffline ? '#64748b' : '#38bdf8'}
              fillOpacity={isOffline ? 0.35 : 0.78}
            />
          );
        })}
      </svg>

      {/* 
        2. CRISP, MEANINGFUL LIVE SYSTEM DATA READOUTS (Strictly bounded inside the panel)
        Displays real Date/Day, CPU/RAM/Battery, and Network/Ping/State inside the telemetry frame.
      */}
      <div
        className={`absolute grid grid-cols-3 gap-2 font-mono text-[8.5px] leading-[12.5px] tracking-[0.04em] uppercase pointer-events-none select-none antialiased overflow-hidden ${
          isOffline ? 'text-slate-400' : 'text-[#7ef9ff]'
        }`}
        style={{
          left: '11.5%',
          right: '5.2%',
          top: '51%',
          bottom: '14%',
        }}
      >
        {/* Column 1: Live Date & Day */}
        <div className="flex flex-col justify-center min-w-0 truncate">
          <div className="flex items-center gap-1 truncate">
            <span className="text-[#38bdf8]/80">DATE:</span>
            <span className="text-[#e0faff] font-semibold truncate">{dateFormatted}</span>
          </div>
          <div className="flex items-center gap-1 truncate">
            <span className="text-[#38bdf8]/80">DAY:</span>
            <span className="truncate">{dayFormatted}</span>
          </div>
        </div>

        {/* Column 2: Live Hardware & Battery Telemetry */}
        <div className="flex flex-col justify-center min-w-0 truncate border-l border-cyan-500/20 pl-2">
          <div className="flex items-center justify-between gap-1 truncate">
            <span className="text-[#38bdf8]/80">CPU/RAM:</span>
            <span className="text-[#e0faff] font-semibold tabular-nums">
              {cpuPct}% / {ramPct}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 truncate">
            <span className="text-[#38bdf8]/80">POWER:</span>
            <span className="tabular-nums">
              {batteryInfo.level}% {batteryInfo.charging ? '⚡' : 'BAT'}
            </span>
          </div>
        </div>

        {/* Column 3: Live Network, Latency & Core State */}
        <div className="flex flex-col justify-center min-w-0 truncate border-l border-cyan-500/20 pl-2">
          <div className="flex items-center justify-between gap-1 truncate">
            <span className="text-[#38bdf8]/80">NET:</span>
            <span className="text-[#e0faff] font-semibold truncate">
              {netInfo.online ? netInfo.type : 'OFFLINE'} ({netInfo.rtt}ms)
            </span>
          </div>
          <div className="flex items-center justify-between gap-1 truncate">
            <span className="text-[#38bdf8]/80">CORES:</span>
            <span className="truncate">
              {coresCount}T // {coreState.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
