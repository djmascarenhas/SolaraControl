import { db } from "./db";
import { users, visitors, companies, visitorCompany, tickets, ticketAssignees, comments, activities } from "@shared/schema";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding database...");

  // Check if admin already exists
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded, skipping.");
    process.exit(0);
  }

  const adminHash = await bcrypt.hash("admin123", 10);
  const memberHash = await bcrypt.hash("member123", 10);

  // Users
  const [admin] = await db.insert(users).values({
    email: "admin@mission.ctl",
    name: "Alice Commander",
    password_hash: adminHash,
    role: "admin",
  }).returning();

  const [member1] = await db.insert(users).values({
    email: "bob@mission.ctl",
    name: "Bob Logistics",
    password_hash: memberHash,
    role: "member",
  }).returning();

  const [member2] = await db.insert(users).values({
    email: "charlie@mission.ctl",
    name: "Charlie Dev",
    password_hash: memberHash,
    role: "member",
  }).returning();

  console.log("Users created.");

  // Visitors
  const [v1] = await db.insert(visitors).values({
    telegram_user_id: 111222333,
    telegram_chat_id: 111222333,
    name: "John Doe",
    is_registered: true,
    persona_type: "consumer",
    email: "john@gmail.com",
    whatsapp: "+5511999887766",
    uf: "SP",
    city: "São Paulo",
  }).returning();

  const [v2] = await db.insert(visitors).values({
    telegram_user_id: 444555666,
    telegram_chat_id: 444555666,
    name: "Maria Silva",
    is_registered: true,
    persona_type: "integrator",
    email: "maria@techsol.com.br",
    uf: "SP",
    city: "São Paulo",
  }).returning();

  const [v3] = await db.insert(visitors).values({
    telegram_user_id: 777888999,
    telegram_chat_id: 777888999,
    name: "Roberto Santos",
    is_registered: true,
    persona_type: "provider",
    email: "roberto@logirap.com.br",
    uf: "PR",
    city: "Curitiba",
  }).returning();

  console.log("Visitors created.");

  // Companies
  const [c1] = await db.insert(companies).values({
    cnpj: "12.345.678/0001-90",
    legal_name: "Tech Solutions LTDA",
    trade_name: "TechSol",
    status: "active",
    city: "São Paulo",
    uf: "SP",
    phone: "+551130001000",
  }).returning();

  const [c2] = await db.insert(companies).values({
    cnpj: "98.765.432/0001-10",
    legal_name: "Logística Rápida SA",
    trade_name: "LogiRap",
    status: "pending_review",
    city: "Curitiba",
    uf: "PR",
    phone: "+554130002000",
  }).returning();

  // Link visitors to companies
  await db.insert(visitorCompany).values([
    { visitor_id: v2.id, company_id: c1.id, role: "admin" },
    { visitor_id: v3.id, company_id: c2.id, role: "admin" },
  ]);

  console.log("Companies created.");

  // Tickets
  const [t1] = await db.insert(tickets).values({
    public_id: "MC-000001",
    queue: "support",
    status: "in_progress",
    severity: "S1",
    title: "Integration failure with API v2",
    description: "I am getting 500 error when trying to sync inventory via the API v2 endpoint.",
    visitor_id: v2.id,
    company_id: c1.id,
    source: "telegram",
    source_chat_id: 444555666,
    last_activity_at: new Date(Date.now() - 30 * 60000),
  }).returning();

  const [t2] = await db.insert(tickets).values({
    public_id: "MC-000002",
    queue: "budget",
    status: "review",
    severity: "S2",
    title: "Budget approval for Q3",
    description: "Need review on the attached logistics budget for Q3 operations.",
    visitor_id: v3.id,
    company_id: c2.id,
    source: "telegram",
    source_chat_id: 777888999,
    last_activity_at: new Date(Date.now() - 2 * 3600000),
  }).returning();

  const [t3] = await db.insert(tickets).values({
    public_id: "MC-000003",
    queue: "logistics",
    status: "inbox",
    severity: "S3",
    title: "Delivery delay SP-RJ",
    description: "Package #9988 is stuck in the distribution center since yesterday.",
    visitor_id: v1.id,
    source: "telegram",
    source_chat_id: 111222333,
    last_activity_at: new Date(Date.now() - 15 * 60000),
  }).returning();

  const [t4] = await db.insert(tickets).values({
    public_id: "MC-000004",
    queue: "support",
    status: "needs_info",
    severity: "S2",
    title: "Login issues - cannot reset password",
    description: "Cannot reset my password via the email recovery flow. No email arrives.",
    visitor_id: v1.id,
    source: "telegram",
    source_chat_id: 111222333,
    last_activity_at: new Date(Date.now() - 24 * 3600000),
  }).returning();

  // Assign tickets
  await db.insert(ticketAssignees).values([
    { ticket_id: t1.id, user_id: member2.id },
    { ticket_id: t2.id, user_id: admin.id },
    { ticket_id: t4.id, user_id: member1.id },
  ]);

  console.log("Tickets created.");

  // Comments
  await db.insert(comments).values([
    {
      ticket_id: t1.id,
      author_type: "visitor",
      author_ref: v2.id,
      body: "Getting 500 error on /sync endpoint. Here is the full log:\n\nHTTP 500 Internal Server Error\nTimeout waiting for DB connection pool.",
      is_internal: false,
    },
    {
      ticket_id: t1.id,
      author_type: "admin",
      author_ref: member2.id,
      body: "Checking server logs now. Looks like the DB connection pool is exhausted.",
      is_internal: true,
    },
    {
      ticket_id: t1.id,
      author_type: "admin",
      author_ref: member2.id,
      body: "We found a timeout issue in the DB adapter. A fix is being deployed now — should be resolved within 30 minutes.",
      is_internal: false,
    },
  ]);

  console.log("Comments created.");

  // Activities
  await db.insert(activities).values([
    {
      type: "ticket_created",
      ticket_id: t3.id,
      payload: { title: t3.title },
    },
    {
      type: "ticket_created",
      ticket_id: t1.id,
      payload: { title: t1.title },
    },
    {
      type: "status_changed",
      ticket_id: t1.id,
      user_id: member2.id,
      payload: { from: "inbox", to: "in_progress" },
    },
    {
      type: "comment_added",
      ticket_id: t1.id,
      user_id: member2.id,
      payload: { snippet: "We found a timeout issue in the DB adapter..." },
    },
    {
      type: "company_pending_review",
      ticket_id: t2.id,
      payload: { company_name: c2.trade_name, cnpj: c2.cnpj },
    },
    {
      type: "assigned_changed",
      ticket_id: t4.id,
      user_id: admin.id,
      payload: { assignee_ids: [member1.id] },
    },
  ]);

  console.log("Activities created.");
  console.log("\nSeed complete!");
  console.log("Admin login: admin@mission.ctl / admin123");
  console.log("Member login: bob@mission.ctl / member123");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
