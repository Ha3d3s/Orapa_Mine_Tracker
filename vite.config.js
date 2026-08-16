import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the build work when hosted in a GitHub Pages
// project subfolder (https://username.github.io/repo-name/)
export default defineConfig({
  plugins: [react()],
  base: "./",
});
