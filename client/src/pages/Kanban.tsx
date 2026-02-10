import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { 
  Filter, 
  MoreHorizontal, 
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";

type TicketStatus = 'inbox' | 'needs_info' | 'assigned' | 'in_progress' | 'waiting' | 'review' | 'done';
type TicketSeverity = 'S1' | 'S2' | 'S3';

interface TicketData {
  id: string;
  public_id: string;
  title: string;
  status: string;
  queue: string;
  severity: string;
  assignee_ids: string[];
  last_activity_at: string;
  created_at: string;
}

function useStatusColumns() {
  const { t } = useI18n();
  return [
    { id: 'inbox' as TicketStatus, label: t("status.inbox") },
    { id: 'needs_info' as TicketStatus, label: t("status.needs_info") },
    { id: 'assigned' as TicketStatus, label: t("status.assigned") },
    { id: 'in_progress' as TicketStatus, label: t("status.in_progress") },
    { id: 'waiting' as TicketStatus, label: t("status.waiting") },
    { id: 'review' as TicketStatus, label: t("status.review") },
    { id: 'done' as TicketStatus, label: t("status.done") },
  ];
}

const SEVERITY_COLORS: Record<string, string> = {
  S1: "bg-destructive/15 text-destructive border-destructive/20",
  S2: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  S3: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
};

export default function Kanban() {
  const { t } = useI18n();
  const [filterQueue, setFilterQueue] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const statusColumns = useStatusColumns();

  const params = new URLSearchParams();
  if (filterQueue) params.set("queue", filterQueue);
  if (filterSeverity) params.set("severity", filterSeverity);

  const { data: tickets = [], isLoading } = useQuery<TicketData[]>({
    queryKey: ["/api/tickets" + (params.toString() ? `?${params}` : "")],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 15000,
  });

  const { data: users = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiRequest("PATCH", `/api/tickets/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  const getTicketsByStatus = (status: TicketStatus) => {
    return tickets.filter(t => t.status === status);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        <div className="px-6 py-3 border-b flex items-center gap-4 bg-background/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
            <Filter className="w-4 h-4" />
            <span>{t("kanban.filters")}</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted/50 transition-colors flex items-center gap-2" data-testid="filter-queue">
              {t("kanban.queue")}: {filterQueue ? filterQueue : t("kanban.all")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilterQueue(null)}>{t("kanban.all")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterQueue('support')}>{t("queue.support")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterQueue('budget')}>{t("queue.budget")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterQueue('logistics')}>{t("queue.logistics")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger className="px-3 py-1.5 text-xs font-medium border rounded-md hover:bg-muted/50 transition-colors flex items-center gap-2" data-testid="filter-severity">
              {t("kanban.severity")}: {filterSeverity ? filterSeverity : t("kanban.all")}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilterSeverity(null)}>{t("kanban.all")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSeverity('S1')}>{t("severity.s1")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSeverity('S2')}>{t("severity.s2")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterSeverity('S3')}>{t("severity.s3")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto text-xs text-muted-foreground">
            {tickets.length} {t("kanban.tickets")}
          </div>
        </div>

        <div className="flex-1 overflow-y-hidden p-3 px-4">
          <div className="flex h-full gap-2">
            {statusColumns.map(column => {
              const columnTickets = getTicketsByStatus(column.id);
              
              return (
                <div key={column.id} className="flex-1 min-w-0 flex flex-col h-full rounded-lg bg-muted/30 border border-border/50">
                  <div className="px-2 py-2 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/20">
                    <h3 className="font-medium text-xs flex items-center gap-1.5 truncate">
                      <span className="truncate">{column.label}</span>
                      <span className="px-1 py-0.5 rounded-full bg-background border text-[9px] text-muted-foreground font-mono shrink-0">
                        {columnTickets.length}
                      </span>
                    </h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
                    {columnTickets.map(ticket => (
                      <div 
                        key={ticket.id} 
                        className="group relative bg-card border rounded-md p-2 shadow-sm hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
                        data-testid={`card-ticket-${ticket.public_id}`}
                      >
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="p-0.5 hover:bg-muted rounded text-muted-foreground">
                              <MoreHorizontal className="w-3 h-3" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {statusColumns.filter(s => s.id !== ticket.status).map(s => (
                                <DropdownMenuItem 
                                  key={s.id} 
                                  onClick={() => statusMutation.mutate({ id: ticket.id, status: s.id })}
                                >
                                  {t("kanban.move_to")} {s.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <Link href={`/ticket/${ticket.id}`} className="block">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-mono text-[9px] text-muted-foreground font-medium">
                              {ticket.public_id}
                            </span>
                            <Badge variant="outline" className={cn("text-[9px] py-0 px-1 h-3.5", SEVERITY_COLORS[ticket.severity])}>
                              {ticket.severity}
                            </Badge>
                          </div>
                          
                          <h4 className="text-xs font-medium leading-tight mb-1.5 pr-3 text-card-foreground line-clamp-2">
                            {ticket.title}
                          </h4>
                          
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="secondary" className="text-[9px] font-normal text-muted-foreground bg-muted px-1 py-0">
                              {ticket.queue}
                            </Badge>
                            
                            <div className="flex items-center gap-1">
                              {ticket.assignee_ids.length > 0 ? (
                                <div className="flex -space-x-1">
                                  {ticket.assignee_ids.slice(0, 2).map(uid => {
                                    const user = users.find(u => u.id === uid);
                                    if (!user) return null;
                                    return (
                                      <div 
                                        key={uid} 
                                        className="w-4 h-4 rounded-full border border-card bg-primary/10 flex items-center justify-center text-[7px] font-bold text-primary"
                                        title={user.name}
                                      >
                                        {user.name.charAt(0)}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-[9px] text-muted-foreground italic">{t("kanban.unassigned")}</span>
                              )}
                            </div>
                          </div>
                        </Link>
                      </div>
                    ))}
                    {columnTickets.length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-8 opacity-50">
                        {t("kanban.no_tickets")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
