import { db } from "./db";
import { dashboardEvents } from "@shared/schema";

const AGENTS = ["Solara", "BESS Architect"];
const CATEGORIES = ["support", "budget", "logistics"];
const RISK_LEVELS = ["low", "medium", "high"];
const CHANNELS = ["telegram"];
const OUTCOMES = ["resolved", "resolved", "resolved", "escalated", "pending"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function seedDashboardEvents(days = 60, eventsPerDay = 15) {
  const now = Date.now();
  const events: any[] = [];

  for (let d = 0; d < days; d++) {
    const dayOffset = (days - d) * 24 * 60 * 60 * 1000;
    const count = eventsPerDay + randomInt(-5, 5);

    for (let i = 0; i < count; i++) {
      const ts = new Date(now - dayOffset + randomInt(0, 23 * 60 * 60 * 1000));
      const agent = randomFrom(AGENTS);
      const category = randomFrom(CATEGORIES);
      const riskLevel = randomFrom(RISK_LEVELS);
      const conversationId = `conv-${d}-${i}`;

      events.push({
        event_type: "inbound",
        conversation_id: conversationId,
        timestamp: ts,
        channel: randomFrom(CHANNELS),
        category,
        risk_level: riskLevel,
        tenant_id: 1,
      });

      const responseTime = randomInt(800, 12000);
      const confidence = parseFloat((0.5 + Math.random() * 0.5).toFixed(2));
      const outcome = randomFrom(OUTCOMES);

      events.push({
        event_type: "outbound",
        conversation_id: conversationId,
        timestamp: new Date(ts.getTime() + responseTime),
        channel: randomFrom(CHANNELS),
        agent_routed_to: agent,
        category,
        risk_level: riskLevel,
        response_time_ms: responseTime,
        confidence_score: confidence,
        has_citations: Math.random() > 0.6,
        outcome_status: outcome,
        feedback_score: Math.random() > 0.7 ? randomInt(1, 5) : null,
        tenant_id: 1,
      });
    }
  }

  const batchSize = 100;
  for (let i = 0; i < events.length; i += batchSize) {
    await db.insert(dashboardEvents).values(events.slice(i, i + batchSize));
  }

  console.log(`Seeded ${events.length} dashboard events (${days} days, ~${eventsPerDay}/day)`);
}

seedDashboardEvents()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed error:", err);
    process.exit(1);
  });
