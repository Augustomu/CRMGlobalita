import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

// @crm/core no está linkeado como dependencia de npm: se apunta directo a la
// fuente de packages/core/src con un alias, sin paso de build intermedio.
// Node ya ejecuta esos .ts sin compilar (ver packages/core/README.md); acá
// esbuild (que usa Vite) hace lo mismo en el navegador.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@crm/core': path.resolve(aqui, '../../packages/core/src'),
    },
  },
  server: {
    port: 5173,
  },
});
