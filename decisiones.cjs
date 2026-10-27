'use strict';

/**
 * Decidir juntos: votos ciegos para decisiones de dinero entre la pareja.
 *
 * Una persona plantea una pregunta con 2 a 4 opciones; cada quien vota en
 * privado, y cuando las DOS han votado se abre el resultado: coinciden o no.
 * Si no coinciden queda en «Hablarlo» y cualquiera de las dos la marca como
 * resuelta con una opcion final y una nota opcional.
 *
 * Igual que el cuestionario de alineacion, vive en un archivo APARTE del hogar
 * (decisiones.json) y no dentro de data.json: GET /api/data devuelve todo el
 * archivo a las dos personas, asi que guardar aqui los votos dejaria leer el de
 * la otra con solo abrir las herramientas del navegador. El voto de la otra
 * persona no sale del servidor hasta que ya no puede influir en el propio.
 */

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const MIN_OPCIONES = 2;
const MAX_OPCIONES = 4;
const MAX_PREGUNTA = 140;
const MAX_OPCION = 60;
const MAX_NOTA = 280;
const MAX_DECISIONES = 500;

// ─── Validacion ─────────────────────────────────────────────────────

const texto = v => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '');

/**
 * Comprueba y normaliza una decision nueva. Devuelve { pregunta, opciones,
 * monto } o { error: codigo }. Los ids de las opciones los pone el servidor
 * (o1, o2...): el cliente solo manda textos.
 */
function validarNueva(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { error: 'decision_invalida' };
  const pregunta = texto(entrada.pregunta);
  if (!pregunta) return { error: 'pregunta_vacia' };
  if (pregunta.length > MAX_PREGUNTA) return { error: 'pregunta_larga' };

  if (!Array.isArray(entrada.opciones)) return { error: 'opciones_invalidas' };
  const textos = entrada.opciones.map(texto);
  if (textos.some(t => !t)) return { error: 'opciones_invalidas' };
  if (textos.length < MIN_OPCIONES || textos.length > MAX_OPCIONES) return { error: 'opciones_cantidad' };
  if (textos.some(t => t.length > MAX_OPCION)) return { error: 'opcion_larga' };
  if (new Set(textos.map(t => t.toLowerCase())).size !== textos.length) return { error: 'opciones_repetidas' };

  let monto = null;
  if (entrada.monto !== undefined && entrada.monto !== null && entrada.monto !== '') {
    if (typeof entrada.monto !== 'number' || !Number.isFinite(entrada.monto) || entrada.monto <= 0 || entrada.monto > 1e12) {
      return { error: 'monto_invalido' };
    }
    monto = Math.round(entrada.monto * 100) / 100;
  }

  return { pregunta, opciones: textos.map((t, i) => ({ id: 'o' + (i + 1), texto: t })), monto };
}

// ─── Archivo ────────────────────────────────────────────────────────

const ARCHIVO = 'decisiones.json';

async function leer(dir) {
  try {
    const crudo = JSON.parse(await fs.readFile(path.join(dir, ARCHIVO), 'utf8'));
    return crudo && typeof crudo === 'object' && Array.isArray(crudo.decisiones)
      ? crudo
      : { decisiones: [] };
  } catch {
    return { decisiones: [] };
  }
}

async function escribir(dir, datos) {
  await fs.mkdir(dir, { recursive: true });
  const destino = path.join(dir, ARCHIVO);
  // Temporal y renombrar: un corte a mitad de escritura no deja un archivo
  // truncado que borre los votos de la otra persona.
  const tmp = destino + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(datos, null, 2));
  await fs.rename(tmp, destino);
}

/**
 * Las escrituras de un mismo archivo van de una en una: dos personas votando a
 * la vez leerian el mismo estado y la segunda pisaria a la primera.
 */
const colas = new Map();
function enCola(clave, tarea) {
  const previa = colas.get(clave) || Promise.resolve();
  const siguiente = previa.catch(() => {}).then(tarea);
  colas.set(clave, siguiente);
  siguiente.finally(() => { if (colas.get(clave) === siguiente) colas.delete(clave); }).catch(() => {});
  return siguiente;
}

// ─── Lo que ve cada quien ───────────────────────────────────────────

const votoValido = (d, miembro) => {
  const v = d.votos && d.votos[miembro];
  return v && d.opciones.some(o => o.id === v.opcion) ? v : null;
};

