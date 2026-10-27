import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Default() {
  return (
    <Select defaultValue="month">
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Range" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="week">Last 7 days</SelectItem>
        <SelectItem value="month">Last 30 days</SelectItem>
        <SelectItem value="year">Last 12 months</SelectItem>
      </SelectContent>
    </Select>
  );
}
