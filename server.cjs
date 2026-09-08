const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const webpush = require('web-push');
require('dotenv').config();
const { montarRutas: montarRutasGoogle, sesionDe, GOOGLE_ACTIVO } = require('./googleAuth.cjs');

const app = express();
app.use(compression());
const PORT = process.env.PORT || 3007;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const HOGARES_FILE = path.join(DATA_DIR, 'hogares.json');
const HOGARES_DIR = path.join(DATA_DIR, 'hogares');

// ─── Hogares ────────────────────────────────────────────────────────
//
// Un hogar es dueño de un data.json. Tiene uno o dos miembros, que ven
// exactamente lo mismo: es lo que hace que la aplicacion sea «Juntos» y no dos
// cuentas separadas. Aislar por usuario habria partido a la pareja.
//
// Al hogar migrado --el que ya tiene los datos-- solo entra quien esta NOMBRADO
// en MIEMBROS_PRINCIPAL. Cualquier otro estrena el suyo, vacio.
//
// Antes esto miraba el emisor del token: quien viniera del directorio de
// trabajo entraba, porque «ese directorio ES la pareja». Era falso. El
// directorio de trabajo tiene cientos de cuentas, y lo unico que impedia que
// entraran era que la aplicacion exige asignacion explicita. En cuanto se abre
// el registro hay que relajar esa asignacion, y la regla del emisor habria
// entregado las finanzas de la pareja a cada cuenta nueva.
//
// Por eso ahora es una lista de nombres propios y falla cerrada: sin lista,
// nadie hereda los datos de nadie.

/** Identidad estable del usuario dentro de su directorio. */
function claveDeUsuario(u) {
  return String((u && (u.oid || u.sub)) || '').trim();
}

/**
 * Quienes son duenos del hogar migrado. Acepta identificadores de objeto o
 * correos: el oid es estable y el correo es lo que un humano encuentra.
 */
const MIEMBROS_PRINCIPAL = (process.env.MIEMBROS_PRINCIPAL || '')
  .split(',')
  .map(v => v.trim().toLowerCase())
  .filter(Boolean);

function esMiembroPrincipal(u) {
  if (MIEMBROS_PRINCIPAL.length === 0) return false;
  const clave = claveDeUsuario(u).toLowerCase();
  const correo = correoDelToken(u);
  return (Boolean(clave) && MIEMBROS_PRINCIPAL.includes(clave)) ||
         (Boolean(correo) && MIEMBROS_PRINCIPAL.includes(correo));
}

async function leerHogares() {
  try {
    return JSON.parse(await fs.readFile(HOGARES_FILE, 'utf8'));
  } catch {
    return { usuarios: {}, hogares: {} };
  }
}

async function guardarHogares(mapa) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(HOGARES_FILE, JSON.stringify(mapa, null, 2));
}

function archivoDeHogar(id) {
  return path.join(HOGARES_DIR, id, 'data.json');
}

/**
 * Mueve el data.json unico al primer hogar. Se ejecuta una vez y solo si aun
 * no hay hogares: si algo falla a mitad, el original sigue donde estaba.
 *
 * El archivo viejo NO se borra. Es el respaldo de una migracion sobre datos
 * financieros reales, y ocupa lo que ocupa.
 */
async function migrarAHogares() {
  const mapa = await leerHogares();
  if (Object.keys(mapa.hogares).length > 0) return mapa;

  let original = null;
  try {
    original = await fs.readFile(DATA_FILE, 'utf8');
    JSON.parse(original); // no migrar un archivo corrupto
  } catch {
    return mapa; // instalacion nueva: no hay nada que migrar
  }

  const id = 'principal';
  await fs.mkdir(path.join(HOGARES_DIR, id), { recursive: true });
  await fs.writeFile(archivoDeHogar(id), original);

  // Releer y contar antes de dar la migracion por buena. Un disco lleno o un
  // corte a mitad de escritura dejan un archivo truncado que parece existir;
  // sobre datos financieros eso no se asume, se comprueba. Si no cuadra, se
  // retira la copia y el original sigue siendo el bueno.
  try {
    const copia = JSON.parse(await fs.readFile(archivoDeHogar(id), 'utf8'));
    const antes = (JSON.parse(original).transactions || []).length;
    const despues = (copia.transactions || []).length;
    if (antes !== despues) throw new Error(`${antes} transacciones antes, ${despues} despues`);
    console.log(`[hogares] copia verificada: ${despues} transacciones`);
  } catch (err) {
    await fs.rm(path.join(HOGARES_DIR, id), { recursive: true, force: true }).catch(() => {});
    console.error('[hogares] migracion abortada, el original queda intacto:', err.message);
    return mapa;
  }

  mapa.hogares[id] = {
    nombre: 'Nuestro hogar',
    creado: new Date().toISOString(),
    origen: 'migracion',
  };
  await guardarHogares(mapa);
  console.log(`[hogares] migrado data.json -> ${archivoDeHogar(id)} (el original se conserva)`);
  if (MIEMBROS_PRINCIPAL.length === 0) {
    // Sin lista nadie puede reclamar estos datos. Es lo correcto --antes que
    // dejar que los reclame quien llegue-- pero deja a la pareja fuera de lo
    // suyo, asi que tiene que verse en el arranque.
    console.warn(
      '[hogares] MIEMBROS_PRINCIPAL vacio: nadie heredara los datos migrados. ' +
      'Pon ahi los correos o los oid de las dos cuentas de la pareja.'
    );
  }
  return mapa;
}

/** El hogar del solicitante, o null si todavia no tiene. */
async function hogarDe(req) {
  const clave = claveDeUsuario(req.user);
  if (!clave) return null;

  const mapa = await leerHogares();
  // Cada visita deja anotado el correo de quien viene. Es lo que despues
  // permite que su pareja lo llame por su direccion en vez de por un oid.
  let cambio = anotarCorreo(mapa, clave, correoDelToken(req.user));

  let id = null;
  if (mapa.usuarios[clave] && mapa.hogares[mapa.usuarios[clave]]) {
    id = mapa.usuarios[clave];
  } else if (esMiembroPrincipal(req.user)) {
    const principal = Object.keys(mapa.hogares).find(h => mapa.hogares[h].origen === 'migracion');
    if (principal) {
      mapa.usuarios[clave] = principal;
      cambio = true;
      id = principal;
      console.log(`[hogares] ${correoDelToken(req.user) || clave} entra a ${principal} por estar nombrado`);
    }
  }

  if (cambio) await guardarHogares(mapa);
  return id;
}

