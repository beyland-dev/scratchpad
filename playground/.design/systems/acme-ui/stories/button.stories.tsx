import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function Variants() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button>Save changes</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="link">Learn more</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add"><Plus /></Button>
      <Button><Plus /> New project</Button>
    </div>
  );
}
