import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import { Layout } from "@/components/Layout";
import { TICKETS, COMMENTS, VISITORS, COMPANIES, USERS, TicketStatus, TicketQueue, TicketSeverity, User as UserType } from "@/lib/mockData";
import { format } from "date-fns";
import { 
  Send, 
  Lock, 
  User, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  AlertTriangle,
  ChevronDown,
  Paperclip,
  CheckCircle2,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
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

export default function TicketDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState<'reply' | 'note'>('reply');
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock fetching data
  const ticket = TICKETS.find(t => t.id === id);
  const comments = COMMENTS.filter(c => c.ticket_id === id).sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  if (!ticket) return <Layout><div className="p-10">Ticket not found</div></Layout>;

  const visitor = VISITORS.find(v => v.id === ticket.visitor_id);
  const company = visitor?.company_id ? COMPANIES.find(c => c.id === visitor.company_id) : null;
  const assignees = ticket.assignee_ids.map(uid => USERS.find(u => u.id === uid)).filter((u): u is UserType => !!u);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  return (
    <Layout>
      <div className="h-full flex flex-col md:flex-row bg-background">
        
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border/50">
          {/* Header */}
          <div className="h-16 border-b border-border/50 flex items-center justify-between px-6 bg-background shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-muted-foreground">{ticket.public_id}</span>
                {ticket.severity === 'S1' && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">CRITICAL</Badge>
                )}
              </div>
              <h2 className="font-semibold text-lg truncate leading-none">{ticket.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn(
                "uppercase tracking-wider font-mono text-[10px]",
                ticket.status === 'done' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-muted text-muted-foreground"
              )}>
                {ticket.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-muted/5 dark:bg-background/50 space-y-6">
             {/* Ticket Description as first message */}
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

              {/* Thread */}
              {comments.map((comment) => {
                const isInternal = comment.is_internal;
                const author = comment.author_type === 'visitor' ? visitor : USERS.find(u => u.id === comment.author_id);
                
                return (
                  <div key={comment.id} className={cn(
                    "flex gap-4 max-w-3xl",
                    isInternal ? "ml-auto flex-row-reverse" : ""
                  )}>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                      isInternal ? "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800" : "bg-slate-200 dark:bg-slate-800 border-transparent"
                    )}>
                      {isInternal ? <Lock className="w-3 h-3 text-amber-600 dark:text-amber-400" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    
                    <div className={cn(
                      "flex flex-col",
                      isInternal ? "items-end" : "items-start"
                    )}>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-medium text-sm">{author?.name || 'Unknown'}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(comment.created_at), "MMM d, HH:mm")}</span>
                        {isInternal && <span className="text-[10px] font-mono text-amber-600 bg-amber-100 dark:bg-amber-900/40 px-1 rounded">INTERNAL NOTE</span>}
                      </div>
                      
                      <div className={cn(
                        "p-3 rounded-lg text-sm leading-relaxed whitespace-pre-wrap shadow-sm max-w-[500px]",
                        isInternal 
                          ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-100 rounded-tr-none" 
                          : comment.author_type === 'admin' 
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

          {/* Composer */}
          <div className="p-4 bg-background border-t border-border shrink-0">
            <div className="max-w-4xl mx-auto border rounded-lg shadow-sm bg-card overflow-hidden focus-within:ring-1 focus-within:ring-primary transition-all">
              <div className="flex border-b bg-muted/30">
                <button
                  onClick={() => setActiveTab('reply')}
                  className={cn(
                    "px-4 py-2 text-xs font-medium border-r transition-colors flex items-center gap-2",
                    activeTab === 'reply' ? "bg-card text-foreground border-b-transparent" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Send className="w-3 h-3" /> Reply to Visitor
                </button>
                <button
                  onClick={() => setActiveTab('note')}
                  className={cn(
                    "px-4 py-2 text-xs font-medium border-r transition-colors flex items-center gap-2",
                    activeTab === 'note' ? "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-b-transparent" : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Lock className="w-3 h-3" /> Internal Note
                </button>
              </div>
              <div className={cn(
                "p-3",
                activeTab === 'note' && "bg-amber-50/50 dark:bg-amber-950/10"
              )}>
                <Textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={activeTab === 'reply' ? "Write a reply..." : "Add a private note for the team..."}
                  className="min-h-[100px] border-none focus-visible:ring-0 resize-none bg-transparent p-0 text-sm"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-border/50">
                   <div className="flex gap-2">
                     <button className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                        <Paperclip className="w-4 h-4" />
                     </button>
                   </div>
                   <Button 
                    size="sm" 
                    className={cn(
                      "gap-2",
                      activeTab === 'note' ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                    )}
                   >
                     {activeTab === 'reply' ? "Send Reply" : "Save Note"} 
                     {activeTab === 'reply' && <Send className="w-3 h-3" />}
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="w-80 border-l border-border bg-muted/10 shrink-0 overflow-y-auto">
          <div className="p-6 space-y-8">
            
            {/* Ticket Properties */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Properties</h3>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select defaultValue={ticket.status}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbox">Inbox</SelectItem>
                      <SelectItem value="needs_info">Needs Info</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Queue</label>
                  <Select defaultValue={ticket.queue}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="budget">Budget</SelectItem>
                      <SelectItem value="logistics">Logistics</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Severity</label>
                  <Select defaultValue={ticket.severity}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="S1">S1 - Critical</SelectItem>
                      <SelectItem value="S2">S2 - Major</SelectItem>
                      <SelectItem value="S3">S3 - Minor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Assignees</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {assignees.map(u => (
                       <Badge key={u.id} variant="secondary" className="gap-1 pl-1 pr-2 py-0.5 font-normal">
                         <img src={u.avatar} className="w-4 h-4 rounded-full" />
                         {u.name}
                       </Badge>
                    ))}
                    <button className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">
                      <span className="text-xs">+</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Visitor Info */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                Visitor
                <Badge variant="outline" className="text-[10px] h-4 py-0 px-1">{visitor?.persona_type}</Badge>
              </h3>
              
              {visitor && (
                <div className="bg-card rounded-md border p-3 space-y-3 text-sm shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                      {visitor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{visitor.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{visitor.telegram_handle}</p>
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
                  </div>
                </div>
              )}
            </div>

            {/* Company Info (if B2B) */}
            {company && (
              <>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Company</h3>
                    {company.status === 'pending_review' && (
                      <Badge variant="destructive" className="h-4 text-[9px] px-1 bg-orange-500 hover:bg-orange-600 border-none">REVIEW</Badge>
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
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location</span>
                        <span className="">{company.city}, {company.uf}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Other Tickets */}
            <Separator />
             <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">History</h3>
              <div className="space-y-2">
                {TICKETS.filter(t => t.visitor_id === visitor?.id && t.id !== ticket.id).map(otherTicket => (
                   <div key={otherTicket.id} className="flex items-center justify-between p-2 rounded border border-transparent hover:border-border hover:bg-card transition-colors cursor-pointer text-xs">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", 
                          otherTicket.status === 'done' ? "bg-emerald-500" : "bg-blue-500"
                        )} />
                        <span className="truncate">{otherTicket.title}</span>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{otherTicket.public_id}</span>
                   </div>
                ))}
                {TICKETS.filter(t => t.visitor_id === visitor?.id && t.id !== ticket.id).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No other tickets.</p>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
