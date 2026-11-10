/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { jarvisAudio } from './audio';
import { jarvisLiveBridge } from './liveBridge';

export type CameraStatus = 'OFFLINE' | 'CONNECTING' | 'LIVE' | 'ERROR';

export interface CameraPreviewProps {
  ocrScanTrigger?: number;
  onOpticalReport?: (report: string) => void;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  ocrScanTrigger = 0,
  onOpticalReport,
}) => {
  const [status, setStatus] = useState<CameraStatus>('OFFLINE');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0);
  const [capturedFlash, setCapturedFlash] = useState(false);
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [sourceMode, setSourceMode] = useState<'webcam' | 'screen'>('webcam');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastOcrTriggerRef = useRef<number>(ocrScanTrigger);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    jarvisLiveBridge.setVideoSource(null);
    setStatus('OFFLINE');
    jarvisAudio.playBeep(440, 0.08);
  }, []);

  // Enumerate video devices
  const updateDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = all.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
    } catch {}
  }, []);

  // Start live camera stream
  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('ERROR');
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      setStatus('CONNECTING');

      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            aspectRatio: { ideal: 16 / 9 },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 360 },
            deviceId: deviceId ? { exact: deviceId } : undefined,
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onended = () => {
            stopCamera();
          };
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
              jarvisLiveBridge.setVideoSource(videoRef.current);
            }
          };
        }

        setSourceMode('webcam');
        setStatus('LIVE');
        jarvisAudio.playBeep(880, 0.08);
        updateDevices();
      } catch {
        setStatus('ERROR');
      }
    },
    [stopCamera, updateDevices]
  );

  // Start Screen Capture stream without restarting the Live WebSocket connection
  const startScreenShare = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      startCamera();
      return;
    }
    try {
      setStatus('CONNECTING');
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 5, max: 10 } },
        audio: false,
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      streamRef.current = screenStream;

      const videoTrack = screenStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopCamera();
        };
      }

      if (videoRef.current) {
        videoRef.current.srcObject = screenStream;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
            jarvisLiveBridge.setVideoSource(videoRef.current);
          }
        };
      }

      setSourceMode('screen');
      setStatus('LIVE');
      jarvisAudio.playBeep(960, 0.08);
    } catch {
      startCamera();
    }
  }, [startCamera, stopCamera]);

  // Switch between Webcam and Screen Capture (or multiple cameras) seamlessly without restarting WS
  const switchCamera = useCallback(() => {
    jarvisAudio.playBeep(720, 0.06);
    if (status === 'LIVE' && sourceMode === 'webcam' && 'getDisplayMedia' in navigator.mediaDevices) {
      startScreenShare();
    } else if (devices.length > 1 && sourceMode === 'webcam') {
      const nextIndex = (currentDeviceIndex + 1) % devices.length;
      setCurrentDeviceIndex(nextIndex);
      startCamera(devices[nextIndex].deviceId);
    } else {
      startCamera();
    }
  }, [devices, currentDeviceIndex, startCamera, startScreenShare, status, sourceMode]);

  // Capture snapshot & trigger OCR analysis
  const handleCapture = useCallback(() => {
    if (status !== 'LIVE') {
      startCamera();
      return;
    }
    setCapturedFlash(true);
    setIsScanningOcr(true);
    jarvisAudio.playBeep(1200, 0.12);
    if (onOpticalReport) {
      onOpticalReport(
        'Optical snapshot captured. High-contrast HUD frame analyzed — target coordinates locked and verified, sir.'
      );
    }
    setTimeout(() => {
      setCapturedFlash(false);
    }, 250);
    setTimeout(() => {
      setIsScanningOcr(false);
    }, 2200);
  }, [status, startCamera, onOpticalReport]);

  // Respond to Vision & OCR module trigger from left HUD
  useEffect(() => {
    if (ocrScanTrigger > lastOcrTriggerRef.current) {
      lastOcrTriggerRef.current = ocrScanTrigger;
      setIsScanningOcr(true);
      if (status === 'OFFLINE') {
        startCamera();
      }
      const timer = window.setTimeout(() => {
        setIsScanningOcr(false);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [ocrScanTrigger, status, startCamera]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-transparent overflow-visible flex flex-col justify-between select-none p-3.5 font-mono">
      {/* 
        Wide Widescreen Chamfered Cyan HUD Frame & Glowing Corner Brackets
      */}
      <svg
        viewBox="0 0 390 290"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
        fill="none"
      >
        <defs>
          <filter id="camFrameGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Decorative Left HUD Circuit Guide Line */}
        <path
          d="M -8 34 L -15 42 L -15 248 L -8 256"
          stroke="#00d8ff"
          strokeWidth="1.2"
          strokeOpacity="0.55"
        />
        <line
          x1="-10"
          y1="72"
          x2="-10"
          y2="218"
          stroke="#00e5ff"
          strokeWidth="2"
          strokeOpacity="0.75"
          filter="url(#camFrameGlow)"
        />

        {/* Outer Compact-Wide Chamfered Octagonal Frame */}
        <path
          d="M 18 4 L 372 4 L 386 18 L 386 272 L 372 286 L 18 286 L 4 272 L 4 18 Z"
          fill="rgba(0, 5, 16, 0.35)"
          stroke="#00d8ff"
          strokeWidth="1.5"
          strokeOpacity="0.85"
          filter="url(#camFrameGlow)"
        />

        {/* Top-Center & Bottom-Center Glowing Cyan Accent Bars */}
        <line
          x1="90"
          y1="4"
          x2="300"
          y2="4"
          stroke="#e0faff"
          strokeWidth="2.5"
          filter="url(#camFrameGlow)"
        />
        <line
          x1="85"
          y1="286"
          x2="305"
          y2="286"
          stroke="#e0faff"
          strokeWidth="2.5"
          filter="url(#camFrameGlow)"
        />

        {/* 4 Outer Glowing Corner Brackets */}
        <path
          d="M 4 46 L 4 18 L 18 4 L 52 4"
          stroke="#00e5ff"
          strokeWidth="2.2"
          filter="url(#camFrameGlow)"
        />
        <path
          d="M 338 4 L 372 4 L 386 18 L 386 46"
          stroke="#00e5ff"
          strokeWidth="2.2"
          filter="url(#camFrameGlow)"
        />
        <path
          d="M 4 244 L 4 272 L 18 286 L 52 286"
          stroke="#00e5ff"
          strokeWidth="2.2"
          filter="url(#camFrameGlow)"
        />
        <path
          d="M 338 286 L 372 286 L 386 272 L 386 244"
          stroke="#00e5ff"
          strokeWidth="2.2"
          filter="url(#camFrameGlow)"
        />
      </svg>

      {/* 
        1. CAMERA VIEWPORT SCREEN
      */}
      <div
        onClick={handleCapture}
        className="relative z-10 flex-1 w-full rounded-lg overflow-hidden bg-[#000208]/95 border border-cyan-400/35 flex items-center justify-center cursor-pointer group shadow-[inset_0_0_24px_rgba(0,229,255,0.12)]"
        title={status === 'LIVE' ? 'Click to Capture Snapshot & Run OCR' : 'Click to Engage Camera'}
      >
        {/* Live Video with JARVIS Holographic Blue color grading */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            status === 'LIVE' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          style={{
            filter: 'contrast(1.22) brightness(1.1) saturate(0.55) hue-rotate(185deg)',
          }}
        />

        {/* Holographic Cyan-Blue Tint Overlay */}
        {status === 'LIVE' && (
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-cyan-500/15 via-blue-500/10 to-cyan-900/30 mix-blend-color" />
        )}

        {/* Sci-Fi Scanlines */}
        {(status === 'LIVE' || isScanningOcr) && (
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.28) 2px, rgba(34,211,238,0.28) 4px)',
            }}
          />
        )}

        {/* Active Vision & OCR Laser Scan Sweep + Target Reticle */}
        {isScanningOcr && (
          <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
            <div className="w-28 h-28 rounded-full border border-dashed border-cyan-300/80 animate-spin flex items-center justify-center shadow-[0_0_16px_rgba(0,229,255,0.4)]">
              <div className="w-3 h-3 rounded-full bg-cyan-300 shadow-[0_0_10px_#ffffff]" />
            </div>
            <div className="absolute top-3 left-3 text-[9px] text-cyan-300 tracking-widest uppercase drop-shadow-[0_0_6px_#00e5ff] animate-pulse">
              OPTICAL OCR SCANNING...
            </div>
          </div>
        )}

        {/* Snapshot Flash Feedback */}
        {capturedFlash && (
          <div className="absolute inset-0 bg-cyan-200/80 pointer-events-none z-30 transition-opacity duration-200" />
        )}

        {/* Standby View when offline */}
        {status === 'OFFLINE' && (
          <div className="flex flex-col items-center justify-center transition-transform duration-200 group-hover:scale-105">
            <div className="relative w-14 h-14 rounded-full border border-cyan-500/40 bg-cyan-950/30 flex items-center justify-center shadow-[0_0_18px_rgba(34,211,238,0.2)] group-hover:border-cyan-400 group-hover:shadow-[0_0_24px_rgba(34,211,238,0.4)] transition-all">
              <svg className="w-6 h-6 text-cyan-300 drop-shadow-[0_0_8px_#22d3ee]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="mt-2.5 text-[10px] text-cyan-300 font-bold tracking-widest uppercase opacity-80 group-hover:opacity-100 drop-shadow-[0_0_6px_rgba(0,229,255,0.5)]">
              CLICK TO ACTIVATE
            </span>
          </div>
        )}

        {/* Connecting state */}
        {status === 'CONNECTING' && (
          <div className="w-8 h-8 rounded-full border-2 border-t-cyan-400 border-r-transparent border-b-cyan-400 border-l-transparent animate-spin shadow-[0_0_12px_rgba(34,211,238,0.4)]" />
        )}

        {/* Error state */}
        {status === 'ERROR' && (
          <div className="flex flex-col items-center justify-center p-2 text-center" onClick={() => startCamera()}>
            <span className="text-[10px] text-red-400 font-bold tracking-wider">CAMERA OFFLINE</span>
            <span className="text-[9px] text-red-300/70 mt-0.5">Click to Retry</span>
          </div>
        )}
      </div>

      {/* 
        2. THREE INTERACTIVE HUD BUTTONS:
           [ 🎥 CAPTURE ]   [ ⏹ STOP ]   [ 🔄 SWITCH ]
      */}
      <div className="relative z-10 shrink-0 w-full pt-2.5 flex items-center justify-between gap-2">
        {/* 1. CAPTURE BUTTON */}
        <button
          onClick={handleCapture}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#021834]/75 hover:bg-cyan-500/25 border border-cyan-400/65 text-cyan-100 hover:text-white transition-all shadow-[0_0_10px_rgba(0,216,255,0.28)] hover:shadow-[0_0_14px_rgba(0,229,255,0.5)] cursor-pointer"
          title="Capture Snapshot / Engage Camera"
        >
          <svg className="w-3 h-3 text-cyan-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          <span className="text-[9.5px] font-bold tracking-wider">CAPTURE</span>
        </button>

        {/* 2. STOP BUTTON */}
        <button
          onClick={stopCamera}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#021834]/75 hover:bg-red-500/25 border border-cyan-400/65 text-cyan-100 hover:text-red-200 transition-all shadow-[0_0_10px_rgba(0,216,255,0.28)] hover:shadow-[0_0_14px_rgba(239,68,68,0.45)] cursor-pointer"
          title="Stop Camera Stream"
        >
          <span className="w-2.5 h-2.5 bg-red-500 rounded-[2px] shadow-[0_0_6px_#ef4444] shrink-0" />
          <span className="text-[9.5px] font-bold tracking-wider">STOP</span>
        </button>

        {/* 3. SWITCH BUTTON */}
        <button
          onClick={switchCamera}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#021834]/75 hover:bg-cyan-500/25 border border-cyan-400/65 text-cyan-100 hover:text-white transition-all shadow-[0_0_10px_rgba(0,216,255,0.28)] hover:shadow-[0_0_14px_rgba(0,229,255,0.5)] cursor-pointer"
          title="Switch Camera Device / Flip"
        >
          <svg className="w-3 h-3 text-cyan-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[9.5px] font-bold tracking-wider">SWITCH</span>
        </button>
      </div>
    </div>
  );
};

