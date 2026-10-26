import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable from outside the container
    port: 5173,
    strictPort: true,
    watch: {
      // File-change events from a Windows folder mounted into Docker often don't arrive,
      // so the dev container turns polling on via this env var.
      usePolling: process.env.VITE_USE_POLLING === 'true',
      interval: 300,
    },
  },
});
