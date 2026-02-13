import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { 
  Send, 
  Lock, 
  User, 
  Building2, 
  Phone, 
  Mail, 
  AlertTriangle,
  Paperclip,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface TicketDetailData {
  id: string;
  public_id: string;
  title: string;
  description: string;
  status: string;
  queue: string;
  severity: string;
  assignee_ids: string[];
  visitor_id: string | null;
  company_id: string | null;
  source_chat_id: number | null;
  created_at: string;
  last_activity_at: string;
  visitor: {
    id: string;
    name: string | null;
    telegram_user_id: number | null;
    persona_type: string | null;
    email: string | null;
    whatsapp: string | null;
    uf: string | null;
    city: string | null;
  } | null;
  company: {
    id: string;
    trade_name: string;
    legal_name: string;
    cnpj: string;
    status: string;
    city: string | null;
    uf: string | null;
    phone: string | null;
  } | null;
  other_tickets: {
    id: string;
    public_id: string;
    title: string;
    status: string;
  }[];
}

interface CommentData {
  id: string;
  ticket_id: string;
  author_type: string;
  author_ref: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export default function TicketDetail() {
  const { id } = useParams();
  const { user: authUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'reply' | 'note'>('reply');
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();

  const { data: ticket, isLoading: ticketLoading } = useQuery<TicketDetailData>({
    queryKey: [`/api/tickets/${id}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<CommentData[]>({
    queryKey: [`/api/tickets/${id}/comments`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const { data: users = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ["/api/users"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/tickets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async ({ body, is_internal }: { body: string; is_internal: boolean }) => {
      const endpoint = is_internal ? `/api/tickets/${id}/comments` : `/api/tickets/${id}/reply`;
      await apiRequest("POST", endpoint, { body, is_internal });
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}/comments`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tickets/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      toast({ title: activeTab === 'reply' ? t("ticket.reply_sent") : t("ticket.note_saved") });
    },
    onError: (err: any) => {
      toast({ title: t("error"), description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  if (ticketLoading || !ticket) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  const visitor = ticket.visitor;
  const company = ticket.company;
  const assignees = ticket.assignee_ids.map(uid => users.find(u => u.id === uid)).filter(Boolean) as { id: string; name: string }[];

  const getUserName = (authorRef: string | null, authorType: string) => {
    if (authorType === 'visitor') return visitor?.name || 'Visitor';
    if (authorType === 'system') return 'System';
    if (authorRef) {
      const u = users.find(u => u.id === authorRef);
      return u?.name || 'Agent';
    }
    return 'Unknown';
  };

  const handleSend = () => {
    if (!replyText.trim()) return;
    commentMutation.mutate({
      body: replyText.trim(),
      is_internal: activeTab === 'note',
    });
  };

  return (
    <Layout>
      <div className="h-full flex flex-col md:flex-row bg-background">
        
        <div className="flex-1 flex flex-col min-w-0 md:border-r border-border/50">
          <div className="h-14 sm:h-16 border-b border-border/50 flex items-center justify-between px-3 sm:px-6 bg-background shrink-0">
            <div className="min-w-0 flex items-center gap-2 sm:gap-4">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-bold text-muted-foreground">{ticket.public_id}</span>
                  {ticket.severity === 'S1' && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{t("ticket.critical")}</Badge>
                  )}
                </div>
                <h2 className="font-semibold text-lg truncate leading-none">{ticket.title}</h2>
              </div>
            </div>
            <Badge variant="outline" className={cn(
              "uppercase tracking-wider font-mono text-[10px]",
              ticket.status === 'done' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"
            )}>
              {ticket.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-muted/5 dark:bg-background/50 space-y-4 sm:space-y-6">
             <div className="flex gap-4 max-w-3xl">
                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-medium text-sm">{visitor?.name || 'Visitor'}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(ticket.created_at), "MMM d, HH:mm")}</span>
                  </div>
                  <div className="bg-muted/30 border border-border p-4 rounded-lg rounded-tl-none text-sm leading-relaxed whitespace-pre-wrap">
                    {ticket.description}
                  </div>
                </div>
              </div>

              {comments.map((comment) => {
                const isInternal = comment.is_internal;
                const isAdmin = comment.author_type === 'admin';
                const authorName = getUserName(comment.author_ref, comment.author_type);
                
                return (
                  <div key={comment.id} className={cn(
                    "flex gap-4 max-w-3xl",
                    isAdmin ? "ml-auto flex-row-reverse" : ""
                  )} data-testid={`comment-${comment.id}`}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                      isInternal ? "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800" : 
                      isAdmin ? "bg-primary/10 border-primary/20" : "bg-slate-200 dark:bg-slate-800 border-transparent"
                    )}>
                      {isInternal ? <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> : 
                       <span className="text-[10px] font-bold text-primary">{authorName.charAt(0)}</span>}
                    </div>
                    
                    <div className={cn("flex flex-col", isAdmin ? "items-end" : "items-start")}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-medium text-sm">{authorName}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), "MMM d, HH:mm")}</span>
                        {isInternal && <span className="text-[10px] font-mono text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{t("ticket.internal")}</span>}
                      </div>
                      
                      <div className={cn(
                        "p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap shadow-sm max-w-[500px]",
                        isInternal 
                          ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 rounded-tr-none" 
                          : isAdmin 
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border border-border rounded-tl-none"
                      )}>
                        {comment.body}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
          </div>

          {authUser?.role !== 'viewer' && (
            <div className="p-4 bg-background border-t border-border shrink-0">
              <div className="max-w-4xl mx-auto border rounded-lg shadow-sm bg-card overflow-hidden focus-within:ring-1 focus-within:ring-primary transition-all">
                <div className="flex border-b bg-muted/30">
                  <button
                    onClick={() => setActiveTab('reply')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium border-r transition-colors flex items-center gap-2",
                      activeTab === 'reply' ? "bg-card text-foreground border-b-transparent" : "text-muted-foreground hover:bg-muted/50"
                    )}
                    data-testid="tab-reply"
                  >
                    <Send className="w-3 h-3" /> {t("ticket.reply")}
                  </button>
                  <button
                    onClick={() => setActiveTab('note')}
                    className={cn(
                      "px-4 py-2 text-xs font-medium border-r transition-colors flex items-center gap-2",
                      activeTab === 'note' ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-b-transparent" : "text-muted-foreground hover:bg-muted/50"
                    )}
                    data-testid="tab-note"
                  >
                    <Lock className="w-3 h-3" /> {t("ticket.note")}
                  </button>
                </div>
                <div className={cn("p-3", activeTab === 'note' && "bg-amber-50/50 dark:bg-amber-950/10")}>
                  <Textarea 
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={activeTab === 'reply' ? t("ticket.reply_placeholder") : t("ticket.note_placeholder")}
                    className="min-h-[100px] border-none focus-visible:ring-0 resize-none bg-transparent p-0 text-sm"
                    data-testid="textarea-composer"
                  />
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-border/50">
                     <div />
                     <Button 
                      size="sm" 
                      disabled={commentMutation.isPending || !replyText.trim()}
                      onClick={handleSend}
                      className={cn("gap-2", activeTab === 'note' ? "bg-amber-600 hover:bg-amber-700 text-white" : "")}
                      data-testid="button-send"
                     >
                       {commentMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                       {activeTab === 'reply' ? t("ticket.send_reply") : t("ticket.save_note")} 
                       {activeTab === 'reply' && !commentMutation.isPending && <Send className="w-3 h-3" />}
                     </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-border bg-muted/10 shrink-0 overflow-y-auto">
          <div className="p-3 sm:p-6 space-y-6 sm:space-y-8">
            
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("ticket.properties")}</h3>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("ticket.status")}</label>
                  <Select 
                    value={ticket.status} 
                    onValueChange={(v) => updateMutation.mutate({ status: v })}
                    disabled={authUser?.role === 'viewer'}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background" data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbox">{t("status.inbox")}</SelectItem>
                      <SelectItem value="needs_info">{t("status.needs_info")}</SelectItem>
                      <SelectItem value="assigned">{t("status.assigned")}</SelectItem>
                      <SelectItem value="in_progress">{t("status.in_progress")}</SelectItem>
                      <SelectItem value="waiting">{t("status.waiting")}</SelectItem>
                      <SelectItem value="review">{t("status.review")}</SelectItem>
                      <SelectItem value="done">{t("status.done")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("ticket.queue")}</label>
                  <Select 
                    value={ticket.queue}
                    onValueChange={(v) => updateMutation.mutate({ queue: v })}
                    disabled={authUser?.role === 'viewer'}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background" data-testid="select-queue">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="support">{t("queue.support")}</SelectItem>
                      <SelectItem value="budget">{t("queue.budget")}</SelectItem>
                      <SelectItem value="logistics">{t("queue.logistics")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("ticket.severity")}</label>
                  <Select 
                    value={ticket.severity}
                    onValueChange={(v) => updateMutation.mutate({ severity: v })}
                    disabled={authUser?.role === 'viewer'}
                  >
                    <SelectTrigger className="h-8 text-xs bg-background" data-testid="select-severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S1">{t("severity.s1")}</SelectItem>
                      <SelectItem value="S2">{t("severity.s2")}</SelectItem>
                      <SelectItem value="S3">{t("severity.s3")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("ticket.assignees")}</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {assignees.map(u => (
                       <Badge key={u.id} variant="secondary" className="gap-1 pl-1 pr-2 py-0.5 font-normal">
                         <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center text-[8px] text-primary font-bold">{u.name.charAt(0)}</div>
                         {u.name}
                       </Badge>
                    ))}
                  </div>
                  <Select onValueChange={(userId) => {
                    const current = ticket.assignee_ids;
                    if (!current.includes(userId)) {
                      updateMutation.mutate({ assignee_ids: [...current, userId] });
                    }
                  }}>
                    <SelectTrigger className="h-7 text-xs bg-background" data-testid="select-assignee">
                      <SelectValue placeholder={t("ticket.add_assignee")} />
                    </SelectTrigger>
                    <SelectContent>
                      {users.filter(u => !ticket.assignee_ids.includes(u.id)).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {visitor && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  {t("ticket.visitor")}
                  {visitor.persona_type && <Badge variant="outline" className="text-[10px] h-4 py-0 px-1">{visitor.persona_type}</Badge>}
                </h3>
                
                <div className="bg-card rounded-md border p-3 space-y-3 text-sm shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {(visitor.name || '?').charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{visitor.name || 'Unknown'}</p>
                      {visitor.telegram_user_id && (
                        <p className="text-xs text-muted-foreground font-mono">TG: {visitor.telegram_user_id}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2">
                    {visitor.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span className="text-xs truncate">{visitor.email}</span>
                      </div>
                    )}
                    {visitor.whatsapp && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span className="text-xs">{visitor.whatsapp}</span>
                      </div>
                    )}
                    {visitor.city && visitor.uf && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">{visitor.city}, {visitor.uf}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {company && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("ticket.company")}</h3>
                    {company.status === 'pending_review' && (
                      <Badge variant="destructive" className="h-4 text-[9px] px-1 bg-orange-500 hover:bg-orange-600 border-none">{t("ticket.company_review")}</Badge>
                    )}
                  </div>
                  
                  <div className={cn(
                    "bg-card rounded-md border p-3 space-y-3 text-sm shadow-sm relative overflow-hidden",
                    company.status === 'pending_review' && "border-orange-500/50 ring-1 ring-orange-500/20"
                  )}>
                    {company.status === 'pending_review' && (
                      <div className="absolute top-0 right-0 p-1.5 bg-orange-500/10 rounded-bl-lg">
                         <AlertTriangle className="w-3 h-3 text-orange-600" />
                      </div>
                    )}
                    
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <p className="font-semibold leading-tight">{company.trade_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{company.legal_name}</p>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CNPJ</span>
                        <span className="font-mono select-all">{company.cnpj}</span>
                      </div>
                      {company.city && company.uf && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Location</span>
                          <span>{company.city}, {company.uf}</span>
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Phone</span>
                          <span className="font-mono">{company.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />
             <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("ticket.other_tickets")}</h3>
              <div className="space-y-2">
                {ticket.other_tickets.map(otherTicket => (
                   <Link key={otherTicket.id} href={`/ticket/${otherTicket.id}`}>
                     <div className="flex items-center justify-between p-2 rounded border border-transparent hover:border-border hover:bg-card transition-colors cursor-pointer text-xs">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", 
                            otherTicket.status === 'done' ? "bg-emerald-500" : "bg-blue-500"
                          )} />
                          <span className="truncate">{otherTicket.title}</span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">{otherTicket.public_id}</span>
                     </div>
                   </Link>
                ))}
                {ticket.other_tickets.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">{t("ticket.no_other")}</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
