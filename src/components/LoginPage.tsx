import { useMsal } from '@azure/msal-react';
import {
  loginRequest, readLoginHint, AUTORIDAD_EXTERNA, LOGIN_EXTERNO_ACTIVO,
} from '../auth/msalConfig';
import { Shield, TrendingUp, PiggyBank, BarChart3, CreditCard, AtSign } from 'lucide-react';

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

  // El tenant externo tiene su propia autoridad, asi que va como parametro de
  // la peticion y no en la configuracion: la misma aplicacion atiende las dos
  // puertas. Sin loginHint a proposito: quien entra por aqui puede venir de
  // Google o de un correo suelto, y el hint guardado es del otro directorio.
  const handleLoginExterno = () => {
    instance.loginRedirect({ ...loginRequest, authority: AUTORIDAD_EXTERNA });
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
            <span>Iniciar sesión con Microsoft</span>
          </button>

          {LOGIN_EXTERNO_ACTIVO && (
            <>
              <div className="login-sep"><span>o</span></div>
              <button className="login-btn login-btn-alt" onClick={handleLoginExterno}>
                <AtSign size={20} />
                <span>Entrar con Google u otro correo</span>
              </button>
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
