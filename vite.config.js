import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Vite multi-pagina: ogni pagina è un HTML statico (ottimo per la SEO).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        privacy: resolve(import.meta.dirname, 'privacy/index.html'),
      },
    },
  },
});
