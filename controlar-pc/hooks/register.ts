import type { Register } from 'claude-code'

type Args = Record<string, unknown>

const DPI = `Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class D { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'; [void][D]::SetProcessDPIAware();`

const MOUSE = `${DPI}
Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class M { [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y); [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, uint d, int e); }'
[void][M]::SetCursorPos([int]$env:PC_X, [int]$env:PC_Y)
$a = $env:PC_ACAO
function Click($down, $up) { [M]::mouse_event($down,0,0,0,0); [M]::mouse_event($up,0,0,0,0) }
if ($a -eq 'clique' -or $a -eq 'duplo') { Click 2 4 }
if ($a -eq 'duplo') { Start-Sleep -Milliseconds 80; Click 2 4 }
if ($a -eq 'direito') { Click 8 16 }
"ok: $a em $($env:PC_X),$($env:PC_Y)"`

const SCRIPTS: Record<string, string> = {
  abrir: `Start-Process -FilePath $env:PC_A; "aberto: $($env:PC_A)"`,
  janelas: `Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Name, MainWindowTitle | Format-Table -AutoSize | Out-String -Width 200`,
  listar: `Get-ChildItem -Force -LiteralPath $env:PC_A | Select-Object Mode, Length, LastWriteTime, Name | Format-Table -AutoSize | Out-String -Width 200`,
  mouse: MOUSE,
  digitar: `Add-Type -AssemblyName System.Windows.Forms; Set-Clipboard -Value $env:PC_A; Start-Sleep -Milliseconds 100; [System.Windows.Forms.SendKeys]::SendWait('^v'); "digitado (colado)"`,
  tecla: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait($env:PC_A); "tecla enviada: $($env:PC_A)"`,
  ler_area_transferencia: `Get-Clipboard -Raw`,
  shell: `Invoke-Expression $env:PC_A 2>&1 | Out-String -Width 200`,
  ler_arquivo: `$c = Get-Content -Raw -LiteralPath $env:PC_A; if ($c.Length -gt 20000) { $c.Substring(0, 20000) + "\n[cortado em 20000 caracteres]" } else { $c }`,
  escrever_arquivo: `Set-Content -LiteralPath $env:PC_A -Value $env:PC_B -Encoding UTF8; "gravado: $($env:PC_A)"`,
  parar: `New-Item -ItemType File -Force -Path (Join-Path $env:TEMP 'controlar-pc.PARAR') | Out-Null; "PARADO: nenhuma ferramenta executa até chamar retomar"`,
  retomar: `Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $env:TEMP 'controlar-pc.PARAR'); "retomado"`,
  captura_tela: `${DPI}
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$b = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Left, $b.Top, 0, 0, $bmp.Size)
$p = Join-Path $env:TEMP ("captura-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".png")
$bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
"$p (tela $($b.Width)x$($b.Height))"`,
}

const ZONA_SEGURA = /^c:[\\/]workspace([\\/]|$)/i
const PERIGOSO = [
  /\bformat(-volume)?\b/i,
  /\bdiskpart\b/i,
  /\bremove-item\b.*-recurse/i,
  /\b(rm|del|rmdir|rd|erase)\b.*(\/s|-r\b|-recurse)/i,
  /\breg(\.exe)?\s+(delete|add)\b/i,
  /\b(set|remove)-itemproperty\b.*hk(lm|cu)/i,
  /\bshutdown\b|\brestart-computer\b|\bstop-computer\b/i,
  /\b(bcdedit|cipher\s+\/w|vssadmin|net\s+user|netsh\s+advfirewall)\b/i,
  /\bset-executionpolicy\b|\bdisable-windowsoptionalfeature\b/i,
  /\b(invoke-webrequest|iwr|curl|wget)\b.*\|\s*(iex|invoke-expression)/i,
  /c:\\windows|c:\\program files|system32/i,
]

// Devolve um aviso se o comando exige confirmação explícita; null se pode rodar.
function exigeConfirmacao(cmd: string, confirmado: boolean): string | null {
  if (confirmado) return null
  const hit = PERIGOSO.find(r => r.test(cmd))
  return hit ? `BLOQUEADO até confirmação: comando destrutivo ou de sistema. Mostre ao Paulo e repita com confirmado=true se ele autorizar: ${cmd}` : null
}

function foraDaZonaSegura(caminho: string, confirmado: boolean): string | null {
  if (confirmado || ZONA_SEGURA.test(caminho)) return null
  return `BLOQUEADO até confirmação: escrita fora de C:\\WORKSPACE (${caminho}). Peça autorização ao Paulo e repita com confirmado=true.`
}

async function rodar($: any, nome: string, env: Record<string, string>): Promise<string> {
  const guarda = `if ((Test-Path (Join-Path $env:TEMP 'controlar-pc.PARAR')) -and '${nome}' -ne 'retomar') { Write-Output 'PARADO pelo kill-switch. Chame retomar.'; exit 0 }\n`
  const r = await $.process.run(
    ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', guarda + SCRIPTS[nome]],
    { env, timeoutMs: 30000 },
  )
  const saida = String(r.stdout ?? '').trim()
  const erro = String(r.stderr ?? '').trim()
  return r.exitCode === 0 ? saida || 'ok' : `erro (${r.exitCode}): ${erro || saida}`
}

const s = (v: unknown) => String(v ?? '')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const t = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
      $.tool.register({ name, description, inputSchema: { type: 'object', properties, required }, isDeferred: false })
    await t('abrir', 'Abre um programa, pasta, arquivo ou site (URL) no Windows, com o aplicativo padrão.', { alvo: { type: 'string', description: 'Caminho, nome do programa ou URL.' } }, ['alvo'])
    await t('janelas', 'Lista as janelas abertas (programa e título).')
    await t('listar_pasta', 'Lista o conteúdo de uma pasta.', { caminho: { type: 'string' } }, ['caminho'])
    await t('mouse', 'Move o mouse para (x, y) em pixels da tela e opcionalmente clica. Use captura_tela antes para saber onde clicar.', { x: { type: 'number' }, y: { type: 'number' }, acao: { type: 'string', enum: ['mover', 'clique', 'duplo', 'direito'] } }, ['x', 'y', 'acao'])
    await t('digitar', 'Digita um texto onde o foco está (cola pelo teclado; sobrescreve a área de transferência).', { texto: { type: 'string' } }, ['texto'])
    await t('tecla', 'Envia teclas no formato SendKeys: ^c = Ctrl+C, %{F4} = Alt+F4, {ENTER}, {TAB}, ^{ESC}.', { teclas: { type: 'string' } }, ['teclas'])
    await t('ler_area_transferencia', 'Lê o texto atual da área de transferência (use depois de Ctrl+A e Ctrl+C para copiar o texto de uma tela).')
    const conf = { confirmado: { type: 'boolean', description: 'true só depois do Paulo autorizar uma ação destrutiva ou fora de C:\\WORKSPACE.' } }
    await t('shell', 'PRIMEIRA ESCOLHA: roda um comando PowerShell e devolve a saída. Prefira isto a mouse e teclado. Comandos destrutivos ou de sistema pedem confirmado=true.', { comando: { type: 'string' }, ...conf }, ['comando'])
    await t('ler_arquivo', 'Lê um arquivo de texto (até 20000 caracteres).', { caminho: { type: 'string' } }, ['caminho'])
    await t('escrever_arquivo', 'Grava um arquivo de texto. Fora de C:\\WORKSPACE exige confirmado=true.', { caminho: { type: 'string' }, conteudo: { type: 'string' }, ...conf }, ['caminho', 'conteudo'])
    await t('parar', 'KILL-SWITCH: bloqueia todas as ferramentas do controlar-pc até chamar retomar.')
    await t('retomar', 'Desfaz o kill-switch.')
    await t('captura_tela', 'Tira uma foto da tela inteira e devolve o caminho do PNG; leia o arquivo com a ferramenta Read para ver a tela.')
    return next(e)
  })

  const ligar = (nome: string, rotulo: string, env: (a: Args) => Record<string, string>) => {
    on('tool.call', { tool: `mcp__controlar-pc__${nome}` }, async ($, e) => {
      const texto = await rodar($, rotulo, env(e as unknown as Args))
      return { result: texto }
    })
  }

  const barrar = (nome: string, rotulo: string, aviso: (a: Args) => string | null, env: (a: Args) => Record<string, string>) => {
    on('tool.call', { tool: `mcp__controlar-pc__${nome}` }, async ($, e) => {
      const a = e as unknown as Args
      const bloqueio = aviso(a)
      if (bloqueio) return { result: bloqueio }
      return { result: await rodar($, rotulo, env(a)) }
    })
  }

  barrar('shell', 'shell', a => exigeConfirmacao(s(a.comando), a.confirmado === true), a => ({ PC_A: s(a.comando) }))
  barrar('escrever_arquivo', 'escrever_arquivo', a => foraDaZonaSegura(s(a.caminho), a.confirmado === true), a => ({ PC_A: s(a.caminho), PC_B: s(a.conteudo) }))
  ligar('ler_arquivo', 'ler_arquivo', a => ({ PC_A: s(a.caminho) }))
  ligar('parar', 'parar', () => ({}))
  ligar('retomar', 'retomar', () => ({}))
  ligar('abrir', 'abrir', a => ({ PC_A: s(a.alvo) }))
  ligar('janelas', 'janelas', () => ({}))
  ligar('listar_pasta', 'listar', a => ({ PC_A: s(a.caminho) }))
  ligar('mouse', 'mouse', a => ({ PC_X: s(a.x), PC_Y: s(a.y), PC_ACAO: s(a.acao) }))
  ligar('digitar', 'digitar', a => ({ PC_A: s(a.texto) }))
  ligar('tecla', 'tecla', a => ({ PC_A: s(a.teclas) }))
  ligar('ler_area_transferencia', 'ler_area_transferencia', () => ({}))
  ligar('captura_tela', 'captura_tela', () => ({}))
}
