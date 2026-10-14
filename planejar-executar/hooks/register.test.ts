import { test, expect } from 'claude-code/testing'

test('o prompt do sistema ganha a seção de planejar e delegar', { options: { executor: 'gemini' } }, async ($: any, on: any) => {
  on('prompt.compose', () => ({ sections: [] }))
  const r = await $.prompt.compose({
    model: 'm',
    promptModel: 'm',
    surfaces: [],
    tools: [],
    outputStyle: null,
    traits: [],
  })
  expect(JSON.stringify(r)).toContain('planejar-executar:executor-gemini')
})
