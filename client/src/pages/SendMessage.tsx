import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, User, ChevronDown, Check, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const PERSONA_TYPES = [
  { value: "integrator", labelPt: "Integrador", labelEn: "Integrator" },
  { value: "installer", labelPt: "Instalador", labelEn: "Installer" },
  { value: "provider", labelPt: "Serviços", labelEn: "Services" },
  { value: "consumer", labelPt: "Consumidor Final", labelEn: "End Consumer" },
];

interface Visitor {
  id: string;
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  persona_type: string | null;
  telegram_chat_id: number | null;
  telegram_user_id: number | null;
}

export default function SendMessage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPersonaType, setSelectedPersonaType] = useState<string | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);
  const [messageText, setMessageText] = useState("");
  const [personaDropdownOpen, setPersonaDropdownOpen] = useState(false);
  const [visitorDropdownOpen, setVisitorDropdownOpen] = useState(false);

  const { data: visitors = [], isLoading: loadingVisitors } = useQuery<Visitor[]>({
    queryKey: ["/api/visitors", selectedPersonaType],
    queryFn: async () => {
      const params = selectedPersonaType ? `?persona_type=${selectedPersonaType}` : "";
      const res = await fetch(`/api/visitors${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load visitors");
      return res.json();
    },
    enabled: !!selectedPersonaType,
  });

  const sendMutation = useMutation({
    mutationFn: async ({ visitorId, body }: { visitorId: string; body: string }) => {
      const res = await fetch(`/api/visitors/${visitorId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to send message");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: lang === "pt" ? "Mensagem enviada" : "Message sent",
        description: lang === "pt" ? "A mensagem foi enviada pelo Telegram." : "The message was sent via Telegram.",
      });
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: ["/api/feed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
    onError: (err: Error) => {
      toast({
        title: t("error"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!selectedVisitor || !messageText.trim()) return;
    sendMutation.mutate({ visitorId: selectedVisitor.id, body: messageText.trim() });
  };

  const selectedPersonaLabel = selectedPersonaType
    ? PERSONA_TYPES.find(p => p.value === selectedPersonaType)?.[lang === "pt" ? "labelPt" : "labelEn"]
    : null;

  return (
    <Layout>
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-send-message-title">
              {lang === "pt" ? "Enviar Mensagem" : "Send Message"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {lang === "pt"
                ? "Envie uma mensagem direta via Telegram para um contato."
                : "Send a direct Telegram message to a contact."}
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {lang === "pt" ? "Tipo de Contato" : "Contact Type"}
              </label>
              <div className="relative">
                <button
                  onClick={() => { setPersonaDropdownOpen(!personaDropdownOpen); setVisitorDropdownOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 border rounded-md bg-card text-sm hover:bg-accent transition-colors"
                  data-testid="button-persona-type"
                >
                  <span className={cn(!selectedPersonaLabel && "text-muted-foreground")}>
                    {selectedPersonaLabel || (lang === "pt" ? "Escolha o tipo de contato..." : "Choose contact type...")}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", personaDropdownOpen && "rotate-180")} />
                </button>

                {personaDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg max-h-48 overflow-y-auto">
                    {PERSONA_TYPES.map((type) => (
                      <button
                        key={type.value}
                        onClick={() => {
                          setSelectedPersonaType(type.value);
                          setSelectedVisitor(null);
                          setPersonaDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left",
                          selectedPersonaType === type.value && "bg-primary/10 text-primary"
                        )}
                        data-testid={`button-persona-${type.value}`}
                      >
                        <span>{lang === "pt" ? type.labelPt : type.labelEn}</span>
                        {selectedPersonaType === type.value && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selectedPersonaType && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === "pt" ? "Contato" : "Contact"}
                </label>
                <div className="relative">
                  <button
                    onClick={() => { setVisitorDropdownOpen(!visitorDropdownOpen); setPersonaDropdownOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2.5 border rounded-md bg-card text-sm hover:bg-accent transition-colors"
                    data-testid="button-visitor-select"
                  >
                    <span className={cn(!selectedVisitor && "text-muted-foreground")}>
                      {selectedVisitor
                        ? `${selectedVisitor.name || "—"} ${selectedVisitor.email ? `(${selectedVisitor.email})` : ""}`
                        : (lang === "pt" ? "Escolha o contato..." : "Choose contact...")}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", visitorDropdownOpen && "rotate-180")} />
                  </button>

                  {visitorDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-lg max-h-60 overflow-y-auto">
                      {loadingVisitors ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : visitors.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                          {lang === "pt" ? "Nenhum contato encontrado." : "No contacts found."}
                        </div>
                      ) : (
                        visitors.map((v) => (
                          <button
                            key={v.id}
                            onClick={() => {
                              setSelectedVisitor(v);
                              setVisitorDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent transition-colors text-left",
                              selectedVisitor?.id === v.id && "bg-primary/10 text-primary"
                            )}
                            data-testid={`button-visitor-${v.id}`}
                          >
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{v.name || "—"}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {v.email || v.whatsapp || (lang === "pt" ? "Sem contato" : "No contact")}
                              </p>
                            </div>
                            {!v.telegram_chat_id && (
                              <span className="text-xs text-destructive shrink-0">
                                {lang === "pt" ? "Sem Telegram" : "No Telegram"}
                              </span>
                            )}
                            {selectedVisitor?.id === v.id && <Check className="w-4 h-4 shrink-0" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedVisitor && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {lang === "pt" ? "Mensagem" : "Message"}
                </label>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={lang === "pt" ? "Digite sua mensagem..." : "Type your message..."}
                  className="w-full min-h-[120px] p-3 border rounded-md bg-card text-sm resize-y focus:ring-1 focus:ring-primary outline-none"
                  data-testid="input-message-text"
                />

                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sendMutation.isPending || !selectedVisitor.telegram_chat_id}
                  className="w-full"
                  data-testid="button-send-message"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  {lang === "pt" ? "Enviar via Telegram" : "Send via Telegram"}
                </Button>

                {!selectedVisitor.telegram_chat_id && (
                  <p className="text-xs text-destructive">
                    {lang === "pt"
                      ? "Este contato não possui Telegram vinculado. Não é possível enviar mensagem."
                      : "This contact has no linked Telegram. Cannot send message."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
