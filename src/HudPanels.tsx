/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CoreState } from './types';
import { jarvisAudio } from './audio';

export type ModuleId = 'voice' | 'vision' | 'memory' | 'os';

interface SystemModulesProps {
  coreState: CoreState;
  activeModule: ModuleId | null;
  onSelectModule: (moduleId: ModuleId) => void;
  onHeaderClick: () => void;
}

/**
 * Top-Left Holographic "JARVIS ASSISTANT" Header with Live Animated Conduit Line
 */
export const JarvisHeader: React.FC<{ onHeaderClick: () => void }> = ({ onHeaderClick }) => {
  return (
    <div
      onClick={onHeaderClick}
      className="relative select-none cursor-pointer group bg-transparent"
      title="Click to run JARVIS voice greeting & telemetry check"
    >
      {/* Title Row */}
      <div className="flex items-baseline gap-5 pl-1">
        <span
          className="text-[36px] leading-none font-black tracking-[0.16em] text-white transition-transform duration-200 group-hover:scale-[1.02]"
          style={{
            fontFamily: '"Orbitron", "Rajdhani", sans-serif',
            textShadow:
              '0 0 10px rgba(0, 229, 255, 0.95), 0 0 22px rgba(0, 168, 255, 0.75), 0 0 36px rgba(0, 119, 255, 0.45)',
          }}
        >
          JARVIS
        </span>
        <span
          className="text-[16px] leading-none font-bold tracking-[0.42em] text-cyan-50/95"
          style={{
            fontFamily: '"Orbitron", "Rajdhani", sans-serif',
            textShadow: '0 0 8px rgba(0, 229, 255, 0.85), 0 0 16px rgba(0, 168, 255, 0.5)',
          }}
        >
          ASSISTANT
        </span>
      </div>

      {/* Animated Holographic Step-Up Conduit Line */}
      <div className="relative mt-2.5 w-[440px] h-[22px] overflow-visible">
        <svg
          viewBox="0 0 440 22"
          className="w-full h-full overflow-visible"
          fill="none"
        >
          <defs>
            <filter id="headerCyanGlow" x="-20%" y="-100%" width="140%" height="300%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="headerPulseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#00e5ff" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Main stepped conduit path: left horizontal -> 45deg step up -> right horizontal */}
          <path
            d="M 2 14 L 272 14 L 288 3 L 432 3"
            stroke="#00d8ff"
            strokeWidth="1.6"
            strokeOpacity="0.85"
            filter="url(#headerCyanGlow)"
          />

          {/* Thick glowing cyan energy bar on the left */}
          <rect
            x="2"
            y="11"
            width="88"
            height="6"
            rx="3"
            fill="#00e5ff"
            filter="url(#headerCyanGlow)"
          />
          <rect
            x="8"
            y="12.5"
            width="68"
            height="3"
            rx="1.5"
            fill="#e0faff"
          />

          {/* Traveling energy pulse along the conduit */}
          <circle r="3" fill="#ffffff" filter="url(#headerCyanGlow)">
            <animateMotion
              dur="3.6s"
              repeatCount="indefinite"
              path="M 2 14 L 272 14 L 288 3 L 432 3"
            />
          </circle>
        </svg>
      </div>
    </div>
  );
};

/**
 * Left HUD Section: "SYSTEM MODULES" Interactive Feature Panel + Live Animated Curved Telemetry Arc
 */
