import { test, expect } from 'claude-code/testing'

test('abrir chama o PowerShell com o alvo', async ($: any, on: any) => {
  let visto = ''
  on('process.run', (_$: any, e: any) => {
    visto = JSON.stringify(e)
    return { value: { exitCode: 0, stdout: 'aberto: x', stderr: '' } }
  })
  const r = await $.tool.call({ tool: 'mcp__controlar-pc__abrir', alvo: 'https://chatgpt.com' })
  expect(JSON.stringify(r)).toContain('aberto')
  expect(visto).toContain('chatgpt.com')
})
