import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export function ComingSoonBoard({ mode }: { mode: string }) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold capitalize">{mode} — coming soon</h1>
      <p className="text-sm text-muted-foreground">This mode is scaffolded but not yet playable.</p>
      <Button asChild>
        <Link to="/">Back home</Link>
      </Button>
    </div>
  );
}
