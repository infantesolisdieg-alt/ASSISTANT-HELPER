import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Configuración de Vite (app 100 % del lado del cliente) y de Vitest (pruebas de src/analysis)
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
