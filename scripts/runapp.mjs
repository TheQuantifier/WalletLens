import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "-full";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const useShell = process.platform === "win32";

function run(args) {
  const result = spawnSync(npm, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: useShell,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runInstallAndAudit(label, installArgs, auditArgs) {
  console.log(`Installing ${label} dependencies...`);
  run(installArgs);
  console.log(`Auditing ${label} dependencies...`);
  run(auditArgs);
}

function runBuild() {
  console.log("Building frontend...");
  run(["run", "build"]);
}

switch (mode) {
  case "-full":
    runInstallAndAudit("frontend", ["install"], ["audit"]);
    runInstallAndAudit("API", ["--prefix", "api", "install"], ["--prefix", "api", "audit"]);
    runBuild();
    break;
  case "-quick":
    console.log("Skipping dependency install.");
    break;
  default:
    console.error("Usage: runapp [-full|-quick]");
    process.exit(1);
}

console.log("Starting app...");
run(["run", "dev:all"]);
