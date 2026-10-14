import { test, expect } from 'claude-code/testing'

test('o painel desenha o agente principal', async ($: any) => {
  const view = await $.ui.mount({
    plugin: 'painel-agentes',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'painel-agentes',
    props: { title: 'Agentes', isFocused: false, bodyColumns: 80 },
  })
  expect(view.surface).toBe('terminal')
})

test('pausar bloqueia ferramentas e continuar libera', async ($: any) => {
  await $.command.run({ command: 'pausar' })
  const r = await $.tool.call({ tool: 'Read', file_path: '/x' })
  expect(JSON.stringify(r)).toContain('PAUSA GERAL')
  await $.command.run({ command: 'continuar' })
})

test('evento entra no painel', async ($: any) => {
  const r = await $.tool.call({ tool: 'mcp__painel-agentes__evento', source_agent: 'arquiteto', target_agent: 'operador', status: 'HANDOFF_DISPATCH', objective: 'backup' })
  expect(JSON.stringify(r)).toContain('registrado')
})
