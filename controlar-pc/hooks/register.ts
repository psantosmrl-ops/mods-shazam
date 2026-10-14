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

async function rodar($: any, nome: string, env: Record<string, string>): Promise<string> {
  const r = await $.process.run(
    ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', SCRIPTS[nome]],
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
    await t('captura_tela', 'Tira uma foto da tela inteira e devolve o caminho do PNG; leia o arquivo com a ferramenta Read para ver a tela.')
    return next(e)
  })

  const ligar = (nome: string, rotulo: string, env: (a: Args) => Record<string, string>) => {
    on('tool.call', { tool: `mcp__controlar-pc__${nome}` }, async ($, e) => {
      const texto = await rodar($, rotulo, env(e as unknown as Args))
      return { result: texto }
    })
  }

  ligar('abrir', 'abrir', a => ({ PC_A: s(a.alvo) }))
  ligar('janelas', 'janelas', () => ({}))
  ligar('listar_pasta', 'listar', a => ({ PC_A: s(a.caminho) }))
  ligar('mouse', 'mouse', a => ({ PC_X: s(a.x), PC_Y: s(a.y), PC_ACAO: s(a.acao) }))
  ligar('digitar', 'digitar', a => ({ PC_A: s(a.texto) }))
  ligar('tecla', 'tecla', a => ({ PC_A: s(a.teclas) }))
  ligar('ler_area_transferencia', 'ler_area_transferencia', () => ({}))
  ligar('captura_tela', 'captura_tela', () => ({}))
}
