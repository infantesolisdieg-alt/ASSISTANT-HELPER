// Número que sube suavemente hasta su valor (600 ms). Respeta "reducir movimiento".

import { useEffect, useRef, useState } from 'react';

// Sin animación si el usuario pidió reducir movimiento o si la pestaña no está visible
// (en ese caso el navegador pausa requestAnimationFrame y el número se quedaría en 0).
const reducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.visibilityState === 'hidden');

export function CountUp({ value, suffix = '', duration = 600 }: { value: number; suffix?: string; duration?: number }) {
  const [shown, setShown] = useState(reducedMotion() ? value : 0);
  // Último valor mostrado: la siguiente animación parte de ahí
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const initial = shownRef.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(initial + (value - initial) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return (
    <>
      {/* El valor final siempre está disponible para lectores de pantalla */}
      <span aria-hidden="true">
        {shown}
        {suffix}
      </span>
      <span className="sr-only">
        {value}
        {suffix}
      </span>
    </>
  );
}
