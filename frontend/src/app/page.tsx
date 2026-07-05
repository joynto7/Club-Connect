"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import LogoIcon from "@/components/shared/LogoIcon";
import { useEffect, useState } from "react";

type ShadowBlob = {
  left: number; bottom: number;
  width: number; height: number;
  opacity: number; rotate: number;
  duration: number; delay: number;
};

function makeShadows(): ShadowBlob[] {
  const left: ShadowBlob[] = [
    { left:  8, bottom: 4,  width: 140, height: 22, opacity: 0.13, rotate:  18, duration: 9,  delay: 0  },
    { left: 15, bottom: 10, width: 110, height: 16, opacity: 0.10, rotate:  14, duration: 11, delay: -3 },
    { left:  5, bottom: 16, width:  90, height: 14, opacity: 0.09, rotate:  20, duration: 8,  delay: -6 },
    { left: 22, bottom: 6,  width: 160, height: 20, opacity: 0.11, rotate:  12, duration: 13, delay: -1 },
    { left: 12, bottom: 22, width:  80, height: 12, opacity: 0.08, rotate:  22, duration: 10, delay: -8 },
    { left: 28, bottom: 14, width: 120, height: 18, opacity: 0.10, rotate:  16, duration: 9,  delay: -4 },
  ];
  const right: ShadowBlob[] = [
    { left: 70, bottom: 4,  width: 140, height: 22, opacity: 0.13, rotate: -18, duration: 10, delay: -2 },
    { left: 76, bottom: 10, width: 110, height: 16, opacity: 0.10, rotate: -14, duration: 12, delay: -5 },
    { left: 82, bottom: 16, width:  90, height: 14, opacity: 0.09, rotate: -20, duration: 8,  delay: -7 },
    { left: 65, bottom: 6,  width: 160, height: 20, opacity: 0.11, rotate: -12, duration: 11, delay: -1 },
    { left: 72, bottom: 22, width:  80, height: 12, opacity: 0.08, rotate: -22, duration: 9,  delay: -9 },
    { left: 60, bottom: 14, width: 120, height: 18, opacity: 0.10, rotate: -16, duration: 13, delay: -3 },
  ];
  return [...left, ...right];
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [shadows]             = useState<ShadowBlob[]>(makeShadows);

  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-[#FDF9F1] flex flex-col relative overflow-hidden font-sans">

      {/* ── Static campus image + swaying tree shadows ── */}
      <div className="absolute bottom-0 right-0 left-0 h-[65vh] pointer-events-none z-0">
        <Image
          src="/assets/images/campus.png"
          alt="Campus Background"
          fill
          className="object-cover object-bottom opacity-90"
          priority
        />

        {mounted && (
          <div className="absolute inset-0 z-[5] overflow-hidden">
            {shadows.map((s, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  left:            `${s.left}%`,
                  bottom:          `${s.bottom}%`,
                  width:           `${s.width}px`,
                  height:          `${s.height}px`,
                  transform:       `rotate(${s.rotate}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <div
                  style={{
                    width:    "100%",
                    height:   "100%",
                    background: `radial-gradient(ellipse at center, rgba(40,22,0,${s.opacity}) 30%, transparent 100%)`,
                    filter:   "blur(7px)",
                    animation: `shadow-sway ${s.duration}s ease-in-out infinite ${s.delay}s`,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-b from-[#FDF9F1] via-[#FDF9F1]/40 to-transparent z-10" />
      </div>

      {/* ═══════════════════════════════════════════════════════
          KEYFRAMES
          ═══════════════════════════════════════════════════════ */}
      <style dangerouslySetInnerHTML={{__html: `

        /* Tree-shadow sway */
        @keyframes shadow-sway {
          0%   { transform: scaleX(1)    translateX(  0px); opacity: 1;    }
          18%  { transform: scaleX(1.20) translateX( 11px); opacity: 0.85; }
          40%  { transform: scaleX(0.86) translateX( -9px); opacity: 1.0;  }
          62%  { transform: scaleX(1.14) translateX(  8px); opacity: 0.88; }
          80%  { transform: scaleX(0.92) translateX( -6px); opacity: 0.95; }
          100% { transform: scaleX(1)    translateX(  0px); opacity: 1;    }
        }

        /*
          ═══════════════════════════════════════════════════════
          FIDGET SPINNER  —  130 s total cycle
          ───────────────────────────────────────────────────────
          • Spin phase  :  first 10 s  (0 – 7.69 % of 130 s)
            – Nodes burst out while already spinning (flick start)
            – Peak angular velocity ≈ 1 800 °/s (5 rps)
            – Long organic friction-decay tail
            – Arms retract back to hub
          • Wait phase  :  remaining 120 s  (7.69 – 100 %)
            – scale(0), completely invisible
          ═══════════════════════════════════════════════════════

          All % values = (original_seconds / 130) × 100, rounded.
          Blur only — no brightness boost.
        */
        @keyframes orbit-emerge-spin {

          /* Emerge: nodes fly out while already spinning */
          0%    { transform: scale(0)    rotate(    0deg); filter: blur(0px);   }
          0.31% { transform: scale(0.35) rotate(  120deg); filter: blur(0.3px); }
          0.62% { transform: scale(0.8)  rotate(  360deg); filter: blur(1px);   }
          0.85% { transform: scale(1.12) rotate(  640deg); filter: blur(2px);   }
          1.08% { transform: scale(1.0)  rotate(  960deg); filter: blur(3px);   }
          1.31% { transform: scale(1)    rotate( 1500deg); filter: blur(5px);   }

          /* ── Peak velocity ≈ 1 800 °/s ── */
          1.38% { transform: scale(1) rotate( 1680deg); filter: blur(6px); }
          1.69% { transform: scale(1) rotate( 2400deg); filter: blur(6px); }
          2.00% { transform: scale(1) rotate( 3120deg); filter: blur(6px); }
          2.31% { transform: scale(1) rotate( 3840deg); filter: blur(6px); }

          /* ── Friction decay ── */
          2.77% { transform: scale(1) rotate( 4360deg); filter: blur(5px);   }
          3.31% { transform: scale(1) rotate( 4750deg); filter: blur(4px);   }
          3.85% { transform: scale(1) rotate( 5040deg); filter: blur(3px);   }
          4.38% { transform: scale(1) rotate( 5260deg); filter: blur(2px);   }
          4.85% { transform: scale(1) rotate( 5430deg); filter: blur(1.5px); }
          5.23% { transform: scale(1) rotate( 5560deg); filter: blur(0.8px); }
          5.62% { transform: scale(1) rotate( 5655deg); filter: blur(0.2px); }
          5.92% { transform: scale(1) rotate( 5720deg); filter: blur(0px);   }
          6.23% { transform: scale(1) rotate( 5766deg); filter: blur(0px);   }
          6.46% { transform: scale(1) rotate( 5796deg); filter: blur(0px);   }
          6.69% { transform: scale(1) rotate( 5814deg); filter: blur(0px);   }
          6.85% { transform: scale(1) rotate( 5822deg); filter: blur(0px);   }
          7.00% { transform: scale(1) rotate( 5826deg); filter: blur(0px);   }
          7.15% { transform: scale(1) rotate( 5827deg); filter: blur(0px);   }

          /* Retract into hub */
          7.38% { transform: scale(1) rotate( 5827deg); filter: blur(0px); }
          7.62% { transform: scale(0) rotate( 5827deg); filter: blur(0px); }

          /* ── 2-minute wait — fully hidden ── */
          7.69% { transform: scale(0) rotate( 5827deg); filter: blur(0px); }
          100%  { transform: scale(0) rotate( 5827deg); filter: blur(0px); }
        }
        .orbit-group { animation: orbit-emerge-spin 130s linear infinite; }

        /* Hero entrance */
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to   { opacity: 1; transform: scale(1);   }
        }
        .animate-fade-in-up { animation: fadeInUp 1s cubic-bezier(0.16,1,0.3,1) forwards; }
        .animate-scale-in   { animation: scaleIn  1s cubic-bezier(0.16,1,0.3,1) forwards; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-500 { animation-delay: 0.5s; }
      `}} />

      {/* ── Main content ── */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6 text-center pt-10 pb-20">

        {/* Logo */}
        <div className="animate-scale-in opacity-0 mb-8">
          <div className="w-24 h-24 rounded-3xl overflow-hidden
                          shadow-[0_8px_30px_rgba(235,168,20,0.22)]">
            <LogoIcon size={96} animateOrbit />
          </div>
        </div>

        <h1 className="animate-fade-in-up delay-100 opacity-0 text-5xl md:text-7xl lg:text-8xl font-black leading-tight text-gray-900 tracking-tight mb-6">
          CLUB <span className="text-[#EBA814]">CONNECT</span>
        </h1>

        <p className="animate-fade-in-up delay-300 opacity-0 text-xl md:text-2xl text-gray-600 font-medium mb-12 max-w-2xl leading-relaxed">
          Your one-stop platform to discover clubs, manage activities, and build a stronger campus community.
        </p>

        <div className="animate-fade-in-up delay-500 opacity-0 flex flex-col sm:flex-row gap-4 w-full max-w-lg justify-center">
          <Link
            href="/register"
            className="flex-1 px-8 py-4 bg-[#EBA814] hover:bg-[#D99810] text-white font-bold rounded-2xl transition-all shadow-[0_6px_20px_rgba(235,168,20,0.3)] hover:shadow-[0_8px_25px_rgba(235,168,20,0.4)] hover:-translate-y-1 flex items-center justify-center gap-2 text-lg"
          >
            Get Started <ArrowRight size={22} strokeWidth={2.5} />
          </Link>
          <Link
            href="/login"
            className="flex-1 px-8 py-4 bg-white border-2 border-gray-100 hover:border-[#EBA814]/30 hover:bg-[#FDF9F1] text-gray-800 font-bold rounded-2xl transition-all shadow-sm hover:shadow-md flex items-center justify-center text-lg"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
