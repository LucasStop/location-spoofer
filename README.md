# Location Spoofer

Ferramenta para simular localização GPS em dispositivos iOS (simulador ou iPhone físico via USB). Interface web com mapa interativo para selecionar coordenadas e aplicar no dispositivo.

## Arquitetura

```
┌─────────────────────┐       ┌─────────────────────┐       ┌──────────────┐
│  Frontend (Next.js) │──────>│ Bridge Server (Express)│────>│ iPhone / Sim │
│  localhost:3000      │ HTTP  │ localhost:3001        │ USB  │              │
└─────────────────────┘       └─────────────────────┘       └──────────────┘
```

- **Frontend** — Mapa interativo (Leaflet) para selecionar coordenadas, buscar endereços e gerenciar histórico
- **Bridge Server** — Recebe coordenadas via HTTP e executa comandos no dispositivo iOS
- **iPhone/Simulador** — Recebe a localização fake via `pymobiledevice3` (físico) ou `xcrun simctl` (simulador)

## Pré-requisitos

- **macOS** com Xcode instalado (necessário para as ferramentas de linha de comando)
- **Node.js** (v18+)
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

## Como Usar

### Modo Device (iPhone físico via USB)

Requer 3 terminais abertos simultaneamente:

**Terminal 1 — Iniciar o tunnel RSD:**

```bash
sudo pymobiledevice3 remote start-tunnel
```

Anote o `RSD Address` e `RSD Port` que aparecem no output, por exemplo:
```
RSD Address: fdaf:1b17:6dc1::1
RSD Port: 55190
```

**Terminal 2 — Montar Developer Disk Image e iniciar o server:**

```bash
# Montar o disk image (necessário uma vez por conexão)
pymobiledevice3 mounter auto-mount --rsd <RSD_ADDRESS> <RSD_PORT>

# Iniciar o bridge server
cd server
npm install
RSD_HOST=<RSD_ADDRESS> RSD_PORT=<RSD_PORT> npm start
```

Exemplo com os valores acima:
```bash
pymobiledevice3 mounter auto-mount --rsd fdaf:1b17:6dc1::1 55190
cd server
RSD_HOST=fdaf:1b17:6dc1::1 RSD_PORT=55190 npm start
```

**Terminal 3 — Iniciar o frontend:**

```bash
cd app
npm install
npm run dev
```

Acesse `http://localhost:3000` no navegador do **Mac** (não no iPhone).

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
curl http://localhost:3001/

# Verificar status do dispositivo
curl http://localhost:3001/status

# Definir localização (exemplo: Torre Eiffel, Paris)
curl -X POST http://localhost:3001/set-location \
  -H "Content-Type: application/json" \
  -d '{"lat": 48.8584, "lon": 2.2945}'

# Limpar localização simulada
curl -X POST http://localhost:3001/clear-location

# Ver último spoof aplicado
curl http://localhost:3001/last-spoof

# Atualizar RSD sem reiniciar o server (se o tunnel mudou)
curl -X POST http://localhost:3001/set-rsd \
  -H "Content-Type: application/json" \
  -d '{"host": "<NOVO_HOST>", "port": "<NOVA_PORTA>"}'
```

## Solução de Problemas

### "Unable to lookup in current state: Shutdown"

O simulador iOS está desligado. Ligue-o antes:
```bash
xcrun simctl boot <UDID>
```

### "Developer Mode is disabled"

O Modo Desenvolvedor não está ativado no iPhone. Siga os passos em [Ativando o Modo Desenvolvedor](#ativando-o-modo-desenvolvedor-no-iphone).

### "Failed to start service" / "No route to host"

O tunnel RSD expirou ou foi reiniciado. Os endereços RSD mudam a cada nova conexão:

1. Pare o tunnel antigo (Ctrl+C)
2. Reinicie: `sudo pymobiledevice3 remote start-tunnel`
3. Atualize o server com os novos valores:
   - Reiniciando: `RSD_HOST=<novo_host> RSD_PORT=<nova_porta> npm start`
   - Ou via API: `curl -X POST http://localhost:3001/set-rsd -H "Content-Type: application/json" -d '{"host":"<novo_host>","port":"<nova_porta>"}'`

### "DeveloperDiskImage already mounted"

Isso não é um erro — significa que o disk image já está montado. Pode prosseguir normalmente.

### O spoof retorna sucesso mas a localização não muda

- Certifique-se de que o **Developer Disk Image está montado**: `pymobiledevice3 mounter auto-mount --rsd <host> <porta>`
- No app de mapas do iPhone, toque no botão de localização para recentrar
- Tente spoofar para um local **bem diferente** da sua posição real para confirmar visualmente

### "Sem conexão com o bridge server" (no frontend)

O frontend não consegue se conectar ao bridge server. Verifique:
- O server está rodando (`npm start` no diretório `server/`)
- A URL em `app/.env.local` está como `NEXT_PUBLIC_BRIDGE_URL=http://localhost:3001`
- Ambos estão rodando na mesma máquina

### O tunnel RSD não inicia / TimeoutError

- Desconecte e reconecte o cabo USB
- No iPhone, se aparecer "Confiar neste computador?", toque em **Confiar**
- Tente novamente: `sudo pymobiledevice3 remote start-tunnel`

## Limitações

- **Requer um Mac conectado via USB** — não é possível spoofar sem um computador. O iOS não permite que apps modifiquem o GPS diretamente
- **O endereço RSD muda** a cada reconexão do tunnel — é necessário atualizar no server
- **O tunnel requer sudo** — pymobiledevice3 precisa de permissões de administrador para criar o tunnel

## Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Leaflet
- **Backend:** Node.js, Express
- **iOS:** pymobiledevice3 (device) / xcrun simctl (simulador)