export const SystemModulesPanel: React.FC<SystemModulesProps> = ({
  coreState,
  activeModule,
  onSelectModule,
}) => {
  const [arcTick, setArcTick] = useState(0);

  // Animate the curved telemetry arc ticks
  useEffect(() => {
    const interval = window.setInterval(() => {
      setArcTick((prev) => (prev + 1) % 11);
    }, 140);
    return () => clearInterval(interval);
  }, []);

  const modules: {
    id: ModuleId;
    label: string;
    subStatus: string;
    isActive: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'voice',
      label: 'Voice Assistant',
      subStatus:
        coreState === 'listening'
          ? 'LISTENING'
          : coreState === 'speaking'
          ? 'SPEAKING'
          : activeModule === 'voice'
          ? 'ACTIVE'
          : 'READY',
      isActive:
        activeModule === 'voice' ||
        coreState === 'listening' ||
        coreState === 'speaking',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path strokeLinecap="round" d="M5 10a7 7 0 0014 0M12 17v4m-3 0h6" />
        </svg>
      ),
    },
    {
      id: 'vision',
      label: 'Vision & OCR',
      subStatus:
        coreState === 'vision' || activeModule === 'vision' ? 'SCANNING' : 'STANDBY',
      isActive: activeModule === 'vision' || coreState === 'vision',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ),
    },
    {
      id: 'memory',
      label: 'Memory',
      subStatus:
        coreState === 'reasoning' || activeModule === 'memory'
          ? 'RECALLING'
          : '99.4% SYNC',
      isActive: activeModule === 'memory' || coreState === 'reasoning',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.5 4a3.5 3.5 0 00-3.3 4.6A3.5 3.5 0 004 12a3.5 3.5 0 002.2 3.2A3.5 3.5 0 009.5 20h1V4h-1zM14.5 4a3.5 3.5 0 013.3 4.6A3.5 3.5 0 0120 12a3.5 3.5 0 01-2.2 3.2A3.5 3.5 0 0114.5 20h-1V4h1z"
          />
          <path strokeLinecap="round" d="M8 9h2.5M7.5 13h3M16 9h-2.5M16.5 13h-3" />
        </svg>
      ),
    },
    {
      id: 'os',
      label: 'OS Control',
      subStatus:
        coreState === 'executing' || activeModule === 'os' ? 'EXECUTING' : 'ONLINE',
      isActive: activeModule === 'os' || coreState === 'executing',
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path strokeLinecap="round" d="M8 20h8M12 16v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="relative flex items-start select-none bg-transparent">
      {/* Left Column: Header + 4 Interactive Modules */}
      <div className="flex flex-col w-[268px] bg-transparent">
        {/* SYSTEM MODULES Header */}
        <div className="flex items-center gap-3.5">
          {/* Glowing Double-Circle Status Node */}
          <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/80 shadow-[0_0_12px_#00e5ff]" />
            <div
              className="absolute inset-[-3px] rounded-full border border-dashed border-cyan-300/60 animate-spin"
              style={{ animationDuration: '10s' }}
            />
            <div className="w-3.5 h-3.5 rounded-full bg-cyan-200 shadow-[0_0_12px_#ffffff,0_0_20px_#00e5ff] animate-pulse" />
          </div>

          <span
            className="text-[18.5px] font-extrabold tracking-[0.08em] text-[#22e8ff] whitespace-nowrap"
            style={{
              fontFamily: '"Orbitron", "Rajdhani", sans-serif',
              textShadow: '0 0 10px rgba(0, 229, 255, 0.85), 0 0 20px rgba(0, 140, 255, 0.5)',
            }}
          >
            SYSTEM MODULES
          </span>
        </div>

        {/* Glowing Horizontal Conduit Line under Header */}
        <div className="relative mt-2 mb-3.5 w-[274px] h-3 flex items-center">
          <div className="w-2 h-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#00e5ff] shrink-0" />
          <div className="flex-1 h-[1.5px] bg-gradient-to-r from-cyan-400/80 via-cyan-300 to-cyan-400/70 shadow-[0_0_8px_#00e5ff]" />
          {/* Bright center core bloom on the line */}
          <div className="absolute left-[95px] w-24 h-[3px] rounded-full bg-cyan-200 shadow-[0_0_14px_#00e5ff,0_0_24px_#0088ff] animate-pulse" />
        </div>

        {/* 4 Interactive Module Buttons */}
        <div className="flex flex-col gap-3">
          {modules.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => onSelectModule(mod.id)}
              className="group relative flex items-center gap-3.5 py-0.5 text-left bg-transparent border-0 outline-none cursor-pointer transition-transform duration-200 hover:translate-x-1"
              style={{ background: 'transparent', boxShadow: 'none' }}
            >
              {/* Double-Ring Glowing Holographic Icon */}
              <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
                {/* Outer Ring */}
                <div
                  className={`absolute inset-0 rounded-full border transition-all duration-300 ${
                    mod.isActive
                      ? 'border-cyan-200 shadow-[0_0_16px_#00e5ff,inset_0_0_10px_rgba(0,229,255,0.4)] scale-105'
                      : 'border-cyan-400/75 shadow-[0_0_10px_rgba(0,216,255,0.45)] group-hover:border-cyan-200 group-hover:shadow-[0_0_15px_#00e5ff]'
                  }`}
                />
                {/* Inner Ring */}
                <div
                  className={`absolute inset-[4px] rounded-full border transition-all duration-300 ${
                    mod.isActive
                      ? 'border-cyan-300/90'
                      : 'border-cyan-400/50 group-hover:border-cyan-300/80'
                  }`}
                />
                {/* Active Rotating Energy Arc */}
                {mod.isActive && (
                  <div
                    className="absolute inset-[-3px] rounded-full border-2 border-t-cyan-200 border-r-transparent border-b-cyan-300 border-l-transparent animate-spin"
                    style={{ animationDuration: '2.4s' }}
                  />
                )}
                <div
                  className={`relative z-10 transition-colors duration-200 ${
                    mod.isActive
                      ? 'text-white drop-shadow-[0_0_10px_#00e5ff]'
                      : 'text-cyan-100 drop-shadow-[0_0_6px_rgba(0,229,255,0.75)] group-hover:text-white'
                  }`}
                >
                  {mod.icon}
                </div>
              </div>

              {/* Module Label & Live Working Telemetry Sub-Badge */}
              <div className="flex flex-col min-w-0">
                <span
                  className={`text-[15.5px] font-semibold tracking-wide transition-colors duration-200 ${
                    mod.isActive
                      ? 'text-white'
                      : 'text-slate-100/95 group-hover:text-white'
                  }`}
                  style={{
                    textShadow: mod.isActive
                      ? '0 0 12px rgba(0, 229, 255, 0.95)'
                      : '0 0 8px rgba(0, 195, 255, 0.45)',
                  }}
                >
                  {mod.label}
                </span>
                <span
                  className={`text-[9.5px] font-mono tracking-[0.18em] uppercase transition-opacity duration-200 ${
                    mod.isActive
                      ? 'text-cyan-300 opacity-100 drop-shadow-[0_0_6px_#00e5ff]'
                      : 'text-cyan-400/65 opacity-75 group-hover:opacity-100'
                  }`}
                >
                  ● {mod.subStatus}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Side of System Modules: Live Animated Curved HUD Gauge / Arc */}
      <div className="relative -ml-3 -mt-3 w-[118px] h-[296px] pointer-events-none overflow-visible">
        <svg
          viewBox="0 0 120 300"
          className="w-full h-full overflow-visible"
          fill="none"
        >
          <defs>
            <filter id="moduleArcGlow" x="-40%" y="-20%" width="180%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer Fine Guide Arc */}
          <path
            d="M 10 12 A 175 175 0 0 1 10 288"
            stroke="#00b4ff"
            strokeWidth="1"
            strokeOpacity="0.4"
            strokeDasharray="3 5"
          />

          {/* Primary Thick Glowing Cyan Arc */}
          <path
            d="M 22 26 A 158 158 0 0 1 22 274"
            stroke="#00e5ff"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#moduleArcGlow)"
          />
          {/* Hot White-Cyan Core on Primary Arc */}
          <path
            d="M 46 66 A 158 158 0 0 1 46 234"
            stroke="#e0faff"
            strokeWidth="1.6"
            strokeLinecap="round"
          />

          {/* Inner Counter-Oscillating Segmented Telemetry Arc */}
          <g
            style={{
              transformOrigin: '-85px 150px',
              animation: 'pulse 3.2s ease-in-out infinite',
            }}
          >
            <path
              d="M 15 36 A 148 148 0 0 1 15 264"
              stroke="#00d0ff"
              strokeWidth="2"
              strokeOpacity="0.85"
              strokeDasharray="28 10 14 8 42 12"
              filter="url(#moduleArcGlow)"
            />
            <path
              d="M 8 50 A 138 138 0 0 1 8 250"
              stroke="#38bdf8"
              strokeWidth="1.4"
              strokeOpacity="0.65"
              strokeDasharray="6 4"
            />
          </g>

          {/* 11 Outer Glowing Cyan Square Ticks along the curve (Animated Wave) */}
          {Array.from({ length: 11 }).map((_, idx) => {
            const deg = -36 + idx * 7.2;
            const rad = (deg * Math.PI) / 180;
            const cx = -92;
            const cy = 150;
            const r = 178;
            const x = cx + Math.cos(rad) * r;
            const y = cy + Math.sin(rad) * r;
            const distFromActive = Math.abs(idx - arcTick);
            const isLit = distFromActive <= 1;

            return (
              <rect
                key={idx}
                x={x - 2.5}
                y={y - 2.5}
                width="5.5"
                height="4.5"
                rx="1"
                transform={`rotate(${deg}, ${x}, ${y})`}
                fill={isLit ? '#ffffff' : '#00e5ff'}
                fillOpacity={isLit ? 1 : 0.72}
                filter="url(#moduleArcGlow)"
              />
            );
          })}

          {/* Horizontal Crosshair Line & Glowing Node at Vertical Midpoint (y = 150) */}
          <line
            x1="28"
            y1="150"
            x2="86"
            y2="150"
            stroke="#00e5ff"
            strokeWidth="1.4"
            strokeOpacity="0.8"
            filter="url(#moduleArcGlow)"
          />
          <circle
            cx="86"
            cy="150"
            r="3.8"
            fill="#e0faff"
            stroke="#00e5ff"
            strokeWidth="1.5"
            filter="url(#moduleArcGlow)"
          />
        </svg>
      </div>
    </div>
  );
};

