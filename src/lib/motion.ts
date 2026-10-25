/** Shared motion tokens; mirror --ease-out in globals.css. */
export const EASE = [0.23, 1, 0.32, 1] as const;

/** Fade-up entrance. Only the first few steps are staggered so a long list never lags. */
export const enter = (i = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.26, ease: EASE, delay: Math.min(i, 7) * 0.04 },
});

/** Status message that opens its own height, so what sits below it moves smoothly. */
export const fade = {
  initial: { opacity: 0, height: 0 },
  animate: { opacity: 1, height: "auto", transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, height: 0, transition: { duration: 0.14, ease: EASE } },
};
