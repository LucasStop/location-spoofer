# Location Spoofer

Ferramenta para simular localização GPS em dispositivos iOS (simulador ou iPhone físico via USB). Interface web com mapa interativo para selecionar coordenadas e aplicar no dispositivo.

## Arquitetura

```
┌─────────────────────┐       ┌─────────────────────┐       ┌──────────────┐
│  Frontend (Next.js) │──────>│ Bridge Server (Express)│────>│ iPhone / Sim │
│  localhost:3010      │ HTTP  │ localhost:3011        │ USB  │              │
└─────────────────────┘       └─────────────────────┘       └──────────────┘
```

- **Frontend** — Mapa interativo (Leaflet) para selecionar coordenadas, buscar endereços e gerenciar histórico
- **Bridge Server** — Recebe coordenadas via HTTP e executa comandos no dispositivo iOS
- **iPhone/Simulador** — Recebe a localização fake via `pymobiledevice3` (físico) ou `xcrun simctl` (simulador)

## Pré-requisitos

- **macOS** com Xcode instalado (necessário para as ferramentas de linha de comando)
- **Node.js** (v20.12+, o bridge usa `process.loadEnvFile`)
- **Python 3** com `pymobiledevice3` (apenas para iPhone físico)
- **iPhone com Modo Desenvolvedor ativado** (apenas para iPhone físico)

### Instalando pymobiledevice3

```bash
pip3 install pymobiledevice3
```

### Ativando o Modo Desenvolvedor no iPhone

1. No iPhone, vá em **Ajustes > Privacidade e Segurança > Modo Desenvolvedor**
2. Ative o toggle
3. O iPhone vai reiniciar
4. Após reiniciar, confirme a ativação quando solicitado

### Descobrindo o UDID do iPhone

Cada iPhone tem o seu UDID, e o bridge precisa dele em `DEVICE_UDID` (`server/.env.local`). Com o iPhone conectado por USB, desbloqueado e pareado (toque em **Confiar**):

```bash
pymobiledevice3 usbmux list      # funciona em Linux, macOS e Windows: copie o campo "Identifier"
```

Alternativas:
- **Linux**: `idevice_id -l` (pacote `libimobiledevice-utils`).
- **macOS**: Finder > selecione o iPhone > clique na linha de informações (modelo/número de série) até aparecer o UDID, ou `system_profiler SPUSBDataType | grep -A8 iPhone`.
- **Windows**: app Apple Devices ou iTunes, mesmo truque do Finder.

O UDID identifica o aparelho, não é uma senha, mas fica só no `server/.env.local`, que o `.gitignore` já ignora.

## Como Usar

### Modo Device (iPhone físico via USB)

Requer 3 terminais abertos simultaneamente. O bridge lê o túnel do **tunneld**, então o endereço RSD pode mudar sem reiniciar nada.

**Terminal 1 — tunneld (sudo):**

```bash
sudo pymobiledevice3 remote tunneld
```

Verifique com `curl -s http://127.0.0.1:49151`: deve listar o UDID do iPhone.

**Terminal 2 — bridge server:**

```bash
pymobiledevice3 usbmux list        # campo "Identifier" = UDID (veja "Descobrindo o UDID do iPhone")
echo "DEVICE_UDID=<seu_udid>" > server/.env.local
cd server
npm install
npm start
```

**Terminal 3 — Iniciar o frontend:**

```bash
cd app
npm install
npm run dev
```

Acesse `http://localhost:3010` no navegador do **Mac** (não no iPhone).

### Modo Simulator (iOS Simulator)

**Terminal 1 — Iniciar o simulador e o server:**

```bash
# Listar simuladores disponíveis
xcrun simctl list devices available

# Iniciar um simulador (exemplo)
xcrun simctl boot <UDID>

# Iniciar o bridge server
cd server
npm install
MODE=simulator SIM_UDID=<UDID> npm start
```

**Terminal 2 — Iniciar o frontend:**

```bash
cd app
npm install
npm run dev
```

### Testando via curl (sem frontend)

```bash
# Verificar se o server está rodando
curl http://localhost:3011/

# Verificar status do dispositivo
curl http://localhost:3011/status

# Definir localização (exemplo: Torre Eiffel, Paris)
curl -X POST http://localhost:3011/set-location \
  -H "Content-Type: application/json" \
  -d '{"lat": 48.8584, "lon": 2.2945}'

# Limpar localização simulada
curl -X POST http://localhost:3011/clear-location

# Ver último spoof aplicado
curl http://localhost:3011/last-spoof

```

