import { defineConfig } from 'vite';

// Un solo bundle classico (IIFE) e percorsi relativi: la cartella dist
// si apre anche con doppio clic su index.html, senza server.
const classicScript = {
  name: 'classic-script',
  enforce: 'post',
  transformIndexHtml(html) {
    return html
      .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '<script defer src="$1"></script>')
      .replace(/ crossorigin(?=[ >])/g, '');
  },
};

export default defineConfig({
  base: './',
  plugins: [classicScript],
  build: {
    assetsInlineLimit: 0,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: { input: { main: 'index.html' }, output: { format: 'iife' } },
  },
});
