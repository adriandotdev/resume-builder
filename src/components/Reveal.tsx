"use client";
import { useEffect } from "react";

/**
 * Section entrances: every [data-reveal] block brings its children in one after
 * another as it scrolls into view. Content is visible by default and only hidden
 * once this runs, so nothing stays hidden without script or with reduced motion.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.in = "true";
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -12% 0px" });
    // Blocks already on screen or scrolled past (a reload mid-page) stay as they are,
    // instead of blinking out and fading back in.
    const fold = window.innerHeight * 0.88;
    for (const b of blocks) {
      if (b.getBoundingClientRect().top < fold) b.dataset.in = "true";
      else io.observe(b);
    }
    root.classList.add("reveal-on");
    return () => { io.disconnect(); root.classList.remove("reveal-on"); };
  }, []);
  return null;
}
