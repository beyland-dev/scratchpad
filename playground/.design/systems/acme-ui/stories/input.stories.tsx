import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WithLabel() {
  return (
    <div className="grid w-80 gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="you@acme.com" />
    </div>
  );
}

export function Disabled() {
  return (
    <Input className="w-80" disabled value="read-only@acme.com" />
  );
}
