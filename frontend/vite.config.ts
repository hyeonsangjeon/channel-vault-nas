import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vendor-react",
              test: /node_modules[\\/](?:@vitejs|react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: "vendor-motion",
              test: /node_modules[\\/](?:framer-motion|motion-dom|motion-utils|tslib)[\\/]/,
              priority: 30,
            },
            {
              name: "vendor-d3",
              test: /node_modules[\\/](?:d3|d3-[^\\/]+|internmap)[\\/]/,
              priority: 25,
            },
            {
              name: "vendor-icons",
              test: /node_modules[\\/]lucide-react[\\/]/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