/**
 * Top-Right "ONLINE" Status Badge + Animated Tech Circuit Conduit Line
 */
export const OnlineStatusConduit: React.FC<{
  coreState: CoreState;
  onToggleOnline: () => void;
}> = ({ coreState, onToggleOnline }) => {
  const isOffline = coreState === 'offline';
  const isAlert = coreState === 'alert' || coreState === 'error';

  const statusText = isOffline
    ? 'OFFLINE'
    : coreState === 'idle'
    ? 'ONLINE'
    : coreState.toUpperCase();

  const accentColor = isOffline
    ? '#64748b'
    : isAlert
    ? '#ef4444'
    : '#00e5ff';

  return (
    <div className="relative w-[405px] h-[595px] pointer-events-none select-none overflow-visible">
      <svg
        viewBox="0 0 405 595"
        className="w-full h-full overflow-visible"
        fill="none"
      >
        <defs>
          <filter id="rightConduitGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Chamfered Top-Right ONLINE Badge Polygon */}
        <g
          onClick={onToggleOnline}
          className="pointer-events-auto cursor-pointer group"
        >
          {/* Outer subtle glow polygon */}
          <polygon
            points="162,48 202,4 358,4 372,18 356,48"
            fill="rgba(0, 20, 48, 0.35)"
            stroke={accentColor}
            strokeWidth="1.5"
            strokeOpacity="0.85"
            filter="url(#rightConduitGlow)"
          />
          {/* Bright bottom-left glowing bar under ONLINE badge */}
          <line
            x1="160"
            y1="48"
            x2="262"
            y2="48"
            stroke="#e0faff"
            strokeWidth="3"
            filter="url(#rightConduitGlow)"
          />
          {/* Top-left parallel angled accent slash */}
          <line
            x1="150"
            y1="48"
            x2="190"
            y2="4"
            stroke={accentColor}
            strokeWidth="1.6"
            strokeOpacity="0.85"
            filter="url(#rightConduitGlow)"
          />
        </g>

        {/* 2. Left Circuit Conduit Path running from ONLINE badge down beside Camera Frame */}
        <path
          d="M 172 28 L 88 28 L 20 96 L 20 278 L 36 294 L 36 474 L 20 490 L 20 554"
          stroke={accentColor}
          strokeWidth="1.5"
          strokeOpacity="0.78"
          filter="url(#rightConduitGlow)"
        />
        {/* Terminal Dots on Conduit */}
        <circle cx="20" cy="96" r="2.2" fill={accentColor} />
        <circle cx="20" cy="554" r="2.5" fill={accentColor} filter="url(#rightConduitGlow)" />

        {/* Live Traveling Energy Pulse along the Circuit Conduit */}
        {!isOffline && (
          <circle r="3" fill="#ffffff" filter="url(#rightConduitGlow)">
            <animateMotion
              dur="4.2s"
              repeatCount="indefinite"
              path="M 172 28 L 88 28 L 20 96 L 20 278 L 36 294 L 36 474 L 20 490 L 20 554"
            />
          </circle>
        )}
      </svg>

      {/* Interactive Status Orb + Text inside the ONLINE Badge */}
      <button
        type="button"
        onClick={onToggleOnline}
        className="absolute top-[10px] left-[200px] w-[155px] h-[32px] flex items-center gap-3 pointer-events-auto cursor-pointer bg-transparent border-0 outline-none group"
        style={{ background: 'transparent', boxShadow: 'none' }}
        title="Click to toggle JARVIS Online / Standby state"
      >
        {/* Glowing Double-Ring Status Orb */}
        <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
          <div
            className="absolute inset-0 rounded-full border transition-all duration-300"
            style={{
              borderColor: accentColor,
              boxShadow: `0 0 10px ${accentColor}`,
            }}
          />
          <div
            className={`w-2.5 h-2.5 rounded-full ${isOffline ? '' : 'animate-pulse'}`}
            style={{
              backgroundColor: isOffline ? '#64748b' : '#e0faff',
              boxShadow: isOffline ? 'none' : `0 0 10px #ffffff, 0 0 18px ${accentColor}`,
            }}
          />
        </div>

        <span
          className="text-[15.5px] font-extrabold tracking-[0.18em] transition-transform duration-200 group-hover:scale-105"
          style={{
            fontFamily: '"Orbitron", "Rajdhani", sans-serif',
            color: isOffline ? '#94a3b8' : '#e0faff',
            textShadow: isOffline ? 'none' : `0 0 10px ${accentColor}, 0 0 18px ${accentColor}`,
          }}
        >
          {statusText}
        </span>
      </button>
    </div>
  );
};

