import { useEffect, useRef } from 'react';

export function AnimatedCore() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated particle field inside the central blue orb
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    // Constellation points inside the sphere
    const particles = Array.from({ length: 28 }, () => ({
      r: Math.random() * 85 + 10,
      baseAngle: Math.random() * Math.PI * 2,
      speed: (Math.random() * 0.008 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
      size: Math.random() * 2 + 1,
      opacity: Math.random() * 0.6 + 0.4,
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      angle += 0.01;

      // Draw particle constellation lines
      ctx.strokeStyle = 'rgba(103, 232, 249, 0.25)';
      ctx.lineWidth = 0.8;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const a1 = p1.baseAngle + angle * p1.speed * 20;
          const a2 = p2.baseAngle + angle * p2.speed * 20;

          const x1 = cx + Math.cos(a1) * p1.r;
          const y1 = cy + Math.sin(a1) * p1.r;
          const x2 = cx + Math.cos(a2) * p2.r;
          const y2 = cy + Math.sin(a2) * p2.r;

          const dist = Math.hypot(x2 - x1, y2 - y1);
          if (dist < 45) {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        const curAngle = p.baseAngle + angle * p.speed * 20;
        const x = cx + Math.cos(curAngle) * p.r;
        const y = cy + Math.sin(curAngle) * p.r;

        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="relative w-full h-full flex items-center justify-center select-none pointer-events-none">
      {/* 
        STATIC CROSSHAIR CONDUITS:
        Steady vertical and horizontal alignment lines passing through the center.
      */}
      <div className="absolute inset-0 flex items-center justify-center">
        {/* Horizontal cyan crosshair line */}
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent shadow-[0_0_8px_#22d3ee]" />
        {/* Vertical cyan crosshair line */}
        <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-cyan-400/80 to-transparent shadow-[0_0_8px_#22d3ee]" />

        {/* Top, Bottom, Left, Right tick notches */}
        <div className="absolute top-0 w-2 h-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_#22d3ee]" />
        <div className="absolute bottom-0 w-2 h-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_#22d3ee]" />
        <div className="absolute left-0 h-2 w-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_#22d3ee]" />
        <div className="absolute right-0 h-2 w-3 bg-cyan-400 rounded-sm shadow-[0_0_10px_#22d3ee]" />
      </div>

      {/* 
        LAYER 1: OUTERMOST RING (Diameter: 100% = 610px)
        Contains the amber/yellow energy blocks and cyan segmented bars.
        Rotates smoothly clockwise.
      */}
      <div className="absolute inset-0 animate-spin-ring-outer">
        <svg viewBox="0 0 610 610" className="w-full h-full">
          {/* Base outer hairline circle */}
          <circle
            cx="305"
            cy="305"
            r="298"
            fill="none"
            stroke="rgba(34, 211, 238, 0.45)"
            strokeWidth="1.5"
          />

          {/* Yellow / Amber Energy Blocks matching the image */}
          {/* Block 1 (Top Left) */}
          <path
            d="M 175 42 A 298 298 0 0 1 215 30"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_#f59e0b]"
          />
          {/* Block 2 (Top Right) */}
          <path
            d="M 445 68 A 298 298 0 0 1 475 88"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="8"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_#f59e0b]"
          />
          {/* Block 3 (Bottom Left) */}
          <path
            d="M 98 420 A 298 298 0 0 1 125 460"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="9"
            strokeLinecap="round"
            className="drop-shadow-[0_0_12px_#f59e0b]"
          />
          {/* Block 4 (Bottom Right) */}
          <path
            d="M 450 495 A 298 298 0 0 1 495 460"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="9"
            strokeLinecap="round"
            className="drop-shadow-[0_0_12px_#f59e0b]"
          />

          {/* Cyan Segmented Arcs on the outer ring */}
          <path
            d="M 240 18 A 298 298 0 0 1 370 18"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="5"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_#22d3ee]"
          />
          <path
            d="M 140 560 A 298 298 0 0 1 270 595"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="5"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_#22d3ee]"
          />
          <path
            d="M 345 595 A 298 298 0 0 1 475 560"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="5"
            strokeLinecap="round"
            className="drop-shadow-[0_0_10px_#22d3ee]"
          />

          {/* Micro tick marks around outer circle */}
          <circle
            cx="305"
            cy="305"
            r="290"
            fill="none"
            stroke="rgba(34, 211, 238, 0.6)"
            strokeWidth="2"
            strokeDasharray="2 12"
          />
        </svg>
      </div>

      {/* 
        LAYER 2: SECOND RING (Concentric Dashed & Stepped Track, r ~ 265px)
        Rotates counter-clockwise.
      */}
      <div className="absolute inset-[40px] animate-spin-ring-middle">
        <svg viewBox="0 0 530 530" className="w-full h-full">
          {/* Dashed tech ring with glowing blocks */}
          <circle
            cx="265"
            cy="265"
            r="255"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3.5"
            strokeDasharray="28 14 6 14"
            className="drop-shadow-[0_0_8px_#22d3ee]"
          />
          <circle
            cx="265"
            cy="265"
            r="245"
            fill="none"
            stroke="rgba(56, 189, 248, 0.5)"
            strokeWidth="1.5"
            strokeDasharray="4 8"
          />
          {/* Circular aperture indicator dots */}
          <circle cx="265" cy="10" r="3" fill="#38bdf8" />
          <circle cx="520" cy="265" r="3" fill="#38bdf8" />
          <circle cx="265" cy="520" r="3" fill="#38bdf8" />
          <circle cx="10" cy="265" r="3" fill="#38bdf8" />
        </svg>
      </div>

      {/* 
        LAYER 3: MIDDLE TECH HUD SCALE (r ~ 220px)
        Concentric ring with degree ticks and numbers.
        Rotates clockwise.
      */}
      <div className="absolute inset-[85px] animate-spin-ring-slow">
        <svg viewBox="0 0 440 440" className="w-full h-full">
          {/* Inner boundary circles */}
          <circle
            cx="220"
            cy="220"
            r="215"
            fill="none"
            stroke="rgba(34, 211, 238, 0.8)"
            strokeWidth="2"
            className="drop-shadow-[0_0_6px_#22d3ee]"
          />
          <circle
            cx="220"
            cy="220"
            r="205"
            fill="none"
            stroke="rgba(34, 211, 238, 0.5)"
            strokeWidth="1"
            strokeDasharray="3 5"
          />

          {/* High-density circular tick scale */}
          <circle
            cx="220"
            cy="220"
            r="195"
            fill="none"
            stroke="rgba(34, 211, 238, 0.7)"
            strokeWidth="4"
            strokeDasharray="1 7"
          />

          {/* Degree angle numbers matching the image */}
          <text x="220" y="25" fill="#67e8f9" fontSize="10" fontFamily="monospace" textAnchor="middle">000°</text>
          <text x="415" y="224" fill="#67e8f9" fontSize="10" fontFamily="monospace" textAnchor="middle">090°</text>
          <text x="220" y="425" fill="#67e8f9" fontSize="10" fontFamily="monospace" textAnchor="middle">180°</text>
          <text x="25" y="224" fill="#67e8f9" fontSize="10" fontFamily="monospace" textAnchor="middle">270°</text>
        </svg>
      </div>

      {/* 
        LAYER 4: INNERMOST ROTATING STEPPED RING (r ~ 160px)
        Counter-clockwise fast rotation.
      */}
      <div className="absolute inset-[145px] animate-spin-ring-inner">
        <svg viewBox="0 0 320 320" className="w-full h-full">
          <circle
            cx="160"
            cy="160"
            r="155"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="3"
            strokeDasharray="45 15 15 15"
            className="drop-shadow-[0_0_8px_#22d3ee]"
          />
          <circle
            cx="160"
            cy="160"
            r="147"
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="1.5"
            strokeDasharray="6 12"
          />
        </svg>
      </div>

      {/* 
        LAYER 5: THE CENTRAL BLUE CELESTIAL ORB (Diameter ~ 280px)
        Active, glowing, breathing with swirling filaments and starry particle constellations!
      */}
      <div className="absolute w-[280px] h-[280px] rounded-full flex items-center justify-center animate-core-pulse">
        {/* Outer Solar Glow / Corona */}
        <div className="absolute -inset-4 rounded-full bg-cyan-400/35 blur-xl animate-pulse" />
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 blur-md opacity-80" />

        {/* Sphere Body with Rich Radial Energy Gradient */}
        <div
          className="relative w-full h-full rounded-full overflow-hidden shadow-[inset_0_0_40px_rgba(255,255,255,0.7),0_0_50px_rgba(34,211,238,0.9)]"
          style={{
            background: 'radial-gradient(circle at 40% 35%, #93c5fd 0%, #38bdf8 20%, #0284c7 50%, #032b69 80%, #020f2b 100%)',
          }}
        >
          {/* Swirling energy filaments inside the orb (rotating clockwise) */}
          <div className="absolute inset-0 animate-filament-spin">
            <svg viewBox="0 0 280 280" className="w-full h-full opacity-90">
              {/* Primary white luminous wave */}
              <path
                d="M 35 140 Q 90 50, 140 140 T 245 140"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3.5"
                className="drop-shadow-[0_0_12px_#ffffff]"
              />
              {/* Secondary cyan harmonic wave */}
              <path
                d="M 45 140 Q 140 235, 235 140"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                className="drop-shadow-[0_0_8px_#67e8f9]"
              />
              {/* Tertiary swirling loop */}
              <path
                d="M 60 100 Q 140 180, 220 100 Q 140 220, 60 100"
                fill="none"
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.5"
              />
            </svg>
          </div>

          {/* Counter-swirling secondary filaments */}
          <div className="absolute inset-0 animate-filament-reverse opacity-70">
            <svg viewBox="0 0 280 280" className="w-full h-full">
              <path
                d="M 50 140 Q 140 60, 230 140"
                fill="none"
                stroke="#a5f3fc"
                strokeWidth="2"
                strokeDasharray="8 6"
              />
            </svg>
          </div>

          {/* Dynamic Canvas Particles / Neural constellation sparks */}
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Off-center Lens Flare / Sun Reflection (matching top-right highlight in image) */}
          <div className="absolute top-10 right-14 w-8 h-8 rounded-full bg-white blur-[3px] opacity-90 shadow-[0_0_25px_#ffffff,0_0_45px_#67e8f9]" />
          <div className="absolute top-12 right-16 w-3 h-3 rounded-full bg-white shadow-[0_0_12px_#ffffff]" />

          {/* Inner atmospheric vignette */}
          <div className="absolute inset-0 rounded-full border border-cyan-200/50 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
