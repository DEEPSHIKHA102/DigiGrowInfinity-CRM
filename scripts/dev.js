import { execFile, spawn } from "node:child_process";

const isWindows = process.platform === "win32";
let stopping = false;

const commands = [
  ["server", "npm run server"],
  ["client", "npm run client"]
];

const children = commands.map(([name, command]) => {
  const child = spawn(command, {
    stdio: "inherit",
    shell: isWindows ? "cmd.exe" : true,
    windowsHide: true
  });

  child.on("exit", (code) => {
    if (!stopping && code !== 0) {
      console.error(`${name} exited with code ${code}`);
      stopAll();
      process.exit(code || 1);
    }
  });

  return child;
});

function stopAll() {
  stopping = true;
  for (const child of children) {
    stopChild(child);
  }
}

function stopChild(child) {
  if (child.killed) return;

  if (isWindows) {
    execFile("taskkill", ["/pid", String(child.pid), "/T", "/F"], () => {});
    return;
  }

  child.kill();
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
