import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CreditCard, Bell, User, Shield, Palette, ChevronRight, LogOut, Loader2 } from "lucide-react";

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
      </main>
    </div>
  );
}

function PlanCard() {
  const navigate = useNavigate();
  const { tier, isActive, cancelAtPeriodEnd, currentPeriodEnd } = useSubscription();
  const [loading, setLoading] = useState(false);

  const label = tier === "ultra" ? "Ultra" : tier === "pro" ? "Pro" : "Free";
  const description = !isActive
    ? "Small daily usage limits. Upgrade for generous or unlimited AI usage."
    : cancelAtPeriodEnd && currentPeriodEnd
    ? `Cancels on ${new Date(currentPeriodEnd).toLocaleDateString()}.`
    : "Active subscription. Manage billing or change plan anytime.";

  const handleManage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error || !data?.url) throw new Error(error?.message || "No portal URL");
      window.open(data.url, "_blank");
    } catch (e) {
      toast({ title: "Could not open portal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground">Current Plan</h3>
        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{label}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="flex gap-2">
        <button
          onClick={() => navigate("/pricing")}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
        >
          {isActive ? "Change plan" : "Upgrade"}
        </button>
        {isActive && (
          <button
            onClick={handleManage}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors flex items-center gap-2"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Manage billing
          </button>
        )}
      </div>
    </div>
  );
}

// Re-open stub so old JSX below is discarded — legacy tail removed
function _unused() {
  return null;

        <button onClick={signOut} className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-destructive/20 text-destructive hover:bg-destructive/5 transition-colors">
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </main>
    </div>
  );
}
