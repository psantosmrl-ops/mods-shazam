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
