import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function Default() {
  return (
    <Tabs defaultValue="overview" className="w-96">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="text-sm text-muted-foreground">Revenue is up 12% this month.</TabsContent>
    </Tabs>
  );
}
