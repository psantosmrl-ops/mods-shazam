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

test('shell bloqueia comando destrutivo sem confirmação', async ($: any, on: any) => {
  let rodou = false
  on('process.run', () => {
    rodou = true
    return { value: { exitCode: 0, stdout: 'x', stderr: '' } }
  })
  const r = await $.tool.call({ tool: 'mcp__controlar-pc__shell', comando: 'Remove-Item C:\\dados -Recurse' })
  expect(JSON.stringify(r)).toContain('BLOQUEADO')
  expect(rodou).toBe(false)
})

test('shell roda comando comum', async ($: any, on: any) => {
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'olá', stderr: '' } }))
  const r = await $.tool.call({ tool: 'mcp__controlar-pc__shell', comando: 'Get-Date' })
  expect(JSON.stringify(r)).toContain('olá')
})
