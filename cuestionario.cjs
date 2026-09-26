'use strict';

/**
 * Cuestionario de alineacion de pareja.
 *
 * Cada persona reparte 100 puntos entre lo que le importa; cuando las DOS han
 * respondido, se ven juntas las respuestas. Una vez al año hay una ronda
 * nueva, y se compara con la anterior.
 *
 * Vive en un archivo APARTE del hogar (cuestionario.json) y no dentro de
 * data.json a proposito: GET /api/data devuelve todo el archivo a las dos
 * personas, asi que guardar aqui las respuestas dejaria leer las de la otra
 * antes de tiempo con solo abrir las herramientas del navegador. Con esto, lo
 * que la otra persona respondio no sale del servidor hasta que ya no puede
 * influir en lo que uno responde.
 */

const fs = require('fs/promises');
const path = require('path');

const TOTAL = 100;

/**
 * Las areas entre las que se reparten los puntos. La lista vive AQUI y viaja
 * en la respuesta: el cliente pinta lo que le llega, asi una sola fuente
 * decide que se pregunta y que se acepta.
 */
const CATEGORIAS = [
  { id: 'ahorro', nombre: 'Ahorrar y tener colchón', descripcion: 'Un fondo para imprevistos y para dormir tranquilos.' },
  { id: 'deudas', nombre: 'Salir de deudas', descripcion: 'Pagar lo que se debe antes que casi cualquier otra cosa.' },
  { id: 'vivienda', nombre: 'Casa propia o mejor vivienda', descripcion: 'Comprar, mudarse o mejorar donde vivimos.' },
  { id: 'viajes', nombre: 'Viajes y experiencias juntos', descripcion: 'Conocer lugares y hacer cosas que se recuerdan.' },
  { id: 'familia', nombre: 'Familia e hijos', descripcion: 'Lo que hace falta para la familia que tenemos o queremos.' },
  { id: 'inversion', nombre: 'Invertir para el futuro', descripcion: 'Hacer crecer el patrimonio y acercar la independencia.' },
  { id: 'disfrute', nombre: 'Disfrutar el día a día', descripcion: 'Salidas, comidas fuera, pequeños gustos sin culpa.' },
  { id: 'personal', nombre: 'Proyectos y gustos personales', descripcion: 'Lo que cada uno quiere para sí, aparte de lo compartido.' },
];

const IDS = CATEGORIAS.map(c => c.id);

/** La ronda es el año: cada año hay una nueva, y se compara con la anterior. */
function rondaActual(ahora = new Date()) {
  return String(ahora.getUTCFullYear());
}

/**
 * Comprueba y normaliza lo que llega. Devuelve { puntos } con TODAS las
 * categorias --las que no vinieron valen 0-- o { error: codigo }.
 *
 * Los puntos son enteros no negativos y suman exactamente 100: sin eso, dos
 * respuestas no se pueden comparar, porque una podria «valer mas» que la otra.
 */
function validarRespuesta(entrada) {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return { error: 'respuesta_invalida' };
  for (const k of Object.keys(entrada)) {
    if (!IDS.includes(k)) return { error: 'categoria_desconocida' };
  }
  const puntos = {};
  let suma = 0;
  for (const id of IDS) {
    const v = entrada[id] === undefined ? 0 : entrada[id];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > TOTAL) return { error: 'puntos_invalidos' };
    puntos[id] = v;
    suma += v;
  }
  if (suma !== TOTAL) return { error: 'suma_invalida' };
  return { puntos };
}

// ─── Archivo ────────────────────────────────────────────────────────

const ARCHIVO = 'cuestionario.json';

async function leer(dir) {
  try {
    const crudo = JSON.parse(await fs.readFile(path.join(dir, ARCHIVO), 'utf8'));
    return crudo && typeof crudo === 'object' && crudo.rondas && typeof crudo.rondas === 'object'
      ? crudo
      : { rondas: {} };
  } catch {
    return { rondas: {} };
  }
}

async function escribir(dir, datos) {
  await fs.mkdir(dir, { recursive: true });
  const destino = path.join(dir, ARCHIVO);
  // Se escribe a un temporal y se renombra: un corte a mitad de escritura no
  // deja un archivo truncado que borre las respuestas de la otra persona.
  const tmp = destino + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(datos, null, 2));
  await fs.rename(tmp, destino);
}

/**
 * Las escrituras de un mismo archivo van de una en una. Dos personas que
 * responden a la vez leerian el mismo estado y la segunda pisaria a la
 * primera: leer-modificar-escribir sin turno pierde respuestas.
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

/** Los miembros actuales que respondieron esa ronda. */
function quienesRespondieron(ronda, miembros) {
  const respuestas = (ronda && ronda.respuestas) || {};
  return miembros.filter(m => respuestas[m] && respuestas[m].puntos);
}