/** Hay dos miembros y los dos votaron. */
function estaCompleta(d, miembros) {
  return miembros.length === 2 && miembros.every(m => votoValido(d, m));
}

/**
 * La vista de UNA decision para UNA persona. Aqui, y solo aqui, se decide que
 * se ve: el voto de la otra persona no aparece hasta que las dos votaron. Ni
 * el voto ni la clave ni la fecha del voto de la otra salen antes.
 */
function vistaDe(d, clave, miembros) {
  const completa = estaCompleta(d, miembros);
  const otra = miembros.find(m => m !== clave);
  const mio = votoValido(d, clave);
  const suyo = otra ? votoValido(d, otra) : null;
  const coinciden = completa ? mio.opcion === suyo.opcion : null;
  const resuelta = Boolean(d.resolucion);

  let estado = 'votando';
  if (resuelta) estado = 'resuelta';
  else if (completa) estado = coinciden ? 'coinciden' : 'hablarlo';

  return {
    id: d.id,
    pregunta: d.pregunta,
    opciones: d.opciones,
    monto: d.monto,
    creada: d.creada,
    mia: d.creador === clave,
    estado,
    yo: mio ? { opcion: mio.opcion, fecha: mio.fecha } : null,
    pareja: {
      voto: Boolean(suyo),
      ...(completa ? { opcion: suyo.opcion } : {}),
    },
    ...(completa ? { coinciden } : {}),
    ...(resuelta ? { resolucion: { opcion: d.resolucion.opcion, nota: d.resolucion.nota, fecha: d.resolucion.fecha } } : {}),
  };
}

function vistaLista(datos, clave, miembros) {
  const lista = datos.decisiones.map(d => vistaDe(d, clave, miembros));
  lista.sort((a, b) => (a.creada < b.creada ? 1 : a.creada > b.creada ? -1 : 0));
  return {
    miembros: miembros.length,
    limites: { maxPregunta: MAX_PREGUNTA, maxOpcion: MAX_OPCION, maxNota: MAX_NOTA, minOpciones: MIN_OPCIONES, maxOpciones: MAX_OPCIONES },
    decisiones: lista,
  };
}

// ─── Operaciones ────────────────────────────────────────────────────

async function consultar({ dir, clave, miembros }) {
  return vistaLista(await leer(dir), clave, miembros);
}

async function crear({ dir, clave, miembros, entrada, ahora = new Date() }) {
  if (!miembros.includes(clave)) return { error: 'no_es_miembro' };
  const v = validarNueva(entrada);
  if (v.error) return { error: v.error };

  return enCola(dir, async () => {
    const datos = await leer(dir);
    if (datos.decisiones.length >= MAX_DECISIONES) return { error: 'demasiadas' };
    const d = {
      id: crypto.randomBytes(8).toString('hex'),
      pregunta: v.pregunta,
      opciones: v.opciones,
      monto: v.monto,
      creador: clave,
      creada: ahora.toISOString(),
      votos: {},
      resolucion: null,
    };
    datos.decisiones.push(d);
    await escribir(dir, datos);
    return { ok: true, id: d.id, vista: vistaLista(datos, clave, miembros) };
  });
}

/**
 * Guarda el voto de una persona. Se puede cambiar mientras la otra no haya
 * votado; con las dos dentro queda cerrado, porque cambiar tras ver el voto de
 * la otra persona es justo lo que este formato evita.
 */
async function votar({ dir, clave, miembros, id, opcion, ahora = new Date() }) {
  if (!miembros.includes(clave)) return { error: 'no_es_miembro' };
  if (typeof opcion !== 'string') return { error: 'opcion_desconocida' };

  return enCola(dir, async () => {
    const datos = await leer(dir);
    const d = datos.decisiones.find(x => x.id === id);
    if (!d) return { error: 'no_existe' };
    if (!d.opciones.some(o => o.id === opcion)) return { error: 'opcion_desconocida' };
    if (d.resolucion || estaCompleta(d, miembros)) return { error: 'decision_cerrada' };
    d.votos = d.votos || {};
    d.votos[clave] = { opcion, fecha: ahora.toISOString() };
    await escribir(dir, datos);
    return { ok: true, vista: vistaLista(datos, clave, miembros) };
  });
}