/** Crea un hogar vacio y mete dentro a quien lo pide. */
async function crearHogar(req, nombre) {
  const clave = claveDeUsuario(req.user);
  if (!clave) return null;
  const mapa = await leerHogares();
  const id = 'h_' + Math.random().toString(36).slice(2, 10);
  await fs.mkdir(path.join(HOGARES_DIR, id), { recursive: true });
  await fs.writeFile(archivoDeHogar(id), JSON.stringify(EMPTY_DATA, null, 2));
  mapa.hogares[id] = {
    nombre: (nombre || '').trim() || 'Mi hogar',
    creado: new Date().toISOString(),
    origen: 'alta',
  };
  mapa.usuarios[clave] = id;
  anotarCorreo(mapa, clave, correoDelToken(req.user));
  await guardarHogares(mapa);
  return id;
}

// ─── Llamar a alguien a tu hogar ────────────────────────────────────
//
// Quien llega nuevo estrena un hogar vacio y empieza a apuntar lo suyo. Cuando
// quiere compartirlo, llama a la otra persona POR CORREO, y solo se puede
// llamar a quien ya entro alguna vez: el token trae un identificador opaco,
// nadie invita a su pareja escribiendo un oid. De ahi el indice de correos.
//
// Y por eso la otra persona tiene que estar antes: al aceptar, lo que ya haya
// apuntado por su cuenta se consolida en el hogar que la invita.

const MIEMBROS_MAX = 2;

function normalizarCorreo(c) {
  return String(c || '').trim().toLowerCase();
}

/**
 * Apunta que este correo es de esta identidad. Devuelve si hubo cambio, para
 * no reescribir el mapa en cada peticion.
 *
 * Si la misma direccion entra por las dos puertas, gana la ultima: son dos
 * identidades distintas para el directorio, y la invitacion tiene que ir a la
 * que esta usando la aplicacion ahora.
 */
function anotarCorreo(mapa, clave, correo) {
  if (!correo) return false;
  mapa.correos = mapa.correos || {};
  if (mapa.correos[correo] === clave) return false;
  mapa.correos[correo] = clave;
  return true;
}

function miembrosDe(mapa, hogarId) {
  return Object.keys(mapa.usuarios).filter(k => mapa.usuarios[k] === hogarId);
}

function correoDe(mapa, clave) {
  const correos = mapa.correos || {};
  return Object.keys(correos).find(c => correos[c] === clave) || null;
}

/** Guarda la llamada. Los errores son codigos: el cliente explica cada uno. */
async function invitar(req, correoCrudo) {
  const clave = claveDeUsuario(req.user);
  const correo = normalizarCorreo(correoCrudo);
  if (!clave) return { error: 'sin_identidad' };
  if (!correo || !correo.includes('@')) return { error: 'correo_invalido' };
  if (normalizarCorreo(correoDelToken(req.user)) === correo) return { error: 'eres_tu' };

  const mapa = await leerHogares();
  const hogarId = mapa.usuarios[clave];
  if (!hogarId || !mapa.hogares[hogarId]) return { error: 'sin_hogar' };

  const miembros = miembrosDe(mapa, hogarId);
  const claveInvitada = (mapa.correos || {})[correo];
  // Solo se llama a quien ya tiene cuenta. Guardar la invitacion a ciegas
  // dejaria a quien invita esperando a alguien que quiza nunca se registre y
  // sin forma de saberlo; asi el aviso es inmediato y dice que hacer.
  if (!claveInvitada) return { error: 'sin_cuenta' };
  // «Ya esta dentro» va antes que «esta lleno»: un hogar de dos siempre esta
  // lleno, y contestar eso a quien reinvita a su pareja despista en vez de
  // explicar.
  if (miembros.includes(claveInvitada)) return { error: 'ya_es_miembro' };
  if (miembros.length >= MIEMBROS_MAX) return { error: 'hogar_lleno' };

  const hogar = mapa.hogares[hogarId];
  hogar.invitaciones = (hogar.invitaciones || []).filter(i => i.correo !== correo);
  hogar.invitaciones.push({ correo, invitadoPor: clave, creada: new Date().toISOString() });
  await guardarHogares(mapa);
  console.log(`[hogares] ${hogarId} llama a ${correo}`);
  return { hogarId, correo };
}

/** Las invitaciones dirigidas a quien pregunta. */
async function invitacionesPara(req, mapaDado) {
  const correo = normalizarCorreo(correoDelToken(req.user));
  if (!correo) return [];
  const mapa = mapaDado || await leerHogares();
  return Object.keys(mapa.hogares)
    .map(id => {
      const inv = (mapa.hogares[id].invitaciones || []).find(i => i.correo === correo);
      return inv ? { hogarId: id, nombre: mapa.hogares[id].nombre, de: correoDe(mapa, inv.invitadoPor), creada: inv.creada } : null;
    })
    .filter(Boolean);
}

// Lo que se une al fusionar. 'users' queda fuera a proposito: es la lista de
// cuentas locales heredada, con sus contraseñas, y mezclarla cruzaria
// credenciales de dos personas que solo querian juntar sus gastos.
const LISTAS_FUSIONABLES = [
  'transactions', 'accounts', 'budgets', 'goals',
  'investments', 'recurring', 'autosave', 'dismissedSubscriptions',
];

/** El id de un elemento; dismissedSubscriptions son ids sueltos, no objetos. */
function idDe(x) {
  return x && typeof x === 'object' ? x.id : x;
}

function unir(a, b) {
  const salida = a.slice();
  const vistos = new Set(a.map(idDe).filter(v => v !== undefined));
  for (const item of b) {
    const id = idDe(item);
    // Sin id no hay forma de saber si ya estaba, asi que entra igual: un
    // movimiento repetido se ve y se borra, uno perdido no se nota.
    if (id === undefined || !vistos.has(id)) {
      salida.push(item);
      if (id !== undefined) vistos.add(id);
    }
  }
  return salida;
}

/** Une lo del invitado dentro de lo del anfitrion. En choque de id, manda el anfitrion. */
function fusionarDatos(anfitrion, invitado) {
  const salida = { ...anfitrion };
  for (const lista of LISTAS_FUSIONABLES) {
    salida[lista] = unir(
      Array.isArray(anfitrion[lista]) ? anfitrion[lista] : [],
      Array.isArray(invitado[lista]) ? invitado[lista] : []
    );
  }
  return salida;
}

/**
 * Vuelca los datos del hogar de origen en el de destino.
 *
 * El archivo de origen no se toca: queda como estaba, y es el respaldo de quien
 * se muda. Antes de escribir el del anfitrion se guarda una copia fechada, y
 * despues se relee para comprobar que esta TODO lo de los dos. Si falta algo,
 * se restaura y la fusion no ocurre: es dinero de dos personas y no hay deshacer.
 */
