import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, timestamp, bigint, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ───── USERS ─────
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ───── SESSIONS ─────
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  expires_at: timestamp("expires_at").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// ───── VISITORS ─────
export const visitors = pgTable("visitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegram_user_id: bigint("telegram_user_id", { mode: "number" }).unique(),
  telegram_chat_id: bigint("telegram_chat_id", { mode: "number" }),
  name: text("name"),
  is_registered: boolean("is_registered").default(false).notNull(),
  onboarding_step: text("onboarding_step").default("none"),
  persona_type: text("persona_type"),
  provider_type: text("provider_type"),
  uf: text("uf"),
  city: text("city"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVisitorSchema = createInsertSchema(visitors).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertVisitor = z.infer<typeof insertVisitorSchema>;
export type Visitor = typeof visitors.$inferSelect;

// ───── COMPANIES ─────
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull().default("pending_review"),
  cnpj: text("cnpj").notNull().unique(),
  legal_name: text("legal_name").notNull(),
  trade_name: text("trade_name").notNull(),
  phone: text("phone"),
  uf: text("uf"),
  city: text("city"),
  address: text("address"),
  enrichment: jsonb("enrichment"),
  enrichment_source: text("enrichment_source"),
  enrichment_at: timestamp("enrichment_at"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ───── VISITOR_COMPANY ─────
export const visitorCompany = pgTable("visitor_company", {
  visitor_id: varchar("visitor_id").notNull().references(() => visitors.id),
  company_id: varchar("company_id").notNull().references(() => companies.id),
  role: text("role"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("visitor_company_unique").on(table.visitor_id, table.company_id),
]);

// ───── TICKETS ─────
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  public_id: text("public_id").notNull().unique(),
  queue: text("queue").notNull().default("support"),
  status: text("status").notNull().default("inbox"),
  severity: text("severity").notNull().default("S3"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  visitor_id: varchar("visitor_id").references(() => visitors.id),
  company_id: varchar("company_id").references(() => companies.id),
  source: text("source").notNull().default("telegram"),
  source_chat_id: bigint("source_chat_id", { mode: "number" }),
  opened_at: timestamp("opened_at").defaultNow().notNull(),
  closed_at: timestamp("closed_at"),
  last_activity_at: timestamp("last_activity_at").defaultNow().notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("tickets_status_queue_idx").on(table.status, table.queue),
  index("tickets_visitor_id_idx").on(table.visitor_id),
  index("tickets_last_activity_idx").on(table.last_activity_at),
]);

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// ───── TICKET_ASSIGNEES ─────
export const ticketAssignees = pgTable("ticket_assignees", {
  ticket_id: varchar("ticket_id").notNull().references(() => tickets.id),
  user_id: varchar("user_id").notNull().references(() => users.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("ticket_assignees_unique").on(table.ticket_id, table.user_id),
]);

// ───── COMMENTS ─────
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticket_id: varchar("ticket_id").notNull().references(() => tickets.id),
  author_type: text("author_type").notNull(),
  author_ref: text("author_ref"),
  body: text("body").notNull(),
  telegram_message_id: bigint("telegram_message_id", { mode: "number" }),
  is_internal: boolean("is_internal").default(false).notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("comments_ticket_created_idx").on(table.ticket_id, table.created_at),
]);

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  created_at: true,
});
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// ───── ACTIVITIES ─────
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  ticket_id: varchar("ticket_id").references(() => tickets.id),
  user_id: varchar("user_id").references(() => users.id),
  payload: jsonb("payload"),
  created_at: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("activities_created_at_idx").on(table.created_at),
]);

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  created_at: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;
