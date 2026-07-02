import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Rutas absolutas desde la raíz: necesarias para que el catálogo público
  // (/c/nombre-del-negocio) cargue los assets correctamente
  base: "/",
});
