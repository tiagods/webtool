// Garante que a porta de dev (3000) esteja livre antes de subir o Next.js.
// Se ja houver um processo escutando nela, avisa e mata o processo antigo.
const { execSync } = require("node:child_process");

const PORT = process.argv[2] || "3000";

function findPidsWindows(port) {
  let output;
  try {
    output = execSync(`netstat -ano -p tcp`, { encoding: "utf8" });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of output.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;
    const [proto, localAddr, , state, pid] = parts;
    if (!/^TCP$/i.test(proto)) continue;
    if (state && state.toUpperCase() !== "LISTENING") continue;
    if (!localAddr.endsWith(`:${port}`)) continue;
    if (pid && pid !== "0") pids.add(pid);
  }
  return [...pids];
}

function findPidsUnix(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: "utf8" });
    return output.split("\n").map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const isWindows = process.platform === "win32";
const pids = isWindows ? findPidsWindows(PORT) : findPidsUnix(PORT);

if (pids.length === 0) {
  process.exit(0);
}

console.warn(
  `\n[free-port] Porta ${PORT} ja esta em uso (PID${pids.length > 1 ? "s" : ""}: ${pids.join(", ")}). Encerrando processo anterior para manter o dev sempre na porta ${PORT}...\n`
);

for (const pid of pids) {
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
  } catch {
    console.warn(`[free-port] Nao foi possivel encerrar o PID ${pid}. Pode ser necessario finaliza-lo manualmente.`);
  }
}
