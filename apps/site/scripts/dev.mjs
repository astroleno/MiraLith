#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";

const DEFAULT_PORT = 3000;
const MAX_PORT = 3099;

function readRequestedPort() {
  const portFromEnv = Number.parseInt(process.env.PORT ?? "", 10);
  if (Number.isInteger(portFromEnv) && portFromEnv > 0) {
    return portFromEnv;
  }

  const portFlagIndex = process.argv.findIndex((arg) => arg === "-p" || arg === "--port");
  if (portFlagIndex >= 0) {
    const portFromFlag = Number.parseInt(process.argv[portFlagIndex + 1] ?? "", 10);
    if (Number.isInteger(portFromFlag) && portFromFlag > 0) {
      return portFromFlag;
    }
  }

  return DEFAULT_PORT;
}

async function readRunningDevServer() {
  try {
    const lockPath = path.join(process.cwd(), ".next", "dev", "lock");
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    const pid = Number(lock.pid);

    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }

    process.kill(pid, 0);
    return lock;
  } catch {
    return null;
  }
}

function isPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopRunningDevServer(pid) {
  // Try graceful shutdown first so Next.js can cleanup lock and artifacts.
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error?.code === "ESRCH") {
      return;
    }

    throw error;
  }

  const gracefulWaitMs = 5000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < gracefulWaitMs) {
    if (!isPidAlive(pid)) {
      return;
    }

    await sleep(100);
  }

  // Fallback to SIGKILL if process does not exit in time.
  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error?.code !== "ESRCH") {
      throw error;
    }
  }
}

function tryListen(port, host, ipv6Only) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (error) => {
      resolve(error.code !== "EADDRINUSE" && error.code !== "EACCES");
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen({ port, host, ipv6Only });
  });
}

async function isPortAvailable(port) {
  const ipv4Available = await tryListen(port, "0.0.0.0");
  if (!ipv4Available) {
    return false;
  }

  return tryListen(port, "::", false);
}

async function findOpenPort(startPort) {
  for (let port = startPort; port <= MAX_PORT; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found in ${startPort}-${MAX_PORT}.`);
}

const requestedPort = readRequestedPort();
const runningDevServer = await readRunningDevServer();

if (runningDevServer) {
  console.log(
    `[dev] Next dev is already running at ${runningDevServer.appUrl ?? `http://localhost:${runningDevServer.port}`} (PID ${runningDevServer.pid}).`
  );
  console.log("[dev] Restart mode enabled: stopping existing Next dev server...");

  try {
    await stopRunningDevServer(Number(runningDevServer.pid));
    console.log("[dev] Existing Next dev server stopped.");
  } catch (error) {
    console.error(`[dev] Failed to stop existing Next dev server: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const port = await findOpenPort(requestedPort);

if (port !== requestedPort) {
  console.log(`[dev] Port ${requestedPort} is busy; using ${port}.`);
} else {
  console.log(`[dev] Using port ${port}.`);
}

const child = spawn("pnpm", ["exec", "next", "dev", "-p", String(port)], {
  env: {
    ...process.env,
    PORT: String(port)
  },
  shell: process.platform === "win32",
  stdio: "inherit"
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
