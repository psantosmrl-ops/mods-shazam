import type { Register } from 'claude-code'

const SITES = {
  chatgpt: { nome: 'ChatGPT', url: 'https://chatgpt.com', login: 'login do Paulo', chat: 'uma conversa nova' },
  gemini: { nome: 'Gemini', url: 'https://gemini.google.com', login: 'login do Google do Paulo', chat: 'um chat novo' },
} as const

const prompt = (s: (typeof SITES)[keyof typeof SITES]) => `Você é o executor. Recebe UM passo já planejado pelo Claude e o executa no ${s.nome}, à mão, pelo navegador do PC:
1. Abra ${s.url} no navegador (use as ferramentas de navegador ou de controle do computador que tiver; se o ${s.nome} já estiver aberto, reaproveite a aba).
2. Se pedir login, pare e avise que precisa do ${s.login}. Nunca digite senha.
3. Abra ${s.chat}, cole o passo e o contexto recebidos, envie e espere a resposta terminar.
4. Copie a resposta inteira e devolva exatamente o texto do ${s.nome}, sem resumir nem comentar.
Se não houver ferramenta de navegador disponível, diga isso em uma linha e devolva o texto do passo pronto para colar.`

export const register: Register = (on, options) => {
  const escolha = String(options.executor ?? 'chatgpt')

  on('session.start', async ($, e, next) => {
    for (const [id, s] of Object.entries(SITES)) {
      await $.agent.register({
        name: `executor-${id}`,
        description: `Executa UM passo já planejado abrindo o ${s.nome} no navegador do PC e devolvendo a resposta dele. Passe o passo e o contexto completos no prompt.`,
        prompt: prompt(s),
        model: 'sonnet',
      })
    }
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    const quem =
      escolha === 'gemini'
        ? 'use sempre subagent_type "planejar-executar:executor-gemini"'
        : escolha === 'alternar'
          ? 'alterne um passo em cada: "planejar-executar:executor-chatgpt" e "planejar-executar:executor-gemini", começando pelo chatgpt'
          : 'use sempre subagent_type "planejar-executar:executor-chatgpt"'
    const text =
      'Modo planejar e delegar: você (Claude) planeja o trabalho em passos curtos e entrega a execução de cada passo ao executor pela ferramenta Agent, um passo por chamada, com o contexto necessário no prompt. Executor: ' +
      quem +
      '. Confira cada resposta antes de seguir para o próximo passo.'
    return { sections: [...r.sections, { id: 'planejar-executar:modo', text, scope: 'session' as const }] }
  })
}
