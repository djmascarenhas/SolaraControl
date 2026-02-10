import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    async () => {
      log(`serving on port ${port}`);

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      const replSlug = process.env.REPL_SLUG;
      const replOwner = process.env.REPL_OWNER;
      const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;

      if (botToken) {
        let webhookUrl = "";
        if (replitDevDomain) {
          webhookUrl = `https://${replitDevDomain}/api/telegram/webhook`;
        } else if (replSlug && replOwner) {
          webhookUrl = `https://${replSlug}.${replOwner}.repl.co/api/telegram/webhook`;
        }

        if (webhookUrl) {
          try {
            const params: any = { url: webhookUrl };
            if (webhookSecret) {
              params.secret_token = webhookSecret;
            }

            const res = await fetch(
              `https://api.telegram.org/bot${botToken}/setWebhook`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
              }
            );
            const data = await res.json() as any;
            if (data.ok) {
              log(`Telegram webhook registered: ${webhookUrl}`, "telegram");
            } else {
              log(`Telegram webhook registration failed: ${data.description}`, "telegram");
            }
          } catch (err: any) {
            log(`Telegram webhook registration error: ${err.message}`, "telegram");
          }
        } else {
          log("Telegram webhook: could not determine app URL", "telegram");
        }
      }
    },
  );
})();