async function consolidar(origenId, destinoId) {
  const archivoDestino = archivoDeHogar(destinoId);

  let origen;
  try {
    origen = JSON.parse(await fs.readFile(archivoDeHogar(origenId), 'utf8'));
  } catch {
    return { fusionadas: 0 }; // nunca guardo nada: no hay que consolidar nada
  }

  let destino;
  try {
    destino = JSON.parse(await fs.readFile(archivoDestino, 'utf8'));
  } catch {
    return { error: 'destino_ilegible' };
  }

  const unido = fusionarDatos(destino, origen);
  const respaldo = path.join(HOGARES_DIR, destinoId, `antes-de-fusionar-${Date.now()}.json`);
  await fs.writeFile(respaldo, JSON.stringify(destino, null, 2));
  await fs.writeFile(archivoDestino, JSON.stringify(unido, null, 2));

  try {
    const escrito = JSON.parse(await fs.readFile(archivoDestino, 'utf8'));
    for (const lista of LISTAS_FUSIONABLES) {
      const esperados = new Set(
        [...(destino[lista] || []), ...(origen[lista] || [])].map(idDe).filter(v => v !== undefined)
      );
      const presentes = new Set((escrito[lista] || []).map(idDe));
      for (const id of esperados) {
        if (!presentes.has(id)) throw new Error(`falta ${id} en ${lista}`);
      }
    }
    const fusionadas = (origen.transactions || []).length;
    console.log(`[hogares] fusion verificada: ${destinoId} recibe ${fusionadas} transacciones de ${origenId}`);
    return { fusionadas };
  } catch (err) {
    await fs.writeFile(archivoDestino, JSON.stringify(destino, null, 2));
    console.error('[hogares] fusion abortada, el hogar anfitrion queda como estaba:', err.message);
    return { error: 'fusion_fallida' };
  }
}

/** Aceptar es mudarse: cambia de hogar y se lleva lo suyo. */
async function aceptarInvitacion(req, destinoId) {
  const clave = claveDeUsuario(req.user);
  const correo = normalizarCorreo(correoDelToken(req.user));
  if (!clave || !correo) return { error: 'sin_identidad' };

  const mapa = await leerHogares();
  const destino = mapa.hogares[destinoId];
  if (!destino) return { error: 'no_existe' };
  if (!(destino.invitaciones || []).some(i => i.correo === correo)) return { error: 'no_invitado' };

  const propioId = mapa.usuarios[clave];
  if (propioId === destinoId) return { error: 'ya_es_miembro' };
  if (miembrosDe(mapa, destinoId).length >= MIEMBROS_MAX) return { error: 'hogar_lleno' };

  let fusionadas = 0;
  if (propioId && mapa.hogares[propioId]) {
    const r = await consolidar(propioId, destinoId);
    if (r.error) return r;
    fusionadas = r.fusionadas;
    // El hogar de origen no se borra ni se reutiliza: queda marcado y con sus
    // datos, que es lo unico que permite volver atras si algo salio mal.
    mapa.hogares[propioId].absorbidoPor = destinoId;
    mapa.hogares[propioId].fusionado = new Date().toISOString();
  }

  mapa.usuarios[clave] = destinoId;
  destino.invitaciones = (destino.invitaciones || []).filter(i => i.correo !== correo);
  await guardarHogares(mapa);
  console.log(`[hogares] ${correo} se muda a ${destinoId} (${fusionadas} transacciones)`);
  return { hogarId: destinoId, fusionadas };
}

async function rechazarInvitacion(req, destinoId) {
  const correo = normalizarCorreo(correoDelToken(req.user));
  if (!correo) return { error: 'sin_identidad' };
  const mapa = await leerHogares();
  const destino = mapa.hogares[destinoId];
  if (!destino) return { error: 'no_existe' };
  destino.invitaciones = (destino.invitaciones || []).filter(i => i.correo !== correo);
  await guardarHogares(mapa);
  return { hogarId: destinoId };
}

/**
 * Resuelve el hogar y deja su archivo en req. Un 409 y no un 404: la peticion
 * es correcta, lo que falta es un paso previo del usuario, y el cliente
 * distingue por el codigo para enseñar el alta en vez de un error.
 */
async function conHogar(req, res) {
  const id = await hogarDe(req);
  if (!id) {
    res.status(409).json({ error: 'Todavia no tienes un hogar', codigo: 'sin_hogar' });
    return null;
  }
  req.hogarId = id;
  req.archivo = archivoDeHogar(id);
  return id;
}
const META_FILE = path.join(DATA_DIR, 'data.meta.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_RETENTION_DAYS = 30;
const PUSH_FILE = path.join(DATA_DIR, 'push-subscriptions.json');
const FX_CACHE_FILE = path.join(DATA_DIR, 'fx-cache.json');
const DIST_DIR = path.join(__dirname, 'dist');
const startedAt = new Date();

// Sello del build, escrito por Vite en dist/build-info.json. Se lee una vez,
// con require sincrono, porque no cambia mientras el proceso vive. Si falta
// --un arranque sin haber compilado-- el health check tiene que seguir
// respondiendo: el sello es informativo, no un requisito.
const BUILD = (() => {
  try {
    return require(path.join(DIST_DIR, 'build-info.json'));
  } catch {
    return { sha: 'desconocido', builtAt: null };
  }
})();

// Entra ID. Sin valores por defecto a proposito: el tenant y la aplicacion
// son de quien despliega, y un fallback embebido solo sirve para que alguien
// arranque apuntando sin querer al directorio de otro.
const TENANT_ID = process.env.AZURE_TENANT_ID;
const CLIENT_ID = process.env.AZURE_CLIENT_ID;
if (!TENANT_ID || !CLIENT_ID) {
  const aviso =
    '[auth] Faltan AZURE_TENANT_ID y/o AZURE_CLIENT_ID. ' +
    'Copia .env.example a .env y completalos antes de arrancar.';
  // Solo se corta si esto es el proceso principal. Los tests importan el
  // modulo para usar los helpers puros del resumen diario, y ahi un exit(1)
  // tumba la suite entera por una configuracion que esos helpers no usan.
  if (require.main === module) {
    console.error(aviso);
    process.exit(1);
  }
  console.warn(aviso);
}
/**
 * Quien puede entrar, por correo, separado por comas. OPCIONAL.
 *
 * Quien se registra con Google entra como INVITADO de este mismo directorio, no
 * por una segunda puerta: su token trae el mismo emisor y la misma audiencia que
 * el de cualquiera de la casa. Por eso ya no hay una lista «para los de fuera»:
 * a efectos del token no hay fuera.
 *
 * Lo que separa a unos de otros son los hogares, y eso no se negocia por
 * configuracion. Esta lista es un freno de mano: si esta puesta, solo entran
 * esos correos; si esta vacia, entra quien el directorio deje entrar.
 */
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '')
  .split(',')
  .map(c => c.trim().toLowerCase())
  .filter(Boolean);

