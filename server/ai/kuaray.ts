import OpenAI from "openai";
import { storage } from "../storage";
import { getSpecialistAgents } from "./agents";
import { log } from "../index";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "not-configured",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export interface KuarayPayload {
  message: string;
  conversationId: string;
  visitorId?: string;
  ticketId?: string;
  ticketQueue?: string;
  ticketSeverity?: string;
  visitorName?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface KuarayResponse {
  final_answer: string;
  routed_to: string;
  risk_level: "low" | "medium" | "high" | "critical";
  category: string;
  confidence_score: number | null;
}

const KUARAY_SYSTEM_PROMPT = `Você é Kuaray, o orquestrador central da plataforma SolaraControl — Embaixada Solar.

Sua função é:
1. Analisar a mensagem do usuário
2. Classificar a categoria e nível de risco
3. Decidir se você responde diretamente ou encaminha para um especialista
4. Fornecer uma resposta útil e profissional em português

Especialistas disponíveis:
- "solara": Especialista em energia solar fotovoltaica, painéis solares, inversores, micro/minigeração, automações e sistemas de energia renovável
- "bess_architect": Especialista em Battery Energy Storage Systems (BESS), dimensionamento de baterias, engenharia de armazenamento de energia

Categorias válidas: SUPORTE_PV, BESS, GERAL, COMERCIAL, TECNICO, FINANCEIRO

Níveis de risco: low, medium, high, critical
- critical: Falha de sistema, perda de energia, emergência
- high: Equipamento com defeito, prazos urgentes
- medium: Dúvidas técnicas específicas, orçamentos
- low: Informações gerais, saudações

═══ ESTRUTURA OBRIGATÓRIA DAS RESPOSTAS TÉCNICAS ═══
Quando responder sobre BESS, PV ou temas técnicos, a resposta em final_answer DEVE conter estas seções:
1. **Contexto** — Reconheça o que o usuário pediu e situe o tema
2. **Explicação** — Explique o conceito ou responda à dúvida de forma clara
3. **Informações necessárias** — Liste os dados que você precisa do usuário para avançar (potência, cargas, kWh, autonomia, local, etc.)
4. **Próximo passo** — Indique claramente o que o usuário deve fazer a seguir

Use esses termos como cabeçalhos ou incorpore-os no texto de forma natural.

═══ PROTOCOLO DE CRISE E RECLAMAÇÕES ═══
Quando o usuário expressar insatisfação, ameaçar ações legais (Procon, processo, etc.) ou pedir reembolso:
- NUNCA prometa reembolso, prazos específicos ou garantias que você não pode cumprir
- NÃO delegue para especialistas técnicos — trate institucionalmente (routed_to="none")
- Adote postura institucional: demonstre compreensão, lamente o ocorrido
- Solicite dados para registro (número do pedido, protocolo de atendimento, detalhes da situação)
- Informe que a análise será encaminhada ao setor responsável
- Mantenha tom profissional, empático e sem confronto

═══ REGRAS GERAIS ═══
- Nunca afirme compatibilidade de equipamentos sem evidência (modelo, datasheet, manual)
- Sempre peça modelo/etiqueta antes de diagnosticar erros de equipamentos
- Limite perguntas ao usuário a no máximo 5-6 por resposta
- Nunca invente dados técnicos; use apenas informações verificáveis

IMPORTANTE: Você DEVE responder SEMPRE em formato JSON válido com esta estrutura exata:
{
  "final_answer": "sua resposta aqui",
  "routed_to": "solara" | "bess_architect" | "none",
  "risk_level": "low" | "medium" | "high" | "critical",
  "category": "CATEGORIA"
}

Se a mensagem for sobre energia solar/PV, use routed_to="solara".
Se for sobre baterias/BESS, use routed_to="bess_architect".
Para reclamações, crises ou assuntos gerais, use routed_to="none".

Sempre forneça uma resposta final útil em final_answer, mesmo quando encaminhar para especialista.`;

export async function callKuaray(payload: KuarayPayload): Promise<KuarayResponse> {
  const model = process.env.KUARAY_MODEL || "gpt-4o";

  const specialists = getSpecialistAgents();
  const specialistInfo = specialists
    .map(a => `- "${a.slug}": ${a.description}`)
    .join("\n");

  const contextParts: string[] = [];
  if (payload.ticketQueue) contextParts.push(`Fila do ticket: ${payload.ticketQueue}`);
  if (payload.ticketSeverity) contextParts.push(`Severidade: ${payload.ticketSeverity}`);
  if (payload.visitorName) contextParts.push(`Nome do visitante: ${payload.visitorName}`);
  const contextStr = contextParts.length > 0
    ? `\n\nContexto adicional:\n${contextParts.join("\n")}`
    : "";

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: KUARAY_SYSTEM_PROMPT + contextStr },
  ];

  if (payload.history && payload.history.length > 0) {
    const recentHistory = payload.history.slice(-5);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: payload.message });

  try {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages,
      max_completion_tokens: 2048,
      response_format: { type: "json_object" },
    });

    const rawContent = response.choices[0]?.message?.content || "";

    const SAFE_FALLBACK = "Desculpe, não consegui processar sua mensagem. Por favor, tente novamente.";
    const VALID_ROUTES = ["solara", "bess_architect", "none"];
    const VALID_RISKS = ["low", "medium", "high", "critical"];

    try {
      const parsed = JSON.parse(rawContent) as KuarayResponse;
      const routedTo = VALID_ROUTES.includes(parsed.routed_to) ? parsed.routed_to : "none";
      const riskLevel = VALID_RISKS.includes(parsed.risk_level) ? parsed.risk_level : "low";

      return {
        final_answer: parsed.final_answer || SAFE_FALLBACK,
        routed_to: routedTo,
        risk_level: riskLevel as KuarayResponse["risk_level"],
        category: parsed.category || "GERAL",
        confidence_score: typeof parsed.confidence_score === "number" ? parsed.confidence_score : null,
      };
    } catch {
      return {
        final_answer: SAFE_FALLBACK,
        routed_to: "none",
        risk_level: "low",
        category: "GERAL",
        confidence_score: null,
      };
    }
  } catch (err: any) {
    log(`Kuaray error: ${err.message}`, "ai-kuaray");
    return {
      final_answer: "Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes.",
      routed_to: "none",
      risk_level: "low",
      category: "GERAL",
      confidence_score: null,
    };
  }
}

export async function getConversationHistoryForKuaray(
  visitorId: string
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  try {
    const agents = await storage.getActiveAiAgents();
    if (agents.length === 0) return [];

    if (agents.length === 1) {
      const h = await storage.getConversationHistory(visitorId, agents[0].id, 5);
      return h.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
    }

    const firstAgent = agents[0];
    const h = await storage.getConversationHistory(visitorId, firstAgent.id, 5);
    return h.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  } catch {
    return [];
  }
}
