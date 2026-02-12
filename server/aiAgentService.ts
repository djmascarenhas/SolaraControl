import OpenAI from "openai";
import { storage } from "./storage";
import type { AiAgent, Visitor } from "@shared/schema";
import { log } from "./index";

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

export async function routeMessageToAgent(text: string): Promise<AiAgent | null> {
  const agents = await storage.getActiveAiAgents();
  if (agents.length === 0) return null;

  const textLower = text.toLowerCase();

  let bestMatch: AiAgent | null = null;
  let bestScore = 0;

  for (const agent of agents) {
    if (!agent.keywords || agent.keywords.length === 0) continue;
    let score = 0;
    for (const keyword of agent.keywords) {
      if (textLower.includes(keyword.toLowerCase())) {
        score += keyword.length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = agent;
    }
  }

  if (bestMatch) return bestMatch;

  if (agents.length === 1) return agents[0];

  const agentDescriptions = agents.map(a => `- "${a.slug}": ${a.description || a.name}`).join("\n");
  try {
    const routingResponse = await getOpenAI().chat.completions.create({
      model: "gpt-5-nano",
      messages: [
        {
          role: "system",
          content: `You are a router. Given a user message, respond with ONLY the slug of the best matching agent. Available agents:\n${agentDescriptions}\n\nIf unsure, respond with the slug of the most general agent. Respond with ONLY the slug, nothing else.`
        },
        { role: "user", content: text }
      ],
      max_completion_tokens: 50,
    });
    const chosenSlug = routingResponse.choices[0]?.message?.content?.trim();
    if (chosenSlug) {
      const matched = agents.find(a => a.slug === chosenSlug);
      if (matched) return matched;
    }
  } catch (err: any) {
    log(`AI routing error: ${err.message}`, "ai-agent");
  }

  return agents[0];
}

export async function getAgentResponse(
  agent: AiAgent,
  visitor: Visitor,
  userMessage: string
): Promise<string> {
  const history = await storage.getConversationHistory(visitor.id, agent.id, 20);

  await storage.addConversationMessage(visitor.id, agent.id, "user", userMessage);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: agent.system_prompt },
  ];

  if (visitor.name) {
    messages.push({
      role: "system",
      content: `O nome do visitante é: ${visitor.name}. Tipo: ${visitor.persona_type || "não definido"}.`
    });
  }

  for (const msg of history) {
    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const response = await getOpenAI().chat.completions.create({
      model: agent.model || "gpt-5.2",
      messages,
      max_completion_tokens: 2048,
    });

    const reply = response.choices[0]?.message?.content || "Desculpe, não consegui gerar uma resposta no momento.";

    await storage.addConversationMessage(visitor.id, agent.id, "assistant", reply);

    return reply;
  } catch (err: any) {
    log(`AI agent error (${agent.name}): ${err.message}`, "ai-agent");
    return `Desculpe, estou com dificuldades técnicas no momento. Por favor, tente novamente em alguns instantes.`;
  }
}
