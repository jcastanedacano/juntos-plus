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
 * salio. Sin red, o con un servidor que no contesta, tambien funciona: espera
 * un rato, sigue y recarga, que es justo cuando hace falta.
 */
export function BotonSalir() {
  const { instance } = useMsal();
  const [saliendo, setSaliendo] = useState(false);
  const [fallo, setFallo] = useState(false);

  const salir = async () => {
    // Una sola vez: el redirect de Microsoft tarda y un segundo clic
    // lanzaria otro cierre encima.
    setSaliendo(true);
    setFallo(false);
    try {
      await cerrarSesion(instance);
    } catch {
      // Si el cierre de Microsoft se rechaza no hay navegacion, y dejar el
      // boton deshabilitado seria quitar la unica salida que hay. Se vuelve a
      // ofrecer y se dice por que, en vez de quedarse mudo.
      setSaliendo(false);
      setFallo(true);
    }
  };

  return (
    <>
      <button
        type="button"
        className="login-btn login-btn-alt login-salir"
        disabled={saliendo}
        onClick={() => { void salir(); }}
      >
        <LogOut size={18} />
        <span>{saliendo ? 'Saliendo…' : 'Cerrar sesión'}</span>
      </button>
      {fallo && (
        <p className="alta-error" role="alert">
          No se pudo cerrar la sesión. Inténtalo de nuevo.
        </p>
      )}
    </>
  );
}