/**
 * Marca como resuelta una decision en la que no coincidieron, con la opcion
 * final y una nota opcional. Solo despues de que las dos votaron y no
 * coinciden: antes no hay nada que resolver, y si coinciden ya esta decidida.
 */
async function resolver({ dir, clave, miembros, id, opcion, nota, ahora = new Date() }) {
  if (!miembros.includes(clave)) return { error: 'no_es_miembro' };
  if (typeof opcion !== 'string') return { error: 'opcion_desconocida' };
  const n = nota === undefined || nota === null ? '' : texto(nota);
  if (typeof nota !== 'undefined' && nota !== null && typeof nota !== 'string') return { error: 'nota_invalida' };
  if (n.length > MAX_NOTA) return { error: 'nota_larga' };

  return enCola(dir, async () => {
    const datos = await leer(dir);
    const d = datos.decisiones.find(x => x.id === id);
    if (!d) return { error: 'no_existe' };
    if (d.resolucion) return { error: 'decision_cerrada' };
    if (!estaCompleta(d, miembros)) return { error: 'faltan_votos' };
    if (votoValido(d, miembros[0]).opcion === votoValido(d, miembros[1]).opcion) return { error: 'ya_coinciden' };
    if (!d.opciones.some(o => o.id === opcion)) return { error: 'opcion_desconocida' };
    d.resolucion = { opcion, nota: n, por: clave, fecha: ahora.toISOString() };
    await escribir(dir, datos);
    return { ok: true, vista: vistaLista(datos, clave, miembros) };
  });
}

// ─── Rutas ──────────────────────────────────────────────────────────

const ESTADO = {
  decision_invalida: 400, pregunta_vacia: 400, pregunta_larga: 400, opciones_invalidas: 400,
  opciones_cantidad: 400, opcion_larga: 400, opciones_repetidas: 400, monto_invalido: 400,
  opcion_desconocida: 400, nota_invalida: 400, nota_larga: 400,
  no_es_miembro: 403, no_existe: 404,
  decision_cerrada: 409, faltan_votos: 409, ya_coinciden: 409, demasiadas: 409,
};

/**
 * Se monta desde server.cjs con lo que necesita del modulo de hogares. Todas
 * las rutas exigen hogar (409 si no) y sesion valida: cuelgan de /api.
 */
function montarRutas(app, { conHogar, leerHogares, miembrosDe, claveDeUsuario, archivoDeHogar }) {
  const contexto = async (req, res) => {
    if (!(await conHogar(req, res))) return null;
    const clave = claveDeUsuario(req.user);
    if (!clave) {
      res.status(400).json({ codigo: 'sin_identidad' });
      return null;
    }
    const mapa = await leerHogares();
    return { clave, miembros: miembrosDe(mapa, req.hogarId), dir: path.dirname(archivoDeHogar(req.hogarId)) };
  };

  const responder = (res, r) => {
    if (r.error) return res.status(ESTADO[r.error] || 400).json({ codigo: r.error });
    return res.json(r.vista);
  };

  const manejar = (nombre, mensaje, hacer) => async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const c = await contexto(req, res);
      if (!c) return;
      responder(res, await hacer(c, req));
    } catch (err) {
      console.error(`[decisiones] ${nombre} fallido:`, err.message);
      res.status(500).json({ error: mensaje });
    }
  };

  app.get('/api/hogar/decisiones', manejar('consulta', 'No se pudieron consultar las decisiones',
    async c => ({ vista: await consultar(c) })));

  app.post('/api/hogar/decisiones', manejar('alta', 'No se pudo crear la decision',
    (c, req) => crear({ ...c, entrada: req.body })));

  app.post('/api/hogar/decisiones/:id/voto', manejar('voto', 'No se pudo guardar el voto',
    (c, req) => votar({ ...c, id: req.params.id, opcion: req.body && req.body.opcion })));

  app.post('/api/hogar/decisiones/:id/resolver', manejar('resolucion', 'No se pudo resolver la decision',
    (c, req) => resolver({ ...c, id: req.params.id, opcion: req.body && req.body.opcion, nota: req.body && req.body.nota })));
}

module.exports = {
  validarNueva, vistaDe, consultar, crear, votar, resolver, estaCompleta, montarRutas,
  MIN_OPCIONES, MAX_OPCIONES, MAX_PREGUNTA, MAX_OPCION, MAX_NOTA,
};
