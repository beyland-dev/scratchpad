import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function Default() {
  return (
    <div className="flex items-center gap-3">
      <Switch id="digest" defaultChecked />
      <Label htmlFor="digest">Weekly digest email</Label>
    </div>
  );
}
