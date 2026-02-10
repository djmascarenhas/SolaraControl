import { format, subMinutes, subHours, subDays } from 'date-fns';

export type UserRole = 'admin' | 'member' | 'viewer';
export type TicketStatus = 'inbox' | 'needs_info' | 'assigned' | 'in_progress' | 'waiting' | 'review' | 'done';
export type TicketQueue = 'support' | 'budget' | 'logistics';
export type TicketSeverity = 'S1' | 'S2' | 'S3';
export type PersonaType = 'consumer' | 'integrator' | 'provider';
export type CompanyStatus = 'active' | 'pending_review' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Company {
  id: string;
  legal_name: string;
  trade_name: string;
  cnpj: string;
  status: CompanyStatus;
  phone?: string;
  city?: string;
  uf?: string;
}

export interface Visitor {
  id: string;
  name: string;
  telegram_handle?: string;
  persona_type: PersonaType;
  email?: string;
  whatsapp?: string;
  company_id?: string;
}

export interface Comment {
  id: string;
  ticket_id: string;
  author_id: string;
  author_type: 'visitor' | 'admin' | 'system';
  body: string;
  is_internal: boolean;
  created_at: string;
}

export interface Ticket {
  id: string;
  public_id: string;
  title: string;
  description: string;
  status: TicketStatus;
  queue: TicketQueue;
  severity: TicketSeverity;
  visitor_id: string;
  assignee_ids: string[];
  created_at: string;
  last_activity_at: string;
}

export interface Activity {
  id: string;
  type: 'ticket_created' | 'status_changed' | 'queue_changed' | 'assigned_changed' | 'comment_added' | 'telegram_message_received' | 'telegram_message_sent' | 'company_pending_review';
  ticket_id?: string;
  user_id?: string;
  payload: any;
  created_at: string;
}

// MOCK DATA STORE

export const USERS: User[] = [
  { id: 'u1', name: 'Alice Commander', email: 'alice@mission.ctl', role: 'admin', avatar: 'https://i.pravatar.cc/150?u=alice' },
  { id: 'u2', name: 'Bob Logistics', email: 'bob@mission.ctl', role: 'member', avatar: 'https://i.pravatar.cc/150?u=bob' },
  { id: 'u3', name: 'Charlie Dev', email: 'charlie@mission.ctl', role: 'member', avatar: 'https://i.pravatar.cc/150?u=charlie' },
];

export const COMPANIES: Company[] = [
  { id: 'c1', legal_name: 'Tech Solutions LTDA', trade_name: 'TechSol', cnpj: '12.345.678/0001-90', status: 'active', city: 'São Paulo', uf: 'SP' },
  { id: 'c2', legal_name: 'Logística Rápida SA', trade_name: 'LogiRap', cnpj: '98.765.432/0001-10', status: 'pending_review', city: 'Curitiba', uf: 'PR' },
];

export const VISITORS: Visitor[] = [
  { id: 'v1', name: 'John Doe', telegram_handle: '@johndoe', persona_type: 'consumer', email: 'john@gmail.com' },
  { id: 'v2', name: 'Maria Silva', telegram_handle: '@mariasilva', persona_type: 'integrator', company_id: 'c1', email: 'maria@techsol.com.br' },
  { id: 'v3', name: 'Roberto Santos', telegram_handle: '@beto_s', persona_type: 'provider', company_id: 'c2', email: 'roberto@logirap.com.br' },
];

export const TICKETS: Ticket[] = [
  { 
    id: 't1', 
    public_id: 'MC-001024', 
    title: 'Integration failure with API v2', 
    description: 'I am getting 500 error when trying to sync inventory.', 
    status: 'in_progress', 
    queue: 'support', 
    severity: 'S1', 
    visitor_id: 'v2', 
    assignee_ids: ['u3'], 
    created_at: subHours(new Date(), 4).toISOString(),
    last_activity_at: subMinutes(new Date(), 30).toISOString()
  },
  { 
    id: 't2', 
    public_id: 'MC-001025', 
    title: 'Budget approval for Q3', 
    description: 'Need review on the attached logistics budget.', 
    status: 'review', 
    queue: 'budget', 
    severity: 'S2', 
    visitor_id: 'v3', 
    assignee_ids: ['u1'], 
    created_at: subDays(new Date(), 1).toISOString(),
    last_activity_at: subHours(new Date(), 2).toISOString()
  },
  { 
    id: 't3', 
    public_id: 'MC-001026', 
    title: 'Delivery delay SP-RJ', 
    description: 'Package #9988 is stuck in distribution center.', 
    status: 'inbox', 
    queue: 'logistics', 
    severity: 'S3', 
    visitor_id: 'v1', 
    assignee_ids: [], 
    created_at: subMinutes(new Date(), 15).toISOString(),
    last_activity_at: subMinutes(new Date(), 15).toISOString()
  },
  { 
    id: 't4', 
    public_id: 'MC-001027', 
    title: 'Login issues', 
    description: 'Cannot reset my password via email.', 
    status: 'needs_info', 
    queue: 'support', 
    severity: 'S2', 
    visitor_id: 'v1', 
    assignee_ids: ['u2'], 
    created_at: subDays(new Date(), 2).toISOString(),
    last_activity_at: subDays(new Date(), 1).toISOString()
  },
];

export const COMMENTS: Comment[] = [
  { id: 'cm1', ticket_id: 't1', author_id: 'v2', author_type: 'visitor', body: 'Getting 500 error on /sync endpoint.', is_internal: false, created_at: subHours(new Date(), 4).toISOString() },
  { id: 'cm2', ticket_id: 't1', author_id: 'u3', author_type: 'admin', body: 'Checking logs now.', is_internal: true, created_at: subHours(new Date(), 3).toISOString() },
  { id: 'cm3', ticket_id: 't1', author_id: 'u3', author_type: 'admin', body: 'We found a timeout in the DB adapter. Fix deploying.', is_internal: false, created_at: subMinutes(new Date(), 30).toISOString() },
];

export const ACTIVITIES: Activity[] = [
  { id: 'a1', type: 'ticket_created', ticket_id: 't3', payload: { title: 'Delivery delay SP-RJ' }, created_at: subMinutes(new Date(), 15).toISOString() },
  { id: 'a2', type: 'comment_added', ticket_id: 't1', user_id: 'u3', payload: { snippet: 'We found a timeout...' }, created_at: subMinutes(new Date(), 30).toISOString() },
  { id: 'a3', type: 'company_pending_review', payload: { company_name: 'Logística Rápida SA', cnpj: '98.765.432/0001-10' }, created_at: subDays(new Date(), 1).toISOString() },
];
