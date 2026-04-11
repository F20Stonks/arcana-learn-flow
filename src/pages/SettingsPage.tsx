import { useNavigate } from "react-router-dom";
import { ArrowLeft, Zap, CreditCard, Bell, User, Shield, Palette, ChevronRight } from "lucide-react";

const sections = [
  { id: "account", icon: User, label: "Account", desc: "Manage your profile and preferences" },
  { id: "billing", icon: CreditCard, label: "Billing & Subscription", desc: "Manage your plan, payment methods, and invoices" },
  { id: "notifications", icon: Bell, label: "Notifications", desc: "Configure how Jarvis notifies you" },
  { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme, font size, and display settings" },
  { id: "privacy", icon: Shield, label: "Privacy & Security", desc: "Password, 2FA, and data export" },
];

const SettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background bg-grid">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="h-7 w-7 rounded-lg bg-primary/10 arc-border flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-display text-sm font-bold tracking-wider text-gradient-jarvis">JARVIS</span>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="text-sm font-medium text-foreground">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
        <p className="text-sm text-muted-foreground mb-8">Manage your account and preferences.</p>

        <div className="space-y-2">
          {sections.map((s) => (
            <button
              key={s.id}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-card arc-border hover:arc-glow transition-all group text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{s.label}</p>
                <p className="text-xs text-muted-foreground truncate">{s.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        {/* Current Plan Card */}
        <div className="mt-10 p-6 rounded-2xl bg-card arc-glow arc-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Current Plan</h3>
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium arc-border">Pro</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Unlimited tracks, AI tutoring, and priority support.</p>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 rounded-lg bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors arc-border">
              Manage Plan
            </button>
            <button className="px-4 py-2 rounded-lg bg-primary/10 text-xs text-primary hover:bg-primary/20 transition-colors arc-border">
              View Invoices
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
