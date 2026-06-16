import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";

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
    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
    }
  });

  return child;
});

function stopAll() {
  for (const child of children) {
    child.kill();
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});