## Roteiro para Linux (Ubuntu/Debian, iPhone físico via USB)

Testado em Ubuntu 24.04 com iPhone 16 Pro (iOS 27.2). O bridge lê o túnel do **tunneld** (mesmo fluxo do macOS acima).

### 1. Dependências do sistema (uma vez)

```bash
sudo apt install -y python3-venv python3-pip libimobiledevice-utils usbmuxd
python3 -m venv ~/.venvs/pmd3
~/.venvs/pmd3/bin/pip install pymobiledevice3
```

Node.js v18+ também é necessário. O `pymobiledevice3` fica no venv, então o bridge precisa dele no `PATH` (passo 4).

### 2. Preparar o iPhone (uma vez)

1. Ative o **Modo Desenvolvedor** (Ajustes > Privacidade e Segurança) e deixe o iPhone reiniciar.
2. Conecte o cabo USB, desbloqueie o iPhone e toque em **Confiar** (digite a senha).
3. Confirme o pareamento: `idevicepair pair && idevicepair validate`. Se vier "user denied the trust dialog", reconecte o cabo ou use Ajustes > Geral > Transferir ou Redefinir > Redefinir Localização e Privacidade, e repita.
4. Pegue o UDID (detalhes em [Descobrindo o UDID do iPhone](#descobrindo-o-udid-do-iphone)):
   ```bash
   ~/.venvs/pmd3/bin/pymobiledevice3 usbmux list      # campo "Identifier" = UDID
   ```
   O Developer Disk Image já vinha montado no iOS 27.2. Se o spoof falhar por isso, monte com `pymobiledevice3 mounter auto-mount --tunnel <UDID>` (comando não testado aqui).

### 3. Subir o tunneld (precisa de sudo, deixe aberto)

```bash
sudo ~/.venvs/pmd3/bin/pymobiledevice3 remote tunneld
```

Verifique: `curl -s http://127.0.0.1:49151` deve listar o UDID do iPhone. Se vier `{}`, o aparelho está bloqueado ou desconectado.

### 4. Subir bridge e frontend

```bash
# bridge: o UDID vem de server/.env.local (gitignored); sem ele o bridge não sobe
echo "DEVICE_UDID=<SEU_UDID>" >> server/.env.local
cd server && npm install
PATH=$HOME/.venvs/pmd3/bin:$PATH npm start

# frontend (outro terminal)
cd app && npm install && npm run dev
```

Abra `http://localhost:3010`. Para produção use `npm run build && npx next start -p 3010`: o `next start` sozinho sobe na porta 3000 e exige build prévio.

### 5. Testar sem o frontend

```bash
curl -X POST localhost:3011/set-location -H "Content-Type: application/json" -d '{"lat": -25.4515, "lon": -49.2538}'
curl localhost:3011/last-spoof
curl -X POST localhost:3011/clear-location     # volta ao GPS real
```

`success: true` só confirma que o comando foi aceito. Confira no Mapas do iPhone (toque no botão de localização). O `simulate-location set` precisa continuar vivo: se o bridge ou o tunneld cair, o iPhone volta à posição real.

### 6. Espelhar a tela do iPhone (opcional)

```bash
sudo apt install -y uxplay gstreamer1.0-plugins-bad gstreamer1.0-plugins-good gstreamer1.0-libav gstreamer1.0-gl gstreamer1.0-x
# se usar ufw, libere só a sua LAN (ajuste a faixa):
sudo ufw allow from 192.168.18.0/24 to any port 7000:7100 proto tcp
sudo ufw allow from 192.168.18.0/24 to any port 6000:7011 proto udp
uxplay -n iPhone -nh -p
```

No iPhone (mesma rede Wi-Fi do PC): Central de Controle > Espelhar Tela > **iPhone**. O `-p` fixa as portas para o firewall.

### Variáveis e arquivos

| Item | Onde | Observação |
|---|---|---|
| `DEVICE_UDID` | `server/.env.local` | UDID do seu iPhone (obrigatório; também aceita variável de ambiente). Requer Node 20.12+ |
| `BRIDGE_TOKEN` | `server/.env.local` | opcional, mas sem ele o bridge (0.0.0.0) aceita qualquer um na rede |
| `NEXT_PUBLIC_BRIDGE_URL` / `NEXT_PUBLIC_BRIDGE_TOKEN` | `app/.env.local` | o arquivo vai em `app/`, não em `app/src/app/`; reinicie o `npm run dev` depois de editar |

### Problemas comuns no Linux

- **`pymobiledevice3: not found` no `/status`**: o bridge foi iniciado sem o venv no `PATH` (passo 4).
- **Bridge sai com "DEVICE_UDID não definido"**: crie `server/.env.local` (passo 4).
- **`[HOLD] <udid> ausente no tunneld`**: o tunneld não está rodando ou não enxerga o aparelho (passo 3).
- **`remote start-tunnel` falha com "No tunnel services discovered"**: use o `tunneld` em vez de `start-tunnel`.
- **UxPlay: "videoparsersbad not found"**: falta `gstreamer1.0-plugins-bad`; depois rode `rm -rf ~/.cache/gstreamer-1.0`.
- **iPhone não vê o UxPlay / não conecta**: firewall bloqueando as portas do passo 6.

## Rodar em segundo plano (launchd + Vercel)

Para usar o site da Vercel sem iniciar nada à mão, o Mac sobe três peças sozinho:

1. **tunneld** (daemon de sistema): `sudo cp server/launchd/com.locationspoofer.tunneld.plist /Library/LaunchDaemons/` e `sudo launchctl bootstrap system /Library/LaunchDaemons/com.locationspoofer.tunneld.plist`.
2. **bridge** (LaunchAgent): `sh server/launchd/install-bridge.sh`. O launchd não lê `~/Downloads`, então o script copia o bridge para `~/Library/Application Support/location-spoofer-bridge` e grava o token de `NEXT_PUBLIC_BRIDGE_TOKEN` (`app/.env.local`). Reexecute após mudar `server/index.js` ou o token.
3. **Tailscale serve**: `tailscale serve --bg --https=443 http://localhost:3011`. Expõe o bridge só na tailnet (nunca `funnel`).

Na Vercel, `NEXT_PUBLIC_BRIDGE_URL` aponta para a URL `*.ts.net` do serve e `NEXT_PUBLIC_BRIDGE_TOKEN` tem o mesmo token do bridge. O aparelho que abre o site precisa estar com o Tailscale ligado.

`server/launchd/tunneld_tailscale.py` roda o tunneld com o IP do iPhone no Tailscale como host fixo (`TUNNELD_EXTRA_HOSTS`), para o túnel funcionar fora da LAN.

## Solução de Problemas

### "Unable to lookup in current state: Shutdown"

O simulador iOS está desligado. Ligue-o antes:
```bash
xcrun simctl boot <UDID>
```

### "Developer Mode is disabled"

O Modo Desenvolvedor não está ativado no iPhone. Siga os passos em [Ativando o Modo Desenvolvedor](#ativando-o-modo-desenvolvedor-no-iphone).

### "Failed to start service" / "No route to host"

O túnel caiu (cabo desconectado, iPhone bloqueado por muito tempo). Reinicie o `tunneld` (`sudo pymobiledevice3 remote tunneld`); o bridge reencontra o aparelho sozinho, sem reiniciar.

### "DeveloperDiskImage already mounted"

Isso não é um erro — significa que o disk image já está montado. Pode prosseguir normalmente.

### O spoof retorna sucesso mas a localização não muda

- Certifique-se de que o **Developer Disk Image está montado**: `pymobiledevice3 mounter auto-mount --rsd <host> <porta>`
- No app de mapas do iPhone, toque no botão de localização para recentrar
- Tente spoofar para um local **bem diferente** da sua posição real para confirmar visualmente

### "Sem conexão com o bridge server" (no frontend)

O frontend não consegue se conectar ao bridge server. Verifique:
- O server está rodando (`npm start` no diretório `server/`)
- A URL em `app/.env.local` está como `NEXT_PUBLIC_BRIDGE_URL=http://localhost:3011`
- Ambos estão rodando na mesma máquina

### O tunneld não inicia / TimeoutError

- Desconecte e reconecte o cabo USB
- No iPhone, se aparecer "Confiar neste computador?", toque em **Confiar**
- Tente novamente: `sudo pymobiledevice3 remote tunneld`

## Limitações

- **Requer um Mac conectado via USB** — não é possível spoofar sem um computador. O iOS não permite que apps modifiquem o GPS diretamente
- **O tunneld requer sudo** — pymobiledevice3 precisa de permissões de administrador para criar o tunnel

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Leaflet
- **Backend:** Node.js, Express
- **iOS:** pymobiledevice3 (device) / xcrun simctl (simulador)
