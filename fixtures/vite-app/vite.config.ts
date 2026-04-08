import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  cacheDir: '.vite',
  plugins: [react(), tsconfigPaths()],
});