console.log(
  ALLOWED_USERS.length === 0
    ? '[auth] sin lista: entra quien el directorio autorice, y estrena hogar vacio.'
    : `[auth] lista activa: solo ${ALLOWED_USERS.length} correo(s) de ALLOWED_USERS.`
);

// Un unico emisor: el directorio de trabajo. Los invitados con Google son
// cuentas de ESTE directorio, asi que su token sale de aqui igual que el resto.
const EMISORES = [
  {
    nombre: 'trabajo',
    issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    audiencia: CLIENT_ID,
    jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
  },
];

for (const e of EMISORES) {
  e.claves = jwksClient({
    jwksUri: e.jwksUri,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 10,
  });
}

/** El correo del token, mires donde mires: cada proveedor lo pone en un sitio. */
function correoDelToken(t) {
  return String(t.preferred_username || t.email || t.upn || '').trim().toLowerCase();
}

function permitido(decoded) {
  if (ALLOWED_USERS.length === 0) return true;
  const correo = correoDelToken(decoded);
  return Boolean(correo) && ALLOWED_USERS.includes(correo);
}

/** Verifica contra UN emisor. Resuelve con el token o con un error. */
function verificarCon(emisor, token) {
  return new Promise(resolve => {
    jwt.verify(
      token,
      (header, cb) => emisor.claves.getSigningKey(header.kid, (err, key) => {
        if (err) return cb(err);
        cb(null, key.getPublicKey());
      }),
      { audience: emisor.audiencia, issuer: emisor.issuer, algorithms: ['RS256'] },
      (err, decoded) => resolve(err ? { error: err } : { decoded }),
    );
  });
}

