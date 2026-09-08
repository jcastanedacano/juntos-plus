import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config aparte: el harness no lleva PWA ni el sello del build, solo monta los
// componentes reales con datos de escaparate.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { port: 3021, strictPort: true },
});
