import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, CreditCard, Bell, User, Shield, ChevronRight, LogOut, Loader2, Clock, Link2, Trash2, Monitor } from "lucide-react";

type View = "list" | "account" | "notifications" | "privacy";

const sections: { id: View | "billing"; icon: typeof User; label: string; desc: string }[] = [
  { id: "account", icon: User, label: "Account", desc: "Manage your profile and preferences" },
  { id: "billing", icon: CreditCard, label: "Billing & Subscription", desc: "Manage your plan and payment methods" },
  { id: "notifications", icon: Bell, label: "Notifications", desc: "Configure how Cortexed notifies you" },
  { id: "privacy", icon: Shield, label: "Privacy & Security", desc: "Password, 2FA, and data export" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [view, setView] = useState<View>("list");

  if (view !== "list") {
    return <SubPage view={view} onBack={() => setView("list")} />;
  }

  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <h1 className="text-xl font-bold text-foreground mb-6">Settings</h1>

        <div className="space-y-2 mb-8">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => (s.id === "billing" ? navigate("/pricing") : setView(s.id))}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all group text-left"
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

        <PlanCard />

        <button onClick={signOut} className="w-full flex items-center gap-3 p-4 rounded-xl bg-card border border-destructive/20 text-destructive hover:bg-destructive/5 transition-colors">
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Sign out</span>
        </button>
      </main>
    </AppShell>
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

const SUB_PAGE_TITLES: Record<Exclude<View, "list">, string> = {
  account: "Account",
  notifications: "Notifications",
  privacy: "Privacy & Security",
};

function SubPage({ view, onBack }: { view: Exclude<View, "list">; onBack: () => void }) {
  return (
    <AppShell>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={onBack} className="mb-6 flex items-center gap-2 text-[13px] text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Settings
        </button>
        <h1 className="mb-6 text-xl font-bold text-foreground">{SUB_PAGE_TITLES[view]}</h1>
        {view === "account" && <AccountPanel />}
        {view === "privacy" && <PrivacyPanel />}
        {view === "notifications" && (
          <ComingSoonPanel
            icon={Bell}
            title="Notification preferences aren't live yet"
            body="Cortexed doesn't send emails or push notifications yet, so there's nothing real to configure here — a toggle with no delivery behind it would just be misleading. Once reminders or progress digests ship, their on/off controls will live here."
          />
        )}
      </main>
    </AppShell>
  );
}

function ComingSoonPanel({ icon: Icon, title, body }: { icon: typeof Bell; title: string; body: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 flex items-start gap-4">
      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function AccountPanel() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [learnerNotes, setLearnerNotes] = useState(profile?.learner_notes || "");
  const [saving, setSaving] = useState(false);

  const dirty = displayName !== (profile?.display_name || "")
    || avatarUrl !== (profile?.avatar_url || "")
    || learnerNotes !== (profile?.learner_notes || "");

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        learner_notes: learnerNotes.trim() || null,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save changes", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
    toast({ title: "Profile updated" });
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-4 mb-5">
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarUrl || undefined} alt={displayName} />
            <AvatarFallback className="text-base font-medium">
              {(displayName || user?.email || "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{displayName || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Display name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Avatar URL</label>
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Email</label>
            <Input value={user?.email || ""} disabled />
            <p className="text-[11px] text-muted-foreground mt-1.5">Contact support to change the email on your account.</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="mt-5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save changes
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">How I learn best</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Tell your tutor anything it should always keep in mind — a pace, a representation you prefer, a habit to avoid.
          This is injected into every session, verbatim.
        </p>
        <Textarea
          value={learnerNotes}
          onChange={(e) => setLearnerNotes(e.target.value)}
          placeholder="e.g. Go slower on notation, I mix up ∂ and d. Show me the geometric picture before the algebra."
          rows={4}
          maxLength={1000}
        />
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Save changes
        </button>

        {profile?.learner_style_notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">What your tutor has noticed</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{profile.learner_style_notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacyPanel() {
  const { user } = useAuth();
  const [identities, setIdentities] = useState<string[] | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUserIdentities().then(({ data }) => {
      if (!cancelled) setIdentities((data?.identities || []).map((i) => i.provider));
    });
    return () => { cancelled = true; };
  }, []);

  const hasPassword = user?.app_metadata?.providers?.includes("email") ?? true;
  const hasGoogle = identities?.includes("google") ?? false;

  const handleLinkGoogle = async () => {
    setLinking(true);
    const { error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/settings` },
    });
    if (error) {
      toast({ title: "Couldn't link Google", description: error.message, variant: "destructive" });
      setLinking(false);
    }
    // On success the browser navigates away to Google's consent screen — nothing more runs here.
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Linked sign-in methods</h3>
        <p className="text-xs text-muted-foreground mb-4">Ways you can sign in to this account.</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-accent">
            <span className="text-sm text-foreground">Email &amp; password</span>
            <span className={`text-xs font-medium ${hasPassword ? "text-status-green" : "text-muted-foreground"}`}>
              {hasPassword ? "Linked" : "Not set up"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-accent">
            <span className="text-sm text-foreground">Google</span>
            {hasGoogle ? (
              <span className="text-xs font-medium text-status-green">Linked</span>
            ) : (
              <button
                onClick={handleLinkGoogle}
                disabled={linking || identities === null}
                className="text-xs font-medium text-primary hover:underline disabled:opacity-40 flex items-center gap-1.5"
              >
                {linking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                Link Google
              </button>
            )}
          </div>
        </div>
      </div>

      <PasswordCard hasPassword={hasPassword} userEmail={user?.email} />

      <SignOutEverywhereCard />

      <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-3">
        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Two-factor authentication and a data export tool aren't built yet — they'll land here once they exist, rather than as controls that don't do anything.
        </p>
      </div>

      <DangerZoneCard userEmail={user?.email} />
    </div>
  );
}

function PasswordCard({ hasPassword, userEmail }: { hasPassword: boolean; userEmail?: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const handleSubmit = async () => {
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setChanging(true);
    if (hasPassword) {
      if (!userEmail) return;
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPassword });
      if (verifyError) {
        setChanging(false);
        toast({ title: "Current password is incorrect", variant: "destructive" });
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (error) {
      toast({ title: "Couldn't update password", description: error.message, variant: "destructive" });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast({ title: hasPassword ? "Password updated" : "Password set" });
  };

  const canSubmit = hasPassword
    ? !!currentPassword && !!newPassword && !!confirmPassword
    : !!newPassword && !!confirmPassword;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Password</h3>
      <p className="text-xs text-muted-foreground mb-4">
        {hasPassword
          ? "Choose a strong password you don't use anywhere else."
          : "You signed in with Google — set a password to also sign in with email."}
      </p>
      <div className="space-y-3">
        {hasPassword && (
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Current password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
        )}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">New password</label>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Confirm new password</label>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
      </div>
      <button
        onClick={handleSubmit}
        disabled={changing || !canSubmit}
        className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
      >
        {changing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {hasPassword ? "Update password" : "Set password"}
      </button>
    </div>
  );
}

function SignOutEverywhereCard() {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutEverywhere = async () => {
    setSigningOut(true);
    await supabase.auth.signOut({ scope: "global" });
    navigate("/auth");
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <Monitor className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground mb-1">Sign out everywhere</h3>
          <p className="text-xs text-muted-foreground mb-3">
            End every active session on every device signed in to this account, including this one.
          </p>
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-muted transition-colors"
          >
            Sign out of all devices
          </button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of all devices?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll be signed out here and everywhere else this account is logged in. You can sign back in anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSignOutEverywhere(); }} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out everywhere"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DangerZoneCard({ userEmail }: { userEmail?: string }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = !!userEmail && emailInput.trim().toLowerCase() === userEmail.toLowerCase();

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      setDeleting(false);
      toast({ title: "Couldn't delete account", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="bg-card border border-destructive/30 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <Trash2 className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground mb-1">Delete account</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Permanently deletes your account and everything in it — tracks, notes, sessions, and subscription history. This cannot be undone.
          </p>
          <button
            onClick={() => setConfirming(true)}
            className="px-4 py-2 rounded-lg border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/5 transition-colors"
          >
            Delete account
          </button>
        </div>
      </div>

      <AlertDialog open={confirming} onOpenChange={(open) => { setConfirming(open); if (!open) setEmailInput(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes your account and everything in it — every track, note, session, and your subscription history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Type <span className="text-foreground">{userEmail}</span> to confirm
            </label>
            <Input value={emailInput} onChange={(e) => setEmailInput(e.target.value)} disabled={deleting} />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={!canDelete || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
