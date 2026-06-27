import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: funciona igual en la raíz del dominio o en una subcarpeta
  base: "./",
});
