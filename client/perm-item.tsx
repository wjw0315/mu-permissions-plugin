import type { PluginComposerItemProps } from "@getpaseo/plugin/client";
import { useComposer, useRpc } from "@getpaseo/plugin/client";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MODES, labelOf, permGetRpc, permSetRpc, type PermMode } from "../shared/perm";

/**
 * Draft composer (new agent, before the first message) has no agent yet, so a
 * composer pill cannot attach. This item covers that gap: it shows mu's default
 * permission mode and lets the user pick one before the conversation exists.
 */
export function MuPermissionItem({ theme }: PluginComposerItemProps) {
  const composer = useComposer();
  const getPerm = useRpc(permGetRpc);
  const setPerm = useRpc(permSetRpc);
  const [mode, setMode] = useState<PermMode | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    getPerm({})
      .then((result) => {
        if (alive) setMode(result.mode);
      })
      .catch(() => {
        // Keep the last known value; the pill still works.
      });
    return () => {
      alive = false;
    };
  }, [getPerm]);

  const provider = composer.agent.provider ?? "";
  const isMu = provider === "" || provider === "mu" || provider.startsWith("mu/");
  if (!isMu || composer.context !== "draft") return null;

  const colors = theme.colors;
  const current = mode ?? "judge";

  const choose = (next: PermMode): void => {
    setOpen(false);
    setMode(next);
    setPerm({ mode: next }).catch(() => {
      setMode(mode);
    });
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.foregroundMuted, fontSize: 12 }}>权限 · {labelOf(current)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {MODES.map((spec) => {
        const active = spec.id === current;
        return (
          <Pressable
            key={spec.id}
            onPress={() => choose(spec.id)}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: active ? colors.accent : colors.border,
              backgroundColor: active ? colors.surface1 : "transparent",
            }}
          >
            <Text style={{ color: active ? colors.foreground : colors.foregroundMuted, fontSize: 12 }}>
              {spec.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
