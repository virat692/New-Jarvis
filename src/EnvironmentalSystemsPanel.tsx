// Holographic 'Environmental Systems' Weather Telemetry Module for JARVIS HUD

import React, { useState, useEffect } from 'react';
import { Cloud, CloudRain, Sun, CloudLightning, Wind, Compass, Droplets, Gauge } from 'lucide-react';
import { WeatherTelemetry, weatherManager } from './weatherService';
import { jarvisAudio } from './audio';

export const HolographicWeatherIcon: React.FC<{
  conditionType: WeatherTelemetry['conditionType'];
  className?: string;
}> = ({ conditionType, className = 'w-10 h-10' }) => {
  switch (conditionType) {
    case 'rain':
      return (
        <div className={`relative flex items-center justify-center text-cyan-300 ${className}`}>
          <CloudRain className="w-full h-full drop-shadow-[0_0_10px_#00e5ff] animate-pulse" />
          <div className="absolute inset-0 bg-cyan-400/20 blur-md rounded-full -z-10" />
        </div>
      );
    case 'thunder':
      return (
        <div className={`relative flex items-center justify-center text-amber-300 ${className}`}>
          <CloudLightning className="w-full h-full drop-shadow-[0_0_12px_#f59e0b] animate-bounce" />
          <div className="absolute inset-0 bg-amber-400/20 blur-md rounded-full -z-10" />
        </div>
      );
    case 'cloudy':
    case 'partlyCloudy':
      return (
        <div className={`relative flex items-center justify-center text-cyan-200 ${className}`}>
          <Cloud className="w-full h-full drop-shadow-[0_0_10px_#00e5ff]" />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400/60 animate-ping" />
        </div>
      );
    case 'fog':
      return (
        <div className={`relative flex items-center justify-center text-slate-300 ${className}`}>
          <Wind className="w-full h-full drop-shadow-[0_0_8px_#38bdf8] animate-pulse" />
        </div>
      );
    case 'clear':
    default:
      return (
        <div className={`relative flex items-center justify-center text-cyan-300 ${className}`}>
          <Sun className="w-full h-full drop-shadow-[0_0_12px_#00e5ff] animate-[spin_16s_linear_infinite]" />
          <div className="absolute inset-1 rounded-full border border-cyan-400/60 animate-ping opacity-60 -z-10" />
          <div className="absolute inset-0 bg-cyan-400/25 blur-lg rounded-full -z-20" />
        </div>
      );
  }
};

interface EnvironmentalSystemsPanelProps {
  onToggleToResources?: () => void;
  secondsRemaining?: number;
  isOffline?: boolean;
}

