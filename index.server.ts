import type { PluginServerContext } from "@getpaseo/plugin/server";
import { permGetRpc, permSetRpc } from "./shared/perm";
import { readMode, writeMode } from "./server/perm";

export default function contribute(server: PluginServerContext) {
  server.handle(permGetRpc, async () => ({ mode: readMode() }));
  server.handle(permSetRpc, async ({ mode }) => ({ mode: writeMode(mode) }));
  return () => {};
}
