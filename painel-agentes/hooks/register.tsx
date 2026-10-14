import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agente, Atividade } from '../types'

const PANE = 'painel-agentes'
const agentes = atom({ plugin: 'painel-agentes', key: 'agentes' } as const, [])
const atividade = atom({ plugin: 'painel-agentes', key: 'atividade' } as const, {})

const MAIN = 'principal'

const resumo = (e: Record<string, unknown>): string => {
  const campo = ['command', 'file_path', 'pattern', 'url', 'query', 'description', 'prompt'].find(
    k => typeof e[k] === 'string',
  )
  const txt = campo ? String(e[campo]).replace(/\s+/g, ' ') : ''
  return `${String(e.tool)} ${txt}`.trim().slice(0, 80)
}

const ESTADO: Record<string, string> = {
  pending: 'esperando',
  running: 'rodando',
  waiting: 'esperando',
  idle: 'parado',
  completed: 'concluído',
  failed: 'falhou',
  killed: 'parado',
}

async function atualizar($: any) {
  const lista = await $.agent.list()
  const novos: Agente[] = lista.map((a: any) => ({
    id: a.id,
    nome: a.name ?? a.description ?? a.id,
    tipo: a.type,
    estado: a.status,
    pai: a.parentId,
  }))
  await update($, agentes, () => novos)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'agentes',
      description: 'Abre o painel que mostra o que os agentes estão fazendo',
    })
    void $.ui.open({ id: PANE, title: 'Agentes' })
    $.clock.every(1500, () => {
      void atualizar($).catch(() => {})
    })
    return next(e)
  })

  on('command.run', { command: 'agentes' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agentes' })
    return { text: 'Painel de agentes aberto.' }
  })

  on('tool.call', async ($, e, next) => {
    const quem = e.agentId ?? MAIN
    const texto = resumo(e as unknown as Record<string, unknown>)
    await update($, atividade, m => ({ ...m, [quem]: { texto, feito: false } as Atividade }))
    void atualizar($).catch(() => {})
    const ran = await next(e)
    await update($, atividade, m => ({ ...m, [quem]: { texto, feito: true } as Atividade }))
    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const lista = await read($, agentes)
    const ativ = await read($, atividade)
    const linhas = Math.max(1, ((e.viewport?.rows ?? 24) - 4) >> 1)
    const todos = [
      { id: MAIN, nome: 'agente principal', tipo: 'principal', estado: 'running', pai: undefined } as Agente,
      ...lista,
    ].slice(-linhas)

    return (
      <Box flexDirection="column">
        {todos.map(a => {
          const at = ativ[a.id]
          const fim = ['completed', 'failed', 'killed'].includes(a.estado)
          const agora = at && !at.feito ? at.texto : at ? `última: ${at.texto}` : '...'
          return (
            <Box flexDirection="column">
              <Text dimColor={fim}>
                {a.pai ? '  ' : ''}[{ESTADO[a.estado] ?? a.estado}] {a.nome} ({a.tipo})
              </Text>
              <Text dimColor>{a.pai ? '    ' : '  '}{fim ? 'fim' : agora}</Text>
            </Box>
          )
        })}
        {lista.length === 0 && <Text dimColor>Nenhum subagente ainda.</Text>}
      </Box>
    )
  })
}
