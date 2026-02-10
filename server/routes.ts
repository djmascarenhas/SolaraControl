import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, requireRole, hashPassword, comparePassword, generateToken } from "./auth";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ═══════════════════════════════════════════
  // AUTH ROUTES
  // ═══════════════════════════════════════════

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const valid = await comparePassword(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });

      res.cookie("mc_token", token, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      });

      return res.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    res.clearCookie("mc_token");
    return res.json({ ok: true });
  });

  app.get("/api/auth/me", authMiddleware, async (req: Request, res: Response) => {
    const user = await storage.getUser(req.user!.id);
    if (!user) return res.status(401).json({ message: "User not found" });
    return res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  });

  // ═══════════════════════════════════════════
  // USERS (Admin)
  // ═══════════════════════════════════════════

  app.get("/api/users", authMiddleware, async (req: Request, res: Response) => {
    const users = await storage.getAllUsers();
    return res.json(users.map(u => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.created_at })));
  });

  app.post("/api/users", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const { email, name, password, role } = req.body;
      if (!email || !name || !password) {
        return res.status(400).json({ message: "email, name, password required" });
      }

      const existing = await storage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "Email already exists" });
      }

      const password_hash = await hashPassword(password);
      const user = await storage.createUser({
        email,
        name,
        password_hash,
        role: role || "member",
      });

      return res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/users/:id", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    const userId = req.params.id as string;
    if (userId === req.user!.id) {
      return res.status(400).json({ message: "Cannot delete yourself" });
    }
    await storage.deleteUser(userId);
    return res.json({ ok: true });
  });

  // ═══════════════════════════════════════════
  // TICKETS
  // ═══════════════════════════════════════════

  app.get("/api/tickets", authMiddleware, async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const queue = req.query.queue as string | undefined;
    const severity = req.query.severity as string | undefined;
    const assignee = req.query.assignee as string | undefined;
    const q = req.query.q as string | undefined;
    const tickets = await storage.getTickets({ status, queue, severity, assignee, q });
    return res.json(tickets);
  });

  app.get("/api/tickets/:id", authMiddleware, async (req: Request, res: Response) => {
    const ticketId = req.params.id as string;
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const visitor = ticket.visitor_id ? await storage.getVisitor(ticket.visitor_id) : null;
    const company = ticket.company_id ? await storage.getCompany(ticket.company_id) : null;
    const visitorCompanies = visitor ? await storage.getCompaniesByVisitorId(visitor.id) : [];
    const otherTickets = ticket.visitor_id ? await storage.getTicketsByVisitorId(ticket.visitor_id) : [];

    return res.json({
      ...ticket,
      visitor,
      company: company || (visitorCompanies.length > 0 ? visitorCompanies[0] : null),
      other_tickets: otherTickets.filter(t => t.id !== ticket.id),
    });
  });

  app.patch("/api/tickets/:id", authMiddleware, async (req: Request, res: Response) => {
    const ticketId = req.params.id as string;
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    if (req.user!.role === "viewer") {
      return res.status(403).json({ message: "Viewers cannot modify tickets" });
    }

    const { status, queue, severity, title, assignee_ids } = req.body;
    const updates: any = {};

    if (status && status !== ticket.status) {
      updates.status = status;
      if (status === "done") updates.closed_at = new Date();
      await storage.createActivity({
        type: "status_changed",
        ticket_id: ticket.id,
        user_id: req.user!.id,
        payload: { from: ticket.status, to: status },
      });
    }
    if (queue && queue !== ticket.queue) {
      updates.queue = queue;
      await storage.createActivity({
        type: "queue_changed",
        ticket_id: ticket.id,
        user_id: req.user!.id,
        payload: { from: ticket.queue, to: queue },
      });
    }
    if (severity) updates.severity = severity;
    if (title) updates.title = title;

    updates.last_activity_at = new Date();

    const updated = await storage.updateTicket(ticket.id, updates);

    if (assignee_ids !== undefined) {
      await storage.setTicketAssignees(ticket.id, assignee_ids);
      await storage.createActivity({
        type: "assigned_changed",
        ticket_id: ticket.id,
        user_id: req.user!.id,
        payload: { assignee_ids },
      });
    }

    const refreshed = await storage.getTicket(ticket.id);
    return res.json(refreshed);
  });

  // ═══════════════════════════════════════════
  // COMMENTS
  // ═══════════════════════════════════════════

  app.get("/api/tickets/:id/comments", authMiddleware, async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const result = await storage.getCommentsByTicketId(id);
    return res.json(result);
  });

  app.post("/api/tickets/:id/comments", authMiddleware, async (req: Request, res: Response) => {
    if (req.user!.role === "viewer") {
      return res.status(403).json({ message: "Viewers cannot comment" });
    }

    const id = req.params.id as string;
    const { body, is_internal } = req.body;
    if (!body) return res.status(400).json({ message: "body is required" });

    const comment = await storage.createComment({
      ticket_id: id,
      author_type: "admin",
      author_ref: req.user!.id,
      body,
      is_internal: is_internal ?? true,
    });

    await storage.createActivity({
      type: "comment_added",
      ticket_id: id,
      user_id: req.user!.id,
      payload: { snippet: body.substring(0, 100), is_internal: comment.is_internal },
    });

    return res.status(201).json(comment);
  });

  // ═══════════════════════════════════════════
  // REPLY TO VISITOR (via Telegram)
  // ═══════════════════════════════════════════

  app.post("/api/tickets/:id/reply", authMiddleware, async (req: Request, res: Response) => {
    if (req.user!.role === "viewer") {
      return res.status(403).json({ message: "Viewers cannot reply" });
    }

    const id = req.params.id as string;
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: "body is required" });

    const ticket = await storage.getTicket(id);
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    let telegramMessageId: number | undefined;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = ticket.source_chat_id;

    if (botToken && chatId) {
      try {
        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: body }),
          }
        );
        const tgData = await tgRes.json() as any;
        if (tgData.ok) {
          telegramMessageId = tgData.result.message_id;
        }
      } catch (e) {
        console.error("Telegram send failed:", e);
      }
    }

    const comment = await storage.createComment({
      ticket_id: id,
      author_type: "admin",
      author_ref: req.user!.id,
      body,
      is_internal: false,
      telegram_message_id: telegramMessageId,
    });

    await storage.createActivity({
      type: "telegram_message_sent",
      ticket_id: id,
      user_id: req.user!.id,
      payload: { snippet: body.substring(0, 100), telegram_message_id: telegramMessageId },
    });

    return res.status(201).json(comment);
  });

  // ═══════════════════════════════════════════
  // FEED (Activities)
  // ═══════════════════════════════════════════

  app.get("/api/feed", authMiddleware, async (req: Request, res: Response) => {
    const ticket_id = req.query.ticket_id as string | undefined;
    const limitStr = req.query.limit as string | undefined;
    const offsetStr = req.query.offset as string | undefined;
    const activities = await storage.getActivities({
      ticket_id,
      limit: limitStr ? parseInt(limitStr) : 50,
      offset: offsetStr ? parseInt(offsetStr) : 0,
    });

    // Enrich activities with ticket and user info
    const enriched = await Promise.all(
      activities.map(async (activity) => {
        let ticket = null;
        let user = null;
        if (activity.ticket_id) {
          const t = await storage.getTicket(activity.ticket_id);
          if (t) ticket = { id: t.id, public_id: t.public_id, title: t.title };
        }
        if (activity.user_id) {
          const u = await storage.getUser(activity.user_id);
          if (u) user = { id: u.id, name: u.name, email: u.email };
        }
        return { ...activity, ticket, user };
      })
    );

    return res.json(enriched);
  });

  return httpServer;
}