// JWT auth middleware for API routes
const authMiddleware = async (req, res, next) => {
  // Dos formas de identificarse, y las dos valen igual a partir de aqui:
  // el token de Entra que trae la pareja, o la cookie de sesion que emitimos
  // nosotros cuando alguien entra por Google. El resto del servidor no
  // distingue: solo mira req.user, y ahi hay un sub y un correo en ambos casos.
  const sesion = sesionDe(req);
  if (sesion) {
    req.user = sesion;
    req.emisor = 'google';
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  // El emisor del propio token dice a quien preguntar: probar todos a ciegas
  // gasta una llamada de claves por proveedor y ensucia los logs con errores
  // que no son fallos.
  let emisorDelToken = null;
  try {
    const cuerpo = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    emisorDelToken = cuerpo && cuerpo.iss;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const candidatos = EMISORES.filter(e => e.issuer === emisorDelToken);
  if (candidatos.length === 0) {
    console.error('[auth] emisor no reconocido:', emisorDelToken);
    return res.status(401).json({ error: 'Invalid token' });
  }

  for (const emisor of candidatos) {
    const r = await verificarCon(emisor, token);
    if (r.error) {
      console.error(`[auth] token invalido (${emisor.nombre}):`, r.error.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (!permitido(r.decoded)) {
      // 403 y no 401: el token es bueno, quien lo trae no esta invitado. Un
      // 401 haria que el cliente reintentara el login en bucle.
      console.warn(`[auth] fuera de la lista: ${correoDelToken(r.decoded) || '(sin correo)'}`);
      return res.status(403).json({ error: 'Tu cuenta no tiene acceso a estos datos' });
    }
    req.user = r.decoded;
    req.emisor = emisor.nombre;
    return next();
  }
};

// CORS. Los origenes de desarrollo van fijos; los de produccion llegan por
// entorno --ALLOWED_ORIGINS, separados por comas-- porque el dominio depende
// de donde se despliegue.
const ALLOWED_ORIGINS = [
  'http://localhost:3007',
  'http://localhost:3008',
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean),
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '50mb' }));

// Logging middleware para debug
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} from ${req.ip}`);
  next();
});

// Health check — no auth, used by uptime monitors. Reports whether the
// persistent data file is actually reachable, not just that Node is alive.
app.get('/healthz', async (req, res) => {
  let dataFileExists = false;
  try {
    await fs.access(DATA_FILE);
    dataFileExists = true;
  } catch {
    // ENOENT is fine on fresh install; still report it so an alert can
    // distinguish "never wrote yet" from "volume disappeared".
  }
  res.json({
    status: 'ok',
    dataDir: DATA_DIR,
    dataFileExists,
    uptimeSeconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
    timestamp: new Date().toISOString(),
    build: BUILD.sha,
    builtAt: BUILD.builtAt,
    // Para poder comprobar desde fuera si la entrada por Google quedo
    // configurada, sin tener que leer variables de entorno del servidor.
    google: GOOGLE_ACTIVO,
  });
});

// Entrar con Google va ANTES del middleware y fuera de /api: son las rutas por
// las que se llega sin tener todavia con que identificarse.
montarRutasGoogle(app);

// Auth middleware on ALL API operations (including GET)
app.use('/api', authMiddleware);


// ─── Version tracking (multi-device sync + optimistic concurrency) ───
// Kept in a separate meta file so it never has to be merged into the
// AppData blob the client reads, and a version bump can never corrupt data.
// La version es por hogar: es el numero que usan los dispositivos para saber
// si tienen datos frescos, y compartirlo entre hogares haria que el cambio de
// uno invalidara la cache del otro.
function archivoMeta(hogarId) {
  return hogarId ? path.join(HOGARES_DIR, hogarId, 'data.meta.json') : META_FILE;
}

async function readMeta(hogarId) {
  try {
    return JSON.parse(await fs.readFile(archivoMeta(hogarId), 'utf8'));
  } catch {
    return { version: 0, updatedAt: new Date(0).toISOString() };
  }
}

async function bumpVersion(hogarId) {
  const meta = await readMeta(hogarId);
  const next = { version: (meta.version || 0) + 1, updatedAt: new Date().toISOString() };
  try {
    await fs.writeFile(archivoMeta(hogarId), JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn('[meta] version bump write failed:', err.code || err.message);
  }
  return next;
}

// ─── Daily backups with rotation ───
// Runs before every write. Copies the CURRENT (pre-write) data.json into
// backups/ once per calendar day, so a bad write or an accidental empty
// overwrite can always be recovered from the prior day's snapshot.
async function dailyBackup(hogarId) {
  const archivo = hogarId ? archivoDeHogar(hogarId) : DATA_FILE;
  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    // El hogar entra en el nombre: con un solo archivo por dia, el segundo
    // hogar que escribiera se llevaria por delante el respaldo del primero.
    const sufijo = hogarId ? `_${hogarId}` : '';
    const backupFile = path.join(BACKUPS_DIR, `data${sufijo}_${today}.json`);
    try {
      await fs.access(backupFile);
      return; // already backed up today
    } catch {
      // no backup yet today — proceed
    }
    const current = await fs.readFile(archivo, 'utf8');
    JSON.parse(current); // don't propagate a backup of corrupt JSON
    await fs.writeFile(backupFile, current);
    await rotateBackups();
  } catch (err) {
    // Missing DATA_FILE on first run, or unreadable — not fatal, the write
    // that follows will create it.
    if (err.code !== 'ENOENT') {
      console.warn('[backup] daily backup failed:', err.code || err.message);
    }
  }
}

async function rotateBackups() {
  try {
    const files = await fs.readdir(BACKUPS_DIR);
    const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const match = file.match(/^data(?:_.+?)?_(\d{4}-\d{2}-\d{2})\.json$/);
      if (!match) continue;
      const fileDate = new Date(match[1]).getTime();
      if (fileDate < cutoff) {
        await fs.unlink(path.join(BACKUPS_DIR, file)).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[backup] rotation failed:', err.code || err.message);
  }
}

// ─── Strip legacy plaintext passwords ───
// `password` on User predates Entra ID login and is never read by the
// client anymore — scrub it on the way out and on the way in so it can't
// leak via GET /api/data or accumulate in backups.
function stripPassword(user) {
  if (!user || typeof user !== 'object') return user;
  const { password, ...rest } = user;
  return rest;
}

function scrubUserPasswords(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.user) data.user = stripPassword(data.user);
  if (Array.isArray(data.users)) data.users = data.users.map(stripPassword);
  return data;
}

// Read all data
// Shape used as the empty default. Matches the client AppData interface.
const EMPTY_DATA = {
  transactions: [],
  accounts: [],
  budgets: [],
  currency: 'PEN',
  user: null,
  users: [],
  goals: [],
  investments: [],
  recurring: [],
  autosave: [],
  // Ids de lo que el usuario marco como "no es suscripcion".
  dismissedSubscriptions: [],
};

// Alta de hogar. Quien llega sin uno --siempre alguien del tenant externo--
// estrena el suyo, vacio. Nunca se une a uno existente por su cuenta: eso
// tiene que venir de una invitacion.
app.post('/api/hogar', async (req, res) => {
  try {
    const yaTiene = await hogarDe(req);
    if (yaTiene) return res.json({ hogarId: yaTiene, creado: false });
    const id = await crearHogar(req, req.body && req.body.nombre);
    if (!id) return res.status(400).json({ error: 'Token sin identidad utilizable' });
    console.log(`[hogares] ${correoDelToken(req.user) || id} estrena hogar ${id}`);
    res.json({ hogarId: id, creado: true });
  } catch (err) {
    console.error('[hogares] alta fallida:', err.message);
    res.status(500).json({ error: 'No se pudo crear el hogar' });
  }
});

// Que hogar tengo, si tengo, y quien me esta llamando al suyo. El cliente lo
// usa para decidir entre entrar, mostrar el alta o mostrar la invitacion, sin
// provocar un 409 a proposito.
app.get('/api/hogar', async (req, res) => {
  try {
    const id = await hogarDe(req);
    const mapa = await leerHogares();
    const hogar = id ? mapa.hogares[id] : null;
    res.json({
      hogarId: id,
      correo: correoDelToken(req.user) || null,
      nombre: hogar ? hogar.nombre : null,
      // Los correos de quienes lo comparten, para que la pantalla de Pareja
      // diga quien esta dentro en vez de pedir que lo escriban a mano.
      miembros: id ? miembrosDe(mapa, id).map(k => correoDe(mapa, k)).filter(Boolean) : [],
      enviadas: hogar ? (hogar.invitaciones || []).map(i => i.correo) : [],
      invitaciones: await invitacionesPara(req, mapa),
    });
  } catch (err) {
    console.error('[hogares] consulta fallida:', err.message);
    res.status(500).json({ error: 'No se pudo consultar el hogar' });
  }
});

// Cada codigo de error dice algo distinto al usuario, asi que se traducen aqui
// una sola vez y el cliente solo elige el texto.
const ESTADO_INVITACION = {
  correo_invalido: 400, eres_tu: 400, sin_identidad: 400,
  sin_hogar: 409, hogar_lleno: 409, ya_es_miembro: 409,
  sin_cuenta: 404, no_existe: 404, no_invitado: 403,
  destino_ilegible: 500, fusion_fallida: 500,
};

app.post('/api/hogar/invitacion', async (req, res) => {
  try {
    const r = await invitar(req, req.body && req.body.correo);
    if (r.error) return res.status(ESTADO_INVITACION[r.error] || 400).json({ codigo: r.error });
    res.json(r);
  } catch (err) {
    console.error('[hogares] invitacion fallida:', err.message);
    res.status(500).json({ error: 'No se pudo enviar la invitacion' });
  }
});

app.post('/api/hogar/invitacion/aceptar', async (req, res) => {
  try {
    const r = await aceptarInvitacion(req, req.body && req.body.hogarId);
    if (r.error) return res.status(ESTADO_INVITACION[r.error] || 400).json({ codigo: r.error });
    res.json(r);
  } catch (err) {
    console.error('[hogares] fusion fallida:', err.message);
    res.status(500).json({ error: 'No se pudo unir al hogar' });
  }
});

app.post('/api/hogar/invitacion/rechazar', async (req, res) => {
  try {
    const r = await rechazarInvitacion(req, req.body && req.body.hogarId);
    if (r.error) return res.status(ESTADO_INVITACION[r.error] || 400).json({ codigo: r.error });
    res.json(r);
  } catch (err) {
    console.error('[hogares] rechazo fallido:', err.message);
    res.status(500).json({ error: 'No se pudo rechazar la invitacion' });
  }
});

app.get('/api/data', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!(await conHogar(req, res))) return;
    const data = await fs.readFile(req.archivo, 'utf8');
    res.json(scrubUserPasswords(JSON.parse(data)));
  } catch (error) {
    // Fresh-install / persistent-volume-not-yet-populated → return empty
    // shell so the UI doesn't blow up with a 500. The next save creates
    // the file. Same for parse errors on a corrupt file: we surface the
    // shell rather than a hard error.
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      console.warn(`[api/data] ${error.code || 'parse_error'} on ${req.archivo}; returning empty shell`);
      // Best-effort: seed the file so future reads succeed.
      try {
        await fs.mkdir(path.dirname(req.archivo), { recursive: true });
        await fs.writeFile(req.archivo, JSON.stringify(EMPTY_DATA, null, 2), 'utf8');
      } catch (seedErr) {
        console.warn('[api/data] seed write failed:', seedErr.code || seedErr.message);
      }
      return res.json(EMPTY_DATA);
    }
    console.error('Error reading data:', error);
    res.status(500).json({ error: 'Error reading data', code: error.code });
  }
});

// Lightweight version check — polled by clients every few minutes so a
// second device can detect "someone else saved" without re-downloading
// the full data blob.
app.get('/api/data/version', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!(await conHogar(req, res))) return;
  res.json(await readMeta(req.hogarId));
});

// Download the current data file as an attachment — manual backup button
// in the UI, independent of the server's own daily rotation.
app.get('/api/backup', async (req, res) => {
  try {
    if (!(await conHogar(req, res))) return;
    const data = await fs.readFile(req.archivo, 'utf8');
    const scrubbed = scrubUserPasswords(JSON.parse(data));
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    res.setHeader('Content-Disposition', `attachment; filename="juntos-backup_${stamp}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(scrubbed, null, 2));
  } catch (error) {
    console.error('Error generating backup:', error);
    res.status(500).json({ error: 'Error generating backup' });
  }
});

