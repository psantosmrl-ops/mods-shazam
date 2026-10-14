# Operador de PC: arquitetura

Desenho do Paulo para o Claude operar o PC com segurança. O mod `controlar-pc` implementa a parte que cabe dentro de um mod; o resto está marcado como "serviço separado".

## Três níveis de execução (do mais seguro ao menos seguro)

1. **Linha de comando e scripts** (primeira escolha): PowerShell, arquivos, programas. Rápido, previsível, sem depender da tela.
2. **Navegador por automação (Playwright)**: abre páginas, clica por seletor, lê o texto. Mais estável que clicar em pixels.
3. **Interface visual (último recurso)**: captura de tela, mouse e teclado. Só quando os níveis 1 e 2 não resolvem.

## Ferramentas

| Ferramenta | Nível | No mod hoje |
|---|---|---|
| shell (PowerShell) | 1 | sim |
| ler_arquivo / escrever_arquivo | 1 | sim |
| listar_pasta, abrir, janelas | 1 | sim |
| parar / retomar (kill-switch) | guarda | sim |
| navegador (Playwright) | 2 | não: serviço separado |
| captura_tela, mouse, tecla, digitar, ler_area_transferencia | 3 | sim |
| Computer Use da Anthropic (visão + ação em loop) | 3 | não: serviço separado |

## Laço ação e observação

Planejar um passo, executar, observar o resultado (saída do comando ou captura de tela), decidir o próximo. Nunca encadear vários passos às cegas.

## Guarda-corpos

- **Lista de bloqueio**: format, diskpart, remoção recursiva, registro, desligar o PC, firewall, usuários, ExecutionPolicy, baixar e executar (`| iex`), pastas do Windows e Program Files. Esses comandos só rodam com `confirmado=true`, e o Claude só passa isso depois do Paulo autorizar no chat.
- **Zona segura**: escrever arquivos livremente só em `C:\WORKSPACE`. Fora dela exige `confirmado=true`.
- **Kill-switch**: `parar` cria um arquivo de trava; todas as ferramentas recusam até `retomar`.
- **Ações destrutivas sempre confirmadas** com o Paulo antes de executar.

## Planos

- **A**: Computer Use da Anthropic num serviço próprio (visão + mouse + teclado, em loop). Mais geral, mais lento e mais caro.
- **B**: servidor MCP próprio ("Operador de PC") com shell, arquivos, tela, mouse, teclado e os guarda-corpos acima. É o que o mod `controlar-pc` cobre, menos Playwright e o kill-switch por atalho de teclado.
- **C**: só scripts e CLI (nível 1), sem GUI. O mod já faz isso com `shell` e `ler_arquivo`.

## O que fica de fora do mod (precisa de serviço separado)

- Playwright (nível 2): precisa de Node ou Python rodando no PC.
- Kill-switch por atalho global (ex.: Ctrl+Alt+Pause): precisa de um processo residente.
- Computer Use (plano A): precisa de um agente com a API da Anthropic.
- Servidor MCP em Python (FastMCP): um programa à parte, fora do Claude Code.
