import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bot, Plus, Pencil, Trash2, Loader2, Check, X, Power, PowerOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  system_prompt: string;
  model: string;
  is_active: boolean;
  keywords: string[] | null;
  created_at: string;
}

export default function AiAgents() {
  const { lang } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: agents = [], isLoading } = useQuery<AiAgent[]>({
    queryKey: ["/api/ai-agents"],
    queryFn: async () => {
      const res = await fetch("/api/ai-agents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load agents");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const res = await fetch(`/api/ai-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active }),
      });
      if (!res.ok) throw new Error("Failed to update agent");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai-agents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete agent");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
      toast({ title: lang === "pt" ? "Agente removido" : "Agent removed" });
    },
  });

  return (
    <Layout>
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" data-testid="text-ai-agents-title">
                {lang === "pt" ? "Agentes de IA" : "AI Agents"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {lang === "pt"
                  ? "Gerencie os agentes que respondem automaticamente no Telegram."
                  : "Manage agents that auto-reply on Telegram."}
              </p>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              size="sm"
              data-testid="button-create-agent"
            >
              <Plus className="w-4 h-4 mr-1" />
              {lang === "pt" ? "Novo Agente" : "New Agent"}
            </Button>
          </div>

          {showCreate && (
            <AgentForm
              lang={lang}
              onCancel={() => setShowCreate(false)}
              onSaved={() => {
                setShowCreate(false);
                queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
              }}
            />
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{lang === "pt" ? "Nenhum agente configurado." : "No agents configured."}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id}>
                  {editingId === agent.id ? (
                    <AgentForm
                      lang={lang}
                      agent={agent}
                      onCancel={() => setEditingId(null)}
                      onSaved={() => {
                        setEditingId(null);
                        queryClient.invalidateQueries({ queryKey: ["/api/ai-agents"] });
                      }}
                    />
                  ) : (
                    <div
                      className={cn(
                        "border rounded-lg p-4 transition-colors",
                        agent.is_active ? "bg-card" : "bg-muted/50 opacity-70"
                      )}
                      data-testid={`card-agent-${agent.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Bot className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-base">{agent.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-mono">{agent.slug}</span>
                            {agent.is_active ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                {lang === "pt" ? "Ativo" : "Active"}
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                {lang === "pt" ? "Inativo" : "Inactive"}
                              </span>
                            )}
                          </div>
                          {agent.description && (
                            <p className="text-sm text-muted-foreground mb-2">{agent.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p><span className="font-medium">{lang === "pt" ? "Modelo:" : "Model:"}</span> {agent.model}</p>
                            {agent.keywords && agent.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {agent.keywords.slice(0, 10).map((kw, i) => (
                                  <span key={i} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">{kw}</span>
                                ))}
                                {agent.keywords.length > 10 && (
                                  <span className="text-muted-foreground">+{agent.keywords.length - 10}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleMutation.mutate({ id: agent.id, is_active: !agent.is_active })}
                            title={agent.is_active ? "Desativar" : "Ativar"}
                            data-testid={`button-toggle-agent-${agent.id}`}
                          >
                            {agent.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingId(agent.id)}
                            data-testid={`button-edit-agent-${agent.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm(lang === "pt" ? "Remover este agente?" : "Remove this agent?")) {
                                deleteMutation.mutate(agent.id);
                              }
                            }}
                            data-testid={`button-delete-agent-${agent.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function AgentForm({
  agent,
  lang,
  onCancel,
  onSaved,
}: {
  agent?: AiAgent;
  lang: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(agent?.name || "");
  const [slug, setSlug] = useState(agent?.slug || "");
  const [description, setDescription] = useState(agent?.description || "");
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || "");
  const [model, setModel] = useState(agent?.model || "gpt-5.2");
  const [keywordsText, setKeywordsText] = useState(agent?.keywords?.join(", ") || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name || !slug || !systemPrompt) {
      toast({ title: lang === "pt" ? "Preencha nome, slug e instruções" : "Fill name, slug and instructions", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const keywords = keywordsText.split(",").map(k => k.trim()).filter(Boolean);
      const body = { name, slug, description, system_prompt: systemPrompt, model, keywords };
      const url = agent ? `/api/ai-agents/${agent.id}` : "/api/ai-agents";
      const method = agent ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed");
      }
      toast({ title: lang === "pt" ? "Agente salvo" : "Agent saved" });
      onSaved();
    } catch (err: any) {
      toast({ title: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {lang === "pt" ? "Nome" : "Name"}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            placeholder="Solara"
            data-testid="input-agent-name"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
            placeholder="solara"
            data-testid="input-agent-slug"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {lang === "pt" ? "Descrição" : "Description"}
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          data-testid="input-agent-description"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {lang === "pt" ? "Modelo" : "Model"}
        </label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          data-testid="select-agent-model"
        >
          <option value="gpt-5.2">GPT-5.2 (mais capaz)</option>
          <option value="gpt-5.1">GPT-5.1</option>
          <option value="gpt-5-mini">GPT-5 Mini (custo-benefício)</option>
          <option value="gpt-5-nano">GPT-5 Nano (mais rápido)</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {lang === "pt" ? "Palavras-chave (separadas por vírgula)" : "Keywords (comma-separated)"}
        </label>
        <input
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          className="w-full px-3 py-2 border rounded-md bg-background text-sm"
          placeholder="solar, painel, inversor, energia"
          data-testid="input-agent-keywords"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {lang === "pt" ? "Instruções do Agente (System Prompt)" : "Agent Instructions (System Prompt)"}
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full min-h-[200px] p-3 border rounded-md bg-background text-sm resize-y font-mono"
          data-testid="input-agent-prompt"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          {lang === "pt" ? "Cancelar" : "Cancel"}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving} data-testid="button-save-agent">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Check className="w-4 h-4 mr-1" />}
          {lang === "pt" ? "Salvar" : "Save"}
        </Button>
      </div>
    </div>
  );
}
