import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}


// GitHub Pages needs base = '/flo/' (subdirectory deploy)
// Vercel / any root deploy needs base = '/'
// Set VITE_BASE_PATH env var in Vercel to '/' (or leave it unset — defaults to '/')
// GitHub Actions workflow sets it to '/flo/' automatically
const base = process.env.VITE_BASE_PATH ?? '/flo/';

export default defineConfig({
  base,
  plugins: [
    figmaAssetResolver(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
