# Capturas del README

Las tres imágenes de `docs/img/` salen de aquí. Se generan montando los
componentes reales de la aplicación con datos inventados, para que el README
muestre la interfaz de verdad sin exponer las cuentas de nadie.

## Regenerarlas

Playwright y su Chromium no están en `package.json`: son necesarios cuando
cambia la interfaz, no en cada build, y su `postinstall` descarga más de
100 MB que el despliegue no tiene por qué pagar.

```bash
npm install --no-save playwright
npx playwright install chromium

npx vite --config shots/vite.config.ts    # levanta el harness en :3021
node shots/capturar.mjs                   # escribe docs/img/*.png
```

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `datos.ts` | Los movimientos y recurrentes de ejemplo. Inventados a mano. |
| `main.tsx` | Monta las vistas móviles reales con esos datos. La pantalla se elige por `?vista=`. |
| `index.html` | Carga las dos familias tipográficas y el punto de entrada. |
| `vite.config.ts` | Config aparte: sin PWA ni sello de build. |
| `capturar.mjs` | Recorre las vistas y guarda los PNG a 390x844, escala 2. |

## Reglas de los datos de ejemplo

Ni un nombre ni una cifra puede salir de una cuenta real. Los datos están
calibrados para que las capturas muestren la aplicación trabajando, con un mes
a medias y margen ajustado, y no un estado vacío que no enseña nada.
