import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

async function isLocalApiRunning() {
  try {
    const response = await fetch("http://localhost:4000/health", {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const processes = [
  {
    name: "web",
    command: npmCommand,
    args: ["run", "dev:web"],
  },
];

if (await isLocalApiRunning()) {
  console.log("[api] Reusing existing API at http://localhost:4000");
} else {
  processes.unshift({
    name: "api",
    command: npmCommand,
    args: ["--prefix", "api", "run", "dev"],
  });
}

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      NO_COLOR: "1",
      TERM: "dumb",
    },
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
      return;
    }
    if (code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      shutdown(code || 1);
    }
  });

  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
