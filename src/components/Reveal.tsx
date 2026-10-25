"use client";
import { animate, inView } from "motion/react";
import { useEffect } from "react";
import { EASE } from "@/lib/motion";

/** Delay (s) for the nth piece of a block: headings first, then text, then picture. */
const delayFor = (block: HTMLElement, el: HTMLElement, i: number) => {
  if (block.classList.contains("faq-cols")) return 0.1 + i * 0.035;
  if (block.classList.contains("show")) return (el.parentElement?.classList.contains("show-out") ? 0.16 : 0) + i * 0.1;
  return Math.min(i, 3) * 0.08;
};

/** The pieces that arrive: a block's children, or for the showcase the contents of its two halves. */
const piecesOf = (block: HTMLElement) =>
  block.classList.contains("show")
    ? Array.from(block.querySelectorAll<HTMLElement>(":scope > .show-in > *, :scope > .show-out > *"))
    : Array.from(block.children) as HTMLElement[];

/**
 * Section entrances: every [data-reveal] block brings its pieces in one after
 * another as it scrolls into view, driven by motion's inView + animate. Content is
 * visible by default and only hidden once this runs, so nothing stays hidden
 * without script or with reduced motion.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    const blocks = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const arrive = (b: HTMLElement) => {
      b.dataset.in = "true"; // lifts the hidden state; the animation below starts from it in the same frame
      piecesOf(b).forEach((el, i) => {
        animate(
          el,
          { opacity: [0, 1], y: [16, 0], filter: ["blur(6px)", "blur(0px)"] },
          { duration: 0.9, ease: EASE, delay: delayFor(b, el, i) },
        ).then(() => { el.style.removeProperty("filter"); });
      });
    };
    // Blocks already on screen or scrolled past (a reload mid-page) stay as they are,
    // instead of blinking out and fading back in.
    const fold = window.innerHeight * 0.88;
    const stops: VoidFunction[] = [];
    for (const b of blocks) {
      if (b.getBoundingClientRect().top < fold) b.dataset.in = "true";
      else stops.push(inView(b, () => { arrive(b); }, { margin: "0px 0px -12% 0px" }));
    }
    root.classList.add("reveal-on");
    return () => { stops.forEach((s) => s()); root.classList.remove("reveal-on"); };
  }, []);
  return null;
}
