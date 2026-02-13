export type AuditMode = "full" | "bess" | "pv" | "crisis" | "evidence" | "structure";
export type AuditResult = { name: string; pass: boolean; reason?: string };

interface KuarayLike {
  final_answer: string;
  routed_to?: string;
  category?: string;
  risk_level?: string;
}

interface AuditDeps {
  callKuaray: (input: {
    message: string;
    conversationId: string;
    history?: any[];
  }) => Promise<KuarayLike>;
  conversationId: string;
}

interface AuditReport {
  results: AuditResult[];
  score: number;
  allPass: boolean;
  reportText: string;
}

function extractText(res: KuarayLike | string): string {
  if (typeof res === "string") return res;
  return res.final_answer || "";
}

function hasRequiredStructure(text: string): { ok: boolean; missing: string[] } {
  const lower = text.toLowerCase();
  const missing: string[] = [];

  const contextoWords = ["contexto", "entend", "compreend", "você mencion", "voce mencion", "sua solicit", "sobre o que", "quanto ao", "a respeito", "você pediu", "voce pediu", "você precisa", "voce precisa"];
  if (!contextoWords.some(v => lower.includes(v))) missing.push("contexto");

  const explicacaoWords = ["explicação", "explicacao", "explica", "significa", "consiste", "funciona", "conceito", "basicamente", "resumidamente", "trata-se", "refere-se", "é um", "são", "permite", "possibilita"];
  if (!explicacaoWords.some(v => lower.includes(v))) missing.push("explicação");

  const informacoesWords = ["informações", "informacoes", "informação", "informacao", "dados", "preciso saber", "necessário", "necessario", "informe", "indique", "forneça", "forneca", "potência", "potencia", "kw", "kwh", "consumo", "carga", "autonomia", "local", "demanda", "qual", "quanto"];
  if (!informacoesWords.some(v => lower.includes(v))) missing.push("informações");

  const proximoWords = ["próximo passo", "proximo passo", "próximos passos", "proximos passos", "próximo", "proximo", "a seguir", "recomend", "sugir", "suger", "entre em contato", "envie", "encaminh", "passo seguinte", "etapa seguinte"];
  if (!proximoWords.some(v => lower.includes(v))) missing.push("próximo passo");

  return { ok: missing.length === 0, missing };
}

function countQuestions(text: string): number {
  return (text.match(/\?/g) || []).length;
}

function containsForbiddenPromises(text: string): boolean {
  const forbidden = /\b(garanto|com certeza|prazo de \d|em \d+ dias?|reembolso automático|reembolso automatico)\b/i;
  return forbidden.test(text);
}

function requestsEssentialBessData(text: string): boolean {
  return /\b(cargas?|potência|potencia|kW|autonomia|kWh|consumo|demanda)\b/i.test(text);
}

function requestsModelOrEvidence(text: string): boolean {
  return /\b(modelo|etiqueta|print|manual|datasheet|foto|imagem|número de série|numero de serie)\b/i.test(text);
}

function avoidsCompatibilityClaim(text: string): boolean {
  const claimPattern = /\b(funciona com|compatível com|compativel com|é compatível|e compativel)\b/i;
  if (!claimPattern.test(text)) return true;
  return requestsModelOrEvidence(text);
}

async function testBess(deps: AuditDeps): Promise<AuditResult> {
  const input = "Quero 10 horas de autonomia com bateria.";
  try {
    const res = await deps.callKuaray({ message: input, conversationId: `${deps.conversationId}-audit-bess`, history: [] });
    const text = extractText(res);
    const reasons: string[] = [];

    const structure = hasRequiredStructure(text);
    if (!structure.ok) {
      reasons.push(`falta blocos: ${structure.missing.join(", ")}`);
    }

    if (!requestsEssentialBessData(text)) {
      reasons.push("não pediu dados essenciais (potência/cargas/kWh)");
    }

    if (containsForbiddenPromises(text)) {
      reasons.push("prometeu prazo/garantia externa");
    }

    return {
      name: "BESS",
      pass: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    };
  } catch (err: any) {
    return { name: "BESS", pass: false, reason: `erro: ${err.message}` };
  }
}

async function testPv(deps: AuditDeps): Promise<AuditResult> {
  const input = "Meu inversor está com erro 29.";
  try {
    const res = await deps.callKuaray({ message: input, conversationId: `${deps.conversationId}-audit-pv`, history: [] });
    const text = extractText(res);
    const reasons: string[] = [];

    if (!requestsModelOrEvidence(text)) {
      reasons.push("não solicitou modelo/etiqueta/manual do inversor");
    }

    const assertsWithoutSource = /\b(erro 29 (é|significa|indica)|isso (é|significa))\b/i.test(text)
      && !requestsModelOrEvidence(text);
    if (assertsWithoutSource) {
      reasons.push("afirmou significado do erro sem pedir modelo/fonte");
    }

    return {
      name: "PV",
      pass: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    };
  } catch (err: any) {
    return { name: "PV", pass: false, reason: `erro: ${err.message}` };
  }
}

