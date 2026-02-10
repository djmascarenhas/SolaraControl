import { Layout } from "@/components/Layout";
import { ACTIVITIES, USERS, Ticket, TICKETS, Activity as ActivityType } from "@/lib/mockData";
import { format } from "date-fns";
import { 
  MessageSquare, 
  Tag, 
  GitPullRequest, 
  ArrowRightCircle, 
  PlusCircle, 
  Building2,
  AlertCircle,
  Activity as ActivityIconLucide
} from "lucide-react";
import { cn } from "@/lib/utils";

const ActivityIcon = ({ type }: { type: ActivityType['type'] }) => {
  switch (type) {
    case 'ticket_created': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
    case 'status_changed': return <GitPullRequest className="w-4 h-4 text-blue-500" />;
    case 'queue_changed': return <Tag className="w-4 h-4 text-purple-500" />;
    case 'comment_added': return <MessageSquare className="w-4 h-4 text-slate-500" />;
    case 'company_pending_review': return <Building2 className="w-4 h-4 text-orange-500" />;
    default: return <ActivityIconLucide className="w-4 h-4 text-slate-400" />;
  }
};

export default function Feed() {
  const sortedActivities = [...ACTIVITIES].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-8">
        <h2 className="text-2xl font-bold mb-6 tracking-tight">Activity Feed</h2>
        
        <div className="relative border-l border-border/60 ml-3 space-y-8">
          {sortedActivities.map((activity) => {
            const ticket = TICKETS.find(t => t.id === activity.ticket_id);
            const user = USERS.find(u => u.id === activity.user_id);
            
            return (
              <div key={activity.id} className="relative pl-8">
                <div className="absolute -left-[9px] top-1 p-1 bg-background rounded-full border border-border">
                  <ActivityIcon type={activity.type} />
                </div>
                
                <div className="bg-card border rounded-lg p-4 shadow-sm hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-mono text-muted-foreground">
                      {format(new Date(activity.created_at), "MMM d, HH:mm")}
                    </span>
                    {ticket && (
                      <span className="text-xs font-mono font-medium text-primary">
                        {ticket.public_id}
                      </span>
                    )}
                  </div>
                  
                  <div className="text-sm">
                    {activity.type === 'ticket_created' && (
                      <p>
                        New ticket created: <span className="font-medium text-foreground">"{activity.payload.title}"</span>
                      </p>
                    )}
                    {activity.type === 'comment_added' && user && (
                      <div className="flex flex-col gap-1">
                        <p className="font-medium text-foreground flex items-center gap-2">
                          <img src={user.avatar} className="w-4 h-4 rounded-full" />
                          {user.name} commented
                        </p>
                        <p className="text-muted-foreground italic">"{activity.payload.snippet}"</p>
                      </div>
                    )}
                    {activity.type === 'company_pending_review' && (
                      <div className="flex items-start gap-3 bg-orange-500/10 p-3 rounded-md border border-orange-500/20">
                        <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-orange-700 dark:text-orange-300">Company Review Needed</p>
                          <p className="mt-1 text-muted-foreground">
                            <span className="font-medium text-foreground">{activity.payload.company_name}</span> (CNPJ: {activity.payload.cnpj}) needs verification.
                          </p>
                          <button className="mt-2 text-xs bg-orange-500 text-white px-3 py-1 rounded-sm font-medium hover:bg-orange-600">
                            Review Now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
