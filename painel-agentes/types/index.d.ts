export type Agente = { id: string; nome: string; tipo: string; estado: string; pai?: string }
export type Evento = { quando: string; tarefa: string; de: string; para: string; status: string; objetivo: string; tokens: number }
export type Atividade = { texto: string; feito: boolean }

declare module 'claude-code' {
  interface PluginState {
    'painel-agentes': { agentes: Agente[]; atividade: Record<string, Atividade>; eventos: Evento[]; pausa: { ativa: boolean }; hub: { online: boolean; pausado: boolean; agentes: any[]; eventos: string[] } }
  }
}
