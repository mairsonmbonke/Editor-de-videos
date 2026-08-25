import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * O GitHub Pages publica projetos em `/<nome-do-repositório>/`, então o build
 * precisa desse prefixo nos caminhos dos arquivos. Em desenvolvimento a
 * aplicação continua na raiz. Se o repositório for renomeado, ajuste aqui.
 */
const BASE_PAGES = '/Editor-de-videos/'

export default defineConfig(({ command }) => ({
  base: command === 'build' ? BASE_PAGES : '/',
  plugins: [react()],
  server: { port: 5173, host: true },
}))
