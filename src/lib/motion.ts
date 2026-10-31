import { gsap } from 'gsap';
import { Observer } from 'gsap/Observer';

let registered = false;

/** Registers the GSAP plugins we use. Safe to call many times. */
export function registerGsap(): typeof gsap {
  if (!registered) {
    gsap.registerPlugin(Observer);
    registered = true;
  }
  return gsap;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
