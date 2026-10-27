import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Default() {
  return (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Upgrade to Pro</CardTitle>
        <CardDescription>Unlimited projects and priority support.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">$24 per seat, billed monthly.</CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost">Not now</Button>
        <Button>Upgrade</Button>
      </CardFooter>
    </Card>
  );
}
