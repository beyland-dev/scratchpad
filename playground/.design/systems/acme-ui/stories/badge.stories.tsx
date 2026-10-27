import { Badge } from "@/components/ui/badge";

export function Variants() {
  return (
    <div className="flex gap-2">
      <Badge>Active</Badge>
      <Badge variant="secondary">Draft</Badge>
      <Badge variant="outline">Archived</Badge>
      <Badge variant="destructive">Overdue</Badge>
    </div>
  );
}
