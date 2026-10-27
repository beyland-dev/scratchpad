import { Separator } from "@/components/ui/separator";

export function Default() {
  return (
    <div className="w-72 text-sm">
      <p className="font-medium">Acme Dashboard</p>
      <Separator className="my-3" />
      <div className="flex h-5 items-center gap-3">
        <span>Docs</span><Separator orientation="vertical" /><span>Support</span>
      </div>
    </div>
  );
}
