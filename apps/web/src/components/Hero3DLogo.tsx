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
          opacity: 0.75;
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

        /* ── The build (3.4s, once): bottom lands → middle stacks → top caps
             it, then holds assembled for good ── */
        .flux3d-l3 { animation: flux3d-build-l3 3.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .flux3d-l2 { animation: flux3d-build-l2 3.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .flux3d-l1 { animation: flux3d-build-l1 3.4s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

        @keyframes flux3d-build-l3 {
          0%, 7%    { opacity: 0;    transform: translateZ(120px); }
          26%       { opacity: 0.34; transform: translateZ(-40px); }
          33%, 100% { opacity: 0.3;  transform: translateZ(-34px); }
        }
        @keyframes flux3d-build-l2 {
          0%, 40%   { opacity: 0;    transform: translateZ(150px); }
          59%       { opacity: 0.6;  transform: translateZ(-4px); }
          66%, 100% { opacity: 0.55; transform: translateZ(2px); }
        }
        @keyframes flux3d-build-l1 {
          0%, 73%   { opacity: 0;    transform: translateZ(190px); }
          92%       { opacity: 1;    transform: translateZ(32px); }
          100%      { opacity: 1;    transform: translateZ(38px); }
        }

        @keyframes flux3d-spin {
          from { transform: rotateX(56deg) rotateZ(45deg); }
          to   { transform: rotateX(56deg) rotateZ(405deg); }
        }
        @keyframes flux3d-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        .flux3d-wrap { perspective: 900px; }

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