/**
 * Bottom-Right "SYSTEM RESOURCES" Live Animated Telemetry Panel + Optimize/Export Action
 */
export const SystemResourcesPanel: React.FC<{
  coreState: CoreState;
  optimizeTriggerCount: number;
  onOptimizeResources: (metrics: { cpu: number; ram: number; disk: number }) => void;
}> = ({ coreState, optimizeTriggerCount, onOptimizeResources }) => {
  const [cpu, setCpu] = useState(28);
  const [ram, setRam] = useState(42);
  const [disk, setDisk] = useState(31);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Live realistic telemetry fluctuations responsive to AI state
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (coreState === 'offline') {
        setCpu(4);
        setRam(18);
        setDisk(31);
        return;
      }

      const isHeavy =
        coreState === 'thinking' ||
        coreState === 'executing' ||
        coreState === 'vision' ||
        coreState === 'reasoning';

      setCpu((prev) => {
        const targetBase = isHeavy ? 64 : 28;
        const delta = Math.floor(Math.random() * 7) - 3;
        return Math.max(18, Math.min(92, Math.round(prev * 0.6 + (targetBase + delta) * 0.4)));
      });

      setRam((prev) => {
        const targetBase = isHeavy ? 54 : 42;
        const delta = Math.floor(Math.random() * 5) - 2;
        return Math.max(32, Math.min(86, Math.round(prev * 0.7 + (targetBase + delta) * 0.3)));
      });

      setDisk((prev) => {
        const delta = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        return Math.max(29, Math.min(36, prev + delta));
      });
    }, 650);

    return () => clearInterval(timer);
  }, [coreState]);

  // Trigger visual optimization sweep when OS Control is clicked
  useEffect(() => {
    if (optimizeTriggerCount === 0) return;
    setIsOptimizing(true);
    setCpu(24);
    setRam(38);
    setDisk(30);
    const t = window.setTimeout(() => setIsOptimizing(false), 1200);
    return () => clearTimeout(t);
  }, [optimizeTriggerCount]);

  const handleActionClick = () => {
    setIsOptimizing(true);
    jarvisAudio.playBeep(980, 0.09);
    const nextMetrics = { cpu: 26, ram: 39, disk: 31 };
    setCpu(nextMetrics.cpu);
    setRam(nextMetrics.ram);
    setDisk(nextMetrics.disk);
    onOptimizeResources(nextMetrics);
    setTimeout(() => setIsOptimizing(false), 1000);
  };

  const rows = [
    { label: 'CPU', value: cpu },
    { label: 'RAM', value: ram },
    { label: 'DISK', value: disk },
  ];

  return (
    <div className="relative w-full h-full select-none bg-transparent overflow-visible">
      {/* Chamfered Sci-Fi Cyan HUD Frame (Strictly transparent background) */}
      <svg
        viewBox="0 0 368 220"
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        fill="none"
      >
        <defs>
          <filter id="sysResGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Chamfered Frame Path */}
        <path
          d="M 18 4 L 346 4 L 364 22 L 364 198 L 348 214 L 22 214 L 4 196 L 4 18 Z"
          fill="rgba(0, 12, 32, 0.18)"
          stroke="#00d8ff"
          strokeWidth="1.6"
          strokeOpacity="0.85"
          filter="url(#sysResGlow)"
        />

        {/* Top-Center Bright Cyan Accent Bar */}
        <line
          x1="88"
          y1="4"
          x2="255"
          y2="4"
          stroke="#e0faff"
          strokeWidth="2.6"
          filter="url(#sysResGlow)"
        />

        {/* Bottom-Left & Top-Right Corner Bracket Highlights */}
        <path
          d="M 4 176 L 4 196 L 22 214 L 58 214"
          stroke="#e0faff"
          strokeWidth="2.4"
          filter="url(#sysResGlow)"
        />
        <path
          d="M 326 4 L 346 4 L 364 22 L 364 52"
          stroke="#00e5ff"
          strokeWidth="2.2"
          filter="url(#sysResGlow)"
        />
      </svg>

      {/* Panel Content */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between px-6 py-4 bg-transparent">
        {/* Header: Glowing Microchip Icon + SYSTEM RESOURCES */}
        <div
          onClick={handleActionClick}
          className="flex items-center gap-3 cursor-pointer group"
          title="Click to optimize & broadcast system telemetry"
        >
          {/* Glowing Cyan Microchip SVG */}
          <div className="relative w-7 h-7 flex items-center justify-center text-[#00e5ff] drop-shadow-[0_0_10px_#00e5ff]">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="6" y="6" width="12" height="12" rx="2" />
              <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" fillOpacity="0.35" />
              <path
                strokeLinecap="round"
                d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"
              />
            </svg>
          </div>

          <span
            className="text-[17.5px] font-extrabold tracking-[0.08em] text-white group-hover:text-cyan-200 transition-colors"
            style={{
              fontFamily: '"Orbitron", "Rajdhani", sans-serif',
              textShadow: '0 0 10px rgba(0, 229, 255, 0.8), 0 0 20px rgba(0, 140, 255, 0.45)',
            }}
          >
            SYSTEM RESOURCES
          </span>
        </div>

        {/* Live Animated Resource Bars (CPU, RAM, DISK) */}
        <div className="flex flex-col gap-3.5 my-auto pt-1 pr-6">
          {rows.map((row) => (
            <div
              key={row.label}
              onClick={handleActionClick}
              className="flex items-center gap-3.5 cursor-pointer group"
              title={`Click to optimize ${row.label} threads`}
            >
              <span
                className="w-11 text-[13.5px] font-bold tracking-[0.1em] text-slate-100/95"
                style={{
                  fontFamily: '"Orbitron", "Rajdhani", sans-serif',
                  textShadow: '0 0 6px rgba(0, 229, 255, 0.45)',
                }}
              >
                {row.label}
              </span>

              {/* Progress Track */}
              <div className="relative flex-1 h-3.5 rounded-full bg-[#021836]/75 border border-cyan-400/35 p-[1.5px] overflow-hidden shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]">
                {/* Glowing Cyan-Blue Fill Bar */}
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out relative ${
                    isOptimizing ? 'brightness-125' : ''
                  }`}
                  style={{
                    width: `${row.value}%`,
                    background:
                      'linear-gradient(90deg, #00e5ff 0%, #00a8ff 65%, #0066ff 100%)',
                    boxShadow: '0 0 12px #00e5ff, 0 0 20px rgba(0, 168, 255, 0.7)',
                  }}
                >
                  {/* Leading hot edge highlight */}
                  <div className="absolute right-0 top-0 bottom-0 w-2 rounded-full bg-white/80 blur-[1px]" />
                </div>
              </div>

              {/* Live Percentage Readout */}
              <span
                className="w-11 text-right text-[14.5px] font-bold font-mono tabular-nums text-slate-100"
                style={{
                  textShadow: '0 0 8px rgba(0, 229, 255, 0.6)',
                }}
              >
                {row.value}%
              </span>
            </div>
          ))}
        </div>

        {/* Bottom-Right Glowing Export / Optimize Action Button [↑] */}
        <button
          type="button"
          onClick={handleActionClick}
          className="absolute bottom-2.5 right-3 w-9 h-9 flex items-center justify-center rounded-lg bg-transparent border-0 text-white hover:text-cyan-200 transition-transform duration-200 hover:scale-110 cursor-pointer"
          style={{
            background: 'transparent',
            filter: 'drop-shadow(0 0 8px #00e5ff)',
          }}
          title="Broadcast & Optimize System Resources"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-5 5m5-5l5 5" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
          </svg>
        </button>
      </div>
    </div>
  );
};
