import { db } from "./db";
import { eq, desc, and, or, ilike, sql, inArray } from "drizzle-orm";
import {
  users, type User, type InsertUser,
  visitors, type Visitor, type InsertVisitor,
  companies, type Company, type InsertCompany,
  visitorCompany,
  tickets, type Ticket, type InsertTicket,
  ticketAssignees,
  comments, type Comment, type InsertComment,
  activities, type Activity, type InsertActivity,
  sessions,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // Sessions
  createSession(userId: string, token: string, expiresAt: Date): Promise<void>;
  getSessionByToken(token: string): Promise<{ user_id: string; expires_at: Date } | undefined>;
  deleteSession(token: string): Promise<void>;

  // Visitors
  getVisitor(id: string): Promise<Visitor | undefined>;
  getVisitorByTelegramId(telegramUserId: number): Promise<Visitor | undefined>;
  createVisitor(visitor: InsertVisitor): Promise<Visitor>;

  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompaniesByVisitorId(visitorId: string): Promise<Company[]>;

  // Tickets
  getTickets(filters?: {
    status?: string;
    queue?: string;
    severity?: string;
    assignee?: string;
    q?: string;
  }): Promise<(Ticket & { assignee_ids: string[] })[]>;
  getTicket(id: string): Promise<(Ticket & { assignee_ids: string[] }) | undefined>;
  getTicketsByVisitorId(visitorId: string): Promise<Ticket[]>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined>;
  getNextPublicId(): Promise<string>;
  getLatestActiveTicketByVisitorId(visitorId: string): Promise<Ticket | undefined>;

  // Ticket Assignees
  setTicketAssignees(ticketId: string, userIds: string[]): Promise<void>;
  getTicketAssignees(ticketId: string): Promise<string[]>;

  // Comments
  getCommentsByTicketId(ticketId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;

  // Activities
  getActivities(filters?: {
    queue?: string;
    severity?: string;
    status?: string;
    ticket_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
}

export class DatabaseStorage implements IStorage {
  // ── Users ──
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.name);
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ ...data, updated_at: new Date() }).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ── Sessions ──
  async createSession(userId: string, token: string, expiresAt: Date): Promise<void> {
    await db.insert(sessions).values({ user_id: userId, token, expires_at: expiresAt });
  }

  async getSessionByToken(token: string): Promise<{ user_id: string; expires_at: Date } | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session ? { user_id: session.user_id, expires_at: session.expires_at } : undefined;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  // ── Visitors ──
  async getVisitor(id: string): Promise<Visitor | undefined> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.id, id));
    return visitor;
  }

  async getVisitorByTelegramId(telegramUserId: number): Promise<Visitor | undefined> {
    const [visitor] = await db.select().from(visitors).where(eq(visitors.telegram_user_id, telegramUserId));
    return visitor;
  }

  async createVisitor(visitor: InsertVisitor): Promise<Visitor> {
    const [created] = await db.insert(visitors).values(visitor).returning();
    return created;
  }

  // ── Companies ──
  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompaniesByVisitorId(visitorId: string): Promise<Company[]> {
    const rows = await db
      .select({ company: companies })
      .from(visitorCompany)
      .innerJoin(companies, eq(visitorCompany.company_id, companies.id))
      .where(eq(visitorCompany.visitor_id, visitorId));
    return rows.map(r => r.company);
  }

  // ── Tickets ──
  async getTickets(filters?: {
    status?: string;
    queue?: string;
    severity?: string;
    assignee?: string;
    q?: string;
  }): Promise<(Ticket & { assignee_ids: string[] })[]> {
    const conditions: any[] = [];

    if (filters?.status) conditions.push(eq(tickets.status, filters.status));
    if (filters?.queue) conditions.push(eq(tickets.queue, filters.queue));
    if (filters?.severity) conditions.push(eq(tickets.severity, filters.severity));
    if (filters?.q) {
      conditions.push(
        or(
          ilike(tickets.public_id, `%${filters.q}%`),
          ilike(tickets.title, `%${filters.q}%`),
          ilike(tickets.description, `%${filters.q}%`)
        )
      );
    }

    let query = db.select().from(tickets);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    const ticketRows = await (query as any).orderBy(desc(tickets.last_activity_at));

    // Get all assignees in one query
    const ticketIds = ticketRows.map((t: Ticket) => t.id);
    let assigneeMap: Record<string, string[]> = {};
    if (ticketIds.length > 0) {
      const assigneeRows = await db
        .select()
        .from(ticketAssignees)
        .where(inArray(ticketAssignees.ticket_id, ticketIds));
      for (const row of assigneeRows) {
        if (!assigneeMap[row.ticket_id]) assigneeMap[row.ticket_id] = [];
        assigneeMap[row.ticket_id].push(row.user_id);
      }
    }

    // Filter by assignee if needed
    let result = ticketRows.map((t: Ticket) => ({
      ...t,
      assignee_ids: assigneeMap[t.id] || [],
    }));

    if (filters?.assignee) {
      result = result.filter((t: Ticket & { assignee_ids: string[] }) => t.assignee_ids.includes(filters.assignee!));
    }

    return result;
  }

  async getTicket(id: string): Promise<(Ticket & { assignee_ids: string[] }) | undefined> {
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    if (!ticket) return undefined;
    const assigneeIds = await this.getTicketAssignees(id);
    return { ...ticket, assignee_ids: assigneeIds };
  }

  async getTicketsByVisitorId(visitorId: string): Promise<Ticket[]> {
    return db.select().from(tickets).where(eq(tickets.visitor_id, visitorId)).orderBy(desc(tickets.created_at));
  }

  async createTicket(ticket: InsertTicket): Promise<Ticket> {
    const [created] = await db.insert(tickets).values(ticket).returning();
    return created;
  }

  async updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined> {
    const [updated] = await db.update(tickets).set({ ...data, updated_at: new Date() }).where(eq(tickets.id, id)).returning();
    return updated;
  }

  async getNextPublicId(): Promise<string> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tickets);
    const num = (result?.count || 0) + 1;
    return `SOL-${String(num).padStart(6, '0')}`;
  }

  async getLatestActiveTicketByVisitorId(visitorId: string): Promise<Ticket | undefined> {
    const [ticket] = await db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.visitor_id, visitorId),
          sql`${tickets.status} NOT IN ('done')`
        )
      )
      .orderBy(desc(tickets.last_activity_at))
      .limit(1);
    return ticket;
  }

  // ── Ticket Assignees ──
  async setTicketAssignees(ticketId: string, userIds: string[]): Promise<void> {
    await db.delete(ticketAssignees).where(eq(ticketAssignees.ticket_id, ticketId));
    if (userIds.length > 0) {
      await db.insert(ticketAssignees).values(
        userIds.map(userId => ({ ticket_id: ticketId, user_id: userId }))
      );
    }
  }

  async getTicketAssignees(ticketId: string): Promise<string[]> {
    const rows = await db.select().from(ticketAssignees).where(eq(ticketAssignees.ticket_id, ticketId));
    return rows.map(r => r.user_id);
  }

  // ── Comments ──
  async getCommentsByTicketId(ticketId: string): Promise<Comment[]> {
    return db.select().from(comments)
      .where(eq(comments.ticket_id, ticketId))
      .orderBy(comments.created_at);
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [created] = await db.insert(comments).values(comment).returning();
    // Update ticket last_activity_at
    await db.update(tickets).set({ last_activity_at: new Date(), updated_at: new Date() }).where(eq(tickets.id, comment.ticket_id));
    return created;
  }

  // ── Activities ──
  async getActivities(filters?: {
    queue?: string;
    severity?: string;
    status?: string;
    ticket_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<Activity[]> {
    let query = db.select().from(activities);
    const conditions: any[] = [];

    if (filters?.ticket_id) {
      conditions.push(eq(activities.ticket_id, filters.ticket_id));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    return (query as any)
      .orderBy(desc(activities.created_at))
      .limit(limit)
      .offset(offset);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [created] = await db.insert(activities).values(activity).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
