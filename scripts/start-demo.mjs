import { spawn, spawnSync } from "node:child_process";

const whereCommand = process.platform === "win32" ? "where.exe" : "which";
const npmAvailable =
  spawnSync(whereCommand, ["npm"], { stdio: "ignore" }).status === 0;
const command = npmAvailable ? "npm" : "pnpm";
const args = npmAvailable
  ? ["run", "dev"]
  : ["dlx", "npm@latest", "run", "dev"];

const child =
  process.platform === "win32"
    ? spawn(
        process.env.ComSpec ?? "cmd.exe",
        ["/d", "/s", "/c", `${command} ${args.join(" ")}`],
        { stdio: "inherit" },
      )
    : spawn(command, args, { stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("error", (error) => {
  process.stderr.write(`Could not start the demo server: ${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 0 : (code ?? 1);
});
