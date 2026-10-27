import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Fallback() {
  return (
    <div className="flex gap-2">
      <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>MK</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>AR</AvatarFallback></Avatar>
    </div>
  );
}
