import type { Register } from 'claude-code'

type Nota = { texto: string; quando: string; janela: string }

const CHAVE = 'notas'
const MAX = 60

const linhas = (notas: Nota[]) =>
  notas.map(n => `- [${n.quando.slice(0, 16)} | ${n.janela}] ${n.texto}`).join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'anotar',
      description:
        'Grava uma nota na memória compartilhada. Todas as outras janelas do Claude Code deste PC passam a ver a nota. Use para decisões, fatos do projeto e o que outra janela precisa saber.',
      inputSchema: {
        type: 'object',
        properties: { texto: { type: 'string', description: 'A nota, curta e autocontida.' } },
        required: ['texto'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'ler_notas',
      description: 'Lê as notas mais recentes da memória compartilhada entre janelas.',
      isDeferred: false,
    })
    await $.command.register({
      name: 'memoria',
      description: 'Mostra as notas da memória compartilhada entre as janelas',
    })
    return next(e)
  })

  on('tool.call', { tool: 'mcp__memoria__anotar' }, async ($, e) => {
    const texto = String((e as unknown as { texto?: string }).texto ?? '').trim()
    if (!texto) return { deny: 'memoria: nota vazia.' }
    const lista = ((await $.store.get(CHAVE)) as Nota[] | undefined) ?? []
    const janela = (await $.session.id()).slice(0, 6)
    const nota: Nota = { texto, quando: new Date(await $.clock.now()).toISOString(), janela }
    await $.store.set(CHAVE, [...lista, nota].slice(-MAX))
    return { result: 'Nota gravada. As outras janelas a verão.', text: 'Nota gravada. As outras janelas a verão.' } as never
  })

  on('tool.call', { tool: 'mcp__memoria__ler_notas' }, async $ => {
    const lista = ((await $.store.get(CHAVE)) as Nota[] | undefined) ?? []
    const t = lista.length ? linhas(lista) : 'Nenhuma nota ainda.'
    return { result: t, text: t } as never
  })

  on('command.run', { command: 'memoria' }, async $ => {
    const lista = ((await $.store.get(CHAVE)) as Nota[] | undefined) ?? []
    return { text: lista.length ? linhas(lista) : 'Nenhuma nota ainda.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const lista = ((await $.store.get(CHAVE)) as Nota[] | undefined) ?? []
    if (!lista.length) return r
    const text =
      'Memória compartilhada entre as janelas do Claude Code deste PC (notas de outras janelas). ' +
      'Use como contexto. Para avisar as outras janelas de algo importante, chame mcp__memoria__anotar.\n' +
      linhas(lista.slice(-30))
    return { sections: [...r.sections, { id: 'memoria:notas', text, scope: 'session' as const }] }
  })
}
