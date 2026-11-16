import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useMsal } from '@azure/msal-react';
import { cerrarSesion } from '../auth/salir';

/**
 * Salir desde una pantalla de bloqueo.
 *
 * Quien cae en «Crear mi hogar» o en «No pudimos hablar con el servidor» con
 * una cuenta que no es la suya no tiene a donde ir: el Header de la aplicacion
 * ni se dibuja, y el propio error dice «cierra sesion y vuelve a entrar» sin
 * dar con que hacerlo. Estas pantallas SIEMPRE llevan una salida.
 *
 * Usa el mismo cerrarSesion que el resto: borra la cookie de Google y cierra
 * la cuenta de Microsoft, porque cerrar solo una deja dentro a quien cree que
 * salio. Sin red tambien funciona: sigue y recarga, que es justo cuando hace
 * falta.
 */
export function BotonSalir() {
  const { instance } = useMsal();
  const [saliendo, setSaliendo] = useState(false);

  return (
    <button
      type="button"
      className="login-btn login-btn-alt login-salir"
      disabled={saliendo}
      onClick={() => {
        // Una sola vez: el redirect de Microsoft tarda y un segundo clic
        // lanzaria otro cierre encima.
        setSaliendo(true);
        void cerrarSesion(instance);
      }}
    >
      <LogOut size={18} />
      <span>{saliendo ? 'Saliendo…' : 'Cerrar sesión'}</span>
    </button>
  );
}
