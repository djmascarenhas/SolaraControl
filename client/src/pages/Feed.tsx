import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";
import { 
  MessageSquare, 
  Tag, 
  GitPullRequest, 
  PlusCircle, 
  Building2,
  AlertCircle,
  Activity as ActivityIconLucide,
  Send,
  UserPlus,
  Loader2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Link } from "wouter";

interface FeedActivity {
  id: string;
  type: string;
  ticket_id: string | null;
  user_id: string | null;
  payload: any;
  created_at: string;
  ticket: { id: string; public_id: string; title: string } | null;
  user: { id: string; name: string; email: string } | null;
}

const ActivityIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'ticket_created': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
    case 'status_changed': return <GitPullRequest className="w-4 h-4 text-blue-500" />;
    case 'queue_changed': return <Tag className="w-4 h-4 text-purple-500" />;
    case 'comment_added': return <MessageSquare className="w-4 h-4 text-slate-500" />;
    case 'company_pending_review': return <Building2 className="w-4 h-4 text-orange-500" />;
    case 'telegram_message_sent': return <Send className="w-4 h-4 text-blue-500" />;
    case 'telegram_message_received': return <MessageSquare className="w-4 h-4 text-emerald-500" />;
    case 'assigned_changed': return <UserPlus className="w-4 h-4 text-indigo-500" />;
    default: return <ActivityIconLucide className="w-4 h-4 text-slate-400" />;
  }
};

function getActivityDescription(activity: FeedActivity): string {
  const userName = activity.user?.name || "System";
  switch (activity.type) {
    case 'ticket_created':
      return `New ticket created: "${activity.payload?.title || ''}"`;
    case 'status_changed':
      return `${userName} changed status from "${activity.payload?.from}" to "${activity.payload?.to}"`;
    case 'queue_changed':
      return `${userName} moved ticket from "${activity.payload?.from}" to "${activity.payload?.to}" queue`;
    case 'comment_added':
      return `${userName} ${activity.payload?.is_internal ? 'added an internal note' : 'commented'}: "${activity.payload?.snippet || ''}"`;
    case 'telegram_message_sent':
      return `${userName} sent a Telegram reply: "${activity.payload?.snippet || ''}"`;
    case 'assigned_changed':
      return `${userName} updated assignees`;
    case 'company_pending_review':
      return `Company "${activity.payload?.company_name}" (CNPJ: ${activity.payload?.cnpj}) needs review`;
    default:
      return activity.type;
  }
}

export default function Feed() {
  const { t } = useI18n();
  const { data: activities = [], isLoading } = useQuery<FeedActivity[]>({
    queryKey: ["/api/feed"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 15000,
  });

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
      <div className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold mb-6 tracking-tight">{t("feed.title")}</h2>
        
        {activities.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("feed.empty")}</p>
        ) : (
          <div className="relative border-l border-border/60 ml-3 space-y-8">
            {activities.map((activity) => (
              <div key={activity.id} className="relative pl-8" data-testid={`activity-${activity.id}`}>
                <div className="absolute -left-[9px] top-1 p-1 bg-background rounded-full border border-border">
                  <ActivityIcon type={activity.type} />
                </div>
                
                <div className="bg-card border rounded-lg p-4 shadow-sm hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {format(new Date(activity.created_at), "MMM d, HH:mm")}
                    </span>
                    {activity.ticket && (
                      <Link href={`/ticket/${activity.ticket.id}`} className="text-xs font-mono font-medium text-primary hover:underline">
                        {activity.ticket.public_id}
                      </Link>
                    )}
                  </div>
                  
                  <div className="text-sm">
                    {activity.type === 'company_pending_review' ? (
                      <div className="flex items-start gap-3 bg-orange-500/10 p-3 rounded-md border border-orange-500/20">
                        <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-orange-700 dark:text-orange-300">Company Review Needed</p>
                          <p className="mt-1 text-muted-foreground">
                            {getActivityDescription(activity)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-card-foreground">{getActivityDescription(activity)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
