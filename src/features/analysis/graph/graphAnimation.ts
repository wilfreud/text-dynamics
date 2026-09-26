import { createScope, animate, stagger, type Scope } from "animejs";

/**
 * Checks if the user has requested reduced motion at the OS/browser level.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Creates a lifecycle-safe Anime.js animation scope for the SVG graph.
 * Invariant:
 * - Domain state & SVG geometry remain authoritative.
 * - Respects prefers-reduced-motion.
 * - Calling revert() cleans up all running timers and styles on unmount.
 */
export function createGraphAnimationScope(rootElement: SVGElement | HTMLElement): {
  animateReveal: () => void;
  animateSelection: (targetElement: SVGElement) => void;
  animateMetricSwitch: () => void;
  cleanup: () => void;
} {
  const scope: Scope = createScope({ root: rootElement });

  function animateReveal() {
    if (prefersReducedMotion()) return;

    // Subtle staggered reveal of nodes and smooth fade-in of semantic paths
    scope.add(() => {
      animate(".paths path", {
        opacity: [0, 0.9],
        duration: 350,
        ease: "outQuad",
      });

      animate(".nodes g", {
        opacity: [0, 1],
        scale: [0.6, 1],
        delay: stagger(25, { start: 50 }),
        duration: 300,
        ease: "outBack(1.3)",
      });

      animate(".phase-bands", {
        opacity: [0, 0.6],
        duration: 400,
        ease: "outQuad",
      });

      animate(".movement-markers", {
        opacity: [0, 1],
        translateY: [-6, 0],
        duration: 300,
        ease: "outQuad",
      });
    });
  }

  function animateMetricSwitch() {
    if (prefersReducedMotion()) return;

    // Micro-transition on metric switch without distorting path geometry
    scope.add(() => {
      animate(".paths path", {
        opacity: [0.3, 0.9],
        duration: 250,
        ease: "outQuad",
      });

      animate(".nodes g circle", {
        scale: [0.85, 1],
        duration: 220,
        ease: "outBack(1.1)",
      });
    });
  }

  function animateSelection(targetElement: SVGElement) {
    if (prefersReducedMotion()) return;

    scope.add(() => {
      animate(targetElement, {
        scale: [1, 1.25, 1],
        duration: 250,
        ease: "outQuad",
      });
    });
  }

  function cleanup() {
    try {
      scope.revert();
    } catch {
      // Ignore if already unmounted
    }
  }

  return {
    animateReveal,
    animateSelection,
    animateMetricSwitch,
    cleanup,
  };
}
