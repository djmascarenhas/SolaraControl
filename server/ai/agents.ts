export interface AgentDefinition {
  slug: string;
  role: "orchestrator" | "pv_support" | "bess_specialist" | "general";
  description: string;
  active: boolean;
}

export const AGENTS: Record<string, AgentDefinition> = {
  kuaray: {
    slug: "kuaray",
    role: "orchestrator",
    description: "Orquestrador central que analisa intenção e roteia para especialistas",
    active: true,
  },
  solara: {
    slug: "solara",
    role: "pv_support",
    description: "Especialista em energia solar fotovoltaica, automações e sistemas de energia renovável",
    active: true,
  },
  bess_architect: {
    slug: "bess_architect",
    role: "bess_specialist",
    description: "Especialista em Battery Energy Storage Systems (BESS), dimensionamento e engenharia",
    active: true,
  },
};

export function getAgentDefinition(slug: string): AgentDefinition | undefined {
  return AGENTS[slug];
}

export function getActiveAgents(): AgentDefinition[] {
  return Object.values(AGENTS).filter(a => a.active);
}

export function getSpecialistAgents(): AgentDefinition[] {
  return Object.values(AGENTS).filter(a => a.active && a.role !== "orchestrator");
}
