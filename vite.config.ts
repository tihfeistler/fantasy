import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// URL da API PHP no XAMPP (pasta htdocs/fantasy). Mude se usar outra pasta/porta.
const API_XAMPP = "http://localhost/fantasy";

export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o build funciona em http://localhost/fantasy/dist/
  base: "./",
  server: {
    // Em "npm run dev", /api/... é repassado para o Apache do XAMPP.
    proxy: { "/api": { target: API_XAMPP, changeOrigin: true } },
  },
});
