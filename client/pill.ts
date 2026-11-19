import type {
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";

// The plugin typechecks without the DOM library; declare the two globals used here.
declare const AbortController: new () => {
  readonly signal: { readonly aborted: boolean };
  abort(): void;
};
declare const console: { error(...args: unknown[]): void };

type MuMode = "full" | "judge" | "ask";

interface ModeSpec {
  id: MuMode;
  label: string;
  hint: string;
  icon: string;
}

const MODES: readonly ModeSpec[] = [
  {
    id: "full",
    label: "完全访问",
    hint: "所有工具直接执行，不再询问",
    icon: "ShieldOff",
  },
  {
    id: "judge",
    label: "判定模式",
    hint: "读与项目内编辑放行，命令/项目外交由 judge 判断",
    icon: "ShieldCheck",
  },
  {
    id: "ask",
    label: "最小权限",
    hint: "只放行读，编辑与命令都要你确认",
    icon: "ShieldAlert",
  },
];

const MODE_BY_ID = new Map(MODES.map((mode) => [mode.id, mode]));

interface AgentRef {
  id: string;
  workspaceId: string;
  provider: string;
}

interface AgentInfo {
  id: string;
  workspaceId: string | null;
  provider?: string;
  config?: { provider?: string };
}

interface AgentList {
  subscription: {
    subscribe(handlers: {
      snapshot(state: { entries: Array<{ agent: AgentInfo }> }): void;
      update(message: {
        type: string;
        payload: { kind: string; agentId?: string; agent?: AgentInfo };
      }): void;
    }): void;
  };
}

/** The provider id Paseo reports for mu agents ("mu" or "mu/<model>"). */
function providerOf(agent: AgentInfo): string {
  return agent.provider ?? agent.config?.provider ?? "";
}

function isMu(agent: AgentInfo): boolean {
  const provider = providerOf(agent);
  return provider === "mu" || provider.startsWith("mu/");
}

function labelFor(mode: MuMode | undefined): string {
  return mode ? `权限 · ${MODE_BY_ID.get(mode)?.label ?? mode}` : "权限";
}

export function contributeMuPermissions(client: PluginClientContext): () => void {
  const pills = new Map<string, PluginButtonRegistration>();
  const agents = new Map<string, AgentRef>();
  const currentModes = new Map<string, MuMode>();
  const lifetime = new AbortController();

  const sendMode = async (agentId: string, mode: MuMode): Promise<void> => {
    // mu's own /permissions command switches the conversation immediately.
    // A human-path send (no agent envelope) is what pi executes as a command.
    await client.paseo.agents.ref(agentId).send(`/permissions ${mode}`);
    currentModes.set(agentId, mode);
    pills.get(agentId)?.update({
      label: labelFor(mode),
      title: `mu 权限模式：${MODE_BY_ID.get(mode)?.label}`,
    });
  };

  const remove = (agentId: string): void => {
    pills.get(agentId)?.remove();
    pills.delete(agentId);
    agents.delete(agentId);
    currentModes.delete(agentId);
  };

  const register = (agent: AgentRef): void => {
    if (lifetime.signal.aborted) return;
    if (!agent.workspaceId) return;
    const known = agents.get(agent.id);
    if (known && known.workspaceId === agent.workspaceId && pills.has(agent.id)) return;
    agents.set(agent.id, agent);
    pills.get(agent.id)?.remove();

    const mode = currentModes.get(agent.id);
    const registration = client.addComposerPill({
      id: "mu-permissions-pill",
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      button: {
        title: "mu 权限模式",
        icon: "Shield",
        label: labelFor(mode),
        behavior: {
          kind: "menu",
          items: MODES.map((spec) => ({
            kind: "item" as const,
            id: spec.id,
            title: `${spec.label} — ${spec.hint}`,
            icon: spec.icon,
            behavior: {
              kind: "action" as const,
              onPress: () => sendMode(agent.id, spec.id),
            },
          })),
        },
      },
    });
    pills.set(agent.id, registration);
  };

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal })
    .then((result: unknown) => {
      const { subscription } = result as AgentList;
      subscription.subscribe({
        snapshot: ({ entries }) => {
          const seen = new Set<string>();
          for (const entry of entries) {
            const agent = entry.agent;
            if (!agent.workspaceId || !isMu(agent)) continue;
            seen.add(agent.id);
            register({
              id: agent.id,
              workspaceId: agent.workspaceId,
              provider: providerOf(agent),
            });
          }
          for (const agentId of [...pills.keys()]) {
            if (!seen.has(agentId)) remove(agentId);
          }
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const { kind, agent, agentId } = message.payload;
          if (kind === "upsert" && agent) {
            if (!agent.workspaceId || !isMu(agent)) {
              if (agentId) remove(agentId);
              return;
            }
            register({
              id: agent.id,
              workspaceId: agent.workspaceId,
              provider: providerOf(agent),
            });
            return;
          }
          if (agentId) remove(agentId);
        },
      });
      return undefined;
    })
    .catch((error: unknown) => {
      if (!lifetime.signal.aborted) console.error("mu-permissions: agent list failed", error);
    });

  return () => {
    lifetime.abort();
    for (const agentId of [...pills.keys()]) remove(agentId);
    agents.clear();
    currentModes.clear();
  };
}