// Update specific collection
app.post('/api/data/:collection', async (req, res) => {
  try {
    if (!(await conHogar(req, res))) return;
    const { collection } = req.params;
    let newData = req.body;

    // Si recibimos la bandera especial __null__, convertir a null
    if (newData && newData.__null__ === true) {
      newData = null;
    }
    if (collection === 'user') newData = stripPassword(newData);
    if (collection === 'users' && Array.isArray(newData)) newData = newData.map(stripPassword);

    await dailyBackup(req.hogarId);

    const data = await fs.readFile(req.archivo, 'utf8');
    const allData = JSON.parse(data);

    allData[collection] = newData;

    await fs.writeFile(req.archivo, JSON.stringify(allData, null, 2));
    const meta = await bumpVersion(req.hogarId);
    res.json({ success: true, data: allData[collection], version: meta.version });
  } catch (error) {
    console.error('Error updating data:', error);
    console.error('Collection:', req.params.collection);
    console.error('Body:', req.body);
    res.status(500).json({ error: 'Error updating data' });
  }
});

// ─── Smart category assignment based on merchant patterns ───
const CATEGORY_PATTERNS = [
  // Transporte
  { pattern: /uber|pyu\*uber|didi|beat|cabify|taxi|dlc\*rides|dlc\*uber|indriver/i, category: 'transport' },
  { pattern: /grifo|e\s+s\s+\w|gasolina|petromax|pecsa|primax|repsol|derby/i, category: 'transport' },
  // Alimentación
  { pattern: /makro|metro|plaza\s*vea|wong|tottus|vivanda|tambo|oxxo|mass/i, category: 'food' },
  { pattern: /rappi|pedidosya|ifood|glovo|delivery/i, category: 'food' },
  { pattern: /restaur|pollo|chifa|brasa|ceviche|kfc|mcdonalds|starbucks|bembos|pizza/i, category: 'food' },
  { pattern: /cencosud|supermercado|patio\s*cencosud/i, category: 'food' },
  // Entretenimiento / Suscripciones
  { pattern: /netflix|ebn\*netflix|spotify|youtube|disney|hbo|prime\s*video|steam|playstation|xbox/i, category: 'subscriptions' },
  { pattern: /openai|chatgpt|claude[\.\s]ai|claude\.ai\s*sub|github|notion|canva|zoom|adobe|restream/i, category: 'subscriptions' },
  { pattern: /apple\.com|apple\s*com|google\s*(play|youtube|one)|microsoft/i, category: 'subscriptions' },
  { pattern: /godaddy|dlc\*godaddy|namecheap|cloudflare|aws|azure|digital\s*ocean/i, category: 'subscriptions' },
  // Salud
  { pattern: /farmacia|inkafarma|mifarma|sanna|clinica|hospital|salud|botica/i, category: 'health' },
  // Hogar
  { pattern: /luz|enel|agua|sedapal|calidda|gas|limpieza|vigilant/i, category: 'home' },
  // Educación
  { pattern: /universidad|colegio|curso|udemy|coursera|platzi|gestion/i, category: 'education' },
  // Compras
  { pattern: /saga|ripley|falabella|oechsle|paris|zara|h&m|pago\s*con\s*qr/i, category: 'shopping' },
  // Facturas
  { pattern: /pago\s*(tc|tarjeta)/i, category: 'bills' },
  // Transferencias / Yapeos (keep at end - catch-all for transfers)
  { pattern: /yapeo\s*a\s*celular|yape|plin|transferencia/i, category: 'other-expense' },
];

function smartCategorize(description) {
  const desc = (description || '').toUpperCase();
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(desc)) return category;
  }
  return 'other-expense';
}

