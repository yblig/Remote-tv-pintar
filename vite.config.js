import { defineConfig } from 'vite';
export default defineConfig({
  base: './',               // relative paths: required inside the Android WebView
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 4000 },
  server: { host: true }
});
