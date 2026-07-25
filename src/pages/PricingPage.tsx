import { useNavigate } from "react-router-dom";
import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    price: "£0",
    tagline: "Try the workspace",
    priceId: null as string | null,
    features: [
      "Small daily AI usage limits",
      "Chat, notes, and knowledge map",
      "Standard model",
    ],
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "£19",
    tagline: "For serious learners",
    priceId: "pro_monthly" as string | null,
    features: [
      "Generous usage limits",
      "Full question attack + past papers",
      "Visualization engine",
      "Standard model",
    ],
    highlight: true,
  },
  {
    id: "ultra" as const,
    name: "Ultra",
    price: "£39",
    tagline: "Unlimited everything",
    priceId: "ultra_monthly" as string | null,
    features: [
      "Unlimited AI usage",
      "Access to the strongest models",
      "Priority for hardest problems (STEP, TMUA, Olympiad)",
      "Everything in Pro",
    ],
    highlight: false,
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { tier, isActive, cancelAtPeriodEnd, loading: subLoading, productId } = useSubscription();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [portalLoading, setPortalLoading] = useState(false);

  const handleSelect = async (planId: "free" | "pro" | "ultra", priceId: string | null) => {
    if (!session) {
      navigate("/auth");
      return;
    }
    if (planId === "free") {
      navigate("/dashboard");
      return;
    }
    if (!priceId) return;
    try {
      await openCheckout({
        priceId,
        customerEmail: session.user.email ?? undefined,
        userId: session.user.id,
      });
    } catch (e) {
      toast({ title: "Checkout error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { environment: getPaddleEnvironment() },
      });
      if (error || !data?.url) throw new Error(error?.message || "No portal URL");
      window.open(data.url, "_blank");
    } catch (e) {
      toast({ title: "Could not open portal", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Choose your plan</h1>
          <p className="text-muted-foreground mt-3">Cancel anytime. Upgrades are prorated instantly.</p>
        </div>

        {isActive && (
          <Card className="mb-8 p-4 flex items-center justify-between border-primary/40">
            <div className="text-sm">
              <div className="font-medium capitalize">You're on {tier}</div>
              <div className="text-muted-foreground">
                {cancelAtPeriodEnd ? "Cancels at period end." : "Active subscription."}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleManage} disabled={portalLoading}>
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage subscription"}
            </Button>
          </Card>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = isActive && productId === `${plan.id}_plan`;
            const canCheckout = plan.id !== "free" && !isCurrent;
            return (
              <Card
                key={plan.id}
                className={`p-6 flex flex-col ${plan.highlight ? "border-primary shadow-lg" : ""}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {plan.id === "pro" && <Sparkles className="h-4 w-4 text-primary" />}
                  {plan.id === "ultra" && <Zap className="h-4 w-4 text-primary" />}
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{plan.tagline}</p>
                <div className="mb-6">
                  <span className="text-4xl font-semibold">{plan.price}</span>
                  {plan.id !== "free" && <span className="text-muted-foreground">/mo</span>}
                </div>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  disabled={isCurrent || subLoading || (canCheckout && checkoutLoading)}
                  onClick={() => handleSelect(plan.id, plan.priceId)}
                >
                  {isCurrent
                    ? "Current plan"
                    : plan.id === "free"
                    ? "Continue free"
                    : checkoutLoading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : `Upgrade to ${plan.name}`}
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
