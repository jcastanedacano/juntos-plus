/**
 * Entrar con Google, sin intermediarios.
 *
 * La primera version metia a Google DETRAS de Entra: la aplicacion hablaba solo
 * con Microsoft y Microsoft federaba con Google. Funciona, pero el usuario
 * aterriza siempre en una pantalla de Microsoft, y no hay forma de saltarsela:
 * en un directorio de trabajo `domain_hint` acelera hacia dominios federados,
 * no hacia proveedores sociales. Probado con cuatro valores distintos.
 *
 * Asi que aqui la aplicacion es cliente de Google directamente, igual que
 * cualquier otra que ofrezca «entrar con Google». El boton va a
 * accounts.google.com y vuelve. Microsoft sigue siendo la puerta de la pareja,
 * pero ya no es la puerta de todos.
 *
 * Se usa el flujo de codigo, no el de token en el navegador, porque esto es una
 * PWA: un id_token de Google dura una hora y no se renueva solo, lo que
 * significaria pedir la cuenta cada vez que se abre la aplicacion. Con el
 * codigo, el servidor emite SU propia sesion en una cookie y esa dura.
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const crypto = require('crypto');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

/** Sin las tres, el boton no se ofrece y el resto del servidor funciona igual. */
const GOOGLE_ACTIVO = Boolean(CLIENT_ID && CLIENT_SECRET && SESSION_SECRET);

const COOKIE_SESION = 'juntos_sesion';
const COOKIE_ESTADO = 'juntos_oauth';
const DIAS_SESION = 30;

const AUTORIZAR = 'https://accounts.google.com/o/oauth2/v2/auth';
const CANJEAR = 'https://oauth2.googleapis.com/token';
const EMISOR_GOOGLE = 'https://accounts.google.com';

const clavesGoogle = jwksClient({
  jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

// ─── Cookies ────────────────────────────────────────────────────────
// A mano y no con una dependencia: son dos cookies y el parseo cabe en cuatro
// lineas. Anadir un paquete para esto es superficie que hay que mantener.

function leerCookies(req) {
  const crudo = req.headers.cookie || '';
  const salida = {};
  for (const parte of crudo.split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    salida[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return salida;
}

/**
 * Secure solo fuera de localhost: el navegador descarta una cookie Secure sobre
 * http, y en desarrollo eso deja la sesion sin efecto y sin decir por que.
 */
function ponerCookie(res, nombre, valor, segundos, seguro) {
  const trozos = [
    `${nombre}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${segundos}`,
  ];
  if (seguro) trozos.push('Secure');
  res.append('Set-Cookie', trozos.join('; '));
}

function borrarCookie(res, nombre, seguro) {
  ponerCookie(res, nombre, '', 0, seguro);
}

function esSeguro(req) {
  // Detras de App Service la conexion llega por http con esta cabecera puesta.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return String(proto).includes('https');
}

// ─── Sesion propia ──────────────────────────────────────────────────

function firmarSesion(perfil) {
  return jwt.sign(
    { sub: perfil.sub, email: perfil.email, name: perfil.name || '' },
    SESSION_SECRET,
    { expiresIn: `${DIAS_SESION}d`, issuer: 'juntos+1' }
  );
}

/** El perfil de la cookie de sesion, o null si no hay o no vale. */
function sesionDe(req) {
  if (!SESSION_SECRET) return null;
  const token = leerCookies(req)[COOKIE_SESION];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET, { issuer: 'juntos+1' });
  } catch {
    return null;
  }
}

// ─── Verificacion del id_token de Google ────────────────────────────

function verificarIdToken(idToken) {
  return new Promise(resolve => {
    jwt.verify(
      idToken,
      (header, cb) => {
        clavesGoogle.getSigningKey(header.kid, (err, key) => {
          if (err) return cb(err);
          cb(null, key.getPublicKey());
        });
      },
      { audience: CLIENT_ID, issuer: [EMISOR_GOOGLE, 'accounts.google.com'], algorithms: ['RS256'] },
      (err, decoded) => resolve(err ? { error: err } : { decoded })
    );
  });
}

// ─── Rutas ──────────────────────────────────────────────────────────

/** La URL de vuelta tiene que coincidir EXACTAMENTE con la de Google Cloud. */
function urlDeVuelta(req) {
  const proto = esSeguro(req) ? 'https' : 'http';
  return `${proto}://${req.headers.host}/auth/google/callback`;
}

function montarRutas(app) {
  if (!GOOGLE_ACTIVO) {
    console.log('[google] sin GOOGLE_CLIENT_ID/SECRET o SESSION_SECRET: entrada por Google desactivada.');
    return;
  }
  console.log('[google] entrada por Google activa.');

  app.get('/auth/google', (req, res) => {
    // El estado ata esta vuelta a esta ida. Sin el, cualquiera podria empujar
    // al navegador un callback ajeno y estrenar sesion con una cuenta que el
    // usuario no eligio.
    const estado = crypto.randomBytes(16).toString('hex');
    ponerCookie(res, COOKIE_ESTADO, estado, 600, esSeguro(req));

    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: urlDeVuelta(req),
      response_type: 'code',
      scope: 'openid email profile',
      state: estado,
      // Para que salga el selector aunque ya haya sesion de Google en el
      // navegador: esta aplicacion la comparten dos personas en un mismo movil.
      prompt: 'select_account',
    });
    res.redirect(`${AUTORIZAR}?${params}`);
  });

  app.get('/auth/google/callback', async (req, res) => {
    const seguro = esSeguro(req);
    const esperado = leerCookies(req)[COOKIE_ESTADO];
    borrarCookie(res, COOKIE_ESTADO, seguro);

    if (req.query.error) {
      console.warn('[google] el usuario cancelo o Google rechazo:', req.query.error);
      return res.redirect('/?entrada=cancelada');
    }
    if (!req.query.code || !esperado || req.query.state !== esperado) {
      console.warn('[google] vuelta sin codigo o con estado que no cuadra');
      return res.redirect('/?entrada=fallida');
    }

    try {
      const r = await fetch(CANJEAR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: urlDeVuelta(req),
          grant_type: 'authorization_code',
        }),
      });
      const datos = await r.json();
      if (!r.ok || !datos.id_token) {
        console.error('[google] canje fallido:', datos.error_description || datos.error || r.status);
        return res.redirect('/?entrada=fallida');
      }

      // Se verifica la firma aunque el token venga del propio Google por TLS:
      // es lo que convierte «me lo dio una fuente de confianza» en «lo he
      // comprobado», y cuesta una llamada cacheada.
      const { decoded, error } = await verificarIdToken(datos.id_token);
      if (error) {
        console.error('[google] id_token invalido:', error.message);
        return res.redirect('/?entrada=fallida');
      }
      if (decoded.email && decoded.email_verified === false) {
        console.warn('[google] correo sin verificar:', decoded.email);
        return res.redirect('/?entrada=sin_verificar');
      }

      ponerCookie(res, COOKIE_SESION, firmarSesion(decoded), DIAS_SESION * 86400, seguro);
      console.log(`[google] entra ${decoded.email || decoded.sub}`);
      res.redirect('/');
    } catch (err) {
      console.error('[google] error en la vuelta:', err.message);
      res.redirect('/?entrada=fallida');
    }
  });

  app.post('/auth/logout', (req, res) => {
    borrarCookie(res, COOKIE_SESION, esSeguro(req));
    res.json({ ok: true });
  });
}

module.exports = {
  GOOGLE_ACTIVO, montarRutas, sesionDe, firmarSesion,
  leerCookies, verificarIdToken, COOKIE_SESION,
};
