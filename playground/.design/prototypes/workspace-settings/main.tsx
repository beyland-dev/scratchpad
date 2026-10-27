import { createRoot } from "react-dom/client";
import "@/index.css";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const members = [
  { name: "Jordan Diaz", email: "jordan@acme.com", role: "Owner", initials: "JD" },
  { name: "Mia Kim", email: "mia@acme.com", role: "Admin", initials: "MK" },
  { name: "Arjun Rao", email: "arjun@acme.com", role: "Member", initials: "AR" },
];

function App() {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <header className="flex h-14 items-center gap-3 border-b bg-background px-6">
        <div className="size-6 rounded-md bg-primary" />
        <span className="font-semibold">Acme</span>
        <span className="text-muted-foreground">/ Settings</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm">Docs</Button>
          <Avatar className="size-8"><AvatarFallback>JD</AvatarFallback></Avatar>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace settings</h1>
          <p className="text-muted-foreground">Manage your workspace profile, members and notifications.</p>
        </div>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>How your workspace appears to members and in emails.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2"><Label htmlFor="name">Workspace name</Label><Input id="name" defaultValue="Acme Inc." /></div>
                <div className="grid gap-2"><Label htmlFor="url">Workspace URL</Label><Input id="url" defaultValue="acme.app/acme" /></div>
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t">
                <Button variant="ghost">Cancel</Button>
                <Button>Save changes</Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Team members</CardTitle>
                <CardDescription>3 of 10 seats used.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {members.map((m, i) => (
                  <div key={m.email}>
                    {i > 0 && <Separator className="my-2" />}
                    <div className="flex items-center gap-3 py-1">
                      <Avatar><AvatarFallback>{m.initials}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.email}</p></div>
                      <Badge variant={m.role === "Owner" ? "default" : "secondary"}>{m.role}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[["Weekly digest", "A summary of activity every Monday.", true], ["Usage alerts", "When you reach 80% of your plan.", true], ["Product updates", "New features and improvements.", false]].map(([title, desc, on]) => (
                  <div key={String(title)} className="flex items-center justify-between gap-4">
                    <div><p className="text-sm font-medium">{title}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
                    <Switch defaultChecked={Boolean(on)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
