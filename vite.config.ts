import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = `http://127.0.0.1:${process.env.PORT || env.PORT || 8000}`;
  return {
    root: 'web',
    base: process.env.VITE_BASE_PATH || '/',
    envDir: process.cwd(),
    build: { outDir: '../dist', emptyOutDir: true },
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        // Preserve the browser Host so the API can verify same-origin writes.
        '/api': { target: backend, changeOrigin: false },
        '/sources': { target: backend, changeOrigin: true },
        '/contribution-photos': { target: backend, changeOrigin: true },
      },
    },
  };
});
