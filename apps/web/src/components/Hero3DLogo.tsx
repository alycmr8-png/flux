"use client";

/**
 * 3D animated Flux logo — plays like a looping video: the three layers of
 * the mark drop in and stack on top of each other, hold as the assembled
 * logo (slowly rotating), then fade and rebuild. Pure CSS 3D (no three.js);
 * freezes to the assembled mark for reduced-motion users.
 */
export function Hero3DLogo() {
  return (
    <div className="flux3d-wrap" aria-hidden="true">
      {/* soft glow under the mark */}
      <div className="flux3d-glow" />

      <div className="flux3d-float">
        <div className="flux3d-stack">
          <div className="flux3d-layer flux3d-l3" />
          <div className="flux3d-layer flux3d-l2" />
          <div className="flux3d-layer flux3d-l1" />
        </div>
      </div>

      {/* small ambient stacks, desktop only */}
      <div className="flux3d-mini flux3d-mini-left">
        <div className="flux3d-float" style={{ animationDelay: "-2.2s" }}>
          <div className="flux3d-stack" style={{ animationDuration: "34s" }}>
            <div className="flux3d-layer flux3d-l3" style={{ animationDelay: "-1.4s" }} />
            <div className="flux3d-layer flux3d-l1" style={{ animationDelay: "-1.4s" }} />
          </div>
        </div>
      </div>
      <div className="flux3d-mini flux3d-mini-right">
        <div className="flux3d-float" style={{ animationDelay: "-4.6s" }}>
          <div className="flux3d-stack" style={{ animationDuration: "40s" }}>
            <div className="flux3d-layer flux3d-l3" style={{ animationDelay: "-3.1s" }} />
            <div className="flux3d-layer flux3d-l1" style={{ animationDelay: "-3.1s" }} />
          </div>
        </div>
      </div>

      <style>{`
        .flux3d-wrap {
          position: relative;
          width: 100%;
          height: 180px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .flux3d-glow {
          position: absolute;
          width: 340px;
          height: 120px;
          bottom: -14px;
          border-radius: 50%;
          background: radial-gradient(50% 50% at 50% 50%, rgba(75,95,232,0.22) 0%, rgba(75,95,232,0) 70%);
          filter: blur(6px);
          animation: flux3d-glowpulse 8s ease-in-out infinite;
        }
        .flux3d-float {
          animation: flux3d-bob 6.5s ease-in-out infinite;
        }
        .flux3d-stack {
          position: relative;
          width: 140px;
          height: 140px;
          transform-style: preserve-3d;
          transform: rotateX(56deg) rotateZ(45deg);
          animation: flux3d-spin 28s linear infinite;
        }
        .flux3d-layer {
          position: absolute;
          inset: 0;
          border-radius: 26px;
          background: linear-gradient(135deg, #4B5FE8 0%, #6E7FF3 55%, #93A0F8 100%);
          box-shadow: 0 24px 50px rgba(75,95,232,0.28), inset 0 1px 0 rgba(255,255,255,0.35);
          opacity: 0;
        }

        /* ── The build loop (8s): bottom lands → middle stacks → top caps it,
             hold assembled, fade, rebuild ── */
        .flux3d-l3 { animation: flux3d-build-l3 8s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .flux3d-l2 { animation: flux3d-build-l2 8s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        .flux3d-l1 { animation: flux3d-build-l1 8s cubic-bezier(0.22, 1, 0.36, 1) infinite; }

        @keyframes flux3d-build-l3 {
          0%        { opacity: 0;    transform: translateZ(120px); }
          3%        { opacity: 0;    transform: translateZ(120px); }
          11%       { opacity: 0.34; transform: translateZ(-40px); }
          14%       { opacity: 0.3;  transform: translateZ(-34px); }
          86%       { opacity: 0.3;  transform: translateZ(-34px); }
          95%, 100% { opacity: 0;    transform: translateZ(-34px); }
        }
        @keyframes flux3d-build-l2 {
          0%, 17%   { opacity: 0;    transform: translateZ(150px); }
          25%       { opacity: 0.6;  transform: translateZ(-4px); }
          28%       { opacity: 0.55; transform: translateZ(2px); }
          86%       { opacity: 0.55; transform: translateZ(2px); }
          95%, 100% { opacity: 0;    transform: translateZ(2px); }
        }
        @keyframes flux3d-build-l1 {
          0%, 31%   { opacity: 0;    transform: translateZ(190px); }
          39%       { opacity: 1;    transform: translateZ(32px); }
          42%       { opacity: 1;    transform: translateZ(38px); }
          86%       { opacity: 1;    transform: translateZ(38px); }
          95%, 100% { opacity: 0;    transform: translateZ(38px); }
        }

        @keyframes flux3d-spin {
          from { transform: rotateX(56deg) rotateZ(45deg); }
          to   { transform: rotateX(56deg) rotateZ(405deg); }
        }
        @keyframes flux3d-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        @keyframes flux3d-glowpulse {
          0%, 100% { opacity: 0.55; transform: scale(0.9); }
          45%      { opacity: 1;    transform: scale(1); }
          95%      { opacity: 0.4;  transform: scale(0.85); }
        }

        .flux3d-wrap, .flux3d-mini { perspective: 900px; }
        .flux3d-mini { position: absolute; display: none; }
        @media (min-width: 900px) {
          .flux3d-mini { display: block; }
          .flux3d-mini-left  { left: 10%;  top: 30%; transform: scale(0.32); opacity: 0.5; }
          .flux3d-mini-right { right: 9%;  top: 12%; transform: scale(0.24); opacity: 0.4; }
        }

        @media (prefers-reduced-motion: reduce) {
          .flux3d-float, .flux3d-stack, .flux3d-layer, .flux3d-glow { animation: none; }
          .flux3d-stack { transform: rotateX(56deg) rotateZ(45deg); }
          .flux3d-l3 { opacity: 0.3;  transform: translateZ(-34px); }
          .flux3d-l2 { opacity: 0.55; transform: translateZ(2px); }
          .flux3d-l1 { opacity: 1;    transform: translateZ(38px); }
        }
      `}</style>
    </div>
  );
}
