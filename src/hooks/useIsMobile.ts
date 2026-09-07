import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // La clase va tambien en <html>, no solo en .app-layout.
  //
  // El contenedor de avisos lo monta ToastProvider, que envuelve a <App> en
  // main.tsx: en el DOM queda como hermano de .app-layout, o sea FUERA de
  // .is-mobile. Consecuencia: heredaba los tokens del tema oscuro --texto
  // #E8ECF1 sobre tarjeta oscura-- y aparecia como un recuadro negro flotando
  // sobre una pantalla clara; y la regla que lo sube por encima de la barra
  // de pestanias no llegaba a aplicarse nunca.
  //
  // Poniendola en la raiz, cualquier cosa que se monte fuera del layout
  // --avisos de hoy, portales de maniana-- hereda el sistema igual.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.toggle('is-mobile', isMobile);
    return () => raiz.classList.remove('is-mobile');
  }, [isMobile]);

  return isMobile;
}
