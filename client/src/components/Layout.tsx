import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Search, 
  LogOut,
  Bell,
  Sun,
  Moon,
  Droplets
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useTheme, type Theme } from "@/lib/theme";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const THEME_CYCLE: { current: Theme; next: Theme; icon: typeof Sun; label: string }[] = [
  { current: "light", next: "dark", icon: Sun, label: "Light" },
  { current: "dark", next: "light-blue", icon: Moon, label: "Dark" },
  { current: "light-blue", next: "light", icon: Droplets, label: "Blue" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { href: "/", label: t("nav.inbox"), icon: LayoutDashboard },
    { href: "/feed", label: t("nav.feed"), icon: Activity },
    ...(user?.role === "admin" ? [{ href: "/admin", label: t("nav.team"), icon: Users }] : []),
  ];

  const currentTheme = THEME_CYCLE.find(tc => tc.current === theme) || THEME_CYCLE[0];
  const ThemeIcon = currentTheme.icon;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-52 border-r border-sidebar-border bg-sidebar flex flex-col shrink-0">
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="font-mono font-bold text-sm tracking-tight flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
            MISSION CTL
          </h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                  isActive 
                    ? "bg-sidebar-primary/10 text-sidebar-primary" 
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}>
                  <Icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {user?.name?.charAt(0) || "?"}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-3 h-3" />
            {t("nav.signout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder={t("header.search")}
                className="w-full h-9 pl-9 pr-4 text-sm bg-muted/50 border-none rounded-md focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/70"
                data-testid="input-search"
              />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLang("pt")}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all",
                    lang === "pt" 
                      ? "bg-primary/10 ring-1 ring-primary/30" 
                      : "hover:bg-muted/80 opacity-50 hover:opacity-100"
                  )}
                  data-testid="button-lang-pt"
                >
                  🇧🇷
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Português</p></TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLang("en")}
                  className={cn(
                    "w-8 h-8 rounded-md flex items-center justify-center text-lg transition-all",
                    lang === "en" 
                      ? "bg-primary/10 ring-1 ring-primary/30" 
                      : "hover:bg-muted/80 opacity-50 hover:opacity-100"
                  )}
                  data-testid="button-lang-en"
                >
                  🇺🇸
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>English</p></TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setTheme(currentTheme.next)}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all"
                  data-testid="button-theme"
                >
                  <ThemeIcon className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>{currentTheme.label}</p></TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border mx-1" />

            <button className="relative text-muted-foreground hover:text-foreground transition-colors w-8 h-8 flex items-center justify-center">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
