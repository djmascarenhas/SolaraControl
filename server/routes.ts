import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { authMiddleware, requireRole, hashPassword, comparePassword, generateToken } from "./auth";
import { z } from "zod";
import { routeMessageToAgent, getAgentResponse } from "./aiAgentService";
import { callKuaray, getConversationHistoryForKuaray } from "./ai/kuaray";

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
  // VISITORS
  // ═══════════════════════════════════════════

  app.get("/api/visitors", authMiddleware, async (req: Request, res: Response) => {
    const persona_type = req.query.persona_type as string | undefined;
    const visitors = await storage.getAllVisitors({ persona_type: persona_type || undefined });
    return res.json(visitors);
  });

  app.post("/api/visitors/:id/message", authMiddleware, async (req: Request, res: Response) => {
    if (req.user!.role === "viewer") {
      return res.status(403).json({ message: "Viewers cannot send messages" });
    }

    const visitorId = req.params.id as string;
    const { body } = req.body;
    if (!body) return res.status(400).json({ message: "body is required" });

    const visitor = await storage.getVisitor(visitorId);
    if (!visitor) return res.status(404).json({ message: "Visitor not found" });
    if (!visitor.telegram_chat_id) return res.status(400).json({ message: "Visitor has no Telegram chat" });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return res.status(500).json({ message: "Telegram bot not configured" });

    let telegramMessageId: number | undefined;
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: visitor.telegram_chat_id, text: body }),
        }
      );
      const tgData = await tgRes.json() as any;
      if (tgData.ok) {
        telegramMessageId = tgData.result.message_id;
      } else {
        return res.status(500).json({ message: `Telegram error: ${tgData.description}` });
      }
    } catch (e: any) {
      return res.status(500).json({ message: `Telegram send failed: ${e.message}` });
    }

    let ticket = await storage.getLatestActiveTicketByVisitorId(visitor.id);
    if (!ticket) {
      const publicId = await storage.getNextPublicId();
      ticket = await storage.createTicket({
        public_id: publicId,
        queue: "support",
        status: "inbox",
        severity: "S3",
        title: `Mensagem para ${visitor.name || "visitante"}`,
        description: body.substring(0, 200),
        visitor_id: visitor.id,
        source: "telegram",
        source_chat_id: visitor.telegram_chat_id,
        last_activity_at: new Date(),
      });
    }

    const comment = await storage.createComment({
      ticket_id: ticket.id,
      author_type: "admin",
      author_ref: req.user!.id,
      body,
      is_internal: false,
      telegram_message_id: telegramMessageId,
    });

    await storage.createActivity({
      type: "telegram_message_sent",
      ticket_id: ticket.id,
      user_id: req.user!.id,
      payload: { snippet: body.substring(0, 100), visitor_name: visitor.name },
    });

    return res.status(201).json({ comment, ticket_id: ticket.id });
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
  // TELEGRAM WEBHOOK
  // ═══════════════════════════════════════════

  app.post("/api/telegram/webhook", async (req: Request, res: Response) => {
    try {
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (webhookSecret) {
        const token = req.headers["x-telegram-bot-api-secret-token"];
        if (token !== webhookSecret) {
          return res.status(403).json({ ok: false, error: "Invalid secret token" });
        }
      }

      const update = req.body;
      const message = update?.message;
      if (!message) {
        return res.json({ ok: true });
      }

      let text = message.text || "";
      if (!text && message.caption) text = message.caption;
      if (message.photo) text = text || "[Foto recebida]";
      if (message.document) text = `[Documento: ${message.document.file_name || "arquivo"}] ${text}`.trim();
      if (message.voice) text = text || "[Mensagem de voz]";
      if (message.video) text = text || "[Vídeo recebido]";
      if (message.audio) text = `[Áudio: ${message.audio.title || "sem título"}] ${text}`.trim();
      if (message.sticker) text = `[Sticker: ${message.sticker.emoji || ""}]`;
      if (message.location) text = `[Localização: ${message.location.latitude}, ${message.location.longitude}]`;
      if (message.contact) text = `[Contato: ${message.contact.first_name} ${message.contact.phone_number}]`;

      if (!text) {
        return res.json({ ok: true });
      }

      const telegramUserId = message.from?.id;
      const telegramChatId = message.chat?.id;
      const firstName = message.from?.first_name || "";
      const lastName = message.from?.last_name || "";
      const senderName = `${firstName} ${lastName}`.trim() || "Unknown";

      if (!telegramUserId || !telegramChatId) {
        return res.json({ ok: true });
      }

      const conversationId = String(telegramChatId);

      let visitor = await storage.getVisitorByTelegramId(telegramUserId);
      if (!visitor) {
        visitor = await storage.createVisitor({
          telegram_user_id: telegramUserId,
          telegram_chat_id: telegramChatId,
          name: senderName,
          is_registered: false,
        });
      }

      let ticket = await storage.getLatestActiveTicketByVisitorId(visitor.id);

      if (!ticket) {
        const publicId = await storage.getNextPublicId();
        ticket = await storage.createTicket({
          public_id: publicId,
          queue: "support",
          status: "inbox",
          severity: "S3",
          title: text.substring(0, 120),
          description: text,
          visitor_id: visitor.id,
          source: "telegram",
          source_chat_id: telegramChatId,
          last_activity_at: new Date(),
        });

        await storage.createActivity({
          type: "ticket_created",
          ticket_id: ticket.id,
          payload: { title: ticket.title, source: "telegram" },
        });
      }

      await storage.createComment({
        ticket_id: ticket.id,
        author_type: "visitor",
        author_ref: visitor.id,
        body: text,
        is_internal: false,
        telegram_message_id: message.message_id,
      });

      await storage.createActivity({
        type: "telegram_message_received",
        ticket_id: ticket.id,
        payload: { snippet: text.substring(0, 100), from: senderName },
      });

      // EVENT 1: inbound
      try {
        await storage.createDashboardEvent({
          event_type: "inbound",
          conversation_id: conversationId,
          visitor_id: visitor.id,
          ticket_id: ticket.id,
          channel: "telegram",
          category: ticket.queue,
          risk_level: ticket.severity === "S1" ? "high" : ticket.severity === "S2" ? "medium" : "low",
        });
      } catch (_e) {}

      // AI Agent auto-reply via Kuaray orchestrator
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken && text && !text.startsWith("[")) {
        try {
          const replyStart = Date.now();

          const history = await getConversationHistoryForKuaray(visitor.id);

          const kuarayResult = await callKuaray({
            message: text,
            conversationId,
            visitorId: visitor.id,
            ticketId: ticket.id,
            ticketQueue: ticket.queue,
            ticketSeverity: ticket.severity,
            visitorName: visitor.name || undefined,
            history,
          });

          const responseTimeMs = Date.now() - replyStart;
          const agentSlug = kuarayResult.routed_to || "none";
          const detectedCategory = kuarayResult.category || "GERAL";
          const detectedRisk = kuarayResult.risk_level || "low";

          // EVENT 2: router_decision
          try {
            await storage.createDashboardEvent({
              event_type: "router_decision",
              conversation_id: conversationId,
              ticket_id: ticket.id,
              visitor_id: visitor.id,
              channel: "telegram",
              category: detectedCategory,
              risk_level: detectedRisk,
              agent_routed_to: agentSlug,
              response_time_ms: null,
              confidence_score: kuarayResult.confidence_score,
              has_citations: false,
              outcome_status: "routed",
            });
          } catch (_e) {}

          const finalAnswer = kuarayResult.final_answer;
          const hasCitations = /Fonte:|Referência:|Ref\.|Source:/i.test(finalAnswer);

          const tgRes = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: telegramChatId, text: finalAnswer }),
            }
          );
          const tgData = await tgRes.json() as any;

          const agentLabel = agentSlug !== "none" ? agentSlug : "kuaray";

          // Save conversation history for the routed agent (or first active agent)
          try {
            const agents = await storage.getActiveAiAgents();
            const matchedAgent = agents.find(a => a.slug === agentSlug) || agents[0];
            if (matchedAgent) {
              await storage.addConversationMessage(visitor.id, matchedAgent.id, "user", text);
              await storage.addConversationMessage(visitor.id, matchedAgent.id, "assistant", finalAnswer);
            }
          } catch (_e) {}

          await storage.createComment({
            ticket_id: ticket.id,
            author_type: "system",
            author_ref: agentLabel,
            body: `[${agentLabel}] ${finalAnswer}`,
            is_internal: false,
            telegram_message_id: tgData.ok ? tgData.result.message_id : undefined,
          });

          await storage.createActivity({
            type: "ai_agent_reply",
            ticket_id: ticket.id,
            payload: { agent_name: agentLabel, snippet: finalAnswer.substring(0, 100), routed_to: agentSlug, category: detectedCategory },
          });

          // EVENT 3: outbound
          try {
            await storage.createDashboardEvent({
              event_type: "outbound",
              conversation_id: conversationId,
              visitor_id: visitor.id,
              ticket_id: ticket.id,
              channel: "telegram",
              agent_routed_to: agentLabel,
              category: detectedCategory,
              risk_level: detectedRisk,
              response_time_ms: responseTimeMs,
              confidence_score: kuarayResult.confidence_score,
              has_citations: hasCitations,
              outcome_status: "resolved",
            });
          } catch (_e) {}

        } catch (aiErr: any) {
          if (process.env.NODE_ENV !== "production") {
            console.error("AI orchestrator error:", aiErr.message);
          }
        }
      }

      return res.json({ ok: true });
    } catch (err: any) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Telegram webhook error:", err.message);
      }
      return res.json({ ok: true });
    }
  });

  // ═══════════════════════════════════════════
  // AI AGENTS (Admin)
  // ═══════════════════════════════════════════

  app.get("/api/ai-agents", authMiddleware, async (req: Request, res: Response) => {
    const agents = await storage.getAllAiAgents();
    return res.json(agents);
  });

  app.get("/api/ai-agents/:id", authMiddleware, async (req: Request, res: Response) => {
    const agentId = req.params.id as string;
    const agent = await storage.getAiAgent(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    return res.json(agent);
  });

  app.post("/api/ai-agents", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    const { name, slug, description, system_prompt, model, is_active, keywords } = req.body;
    if (!name || !slug || !system_prompt) {
      return res.status(400).json({ message: "name, slug, and system_prompt are required" });
    }
    const agent = await storage.createAiAgent({ name, slug, description, system_prompt, model: model || "gpt-5.2", is_active: is_active ?? true, keywords });
    return res.status(201).json(agent);
  });

  app.patch("/api/ai-agents/:id", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    const agentId = req.params.id as string;
    const agent = await storage.getAiAgent(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });
    const updated = await storage.updateAiAgent(agentId, req.body);
    return res.json(updated);
  });

  app.delete("/api/ai-agents/:id", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    const agentId = req.params.id as string;
    await storage.deleteAiAgent(agentId);
    return res.json({ ok: true });
  });

  // ═══════════════════════════════════════════
  // DASHBOARD (Admin)
  // ═══════════════════════════════════════════

  app.get("/api/dashboard/overview", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to ? new Date(req.query.to as string) : new Date();
      const data = await storage.getDashboardOverview(from, to);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dashboard/timeseries", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const metric = (req.query.metric as string) || "volume";
      const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to ? new Date(req.query.to as string) : new Date();
      const granularity = (req.query.granularity as string) || "day";
      const data = await storage.getDashboardTimeseries(metric, from, to, granularity);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dashboard/breakdowns", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const by = (req.query.by as string) || "category";
      const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to ? new Date(req.query.to as string) : new Date();
      const data = await storage.getDashboardBreakdowns(by, from, to);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/dashboard/top-issues", authMiddleware, requireRole("admin"), async (req: Request, res: Response) => {
    try {
      const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = req.query.to ? new Date(req.query.to as string) : new Date();
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const data = await storage.getDashboardTopIssues(from, to, limit);
      return res.json(data);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
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
