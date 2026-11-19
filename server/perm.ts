import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { PermMode } from "../shared/perm";

/**
 * mu stores the default permission mode in `<agentDir>/mu/permissions.json`.
 * Reading/writing that file is exactly what `/permissions <mode>` does, so a
 * new conversation starts on the mode picked here.
 */
const FILE = join(homedir(), ".mu", "agent", "mu", "permissions.json");

function parse(value: unknown): PermMode | undefined {
  return value === "full" || value === "judge" || value === "ask" ? value : undefined;
}

export function readMode(): PermMode {
  try {
    const parsed: unknown = JSON.parse(readFileSync(FILE, "utf8"));
    if (parsed && typeof parsed === "object" && "mode" in parsed) {
      return parse((parsed as { mode: unknown }).mode) ?? "judge";
    }
  } catch {
    // No file yet: mu's own default is judge.
  }
  return "judge";
}

export function writeMode(mode: PermMode): PermMode {
  mkdirSync(dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ version: 1, mode }, null, "\t")}\n`, { mode: 0o600 });
  renameSync(temp, FILE);
  return mode;
}
