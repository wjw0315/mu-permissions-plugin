import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const permModeSchema = z.enum(["full", "judge", "ask"]);
export type PermMode = z.infer<typeof permModeSchema>;

export interface ModeSpec {
  id: PermMode;
  label: string;
  hint: string;
}

/** mu's own three permission modes, as mu names them. */
export const MODES: readonly ModeSpec[] = [
  { id: "full", label: "完全访问", hint: "所有工具直接执行，不再询问" },
  { id: "judge", label: "判定模式", hint: "读与项目内编辑放行，命令/项目外交给 judge 判断" },
  { id: "ask", label: "最小权限", hint: "只放行读，编辑与命令都要你确认" },
];

export function labelOf(mode: PermMode): string {
  return MODES.find((spec) => spec.id === mode)?.label ?? mode;
}

/** Read/write mu's persisted default mode (`~/.mu/agent/mu/permissions.json`). */
export const permGetRpc = defineRpc({
  name: "mu-permissions.get",
  input: z.object({}),
  output: z.object({ mode: permModeSchema }),
});

export const permSetRpc = defineRpc({
  name: "mu-permissions.set",
  input: z.object({ mode: permModeSchema }),
  output: z.object({ mode: permModeSchema }),
});