// ─── BCP Email Sync endpoint ───
app.post('/api/sync-bcp', async (req, res) => {
  try {
    if (!(await conHogar(req, res))) return;
    const { transactions: newTxs } = req.body;
    if (!Array.isArray(newTxs) || newTxs.length === 0) {
      return res.json({ success: true, imported: 0, message: 'No transactions to import' });
    }

    await dailyBackup(req.hogarId);

    const data = JSON.parse(await fs.readFile(req.archivo, 'utf8'));
    const existingKeys = new Set(
      data.transactions.map(t => `${t.date}|${t.amount}|${t.type}|${t.description}`)
    );

    let imported = 0;
    let skipped = 0;

    for (const tx of newTxs) {
      const key = `${tx.date}|${tx.amount}|${tx.type}|${tx.description}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }
      existingKeys.add(key);

      data.transactions.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        type: tx.type || 'expense',
        amount: tx.amount,
        category: tx.category || smartCategorize(tx.description),
        description: tx.description || '',
        date: tx.date,
        accountId: tx.accountId || 'default',
      });
      imported++;
    }

    // Update recurring nextDate if matching subscriptions found
    if (data.recurring) {
      const subPatterns = [
        { pattern: /netflix/i, recPattern: /netflix/i },
        { pattern: /apple/i, recPattern: /apple/i },
        { pattern: /openai|chatgpt/i, recPattern: /openai/i },
        { pattern: /claude/i, recPattern: /claude/i },
        { pattern: /youtube|premium.network/i, recPattern: /youtube/i },
        { pattern: /spotify|spootify/i, recPattern: /spootify|spotify/i },
        { pattern: /restream/i, recPattern: /restream/i },
      ];

      for (const sp of subPatterns) {
        const matchingTx = newTxs.filter(t => sp.pattern.test(t.description));
        if (matchingTx.length === 0) continue;
        const latestDate = matchingTx.map(t => t.date).sort().pop();
        const rec = data.recurring.find(r => r.isActive && sp.recPattern.test(r.description));
        if (rec) {
          const d = new Date(latestDate);
          d.setMonth(d.getMonth() + 1);
          if (d.toISOString() > rec.nextDate) {
            rec.nextDate = d.toISOString();
          }
        }
      }
    }

    await fs.writeFile(req.archivo, JSON.stringify(data, null, 2));
    const meta = await bumpVersion(req.hogarId);
    res.json({ success: true, imported, skipped, total: data.transactions.length, version: meta.version });
  } catch (error) {
    console.error('Error syncing BCP:', error);
    res.status(500).json({ error: 'Error syncing BCP data' });
  }
});

// Update all data at once
app.post('/api/data', async (req, res) => {
  try {
    if (!(await conHogar(req, res))) return;
    const newData = scrubUserPasswords(req.body);
    await dailyBackup(req.hogarId);
    await fs.writeFile(req.archivo, JSON.stringify(newData, null, 2));
    const meta = await bumpVersion(req.hogarId);
    res.json({ success: true, version: meta.version });
  } catch (error) {
    console.error('Error updating data:', error);
    res.status(500).json({ error: 'Error updating data' });
  }
});


// --- Notificaciones push -------------------------------------------------
//
// Las claves VAPID llegan por variables de entorno. Si faltan, los endpoints
// responden 503 en vez de reventar: un despliegue sin configurar no debe
// tumbar el resto del servidor.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
// El sujeto VAPID tiene que ser un contacto real de quien opera el servidor:
// es a donde escribe el servicio de push si hay un problema con los envios.
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || '';
const PUSH_ENABLED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (PUSH_ENABLED) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[push] VAPID configurado');
} else {
  console.warn('[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes - push deshabilitado');
}

// Lima es UTC-5 todo el anio (sin horario de verano) y las fechas de la app
// se anclan al mediodia UTC. Leer el dia calendario asi mantiene al servidor
// y al cliente de acuerdo sobre que dia es "hoy".
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000;
function limaDateStr(d) {
  const ref = d || new Date();
  return new Date(ref.getTime() - LIMA_OFFSET_MS).toISOString().slice(0, 10);
}
function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function readPushSubs() {
  try {
    return JSON.parse(await fs.readFile(PUSH_FILE, 'utf8'));
  } catch (e) {
    return { subscriptions: [] };
  }
}
async function writePushSubs(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PUSH_FILE, JSON.stringify(store, null, 2));
}
function userKey(req) {
  const u = req.user || {};
  return u.oid || u.sub || u.preferred_username || 'unknown';
}

app.get('/api/push/config', (req, res) => {
  res.json({ enabled: PUSH_ENABLED, publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', async (req, res) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push no configurado en el servidor' });
  const sub = req.body;
  if (!sub || !sub.endpoint || !sub.keys) {
    return res.status(400).json({ error: 'Suscripcion invalida' });
  }
  try {
    const store = await readPushSubs();
    const uid = userKey(req);
    const hogarId = await hogarDe(req);
    const rest = store.subscriptions.filter(function (x) { return x.endpoint !== sub.endpoint; });
    rest.push({
      userId: uid,
      hogarId: hogarId,
      endpoint: sub.endpoint,
      keys: sub.keys,
      createdAt: new Date().toISOString(),
      lastSentDate: null,
    });
    store.subscriptions = rest;
    await writePushSubs(store);
    res.json({ success: true });
  } catch (err) {
    console.error('[push] subscribe fallo:', err.message);
    res.status(500).json({ error: 'No se pudo guardar la suscripcion' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  try {
    const store = await readPushSubs();
    const ep = req.body && req.body.endpoint;
    store.subscriptions = store.subscriptions.filter(function (x) { return x.endpoint !== ep; });
    await writePushSubs(store);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo borrar la suscripcion' });
  }
});

// Envia a un endpoint y reporta si el navegador ya lo dio de baja, para
// poder purgarlo en vez de reintentar por siempre.
async function sendTo(sub, payload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload)
    );
    return 'sent';
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) return 'gone';
    console.warn('[push] envio fallido:', err.statusCode || err.message);
    return 'error';
  }
}

app.post('/api/push/test', async (req, res) => {
  if (!PUSH_ENABLED) return res.status(503).json({ error: 'Push no configurado en el servidor' });
  try {
    const store = await readPushSubs();
    const uid = userKey(req);
    const mine = store.subscriptions.filter(function (x) { return x.userId === uid; });
    if (mine.length === 0) return res.status(404).json({ error: 'No hay dispositivos suscritos' });

    let sent = 0;
    const survivors = [];
    for (const sub of store.subscriptions) {
      if (sub.userId !== uid) { survivors.push(sub); continue; }
      const r = await sendTo(sub, {
        title: 'Juntos+1',
        body: 'Las notificaciones estan funcionando.',
        tag: 'test',
        url: '/',
      });
      if (r === 'sent') sent++;
      if (r !== 'gone') survivors.push(sub);
    }
    store.subscriptions = survivors;
    await writePushSubs(store);
    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo enviar la prueba' });
  }
});

// --- Resumen diario ------------------------------------------------------
//
// Un aviso al dia con los cobros recurrentes que caen en los proximos 3 dias
// y las suscripciones que subieron de precio. Se manda una vez por dia y por
// dispositivo; lastSentDate evita repetirlo si el proceso reinicia.
function buildDigest(data) {
  const today = limaDateStr();
  const limit = addDaysStr(today, 3);
  const manana = addDaysStr(today, 1);
  const lines = [];
  let total = 0;

  const upcoming = (data.recurring || [])
    .filter(function (r) { return r.isActive; })
    .map(function (r) {
      return { r: r, day: String(r.nextDate || '').slice(0, 10) };
    })
    .filter(function (x) { return x.day >= today && x.day <= limit; })
    .sort(function (a, b) { return a.day.localeCompare(b.day); });

  for (const x of upcoming) {
    const when = x.day === today ? 'hoy'
      : x.day === manana ? 'manana'
      : x.day.slice(8) + '/' + x.day.slice(5, 7);
    lines.push(x.r.description + ' S/ ' + Number(x.r.amount).toFixed(2) + ' ' + when);
    if (x.r.type !== 'income') total += Number(x.r.amount) || 0;
  }

  const subidas = (data.recurring || []).filter(function (r) {
    const prev = r.previousAmounts;
    return r.isActive && Array.isArray(prev) && prev.length > 0
      && Number(r.amount) > Number(prev[prev.length - 1].amount);
  });

  if (lines.length === 0 && subidas.length === 0) return null;

  let body = lines.length > 0
    ? lines.slice(0, 4).join(' - ') + (lines.length > 4 ? ' y ' + (lines.length - 4) + ' mas' : '')
    : '';
  if (subidas.length > 0) {
    body += (body ? '\n' : '') + subidas.length + ' suscripcion' +
      (subidas.length === 1 ? '' : 'es') + ' subio de precio';
  }

  const title = lines.length > 0
    ? 'S/ ' + total.toFixed(2) + ' en cobros esta semana'
    : 'Cambios en tus suscripciones';

  return { title: title, body: body, tag: 'digest', url: '/' };
}

async function runDailyDigest() {
  if (!PUSH_ENABLED) return;
  try {
    const store = await readPushSubs();
    if (store.subscriptions.length === 0) return;

    const today = limaDateStr();
    if (store.subscriptions.every(function (s) { return s.lastSentDate === today; })) return;

    // Un resumen por hogar. Antes salia uno solo del archivo global; con los
    // datos partidos, mandarselo a todos seria contarle a cada quien las
    // cuentas de otro.
    const payloadPorHogar = new Map();
    async function payloadDe(hogarId) {
      const clave = hogarId || '';
      if (payloadPorHogar.has(clave)) return payloadPorHogar.get(clave);
      let payload = null;
      try {
        const archivo = hogarId ? archivoDeHogar(hogarId) : DATA_FILE;
        payload = buildDigest(JSON.parse(await fs.readFile(archivo, 'utf8')));
      } catch (err) {
        console.warn(`[push] sin datos para el hogar ${clave || '(global)'}:`, err.code || err.message);
      }
      payloadPorHogar.set(clave, payload);
      return payload;
    }

    const survivors = [];
    let sentCount = 0;
    for (const sub of store.subscriptions) {
      if (sub.lastSentDate === today) { survivors.push(sub); continue; }
      const payload = await payloadDe(sub.hogarId);
      // Sin datos que resumir la suscripcion se conserva: el fallo es del
      // archivo de hoy, no del dispositivo.
      if (!payload) { survivors.push(sub); continue; }
      const r = await sendTo(sub, payload);
      if (r === 'gone') continue;
      if (r === 'sent') sentCount++;
      survivors.push(Object.assign({}, sub, {
        lastSentDate: r === 'sent' ? today : sub.lastSentDate,
      }));
    }
    store.subscriptions = survivors;
    await writePushSubs(store);
    console.log('[push] resumen diario enviado a ' + sentCount + ' dispositivo(s)');
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn('[push] resumen diario fallo:', err.message);
  }
}

// Se revisa cada hora y solo dispara a las 09:00 de Lima (14:00 UTC).
const DIGEST_HOUR_UTC = 14;
// unref: el listen del servidor ya mantiene vivo el proceso. Sin esto, un
// require desde un test nunca terminaria por culpa del temporizador.
const digestTimer = setInterval(function () {
  if (new Date().getUTCHours() === DIGEST_HOUR_UTC) runDailyDigest();
}, 60 * 60 * 1000);
if (typeof digestTimer.unref === 'function') digestTimer.unref();


// --- Tipo de cambio en vivo ----------------------------------------------
//
// Proxy en el servidor en vez de llamar al proveedor desde el navegador: se
// evitan problemas de CORS, la respuesta se cachea una sola vez para todos
// los dispositivos, y si el proveedor se cae seguimos sirviendo el ultimo
// valor bueno en lugar de dejar a la app sin tasas.
const FX_SOURCE = 'https://open.er-api.com/v6/latest/PEN';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
let fxMemory = null;

async function readFxCache() {
  if (fxMemory) return fxMemory;
  try {
    fxMemory = JSON.parse(await fs.readFile(FX_CACHE_FILE, 'utf8'));
  } catch (e) {
    fxMemory = null;
  }
  return fxMemory;
}

async function writeFxCache(entry) {
  fxMemory = entry;
  try {
    await fs.writeFile(FX_CACHE_FILE, JSON.stringify(entry, null, 2));
  } catch (e) {
    // El cache en disco es una comodidad; si falla, el de memoria alcanza.
    console.warn('[fx] no se pudo escribir el cache:', e.message);
  }
}

async function fetchFxRates() {
  const res = await fetch(FX_SOURCE, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error('HTTP_' + res.status);
  const body = await res.json();
  if (body.result !== 'success' || !body.rates) throw new Error('respuesta inesperada');

  // El proveedor devuelve "1 PEN = X moneda"; la app trabaja al reves,
  // en soles por unidad de moneda extranjera.
  const perUnit = function (code) {
    const v = Number(body.rates[code]);
    return v > 0 ? Math.round((1 / v) * 10000) / 10000 : null;
  };
  const usd = perUnit('USD');
  const eur = perUnit('EUR');
  if (!usd || !eur) throw new Error('faltan USD/EUR');

  return {
    rates: { PEN: 1, USD: usd, EUR: eur },
    updatedAt: new Date().toISOString(),
    source: 'open.er-api.com',
  };
}

app.get('/api/fx', async (req, res) => {
  const cached = await readFxCache();
  const fresh = cached && Date.now() - new Date(cached.updatedAt).getTime() < FX_TTL_MS;
  if (fresh) return res.json({ ...cached, cached: true });

  try {
    const entry = await fetchFxRates();
    await writeFxCache(entry);
    res.json({ ...entry, cached: false });
  } catch (err) {
    console.warn('[fx] no se pudo actualizar:', err.message);
    // Servir lo viejo es mejor que no servir nada: la app necesita alguna
    // tasa para convertir, y una de hace unas horas sigue siendo util.
    if (cached) return res.json({ ...cached, cached: true, stale: true });
    res.status(503).json({ error: 'No se pudo obtener el tipo de cambio' });
  }
});

// Serve static files from dist directory (for production)
app.use(express.static(DIST_DIR));

// Fallback to index.html for client-side routing (SPA support)
app.use((req, res, next) => {
  // Solo si no es una ruta API y el archivo no existe, servir index.html
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(DIST_DIR, 'index.html'), (err) => {
      if (err) next(err);
    });
  } else {
    next();
  }
});

// Exportado para poder probar la logica de fechas del resumen sin levantar
// el servidor. El arranque queda detras de require.main para que importar
// este archivo desde un test no abra un puerto.
module.exports = {
  buildDigest, limaDateStr, addDaysStr,
  correoDelToken, permitido, EMISORES,
  claveDeUsuario, leerHogares, guardarHogares, archivoDeHogar,
  migrarAHogares, hogarDe, crearHogar,
  invitar, invitacionesPara, aceptarInvitacion, rechazarInvitacion,
  fusionarDatos, consolidar, miembrosDe,
};

// Start server
if (require.main === module) migrarAHogares().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Available on network at http://0.0.0.0:${PORT}`);
    console.log(`Serving static files from: ${DIST_DIR}`);
    console.log(`Auth: Entra ID tenant ${TENANT_ID}`);
  });
});
