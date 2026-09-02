/**
 * The assessment surface itself.
 *
 * Runs full-height outside AppShell — the sidebar, the nav and the XP counter are exactly what a
 * real assessment does not have, and dropping them is most of what makes this feel like the real
 * screen. Same reasoning as ResourceReader.
 */
import { useNavigate, useParams } from "react-router-dom";
import ProctorShell from "@/features/assessments/components/ProctorShell";
import { findFirm } from "@/features/assessments/firms/registry";

export default function AssessmentRun() {
  const { firmId, moduleId } = useParams<{ firmId: string; moduleId?: string }>();
  const navigate = useNavigate();
  const firm = findFirm(firmId);

  // `/assessments/:firmId/run` sits the whole battery; any other :moduleId is a single section.
  const onlyModuleId = moduleId && moduleId !== "run" ? moduleId : undefined;
  const moduleExists = !onlyModuleId || firm?.modules.some((m) => m.id === onlyModuleId);

  if (!firm || !moduleExists) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-[15px] text-muted-foreground">That assessment doesn't exist.</p>
        <button
          onClick={() => navigate("/assessments")}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Back to assessments
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ProctorShell firm={firm} onlyModuleId={onlyModuleId} onExit={() => navigate("/assessments")} />
    </div>
  );
}
