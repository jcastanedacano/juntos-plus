import { useMsal } from '@azure/msal-react';
import { loginRequest, readLoginHint, LOGIN_GOOGLE_ACTIVO } from '../auth/msalConfig';
import { Shield, TrendingUp, PiggyBank, BarChart3, CreditCard } from 'lucide-react';

/** La G de Google, con sus colores. Es una marca ajena: se dibuja tal cual. */
function MarcaGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.2-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

export function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = () => {
    // Pre-fill the loginHint so MS picks the right account without
    // showing the account chooser. Survives Safari ITP via cookie mirror.
    const hint = readLoginHint();
    instance.loginRedirect({
      ...loginRequest,
      ...(hint ? { loginHint: hint } : {}),
    });
  };

  // Google va DIRECTO a Google. Esta aplicacion es cliente suyo, igual que
  // cualquier otra que ofrezca «entrar con Google»; Microsoft no participa.
  //
  // El intento anterior metia a Google detras de Entra, y por ahi el usuario
  // aterrizaba siempre en una pantalla de Microsoft sin forma de saltarsela:
  // en un directorio de trabajo domain_hint acelera hacia dominios federados,
  // no hacia proveedores sociales. Probado con cuatro valores distintos.
  //
  // No es loginRedirect de MSAL sino una navegacion normal, porque el que
  // arranca el intercambio es nuestro servidor, que es quien guarda el secreto.
  const conGoogle = () => {
    window.location.href = '/auth/google';
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern" />

      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">
            <span className="login-brand-mark" aria-hidden="true">J</span>
            <h1 className="login-app-name">Juntos<span className="login-plus">+1</span></h1>
            <p className="login-subtitle">Tu copiloto financiero en pareja</p>
          </div>

          <div className="login-features">
            <div className="login-feature">
              <TrendingUp size={18} />
              <span>Dashboard y forecast del mes</span>
            </div>
            <div className="login-feature">
              <CreditCard size={18} />
              <span>Asesor de tarjeta de crédito</span>
            </div>
            <div className="login-feature">
              <PiggyBank size={18} />
              <span>Metas y ahorros automáticos</span>
            </div>
            <div className="login-feature">
              <BarChart3 size={18} />
              <span>Recurrentes, presupuestos y recap</span>
            </div>
          </div>

          <button className="login-btn" onClick={handleLogin}>
            <Shield size={20} />
            <span>Continuar con Microsoft</span>
          </button>

          {LOGIN_GOOGLE_ACTIVO && (
            <>
              <div className="login-sep"><span>o</span></div>

              <button className="login-btn login-btn-google" onClick={conGoogle}>
                <MarcaGoogle />
                <span>Continuar con Google</span>
              </button>

              {/* Con Google no hay registro aparte: la primera vez que entras,
                  entras; el hogar se crea despues, dentro de la aplicacion. */}
              <p className="login-nota">
                La primera vez creamos tu cuenta sola.
              </p>
            </>
          )}

          <p className="login-secured">
            <Shield size={12} />
            Protegido con Microsoft Entra ID
          </p>
        </div>
      </div>
    </div>
  );
}
