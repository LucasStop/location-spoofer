const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// Log em arquivo além do console: server/logs/bridge.log
const LOG_DIR = path.join(__dirname, "logs");
fs.mkdirSync(LOG_DIR, { recursive: true });
const logStream = fs.createWriteStream(path.join(LOG_DIR, "bridge.log"), { flags: "a" });
for (const level of ["log", "error"]) {
  const orig = console[level].bind(console);
  console[level] = (...args) => {
    orig(...args);
    logStream.write(`${new Date().toISOString()} [${level}] ${args.join(" ")}\n`);
  };
}

const app = express();
const PORT = 3001;

// Modos: "simulator" ou "device"
const MODE = process.env.MODE || "device";
// Para descobrir o UDID do seu simulador: xcrun simctl list devices | grep Booted
const SIM_UDID =
  process.env.SIM_UDID || "A019A98F-0878-453A-90D4-7D4185AD9C9E";

// RSD tunnel info (iOS 17+)
// Obter com: sudo pymobiledevice3 remote start-tunnel
// Iniciar server com: RSD_HOST=<host> RSD_PORT=<porta> npm start
let rsdHost = process.env.RSD_HOST || null;
let rsdPort = process.env.RSD_PORT || null;

app.use(cors());
app.use(express.json());

// Bridge escuta em 0.0.0.0: sem token, qualquer um na rede muda a localização.
const TOKEN = process.env.BRIDGE_TOKEN;
app.use((req, res, next) => {
  if (!TOKEN || req.get("x-bridge-token") === TOKEN) return next();
  console.error(`[AUTH] 401 ${req.method} ${req.path} de ${req.ip}`);
  res.status(401).json({ error: "token inválido" });
});

let lastSpoof = null;

// O `simulate-location set` precisa continuar rodando: ao sair, o iPhone volta à localização real.
let holder = null;
function killHolder() {
  if (holder) {
    holder.kill();
    holder = null;
  }
}

// Sucesso = processo ainda vivo após STARTUP_MS; saiu antes = erro com stderr.
const STARTUP_MS = 4000;
function holdLocation(lat, lon) {
  killHolder();
  const args = ["developer", "dvt", "simulate-location", "set", "--rsd", rsdHost, rsdPort, "--", String(lat), String(lon)];
  console.log(`[HOLD] pymobiledevice3 ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn("pymobiledevice3", args);
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => {
      holder = child;
      resolve();
    }, STARTUP_MS);
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (holder === child) holder = null;
      console.log(`[HOLD] exit code=${code} stderr=${stderr.trim() || "(vazio)"}`);
      reject({ message: `simulate-location saiu com código ${code}`, stderr });
    });
  });
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`[CMD] ${cmd}`);
    exec(cmd, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ERROR] ${error.message}`);
        console.error(`[STDERR] ${stderr}`);
        return reject({ message: error.message, stderr });
      }
      console.log(`[OK] ${stdout || "(sem output)"}`);
      resolve(stdout);
    });
  });
}

function getSetCommand(lat, lon) {
  if (MODE === "simulator") {
    return `xcrun simctl location ${SIM_UDID} set ${lat},${lon}`;
  }
  return `pymobiledevice3 developer dvt simulate-location set --rsd ${rsdHost} ${rsdPort} -- ${lat} ${lon}`;
}

function getClearCommand() {
  if (MODE === "simulator") {
    return `xcrun simctl location ${SIM_UDID} clear`;
  }
  return `pymobiledevice3 developer dvt simulate-location clear --rsd ${rsdHost} ${rsdPort}`;
}

function getStatusCommand() {
  if (MODE === "simulator") {
    return `xcrun simctl list devices | grep ${SIM_UDID}`;
  }
  return "pymobiledevice3 usbmux list";
}

// Definir localização simulada
app.post("/set-location", async (req, res) => {
  const { lat, lon } = req.body;

  if (lat == null || lon == null) {
    return res.status(400).json({ error: "lat e lon são obrigatórios" });
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: "Coordenadas fora do range válido" });
  }

  if (MODE === "device" && (!rsdHost || !rsdPort)) {
    return res.status(500).json({
      error: "RSD não configurado. Inicie com: RSD_HOST=<host> RSD_PORT=<porta> npm start",
    });
  }

  try {
    let cmd, output = "";
    if (MODE === "device") {
      await holdLocation(lat, lon);
      cmd = "simulate-location set (processo mantido)";
    } else {
      cmd = getSetCommand(lat, lon);
      output = (await runCommand(cmd)).trim();
    }
    lastSpoof = { lat, lon, time: new Date().toISOString(), cmd };
    res.json({ success: true, lat, lon, mode: MODE, cmd, output });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stderr: err.stderr,
    });
  }
});

// Limpar localização simulada
app.post("/clear-location", async (_req, res) => {
  if (MODE === "device" && (!rsdHost || !rsdPort)) {
    return res.status(500).json({ error: "RSD não configurado" });
  }

  try {
    killHolder();
    const output = await runCommand(getClearCommand());
    res.json({ success: true, mode: MODE, output: output.trim() });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stderr: err.stderr,
    });
  }
});

// Status: verifica se há device/simulator ativo
app.get("/status", async (_req, res) => {
  try {
    const output = await runCommand(getStatusCommand());
    const connected =
      MODE === "simulator"
        ? output.includes("Booted")
        : output.includes("UniqueDeviceID");
    res.json({ connected, mode: MODE, output: output.trim() });
  } catch (err) {
    res.json({ connected: false, mode: MODE, error: err.message });
  }
});

// Atualizar RSD sem reiniciar o server
app.post("/set-rsd", (req, res) => {
  const { host, port } = req.body;
  if (!host || !port) {
    return res.status(400).json({ error: "host e port são obrigatórios" });
  }
  rsdHost = host;
  rsdPort = String(port);
  console.log(`[RSD] Atualizado para ${rsdHost}:${rsdPort}`);
  res.json({ success: true, host: rsdHost, port: rsdPort });
});

// Conferir último spoof aplicado
app.get("/last-spoof", (_req, res) => {
  res.json({ lastSpoof, mode: MODE });
});

app.get("/", (_req, res) => {
  res.json({ status: "Bridge server rodando", mode: MODE, port: PORT, rsdHost, rsdPort });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n=== Location Spoofer Bridge ===`);
  console.log(`Modo: ${MODE.toUpperCase()}`);
  if (MODE === "simulator") console.log(`Simulator UDID: ${SIM_UDID}`);
  if (MODE === "device") {
    if (rsdHost && rsdPort) {
      console.log(`RSD: ${rsdHost}:${rsdPort}`);
    } else {
      console.log(`⚠ RSD não configurado! Reinicie com: RSD_HOST=<host> RSD_PORT=<porta> npm start`);
    }
  }
  if (!TOKEN) console.log(`⚠ BRIDGE_TOKEN não definido: bridge aberto a toda a rede`);
  console.log(`Rodando em http://0.0.0.0:${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  POST /set-location   { lat, lon }`);
  console.log(`  POST /clear-location`);
  console.log(`  POST /set-rsd        { host, port }`);
  console.log(`  GET  /status`);
  console.log(`  GET  /last-spoof\n`);
});
