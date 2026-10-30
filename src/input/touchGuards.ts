// Avoid browser zoom without blocking single-finger page scrolling.
export function installTouchGuards(target: Document): void {
  const prevent = (event: Event) => event.preventDefault();
  const preventPinch = (event: TouchEvent) => { if (event.touches.length > 1) event.preventDefault(); };
  const options = { passive: false };
  target.addEventListener('gesturestart', prevent, options);
  target.addEventListener('gesturechange', prevent, options);
  target.addEventListener('touchstart', preventPinch, options);
  target.addEventListener('touchmove', preventPinch, options);
  target.addEventListener('selectstart', prevent);
  target.addEventListener('dragstart', prevent);
}
