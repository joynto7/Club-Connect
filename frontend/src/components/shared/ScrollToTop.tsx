"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const onScroll = () => setVisible(main.scrollTop > 300);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
      title="Scroll to top"
      className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-[#EBA814] text-white shadow-lg hover:bg-[#d4970f] hover:scale-110 active:scale-95 transition-all"
    >
      <ChevronUp size={20} />
    </button>
  );
}
