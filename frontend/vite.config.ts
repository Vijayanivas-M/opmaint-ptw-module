import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,          // Bind to 0.0.0.0 — required for custom hostnames to resolve
    port: 5173,
    allowedHosts: [
      'ptw.local',       // Custom domain mapped via Windows hosts file
    ],
  },
})
