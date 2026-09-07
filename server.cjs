const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const webpush = require('web-push');
require('dotenv').config();

const app = express();
app.use(compression());
const PORT = process.env.PORT || 3007;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, 'data.json');
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
const JWKS_URI = `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`;
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;

const client = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getSigningKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    callback(null, key.getPublicKey());
  });
}

// JWT auth middleware for API routes
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, getSigningKey, {
    audience: CLIENT_ID,
    issuer: ISSUER,
    algorithms: ['RS256'],
  }, (err, decoded) => {
    if (err) {
      console.error('Token validation error:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
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
  });
});

// Auth middleware on ALL API operations (including GET)
app.use('/api', authMiddleware);

// Initialize data file if it doesn't exist
async function initDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(DATA_FILE);
  } catch {
    const initialData = {
      transactions: [],
      accounts: [{
        id: 'default',
        name: 'Cuenta Principal',
        balance: 0,
        color: '#00D1B2',
        icon: '🏦',
        type: 'debit',
      }],
      budgets: [],
      currency: 'PEN',
      user: null,
      users: [],
      goals: [],
      investments: [],
      recurring: [],
      autosave: [],
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
  }
}

// ─── Version tracking (multi-device sync + optimistic concurrency) ───
// Kept in a separate meta file so it never has to be merged into the
// AppData blob the client reads, and a version bump can never corrupt data.
async function readMeta() {
  try {
    const raw = await fs.readFile(META_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { version: 0, updatedAt: new Date(0).toISOString() };
  }
}

async function bumpVersion() {
  const meta = await readMeta();
  const next = { version: (meta.version || 0) + 1, updatedAt: new Date().toISOString() };
  try {
    await fs.writeFile(META_FILE, JSON.stringify(next, null, 2));
  } catch (err) {
    console.warn('[meta] version bump write failed:', err.code || err.message);
  }
  return next;
}

// ─── Daily backups with rotation ───
// Runs before every write. Copies the CURRENT (pre-write) data.json into
// backups/ once per calendar day, so a bad write or an accidental empty
// overwrite can always be recovered from the prior day's snapshot.
async function dailyBackup() {
  try {
    await fs.mkdir(BACKUPS_DIR, { recursive: true });
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const backupFile = path.join(BACKUPS_DIR, `data_${today}.json`);
    try {
      await fs.access(backupFile);
      return; // already backed up today
    } catch {
      // no backup yet today — proceed
    }
    const current = await fs.readFile(DATA_FILE, 'utf8');
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
      const match = file.match(/^data_(\d{4}-\d{2}-\d{2})\.json$/);
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

app.get('/api/data', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    res.json(scrubUserPasswords(JSON.parse(data)));
  } catch (error) {
    // Fresh-install / persistent-volume-not-yet-populated → return empty
    // shell so the UI doesn't blow up with a 500. The next save creates
    // the file. Same for parse errors on a corrupt file: we surface the
    // shell rather than a hard error.
    if (error.code === 'ENOENT' || error instanceof SyntaxError) {
      console.warn(`[api/data] ${error.code || 'parse_error'} on ${DATA_FILE}; returning empty shell`);
      // Best-effort: seed the file so future reads succeed.
      try {
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        await fs.writeFile(DATA_FILE, JSON.stringify(EMPTY_DATA, null, 2), 'utf8');
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
  const meta = await readMeta();
  res.json(meta);
});

// Download the current data file as an attachment — manual backup button
// in the UI, independent of the server's own daily rotation.
app.get('/api/backup', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
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
    const { collection } = req.params;
    let newData = req.body;

    // Si recibimos la bandera especial __null__, convertir a null
    if (newData && newData.__null__ === true) {
      newData = null;
    }
    if (collection === 'user') newData = stripPassword(newData);
    if (collection === 'users' && Array.isArray(newData)) newData = newData.map(stripPassword);

    await dailyBackup();

    const data = await fs.readFile(DATA_FILE, 'utf8');
    const allData = JSON.parse(data);

    allData[collection] = newData;

    await fs.writeFile(DATA_FILE, JSON.stringify(allData, null, 2));
    const meta = await bumpVersion();
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
    const { transactions: newTxs } = req.body;
    if (!Array.isArray(newTxs) || newTxs.length === 0) {
      return res.json({ success: true, imported: 0, message: 'No transactions to import' });
    }

    await dailyBackup();

    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
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

    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    const meta = await bumpVersion();
    res.json({ success: true, imported, skipped, total: data.transactions.length, version: meta.version });
  } catch (error) {
    console.error('Error syncing BCP:', error);
    res.status(500).json({ error: 'Error syncing BCP data' });
  }
});

// Update all data at once
app.post('/api/data', async (req, res) => {
  try {
    const newData = scrubUserPasswords(req.body);
    await dailyBackup();
    await fs.writeFile(DATA_FILE, JSON.stringify(newData, null, 2));
    const meta = await bumpVersion();
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
    const rest = store.subscriptions.filter(function (x) { return x.endpoint !== sub.endpoint; });
    rest.push({
      userId: uid,
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

    const data = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    const payload = buildDigest(data);
    if (!payload) return;

    const survivors = [];
    let sentCount = 0;
    for (const sub of store.subscriptions) {
      if (sub.lastSentDate === today) { survivors.push(sub); continue; }
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
module.exports = { buildDigest, limaDateStr, addDaysStr };

// Start server
if (require.main === module) initDataFile().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`Available on network at http://0.0.0.0:${PORT}`);
    console.log(`Serving static files from: ${DIST_DIR}`);
    console.log(`Auth: Entra ID tenant ${TENANT_ID}`);
  });
});
