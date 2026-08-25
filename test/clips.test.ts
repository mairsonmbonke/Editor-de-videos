import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clipsFromSilences,
  layout,
  makeClip,
  moveClip,
  outputDuration,
  removedDuration,
  resolveTimelineTime,
  singleClip,
  splitClip,
  summarize,
  timelineDuration,
} from '../src/lib/clips.ts'
import type { Clip } from '../src/types.ts'

function build(): Clip[] {
  return clipsFromSilences(14, [
    { start: 2, end: 5 },
    { start: 7, end: 11 },
  ])
}

test('alterna blocos de fala e silêncio cobrindo o vídeo inteiro', () => {
  const clips = build()
  assert.equal(clips.length, 5)
  assert.deepEqual(
    clips.map((clip) => clip.isSilence),
    [false, true, false, true, false],
  )
  assert.ok(Math.abs(timelineDuration(clips) - 14) < 0.001)
})

test('vídeo sem silêncio vira um único bloco', () => {
  assert.equal(clipsFromSilences(10, []).length, 1)
  assert.equal(singleClip(10)[0].end, 10)
})

test('remover os silêncios encurta o vídeo final e nada mais', () => {
  const clips = build().map((clip) => (clip.isSilence ? { ...clip, enabled: false } : clip))
  assert.ok(Math.abs(outputDuration(clips) - 7) < 0.001)
  assert.ok(Math.abs(removedDuration(clips) - 7) < 0.001)
  assert.ok(Math.abs(timelineDuration(clips) - 14) < 0.001)
})

test('o resumo separa o que dá para cortar do que já foi cortado', () => {
  const clips = build()
  const inicial = summarize(clips)
  assert.equal(inicial.count, 2)
  assert.equal(inicial.removableCount, 2)
  assert.equal(inicial.removedCount, 0)
  assert.ok(Math.abs(inicial.removableDuration - 7) < 0.001)

  const comIgnorado = clips.map((clip, index) => (index === 1 ? { ...clip, kept: true } : clip))
  const depois = summarize(comIgnorado)
  assert.equal(depois.count, 2)
  assert.equal(depois.removableCount, 1, 'trecho ignorado não conta para o corte em massa')
  assert.ok(Math.abs(depois.removableDuration - 4) < 0.001)
})

test('dividir um bloco preserva a duração total', () => {
  const clips = singleClip(10)
  const dividido = splitClip(clips, 0, 4)
  assert.ok(dividido)
  assert.equal(dividido!.length, 2)
  assert.equal(dividido![0].end, 4)
  assert.equal(dividido![1].start, 4)
  assert.ok(Math.abs(timelineDuration(dividido!) - 10) < 0.001)
})

test('divisão colada na borda é recusada', () => {
  const clips = singleClip(10)
  assert.equal(splitClip(clips, 0, 0.01), null)
  assert.equal(splitClip(clips, 0, 9.99), null)
  assert.equal(splitClip(clips, 9, 5), null)
})

test('mover um bloco reordena sem perder nada', () => {
  const clips = [makeClip(0, 1, false), makeClip(1, 2, false), makeClip(2, 3, false)]
  const movido = moveClip(clips, 0, 2)
  assert.ok(movido)
  assert.deepEqual(
    movido!.map((clip) => clip.id),
    [clips[1].id, clips[2].id, clips[0].id],
  )
  assert.equal(moveClip(clips, 0, -1), null, 'não sai pela esquerda')
  assert.equal(moveClip(clips, 2, 1), null, 'não sai pela direita')
})

test('a posição da linha do tempo aponta para o tempo certo do vídeo original', () => {
  const clips = build()
  const meioDoTerceiro = resolveTimelineTime(clips, 6)
  assert.equal(meioDoTerceiro?.index, 2)
  assert.ok(Math.abs((meioDoTerceiro?.sourceTime ?? 0) - 6) < 0.001)

  // Reordenado, a mesma posição na tela cai em outro ponto do vídeo original.
  const reordenado = moveClip(clips, 4, -4)!
  const inicio = resolveTimelineTime(reordenado, 0.5)
  assert.equal(inicio?.index, 0)
  assert.ok(Math.abs((inicio?.sourceTime ?? 0) - 11.5) < 0.001)
})

test('o layout empilha os blocos sem buracos', () => {
  const entries = layout(build())
  for (let i = 1; i < entries.length; i += 1) {
    const anterior = entries[i - 1]
    assert.ok(Math.abs(entries[i].offset - (anterior.offset + anterior.duration)) < 0.001)
  }
})
