import { test, expect } from 'claude-code/testing'

test('anotar grava e ler_notas devolve', async ($: any, on: any) => {
  let guardado: unknown = []
  on('store.get', () => ({ value: guardado }))
  on('store.set', (_$: any, e: any) => {
    guardado = e.value
    return { value: undefined }
  })
  on('session.id', () => ({ value: 'abcdef123' }))
  on('clock.now', () => ({ value: 0 }))
  const a = await $.tool.call({ tool: 'mcp__memoria__anotar', texto: 'teste de nota' })
  expect(JSON.stringify(a)).toContain('gravada')
  const l = await $.tool.call({ tool: 'mcp__memoria__ler_notas' })
  expect(JSON.stringify(l)).toContain('teste de nota')
})
