import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5945,
    proxy: {
      '/api': 'http://localhost:3945',
      '/socket.io': { target: 'http://localhost:3945', ws: true }
    }
  }
});
