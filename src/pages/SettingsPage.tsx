import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, CreditCard, Bell, User, Shield, Palette, ChevronRight, LogOut } from "lucide-react";

const sections = [
  { id: "account", icon: User, label: "Account", desc: "Manage your profile and preferences" },
  { id: "billing", icon: CreditCard, label: "Billing & Subscription", desc: "Manage your plan and payment methods" },
  { id: "notifications", icon: Bell, label: "Notifications", desc: "Configure how Jarvis notifies you" },
  { id: "appearance", icon: Palette, label: "Appearance", desc: "Theme and display settings" },
  { id: "privacy", icon: Shield, label: "Privacy & Security", desc: "Password, 2FA, and data export" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground">Settings</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>

        <div className="space-y-2 mb-8">
          {sections.map((s) => (
            <button key={s.id} className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group text-left">
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

        <PlanCard />

        <button onClick={signOut} className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-destructive/20 text-destructive hover:bg-destructive/5 transition-colors">
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </main>
    </div>
  );
}
