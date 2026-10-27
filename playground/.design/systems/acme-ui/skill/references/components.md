# Acme UI components

12 components. Root context: none.

## `<Button>` — Button

Kind: component · Category: actions · Status: stable

Triggers an action. Variants: default (Acme violet), secondary, outline, ghost, destructive and link; sizes sm, default, lg and icon.

**Usage:** Primary actions use the default variant, one per view. Use outline or ghost for secondary actions in toolbars.

**Example — Variants**

```html
<div className="flex flex-wrap gap-2">
  <Button>Save changes</Button>
  <Button variant="secondary">Secondary</Button>
  <Button variant="outline">Outline</Button>
  <Button variant="ghost">Ghost</Button>
  <Button variant="destructive">Delete</Button>
  <Button variant="link">Learn more</Button>
</div>
```

**Example — Sizes and icon**

```html
<div className="flex items-center gap-2">
  <Button size="sm">Small</Button>
  <Button>Default</Button>
  <Button size="lg">Large</Button>
  <Button size="icon" aria-label="Add"><Plus /></Button>
  <Button><Plus /> New project</Button>
</div>
```

Source: `src/components/ui/button.tsx`

## `<Avatar>` — Avatar

Kind: component · Category: display · Status: stable

User image with initials fallback.

**Example — Initials**

```html
<div className="flex gap-2">
  <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
  <Avatar><AvatarFallback>MK</AvatarFallback></Avatar>
  <Avatar><AvatarFallback>AR</AvatarFallback></Avatar>
</div>
```

Source: `src/components/ui/avatar.tsx`

## `<Badge>` — Badge

Kind: component · Category: display · Status: stable

Small status or count label.

**Example — Variants**

```html
<div className="flex gap-2">
  <Badge>Active</Badge>
  <Badge variant="secondary">Draft</Badge>
  <Badge variant="outline">Archived</Badge>
  <Badge variant="destructive">Overdue</Badge>
</div>
```

Source: `src/components/ui/badge.tsx`

## `<Input>` — Input

Kind: component · Category: forms · Status: stable

Single-line text field. Pair with Label.

**Composed of:** `<Label>`

**Example — With a label**

```html
<div className="grid w-80 gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@acme.com" />
</div>
```

**Example — Disabled**

```html
<Input className="w-80" disabled value="read-only@acme.com" />
```

Source: `src/components/ui/input.tsx`

## `<Label>` — Label

Kind: component · Category: forms · Status: stable

Accessible label for a form control.

**Example — Default**

```html
<Label>Workspace name</Label>
```

Source: `src/components/ui/label.tsx`

## `<Select>` — Select

Kind: component · Category: forms · Status: stable

Pick one option from a list (Radix select; the list opens in a portal).

**Example — Default**

```html
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
```

Source: `src/components/ui/select.tsx`

## `<Switch>` — Switch

Kind: component · Category: forms · Status: stable

On/off toggle for settings that apply immediately.

**Composed of:** `<Label>`

**Example — With a label**

```html
<div className="flex items-center gap-3">
  <Switch id="digest" defaultChecked />
  <Label htmlFor="digest">Weekly digest email</Label>
</div>
```

Source: `src/components/ui/switch.tsx`

## `<Separator>` — Separator

Kind: component · Category: layout · Status: stable

Visual divider between groups of content.

**Example — Horizontal and vertical**

```html
<div className="w-72 text-sm">
  <p className="font-medium">Acme Dashboard</p>
  <Separator className="my-3" />
  <div className="flex h-5 items-center gap-3">
    <span>Docs</span><Separator orientation="vertical" /><span>Support</span>
  </div>
</div>
```

Source: `src/components/ui/separator.tsx`

## `<DropdownMenu>` — Dropdown menu

Kind: pattern · Category: actions · Status: stable

Menu of actions opened from a trigger (renders in a portal).

**Composed of:** `<Button>`

**Example — Account menu**

```html
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Account</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-48">
    <DropdownMenuLabel>My account</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Billing</DropdownMenuItem>
    <DropdownMenuItem>Sign out</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Source: `src/components/ui/dropdown-menu.tsx`

## `<Table>` — Table

Kind: pattern · Category: data · Status: stable

Data table with header, rows and caption.

**Composed of:** `<Badge>`

**Example — Invoices**

```html
<Table className="w-[480px]">
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-medium">INV-1042</TableCell>
      <TableCell><Badge>Paid</Badge></TableCell>
      <TableCell className="text-right">$1,250.00</TableCell>
    </TableRow>
    <TableRow>
      <TableCell className="font-medium">INV-1043</TableCell>
      <TableCell><Badge variant="secondary">Pending</Badge></TableCell>
      <TableCell className="text-right">$640.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

Source: `src/components/ui/table.tsx`

## `<Card>` — Card

Kind: pattern · Category: layout · Status: stable

A surface grouping related content: header (title, description, action), content and footer.

**Usage:** Dashboard widgets, settings sections and forms.

**Composed of:** `<Button>`

**Example — Card with footer**

```html
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
```

Source: `src/components/ui/card.tsx`

## `<Tabs>` — Tabs

Kind: pattern · Category: navigation · Status: stable

Switches between views of the same context.

**Example — Default**

```html
<Tabs defaultValue="overview" className="w-96">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    <TabsTrigger value="analytics">Analytics</TabsTrigger>
    <TabsTrigger value="reports">Reports</TabsTrigger>
  </TabsList>
  <TabsContent value="overview" className="text-sm text-muted-foreground">Revenue is up 12% this month.</TabsContent>
</Tabs>
```

Source: `src/components/ui/tabs.tsx`