export const EnvironmentalSystemsPanel: React.FC<EnvironmentalSystemsPanelProps> = ({
  onToggleToResources,
  secondsRemaining = 10,
  isOffline = false,
}) => {
  const [weather, setWeather] = useState<WeatherTelemetry>(weatherManager.getCurrent());

  useEffect(() => {
    const unsub = weatherManager.subscribe((data) => {
      setWeather(data);
    });
    return () => unsub();
  }, []);

  const handleManualToggle = () => {
    jarvisAudio.playBeep(920, 0.08);
    if (onToggleToResources) {
      onToggleToResources();
    }
  };

  const rows = [
    {
      label: 'HUM',
      fullLabel: 'Humidity',
      val: weather.humidity,
      unit: '%',
      icon: <Droplets className="w-3.5 h-3.5 text-cyan-400" />,
      color: '#00d8ff',
    },
    {
      label: 'BAR',
      fullLabel: 'Pressure',
      val: Math.min(100, Math.max(10, Math.round(((weather.pressure - 950) / 80) * 100))),
      readout: `${weather.pressure} hPa`,
      unit: '',
      icon: <Gauge className="w-3.5 h-3.5 text-cyan-300" />,
      color: '#38bdf8',
    },
    {
      label: 'WIND',
      fullLabel: 'Wind Velocity',
      val: Math.min(100, Math.max(5, Math.round((weather.windSpeed / 40) * 100))),
      readout: `${weather.windSpeed} km/h`,
      unit: '',
      icon: <Compass className="w-3.5 h-3.5 text-teal-300" />,
      color: '#2dd4bf',
    },
  ];

  return (
    <div className="relative w-full h-full select-none bg-transparent flex flex-col justify-between overflow-hidden">
      {/* Top Header: Glowing Atmospheric Weather Radar Icon + Title + 10s Switcher Pill */}
      <div className="flex items-center justify-between w-full pt-1 px-1">
        <div
          onClick={handleManualToggle}
          className="flex items-center gap-2.5 cursor-pointer group"
          title="Click to switch back to System Resources telemetry"
        >
          {/* Glowing Animated Holographic Weather Condition Icon */}
          <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
            <HolographicWeatherIcon
              conditionType={weather.conditionType}
              className="w-6 h-6"
            />
          </div>

          <div className="flex flex-col">
            <span
              className="text-[14px] font-extrabold tracking-[0.08em] uppercase text-white group-hover:text-cyan-200 transition-colors"
              style={{
                fontFamily: '"Orbitron", "Rajdhani", sans-serif',
                textShadow: '0 0 10px rgba(0, 229, 255, 0.85), 0 0 20px rgba(0, 140, 255, 0.5)',
              }}
            >
              ENVIRONMENTAL
            </span>
            <span className="text-[9px] font-mono tracking-widest text-cyan-300/80 -mt-0.5">
              SYSTEMS • METEOROLOGY
            </span>
          </div>
        </div>

        {/* Live Status + 10s Carousel Countdown Timer */}
        <div
          onClick={handleManualToggle}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-cyan-400/40 bg-cyan-950/60 cursor-pointer hover:bg-cyan-500/20 transition-all shadow-[0_0_8px_rgba(0,229,255,0.25)]"
          title="Click to toggle to System Resources"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-200">
            {secondsRemaining}s
          </span>
        </div>
      </div>

      {/* Middle Holographic Core: Large Temperature Readout + Current Condition */}
      <div className="flex items-center justify-between px-2 py-1 my-auto">
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span
              className="text-[34px] font-extrabold leading-none tracking-tight text-white font-mono"
              style={{
                fontFamily: '"Orbitron", "Rajdhani", sans-serif',
                textShadow:
                  '0 0 12px rgba(0, 229, 255, 0.95), 0 0 24px rgba(0, 160, 255, 0.6), 0 0 36px rgba(0, 229, 255, 0.3)',
              }}
            >
              {isOffline ? '--' : weather.temperature}
            </span>
            <span className="text-[18px] font-bold text-cyan-300 drop-shadow-[0_0_8px_#00e5ff]">
              °C
            </span>
            <span className="text-[11px] font-mono text-cyan-200/70 ml-2">
              FEELS {isOffline ? '--' : weather.feelsLike}°
            </span>
          </div>

          <span
            className="text-[11.5px] font-bold tracking-[0.12em] uppercase text-cyan-300 drop-shadow-[0_0_6px_rgba(0,229,255,0.7)] mt-0.5"
            style={{ fontFamily: '"Orbitron", "Rajdhani", sans-serif' }}
          >
            {isOffline ? 'OFFLINE' : weather.conditionText}
          </span>
        </div>

        {/* Ambient Radar Coordinates */}
        <div className="text-right flex flex-col justify-center">
          <span className="text-[9px] font-mono tracking-wider text-cyan-200/60 uppercase">
            ATMOSPHERE
          </span>
          <span className="text-[10px] font-mono font-semibold tracking-wide text-white drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]">
            {weather.locationName}
          </span>
        </div>
      </div>

      {/* Atmospheric Telemetry Progress Bars (HUMIDITY, PRESSURE, WIND) */}
      <div className="flex flex-col gap-2 pt-0.5 pb-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            <span
              className="w-10 text-[11px] font-bold tracking-[0.08em] text-slate-100 flex items-center gap-1 shrink-0"
              style={{ fontFamily: '"Orbitron", "Rajdhani", sans-serif' }}
            >
              {row.label}
            </span>

            {/* Glowing Capsule Track */}
            <div className="relative flex-1 h-2.5 rounded-full bg-[#021836]/80 border border-cyan-400/40 p-[1px] overflow-hidden shadow-[inset_0_0_6px_rgba(0,0,0,0.8)]">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(0,229,255,0.7)]"
                style={{
                  width: `${isOffline ? 4 : row.val}%`,
                  background: `linear-gradient(90deg, #0052cc 0%, ${row.color} 80%, #ffffff 100%)`,
                }}
              />
            </div>

            <span className="w-14 text-right text-[11px] font-mono font-bold text-white tracking-wider shrink-0 tabular-nums drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]">
              {isOffline ? '--' : row.readout || `${row.val}${row.unit}`}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom 10-Second Alternation Progress Line */}
      <div className="relative w-full h-[2px] bg-cyan-950/80 rounded-full overflow-hidden mt-0.5">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-cyan-300 to-white shadow-[0_0_6px_#00e5ff] transition-all duration-1000 ease-linear"
          style={{ width: `${(secondsRemaining / 10) * 100}%` }}
        />
      </div>
    </div>
  );
};
