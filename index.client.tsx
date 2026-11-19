import type { PluginClientContext } from "@getpaseo/plugin/client";
import { MuPermissionItem } from "./client/perm-item";
import { contributeMuPermissions } from "./client/pill";

export default function contribute(client: PluginClientContext) {
  const releasePills = contributeMuPermissions(client);
  const releaseDraftItem = client.addComposerItem({
    id: "mu-permissions-draft",
    Component: MuPermissionItem,
  });
  return () => {
    releasePills();
    releaseDraftItem();
  };
}
