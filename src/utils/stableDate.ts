/**
 * Fechas "de calendario" estables entre zonas horarias.
 *
 * EL PROBLEMA. Los recurrentes guardan `nextDate` como ISO, pero la app
 * los agrupa y etiqueta en hora LOCAL (date-fns `startOfMonth`, `format`).
 * Un `<input type="date">` entrega "2026-09-06", y `new Date("2026-09-06")`
 * lo interpreta como medianoche UTC — que en Perú (UTC-5) es el 5 de
 * septiembre 19:00. Resultado: el usuario elige el 6 y la app muestra el 5.
 * Con `2026-09-01` es peor: se muestra el 31 de agosto, o sea en el mes
 * anterior.
 *
 * LA SOLUCIÓN. Anclar siempre al MEDIODÍA UTC del día calendario buscado.
 * El mediodía UTC cae en el mismo día para cualquier offset entre UTC-11 y
 * UTC+12, así que la etiqueta local nunca se corre. Estas fechas
 * representan un día del calendario ("cobra el 6"), no un instante, así
 * que la hora es arbitraria: solo tiene que ser inmune al huso.
 */

/** Mediodía UTC — el único punto del día que no cambia de fecha en ningún huso real. */
const ANCHOR_HOUR_UTC = 12;

const isDateOnly = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Devuelve el ISO estable (mediodía UTC) del día calendario de `input`.
 *
 * - `"2026-09-06"` (de un `<input type="date">`) → ese día, sin reinterpretarlo
 *   como UTC.
 * - `Date` → se toma su día calendario LOCAL, que es el que el usuario ve.
 * - ISO con hora → igual que `Date`.
 *
 * Devuelve cadena vacía si la entrada no es una fecha válida, para que el
 * llamador pueda decidir en vez de propagar un "Invalid Date".
 */
export function toStableDateISO(input: Date | string): string {
  let y: number, m: number, d: number;

  if (typeof input === 'string') {
    if (isDateOnly(input)) {
      // Se leen los componentes tal cual: pasar por `new Date` acá es
      // justamente lo que introduce el corrimiento.
      const [ys, ms, ds] = input.split('-');
      y = Number(ys); m = Number(ms); d = Number(ds);
    } else {
      const parsed = new Date(input);
      if (isNaN(parsed.getTime())) return '';
      y = parsed.getFullYear(); m = parsed.getMonth() + 1; d = parsed.getDate();
    }
  } else {
    if (isNaN(input.getTime())) return '';
    y = input.getFullYear(); m = input.getMonth() + 1; d = input.getDate();
  }

  if (!y || !m || !d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(ANCHOR_HOUR_UTC).padStart(2, '0')}:00:00.000Z`;
}

/**
 * Día calendario ("yyyy-MM-dd") de un ISO guardado, para precargar un
 * `<input type="date">`. Con fechas ancladas a mediodía el prefijo del ISO
 * ya es correcto; esto además arregla las heredadas a medianoche UTC, que
 * de otro modo se cargarían un día antes.
 */
export function toDateInputValue(iso: string): string {
  if (!iso) return '';
  if (isDateOnly(iso)) return iso;
  // El prefijo del ISO es el día que se quiso guardar; leerlo directo evita
  // volver a pasar por la conversión de huso.
  const prefix = iso.slice(0, 10);
  return isDateOnly(prefix) ? prefix : '';
}

/**
 * Convierte a Date la fecha de una transacción SIN correrla de día.
 *
 * EL PROBLEMA. Las transacciones guardan `date` como "yyyy-MM-dd", y
 * `new Date("2026-09-01")` es medianoche UTC por especificación. En Perú
 * (UTC-5) eso es el 31 de agosto a las 19:00, así que un gasto del 1 de
 * septiembre se muestra como "31 ago" y, peor, cae en el bucket de agosto
 * al agrupar por mes: los totales del mes quedan mal.
 *
 * Una fecha sin hora representa un día del calendario, no un instante.
 * Se interpreta en hora local, que es la que el usuario ve y con la que
 * la app agrupa (date-fns startOfMonth / format son locales).
 *
 * Las cadenas que sí traen hora se dejan pasar tal cual: ahí el instante
 * es explícito y reinterpretarlo sería incorrecto.
 */
export function parseDateOnly(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date(NaN);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(value);
}
