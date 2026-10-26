// MI-FORK: `npm run release` = tauri build con el toolchain de rustup en el PATH.
// En esta máquina los proxies de ~/.cargo/bin son symlinks y tauri no encuentra cargo.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const toolchain = join(homedir(), ".rustup", "toolchains", "stable-x86_64-pc-windows-msvc", "bin");
const env = { ...process.env };
if (existsSync(toolchain)) env.Path = `${toolchain};${env.Path ?? env.PATH ?? ""}`;

const result = spawnSync("npm run tauri build", { stdio: "inherit", shell: true, env });
process.exit(result.status ?? 1);
