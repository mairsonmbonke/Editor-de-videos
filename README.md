# Cortex — Editor de Vídeo com Corte Automático de Silêncio

Aplicação web de edição de vídeo que roda inteiramente no navegador. A função
principal é **detectar automaticamente os trechos de silêncio de um vídeo e
removê-los todos de uma vez**, cortando boa parte do tempo gasto na edição.

Nenhum arquivo é enviado para servidor: o vídeo é lido do disco, analisado com a
Web Audio API e exportado localmente.

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
```

Outros comandos:

```bash
npm run build     # verificação de tipos + build de produção em dist/
npm run preview   # serve o build de produção
npm test          # testes das funções de detecção e do modelo de blocos
```

## Fluxo de uso

1. **Login** — sessão local de demonstração; qualquer e-mail válido entra.
2. **Upload** — um ou vários vídeos, por clique ou arrastando para a barra lateral.
3. **Análise automática** — o áudio é decodificado e os silêncios aparecem
   destacados na linha do tempo, com waveform.
4. **Revisão** — o painel da direita lista cada trecho encontrado; dá para pular
   até ele, ignorá-lo ou removê-lo individualmente.
5. **Corte em massa** — *Remover todos os silêncios* aplica todos os cortes.
6. **Exportação** — resumo com duração original, duração final, silêncio
   removido e tamanho estimado; o arquivo sai em MP4.

## Interface

| Região | Conteúdo |
| --- | --- |
| Barra lateral esquerda | Arquivos de mídia, com duração, tamanho e nº de silêncios |
| Centro | Player grande e controles de reprodução |
| Direita | Ajustes da detecção, resumo do resultado e lista de trechos |
| Inferior | Linha do tempo com waveform, playhead e blocos destacados |

Verde = vídeo · laranja hachurado = silêncio · amarelo = silêncio marcado para
manter · cinza riscado = trecho removido (ainda restaurável).

### Atalhos

| Tecla | Ação |
| --- | --- |
| `espaço` | Reproduzir / pausar |
| `←` / `→` | Voltar / avançar 5 s (com `Shift`, 1 s) |
| `Home` / `End` | Início / fim |
| `S` | Dividir o bloco no playhead |
| `Delete` | Excluir o bloco selecionado |
| `M` | Mutar o bloco selecionado |
| `+` / `-` | Zoom da linha do tempo (ou `Ctrl` + roda do mouse) |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Desfazer / refazer |

## Detecção de silêncio

O áudio é reduzido a janelas de 10 ms; de cada janela saem o pico (waveform) e o
RMS em dBFS (detecção). Um trecho vira silêncio quando fica abaixo do volume
mínimo por pelo menos a duração mínima configurada. Ruídos isolados de até
120 ms não interrompem um silêncio, e a margem configurada encolhe o corte nas
duas pontas para não comer a respiração no início e no fim da fala.

Quatro controles, mais três predefinições (Conservador / Equilibrado / Agressivo):

| Controle | Efeito |
| --- | --- |
| Sensibilidade | Atalho de 0 a 100 % para o volume mínimo (−70 dB a −15 dB) |
| Volume mínimo | Limiar em dBFS abaixo do qual o áudio conta como silêncio |
| Duração mínima | Pausas mais curtas que isso são mantidas |
| Margem do corte | Sobra preservada antes e depois de cada corte |

Mudar qualquer ajuste refaz a análise e entra no histórico — dá para desfazer.

## Modelo de edição

A linha do tempo é uma lista ordenada de **blocos**, cada um apontando para um
intervalo do vídeo de origem. Cortar nunca altera o arquivo original: remover um
trecho apenas desliga o bloco correspondente, que continua visível na linha do
tempo para ser restaurado depois. Dividir, excluir, mutar e reordenar operam
sobre essa mesma lista, e cada operação vira uma entrada no histórico de
desfazer/refazer (limitado a 100 passos por vídeo).

## Exportação

A exportação usa `MediaRecorder` sobre um canvas alimentado pelo player, com o
áudio roteado por um grafo da Web Audio API (é assim que os blocos mutados saem
sem som). A gravação é **pausada entre um bloco e outro**, então os trechos
removidos não deixam buraco nem congelam a imagem no arquivo final.

Consequências práticas:

- A exportação roda **em tempo real**: um vídeo final de 4 minutos leva cerca de
  4 minutos. A aba precisa ficar aberta e em primeiro plano.
- O formato preferido é MP4 (H.264/AAC). Em navegadores que não gravam MP4, o
  arquivo sai em WebM e a interface avisa antes de começar.

## Estrutura

```
src/
  lib/
    audio.ts       decodificação do áudio, picos e RMS por janela
    silence.ts     detecção de silêncio e conversão sensibilidade ⇄ dB
    clips.ts       modelo de blocos: layout, divisão, resumo, durações
    export.ts      gravação do vídeo final e download
    format.ts      formatação de tempo, duração e tamanho em pt-BR
  state/
    editorReducer.ts   estado do editor com histórico por vídeo
    usePlayback.ts     reprodução que pula os trechos removidos
  components/        Login, Editor, MediaSidebar, Transport, Timeline,
                     Waveform, Inspector, ExportDialog, Toasts, icons
test/                testes das funções puras (node:test, sem dependências)
```

## Publicação

O app é totalmente estático — não tem servidor, banco nem chave de API —, então
o GitHub Pages dá conta dele.

A publicação é automática: a cada push na `main`, o workflow
`.github/workflows/deploy.yml` roda o build e publica o `dist/`. Dá para
republicar sob demanda pela aba **Actions → Publicar no GitHub Pages → Run
workflow**.

**Antes da primeira publicação**, é preciso ativar o Pages uma vez, à mão, em
**Settings → Pages → Source: GitHub Actions**. Esse passo não dá para
automatizar: ativar o Pages exige um token com permissão de administração, que
o `GITHUB_TOKEN` do workflow não tem. Enquanto não for ativado, o job falha
logo no passo "Conferir a configuração do Pages", com a mensagem apontando para
essa configuração.

Feito isso, o endereço é:

```
https://mairsonmbonke.github.io/Editor-de-videos/
```

O caminho `/Editor-de-videos/` é o nome do repositório, e o `vite.config.ts`
usa esse prefixo no build (em desenvolvimento a aplicação segue na raiz). Se o
repositório for renomeado, ajuste a constante `BASE_PAGES`.

Como tudo roda no navegador do visitante, publicar não expõe nada: os vídeos
continuam sem sair da máquina de quem usa.

## Compatibilidade

Chrome e Edge recentes cobrem tudo, incluindo a exportação em MP4. Safari 17+ e
Firefox reproduzem e editam normalmente; a exportação pode sair em WebM
dependendo da versão. Os formatos de entrada aceitos são os que o próprio
navegador consegue decodificar (MP4/H.264, WebM, MOV).
