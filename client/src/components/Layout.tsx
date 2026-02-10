import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Activity, 
  Users, 
  Settings, 
  Search, 
  LogOut,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { USERS } from "@/lib/mockData";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const currentUser = USERS[0]; // Mock logged in user

  const navItems = [
    { href: "/", label: "Inbox", icon: LayoutDashboard },
    { href: "/feed", label: "Activity Feed", icon: Activity },
    { href: "/admin", label: "Team", icon: Users },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="font-mono font-bold text-lg tracking-tight flex items-center gap-2">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
            MISSION CTL
          </h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
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
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-8 h-8 rounded-full border border-sidebar-border"
            />
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{currentUser.role}</p>
            </div>
          </div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Top Header */}
        <header className="h-14 border-b px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input 
                type="text" 
                placeholder="Search tickets (ID, content)..." 
                className="w-full h-9 pl-9 pr-4 text-sm bg-muted/50 border-none rounded-md focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/70"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </main>
    </div>
  );
}
