import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Lang = "pt" | "en";

const translations = {
  pt: {
    "nav.inbox": "Painel",
    "nav.feed": "Atividades",
    "nav.team": "Equipe",
    "nav.signout": "Sair",
    "header.search": "Buscar tickets (ID, conteúdo)...",
    "login.title": "SolaraControl",
    "login.subtitle": "Acesse a central de operações de suporte",
    "login.email": "Email",
    "login.password": "Senha",
    "login.button": "Entrar",
    "login.default": "Padrão: admin@mission.ctl / admin123",
    "kanban.filters": "Filtros:",
    "kanban.queue": "Fila",
    "kanban.severity": "Severidade",
    "kanban.all": "Todas",
    "kanban.tickets": "tickets",
    "kanban.no_tickets": "Sem tickets",
    "kanban.unassigned": "Não atribuído",
    "kanban.move_to": "Mover para",
    "status.inbox": "Caixa de Entrada",
    "status.needs_info": "Precisa Info",
    "status.assigned": "Atribuído",
    "status.in_progress": "Em Progresso",
    "status.waiting": "Aguardando",
    "status.review": "Revisão",
    "status.done": "Concluído",
    "queue.support": "Suporte",
    "queue.budget": "Orçamento",
    "queue.logistics": "Logística",
    "severity.s1": "S1 - Crítico",
    "severity.s2": "S2 - Major",
    "severity.s3": "S3 - Minor",
    "feed.title": "Feed de Atividades",
    "feed.empty": "Nenhuma atividade ainda.",
    "ticket.back": "Voltar",
    "ticket.critical": "CRÍTICO",
    "ticket.properties": "Propriedades",
    "ticket.status": "Status",
    "ticket.queue": "Fila",
    "ticket.severity": "Severidade",
    "ticket.assignees": "Atribuídos",
    "ticket.add_assignee": "Adicionar atribuído...",
    "ticket.visitor": "Visitante",
    "ticket.company": "Empresa",
    "ticket.company_review": "Revisão de Empresa Necessária",
    "ticket.other_tickets": "Outros Tickets",
    "ticket.no_other": "Nenhum outro ticket deste visitante.",
    "ticket.reply": "Responder ao Visitante",
    "ticket.note": "Nota Interna",
    "ticket.reply_placeholder": "Escreva uma resposta...",
    "ticket.note_placeholder": "Adicione uma nota privada para a equipe...",
    "ticket.send_reply": "Enviar Resposta",
    "ticket.save_note": "Salvar Nota",
    "ticket.reply_sent": "Resposta enviada",
    "ticket.note_saved": "Nota salva",
    "ticket.internal": "INTERNA",
    "admin.title": "Gerenciamento de Equipe",
    "admin.add_user": "Adicionar Usuário",
    "admin.new_user": "Novo Usuário",
    "admin.name": "Nome",
    "admin.email": "Email",
    "admin.password": "Senha",
    "admin.create": "Criar Usuário",
    "admin.cancel": "Cancelar",
    "admin.created": "Usuário criado com sucesso",
    "admin.deleted": "Usuário removido",
    "admin.restricted": "Acesso restrito a administradores.",
    "error": "Erro",
  },
  en: {
    "nav.inbox": "Inbox",
    "nav.feed": "Activity Feed",
    "nav.team": "Team",
    "nav.signout": "Sign Out",
    "header.search": "Search tickets (ID, content)...",
    "login.title": "SolaraControl",
    "login.subtitle": "Sign in to your support operations center",
    "login.email": "Email",
    "login.password": "Password",
    "login.button": "Sign In",
    "login.default": "Default: admin@mission.ctl / admin123",
    "kanban.filters": "Filters:",
    "kanban.queue": "Queue",
    "kanban.severity": "Severity",
    "kanban.all": "All",
    "kanban.tickets": "tickets",
    "kanban.no_tickets": "No tickets",
    "kanban.unassigned": "Unassigned",
    "kanban.move_to": "Move to",
    "status.inbox": "Inbox",
    "status.needs_info": "Needs Info",
    "status.assigned": "Assigned",
    "status.in_progress": "In Progress",
    "status.waiting": "Waiting",
    "status.review": "Review",
    "status.done": "Done",
    "queue.support": "Support",
    "queue.budget": "Budget",
    "queue.logistics": "Logistics",
    "severity.s1": "S1 - Critical",
    "severity.s2": "S2 - Major",
    "severity.s3": "S3 - Minor",
    "feed.title": "Activity Feed",
    "feed.empty": "No activities yet.",
    "ticket.back": "Back",
    "ticket.critical": "CRITICAL",
    "ticket.properties": "Properties",
    "ticket.status": "Status",
    "ticket.queue": "Queue",
    "ticket.severity": "Severity",
    "ticket.assignees": "Assignees",
    "ticket.add_assignee": "Add assignee...",
    "ticket.visitor": "Visitor",
    "ticket.company": "Company",
    "ticket.company_review": "Company Review Needed",
    "ticket.other_tickets": "Other Tickets",
    "ticket.no_other": "No other tickets from this visitor.",
    "ticket.reply": "Reply to Visitor",
    "ticket.note": "Internal Note",
    "ticket.reply_placeholder": "Write a reply...",
    "ticket.note_placeholder": "Add a private note for the team...",
    "ticket.send_reply": "Send Reply",
    "ticket.save_note": "Save Note",
    "ticket.reply_sent": "Reply sent",
    "ticket.note_saved": "Note saved",
    "ticket.internal": "INTERNAL",
    "admin.title": "Team Management",
    "admin.add_user": "Add User",
    "admin.new_user": "New User",
    "admin.name": "Name",
    "admin.email": "Email",
    "admin.password": "Password",
    "admin.create": "Create User",
    "admin.cancel": "Cancel",
    "admin.created": "User created successfully",
    "admin.deleted": "User deleted",
    "admin.restricted": "Access restricted to administrators.",
    "error": "Error",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("mc_lang");
    return (saved === "pt" || saved === "en") ? saved : "pt";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("mc_lang", l);
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[lang][key] || key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
}