/** Hay dos miembros y los dos respondieron. */
function estaCompleta(ronda, miembros) {
  return miembros.length === 2 && quienesRespondieron(ronda, miembros).length === 2;
}

/**
 * La vista para UNA persona. Aqui, y solo aqui, se decide que se ve: los
 * puntos de la otra persona no aparecen hasta que la ronda esta completa.
 * Las respuestas de quien ya no es del hogar se ignoran.
 */
function vistaPara(datos, clave, miembros, ahora = new Date()) {
  const actual = rondaActual(ahora);
  const ronda = datos.rondas[actual];
  const respuestas = (ronda && ronda.respuestas) || {};
  const completa = estaCompleta(ronda, miembros);
  const otra = miembros.find(m => m !== clave);
  const suya = respuestas[clave];
  const deLaOtra = otra ? respuestas[otra] : null;

  // La ronda anterior mas reciente que las dos personas llegaron a cerrar.
  let previa = null;
  const anteriores = Object.keys(datos.rondas).filter(r => r < actual).sort().reverse();
  for (const r of anteriores) {
    if (!estaCompleta(datos.rondas[r], miembros)) continue;
    const resp = datos.rondas[r].respuestas;
    previa = { ronda: r, yo: resp[clave].puntos, pareja: resp[otra].puntos };
    break;
  }

  return {
    ronda: actual,
    total: TOTAL,
    categorias: CATEGORIAS,
    miembros: miembros.length,
    completa,
    yo: suya && suya.puntos ? { puntos: suya.puntos, fecha: suya.fecha } : null,
    pareja: {
      respondio: Boolean(deLaOtra && deLaOtra.puntos),
      ...(completa ? { puntos: deLaOtra.puntos } : {}),
    },
    previa,
  };
}

/**
 * Guarda la respuesta de una persona. Se puede cambiar mientras la otra no
 * haya respondido; con las dos dentro la ronda se cierra, porque cambiar tras
 * ver la respuesta de la otra persona es justo lo que este formato evita.
 */
async function guardarRespuesta({ dir, clave, miembros, entrada, ahora = new Date() }) {
  const v = validarRespuesta(entrada);
  if (v.error) return { error: v.error };
  if (!miembros.includes(clave)) return { error: 'no_es_miembro' };

  return enCola(dir, async () => {
    const datos = await leer(dir);
    const actual = rondaActual(ahora);
    const ronda = datos.rondas[actual] || { respuestas: {} };
    if (estaCompleta(ronda, miembros)) return { error: 'ronda_cerrada' };
    ronda.respuestas[clave] = { puntos: v.puntos, fecha: ahora.toISOString() };
    datos.rondas[actual] = ronda;
    await escribir(dir, datos);
    return { ok: true, vista: vistaPara(datos, clave, miembros, ahora) };
  });
}

async function consultar({ dir, clave, miembros, ahora = new Date() }) {
  return vistaPara(await leer(dir), clave, miembros, ahora);
}

// ─── Rutas ──────────────────────────────────────────────────────────

const ESTADO = {
  respuesta_invalida: 400, categoria_desconocida: 400, puntos_invalidos: 400, suma_invalida: 400,
  no_es_miembro: 403, ronda_cerrada: 409,
};

/**
 * Se monta desde server.cjs con lo que necesita del modulo de hogares. Ambas
 * rutas exigen hogar (409 si no) y sesion valida: cuelgan de /api.
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

  app.get('/api/hogar/cuestionario', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const c = await contexto(req, res);
      if (!c) return;
      res.json(await consultar(c));
    } catch (err) {
      console.error('[cuestionario] consulta fallida:', err.message);
      res.status(500).json({ error: 'No se pudo consultar el cuestionario' });
    }
  });

  app.post('/api/hogar/cuestionario', async (req, res) => {
    try {
      const c = await contexto(req, res);
      if (!c) return;
      const r = await guardarRespuesta({ ...c, entrada: req.body && req.body.puntos });
      if (r.error) return res.status(ESTADO[r.error] || 400).json({ codigo: r.error });
      res.json(r.vista);
    } catch (err) {
      console.error('[cuestionario] guardado fallido:', err.message);
      res.status(500).json({ error: 'No se pudo guardar el cuestionario' });
    }
  });
}

module.exports = {
  CATEGORIAS, TOTAL, rondaActual, validarRespuesta, vistaPara,
  guardarRespuesta, consultar, estaCompleta, montarRutas,
};
