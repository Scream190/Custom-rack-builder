import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build into ONE self-contained HTML file. This makes the editor usable offline
// (just open dist/index.html) and lets the app export itself as an interactive viewer.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { chunkSizeWarningLimit: 4000 },
});
