export type Agente = { id: string; nome: string; tipo: string; estado: string; pai?: string }
export type Atividade = { texto: string; feito: boolean }

declare module 'claude-code' {
  interface PluginState {
    'painel-agentes': { agentes: Agente[]; atividade: Record<string, Atividade> }
  }
}
