import { execSync } from 'node:child_process'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Sello del build: que SHA es lo que hay servido.
 *
 * Cuatro revisiones seguidas midieron una version anterior a la desplegada
 * --el service worker sirve el index precargado en el primer refresco-- y no
 * habia forma de saberlo desde fuera. Con esto la respuesta esta a mano en dos
 * sitios: en el <meta> del HTML y en /healthz.
 */
function selloDelBuild(): Plugin {
  const sha =
    process.env.GITHUB_SHA?.slice(0, 7) ||
    (() => {
      try {
        return execSync('git rev-parse --short HEAD').toString().trim();
      } catch {
        // Un tarball sin .git o sin git instalado: el build no debe caerse
        // por no poder sellarse.
        return 'desconocido';
      }
    })();
  const fecha = new Date().toISOString();

  return {
    name: 'sello-del-build',
    transformIndexHtml: {
      order: 'pre',
      handler: (html: string) =>
        html.replace(
          '</head>',
          `  <meta name="build" content="${sha}" />
    <meta name="build-time" content="${fecha}" />
  </head>`
        ),
    },
    // El servidor lo lee para responderlo en /healthz. Va como .json a
    // proposito: el precache del service worker solo coge js, css, html e
    // imagenes, asi que este archivo nunca se sirve de una copia vieja.
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-info.json',
        source: JSON.stringify({ sha, builtAt: fecha }, null, 2),
      });
    },
  };
}

export default defineConfig({
  plugins: [
    selloDelBuild(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // El SW se regenera en cada build (generateSW), asi que los
        // manejadores de push van en un script aparte que se importa.
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // /api/data NO se cachea.
        //
        // Estaba con NetworkFirst y networkTimeoutSeconds: 5, asi que si el
        // servidor tardaba mas de 5 segundos --normal en el plan Basic recien
        // reiniciado-- el service worker servia una copia de hasta una hora
        // antes. Para datos financieros propios eso significa ver saldos
        // viejos, o un descarte de suscripcion que "vuelve a aparecer".
        //
        // El fetch ya pedia cache: 'no-store' justamente para evitarlo, y esta
        // regla lo contradecia por detras. La app tiene su propio cache en
        // memoria como respaldo y muestra un banner de error si la carga
        // falla, asi que quedarse sin la copia del SW degrada bien.
        runtimeCaching: [
          {
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
        // El SW de generateSW pone un navigateFallback por defecto: CUALQUIER
        // navegacion de pagina que no este en la precache se responde con el
        // index.html cacheado, sin tocar la red. Eso rompe /auth/google y
        // /auth/google/callback, que son navegaciones completas de verdad
        // (window.location.href, no un fetch): el boton de Google pulsaba,
        // el SW devolvia la app de vuelta con 200, y nunca salia hacia Google.
        // "Vuelve a la pantalla inicial y no avanza" era exactamente esto.
        navigateFallbackDenylist: [/^\/auth\//, /^\/api\//],
      },
      manifest: {
        name: 'Juntos+1 Finance Tracker',
        short_name: 'Juntos+1',
        description: 'Control financiero personal',
        theme_color: '#0B0F1A',
        background_color: '#060a14',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-msal': ['@azure/msal-browser', '@azure/msal-react'],
          'vendor-charts': ['recharts'],
          'vendor-date': ['date-fns'],
        },
      },
    },
  },
  server: {
    port: 3008,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: true,
    // En produccion el mismo Express sirve la aplicacion y la API, asi que todo
    // es del mismo origen y la cookie de sesion viaja sola. En desarrollo son
    // dos puertos distintos, y sin este proxy el navegador trataría la cookie
    // como de terceros y no la mandaria: entrar con Google parecería funcionar
    // y luego la aplicacion no reconoceria a nadie.
    proxy: {
      '/api': 'http://localhost:3007',
      '/auth': 'http://localhost:3007',
    },
  },
  preview: {
    port: 3008,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: true,
  },
})
