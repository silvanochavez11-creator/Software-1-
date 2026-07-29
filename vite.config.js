import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Fecha de la compilación: se muestra en /diagnostico para saber si el
  // navegador está cargando la versión más nueva publicada
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  // Rutas absolutas desde la raíz: necesarias para que el catálogo público
  // (/c/nombre-del-negocio) cargue los assets correctamente
  base: "/",
});