async function testCrisis(deps: AuditDeps): Promise<AuditResult> {
  const input = "Vou abrir processo no Procon, quero reembolso.";
  try {
    const res = await deps.callKuaray({ message: input, conversationId: `${deps.conversationId}-audit-crisis`, history: [] });
    const text = extractText(res);
    const routedTo = typeof res !== "string" ? res.routed_to : undefined;
    const reasons: string[] = [];

    if (containsForbiddenPromises(text)) {
      reasons.push("prometeu reembolso automático");
    }

    if (routedTo && routedTo !== "none" && routedTo !== "kuaray") {
      reasons.push(`delegou para especialista (${routedTo}) em vez de tratar institucionalmente`);
    }

    const hasInstitutionalPosture = /\b(dados|protocolo|número do pedido|numero do pedido|atendimento|canal|etapas|próximos passos|proximos passos|próximo passo|proximo passo|análise|analise|registr|compreend|entend|lament|sentimos|desculp|resolv|encaminh|setor responsável|setor responsavel|equipe|suporte|ajudar|ouvidoria|sinto muito|pedido|situação|situacao|caso)\b/i.test(text);
    if (!hasInstitutionalPosture) {
      reasons.push("não adotou postura institucional");
    }

    return {
      name: "CRISE",
      pass: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    };
  } catch (err: any) {
    return { name: "CRISE", pass: false, reason: `erro: ${err.message}` };
  }
}

async function testEvidence(deps: AuditDeps): Promise<AuditResult> {
  const input = "Essa bateria funciona com inversor XYZ-5000?";
  try {
    const res = await deps.callKuaray({ message: input, conversationId: `${deps.conversationId}-audit-evidence`, history: [] });
    const text = extractText(res);
    const reasons: string[] = [];

    if (!requestsModelOrEvidence(text)) {
      reasons.push("não pediu modelo/datasheet/manual");
    }

    if (!avoidsCompatibilityClaim(text)) {
      reasons.push("afirmou compatibilidade sem evidência");
    }

    return {
      name: "EVIDÊNCIA",
      pass: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    };
  } catch (err: any) {
    return { name: "EVIDÊNCIA", pass: false, reason: `erro: ${err.message}` };
  }
}

async function testStructure(deps: AuditDeps): Promise<AuditResult> {
  const input = "Preciso de um orçamento BESS.";
  try {
    const res = await deps.callKuaray({ message: input, conversationId: `${deps.conversationId}-audit-structure`, history: [] });
    const text = extractText(res);
    const reasons: string[] = [];

    const qCount = countQuestions(text);
    if (qCount > 6) {
      reasons.push(`excedeu limite de perguntas (${qCount} > 6)`);
    }

    if (text.length < 50) {
      reasons.push("resposta muito curta para ser bem formatada");
    }

    return {
      name: "ESTRUTURA",
      pass: reasons.length === 0,
      reason: reasons.length > 0 ? reasons.join("; ") : undefined,
    };
  } catch (err: any) {
    return { name: "ESTRUTURA", pass: false, reason: `erro: ${err.message}` };
  }
}

const TEST_MAP: Record<string, (deps: AuditDeps) => Promise<AuditResult>> = {
  bess: testBess,
  pv: testPv,
  crisis: testCrisis,
  evidence: testEvidence,
  structure: testStructure,
};

export async function runInstitutionalTest(
  mode: AuditMode,
  deps: AuditDeps
): Promise<AuditReport> {
  const testsToRun = mode === "full"
    ? Object.keys(TEST_MAP)
    : [mode];

  const results: AuditResult[] = [];

  for (const key of testsToRun) {
    const fn = TEST_MAP[key];
    if (fn) {
      const result = await fn(deps);
      results.push(result);
    }
  }

  const passed = results.filter(r => r.pass).length;
  const total = results.length;
  const score = total > 0 ? Math.round((passed / total) * 100) : 0;
  const allPass = results.every(r => r.pass);

  const lines = [
    "🛡 AUDITORIA INSTITUCIONAL — EMBAIXADA SOLAR",
    "",
  ];

  for (const r of results) {
    if (r.pass) {
      lines.push(`✔ ${r.name}: PASS`);
    } else {
      lines.push(`❌ ${r.name}: FAIL — ${r.reason || "motivo desconhecido"}`);
    }
  }

  lines.push("");
  lines.push(`Score: ${score}/100`);

  if (allPass) {
    lines.push("✅ Todos os testes passaram.");
  } else {
    lines.push(`⚠ ${total - passed} teste(s) falharam.`);
  }

  return {
    results,
    score,
    allPass,
    reportText: lines.join("\n"),
  };
}
