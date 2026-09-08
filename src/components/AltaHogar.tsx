import { useState } from 'react';
import { Home, Users, Check, X } from 'lucide-react';
import {
  EstadoHogar, crearHogar, aceptarInvitacion, rechazarInvitacion, explicar,
} from '../utils/hogar';

interface Props {
  estado: EstadoHogar;
  /** Se llama cuando ya hay hogar: la aplicación vuelve a arrancar con datos. */
  onListo: () => void;
}

/**
 * Lo primero que ve quien acaba de registrarse. Sin esto el servidor responde
 * 409 a todo y la aplicación aparece rota justo para el usuario nuevo.
 *
 * Si alguien ya lo llamó a su hogar, esa invitación va PRIMERO: crear un hogar
 * propio para después fusionarlo es un rodeo que nadie pidió.
 */
export function AltaHogar({ estado, onListo }: Props) {
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rechazada, setRechazada] = useState(false);

  const invitacion = rechazada ? null : (estado.invitaciones[0] || null);

  const ejecutar = async (accion: () => Promise<{ ok: boolean; codigo?: string }>) => {
    setOcupado(true);
    setError(null);
    const r = await accion();
    setOcupado(false);
    if (r.ok) onListo();
    else setError(explicar(r.codigo || ''));
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <span className="login-brand-mark" aria-hidden="true">J</span>
            <h1 className="login-app-name">Juntos<span className="login-plus">+1</span></h1>
            <p className="login-subtitle">
              {estado.correo ? `Entraste como ${estado.correo}` : 'Un paso más y empezamos'}
            </p>
          </div>

          {invitacion && (
            <div className="alta-invitacion">
              <span className="alta-titulo">
                <Users size={14} /> Te están invitando
              </span>
              <p>
                <strong>{invitacion.de || 'Alguien'}</strong> te llamó a <strong>{invitacion.nombre}</strong>.
                Si aceptas, compartirán los mismos datos y lo que ya hayas apuntado se unirá a los suyos.
              </p>
              <div className="alta-botones">
                <button
                  className="login-btn"
                  disabled={ocupado}
                  onClick={() => ejecutar(() => aceptarInvitacion(invitacion.hogarId))}
                >
                  <Check size={18} />
                  <span>Unirme</span>
                </button>
                {/* Rechazar no crea nada ni sale de aquí: solo retira la
                    invitación y deja a la vista la opción de empezar el suyo. */}
                <button
                  className="login-btn login-btn-alt"
                  disabled={ocupado}
                  onClick={async () => {
                    setOcupado(true);
                    setError(null);
                    const r = await rechazarInvitacion(invitacion.hogarId);
                    setOcupado(false);
                    if (r.ok) setRechazada(true);
                    else setError(explicar(r.codigo));
                  }}
                >
                  <X size={18} />
                  <span>Ahora no</span>
                </button>
              </div>
            </div>
          )}

          {invitacion && <div className="login-sep"><span>o empieza el tuyo</span></div>}

          <label className="alta-campo">
            <span>¿Cómo se llama tu hogar?</span>
            <input
              type="text"
              value={nombre}
              maxLength={40}
              placeholder="Nuestra casa"
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !ocupado) ejecutar(() => crearHogar(nombre));
              }}
            />
          </label>

          <button
            className="login-btn"
            disabled={ocupado}
            onClick={() => ejecutar(() => crearHogar(nombre))}
          >
            <Home size={18} />
            <span>{ocupado ? 'Creando…' : 'Crear mi hogar'}</span>
          </button>

          {error && <p className="alta-error" role="alert">{error}</p>}

          <p className="login-secured">
            Empiezas con todo vacío. Nadie más ve tus números.
          </p>
        </div>
      </div>
    </div>
  );
}
