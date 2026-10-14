import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agente, Atividade } from '../types'

const PANE = 'painel-agentes'
const agentes = atom({ plugin: 'painel-agentes', key: 'agentes' } as const, [])
const atividade = atom({ plugin: 'painel-agentes', key: 'atividade' } as const, {})

const eventos = atom({ plugin: 'painel-agentes', key: 'eventos' } as const, [])
const pausa = atom({ plugin: 'painel-agentes', key: 'pausa' } as const, { ativa: false })

const MAIN = 'principal'
const MAX_EVENTOS = 30
const FERRAMENTA_EVENTO = 'mcp__painel-agentes__evento'
const ESTADOS_HUB = ['IDLE', 'THINKING', 'EXECUTING_TOOL', 'AWAITING_APPROVAL', 'ERROR', 'HANDOFF_DISPATCH', 'DONE']

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
    await $.command.register({ name: 'pausar', description: 'KILL-SWITCH: bloqueia todas as ferramentas dos agentes até /continuar' })
    await $.command.register({ name: 'continuar', description: 'Desfaz a pausa geral dos agentes' })
    await $.tool.register({
      name: 'evento',
      description: 'Registra no painel um pacote de evento entre agentes (handoff, status, erro).',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string' },
          source_agent: { type: 'string' },
          target_agent: { type: 'string' },
          status: { type: 'string', description: ESTADOS_HUB.join(', ') },
          objective: { type: 'string' },
          tokens: { type: 'number', description: 'Tokens acumulados da tarefa.' },
        },
        required: ['source_agent', 'status'],
      },
      isDeferred: false,
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

  on('command.run', { command: 'pausar' }, async $ => {
    await update($, pausa, () => ({ ativa: true }))
    return { text: 'PAUSA GERAL ligada: as ferramentas dos agentes estão bloqueadas. Use /continuar.' }
  })

  on('command.run', { command: 'continuar' }, async $ => {
    await update($, pausa, () => ({ ativa: false }))
    return { text: 'Pausa geral desligada.' }
  })

  on('tool.call', { tool: FERRAMENTA_EVENTO }, async ($, e) => {
    const a = e as unknown as Record<string, unknown>
    const pacote = {
      quando: new Date().toISOString().slice(11, 19),
      tarefa: String(a.task_id ?? ''),
      de: String(a.source_agent ?? ''),
      para: String(a.target_agent ?? ''),
      status: String(a.status ?? ''),
      objetivo: String(a.objective ?? '').slice(0, 60),
      tokens: Number(a.tokens ?? 0),
    }
    await update($, eventos, l => [...l, pacote].slice(-MAX_EVENTOS))
    return { result: `registrado: ${pacote.de} -> ${pacote.para || '-'} [${pacote.status}]` }
  })

  on('tool.call', async ($, e, next) => {
    const p = await read($, pausa)
    if (p.ativa) {
      return { result: 'PAUSA GERAL ativa (kill-switch). Nada executa até o Paulo usar /continuar.' }
    }
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
    const log = await read($, eventos)
    const parado = (await read($, pausa)).ativa
    const ativ = await read($, atividade)
    const linhas = Math.max(1, ((e.viewport?.rows ?? 24) - 4) >> 1)
    const todos = [
      { id: MAIN, nome: 'agente principal', tipo: 'principal', estado: 'running', pai: undefined } as Agente,
      ...lista,
    ].slice(-linhas)

    return (
      <Box flexDirection="column">
        {parado && <Text color="red" bold>PAUSA GERAL ATIVA (use /continuar)</Text>}
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
        {log.length > 0 && <Text bold>Handoffs e eventos</Text>}
        {log.slice(-5).map((v: any) => (
          <Text dimColor>
            {v.quando} {v.de}{v.para ? ` -> ${v.para}` : ''} [{v.status}] {v.objetivo}{v.tokens ? ` (${v.tokens} tok)` : ''}
          </Text>
        ))}
      </Box>
    )
  })
}
