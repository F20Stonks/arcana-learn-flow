import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * "/" redirects logged-in users straight to their dashboard (see AppRoutes in
 * App.tsx), so this doubles as "go home": the marketing landing page when
 * logged out, back to the dashboard when logged in.
 */
export default function BrandLogo({ className }: Props) {
  return (
    <Link to="/" className={cn("font-bold text-foreground hover:opacity-80 transition-opacity", className)}>
      Cortexed
    </Link>
  );
}
