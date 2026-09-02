import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * O GitHub Pages publica projetos em `/<nome-do-repositório>/`, então o build
 * precisa desse prefixo nos caminhos dos arquivos. Em desenvolvimento a
 * aplicação continua na raiz. Se o repositório for renomeado, ajuste aqui.
 */
const BASE_PAGES = '/Editor-de-videos/'

export default defineConfig(({ command, isPreview }) => ({
  // O `preview` serve o build, então precisa do mesmo prefixo dele.
  base: command === 'build' || isPreview ? BASE_PAGES : '/',
  // Duas páginas HTML de verdade, sem roteador: sem isso o `vite preview`
  // devolveria a index para qualquer endereço, diferente do GitHub Pages.
  appType: 'mpa',
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    // Duas páginas independentes: o editor de vídeo e o leitor em voz alta.
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        leitor: resolve(import.meta.dirname, 'leitor.html'),
      },
    },
  },
}))
