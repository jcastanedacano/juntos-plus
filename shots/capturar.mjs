import { chromium } from 'playwright';

const VISTAS = [
  { archivo: 'inicio.png',      url: '?vista=inicio&seccion=resumen' },
  { archivo: 'fijos.png',       url: '?vista=inicio&seccion=fijos' },
  { archivo: 'movimientos.png', url: '?vista=movimientos' },
];

const navegador = await chromium.launch();
// 390x844 es un iPhone 14. deviceScaleFactor 2 para que el PNG no se vea
// borroso en pantalla retina, que es donde se mira un README.
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  locale: 'es-PE',
  timezoneId: 'America/Lima',
  colorScheme: 'light',
  reducedMotion: 'reduce',
});
const pagina = await contexto.newPage();

// El reloj queda clavado al 12 de septiembre, el ultimo dia con movimientos en
// los datos de ejemplo. Sin esto la cabecera muestra la fecha de hoy y la
// marca de «hoy» del grafico se mueve sola: las capturas cambiarian cada dia
// que se regeneren, y ademas quedaria una lista con movimientos posteriores a
// hoy, que es justo lo que la app no deberia poder mostrar.
await pagina.clock.install({ time: new Date('2026-09-12T15:00:00-05:00') });

for (const v of VISTAS) {
  await pagina.goto('http://localhost:3021/' + v.url, { waitUntil: 'networkidle' });
  // Las fuentes llegan de Google Fonts. Sin esperarlas, la primera captura
  // sale con la sans del sistema y la serif no aparece por ningun lado.
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(600);
  await pagina.screenshot({ path: `docs/img/${v.archivo}` });
  console.log('  ' + v.archivo);
}

await navegador.close();
