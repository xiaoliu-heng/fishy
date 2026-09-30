import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      deny: [
        "**/.data/**",
        "**/data/**",
        "**/tmp/**",
        "**/backups/**",
        "**/releases/**",
        "**/deploy/**",
        "**/.git/**",
        "**/.env*",
        "**/design/**",
        "**/.impeccable/**",
        "**/server/**",
      ],
    },
  },
  build: { target: "es2022" },
});
