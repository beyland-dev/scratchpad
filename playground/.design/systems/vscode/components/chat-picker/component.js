/*
 * Chat input picker (workbench Chat view) plus the data behind every Agents window composer picker.
 *
 * ds.chatPickers holds the options the Agents window offered when this system was last captured (VS Code -
 * Insiders 1.144.0, commit 131aec7f1ee, signed in): harnesses, environments, recent workspaces, isolation,
 * branches, Copilot modes and permission levels, Claude and Codex approval modes, and each harness's model list
 * with effort, context size, speed and pricing. Pickers read it when they open, so prototypes show real choices.
 * To refresh it, recapture the pickers from a running Agents window (see the system notes) and update DATA.
 */
ds.chatPickers = (() => {
  const SEPARATOR = { type: "separator" };
  const DATA = {
    source: { product: "Visual Studio Code - Insiders", version: "1.144.0-insider", commit: "131aec7f1ee4", capturedAt: "2026-10-28" },
    harnesses: [
      { id: "copilot", label: "Copilot", icon: "copilot", placeholder: "Chat with Copilot" },
      { id: "claude", label: "Claude", icon: "claude", placeholder: "Chat with Claude" },
      { id: "codex", label: "Codex", icon: "openai", placeholder: "Chat with Codex" },
    ],
    environments: [
      { id: "local", label: "This Computer", icon: "device-desktop" },
      { id: "cloud", label: "Cloud", icon: "cloud" },
      SEPARATOR,
      { id: "environments", label: "Environments...", icon: "remote", command: true },
      { id: "tunnels", label: "Tunnels...", icon: "remote", command: true },
      { id: "ssh", label: "SSH...", icon: "remote", command: true },
      SEPARATOR,
      { id: "manage", label: "Manage...", icon: "settings-gear", command: true },
    ],
    workspaces: [
      { id: "chat", label: "Chat", icon: "comment", noWorkspace: true },
      SEPARATOR,
      { id: "adt", label: "adt", description: "~/Code", icon: "folder", recent: true },
      { id: "code", label: "Code", description: "/Users/hawkticehurst", icon: "folder", recent: true },
      { id: "temp-test", label: "temp-test", description: "~/Code/work", icon: "folder", recent: true },
      { id: "vscode", label: "vscode", description: "~/Code/work", icon: "folder", recent: true },
      { id: "vscode-customization-migration-test", label: "vscode-customization-migration-test", description: "~/Code/work", icon: "folder", recent: true },
      { id: "vscode-335485-issues", label: "vscode-335485-issues", description: "~/Downloads", icon: "folder", recent: true },
      { id: "research-journal", label: "research-journal", description: "~/Code", icon: "folder", recent: true },
      { id: "figleaf", label: "figleaf", description: "~/Code", icon: "folder", recent: true },
      SEPARATOR,
      { id: "open-folder", label: "Open Folder...", icon: "folder", command: true },
      { id: "repository", label: "Work in Repository", icon: "github", command: true },
    ],
    isolation: [
      { id: "branch", label: "Branch", icon: "folder", detail: "Works in the repository already on this computer" },
      { id: "worktree", label: "New Worktree", icon: "worktree", detail: "Creates a separate copy for this session" },
    ],
    branches: [
      { id: "main", label: "main", icon: "git-branch-changes", detail: "7 uncommitted files", uncommitted: true },
    ],
    // Copilot: the combined Mode and Permissions picker (agentHostModePickerPresentation.ts).
    modes: [
      { id: "interactive", label: "Interactive", icon: "comment", detail: "Step-by-step collaboration", cloudDetail: "Works with you and asks for input when needed." },
      { id: "plan", label: "Plan", icon: "checklist", detail: "Plan first, execute when ready", cloudDetail: "Plans the task before making changes." },
      { id: "autopilot", label: "Autopilot", icon: "rocket", detail: "Works autonomously within permissions", cloudDetail: "Continues working until the task is done." },
    ],
    permissions: [
      { id: "manual", label: "Manual permissions", short: "Manual", icon: "key", detail: "Asks when approval settings don't apply", description: "Copilot asks before running tools unless your configured settings allow the tool." },
      { id: "assisted", label: "Assisted permissions", short: "Assisted", icon: "sparkle", badge: "New", detail: "Evaluates risk before running tools", description: "An LLM judge evaluates each tool call. Tools it doesn't approve require your approval.", style: "warning", class: "agent-host-assisted-permissions" },
      { id: "allow-all", label: "Allow all", short: "Allow all", icon: "warning", detail: "Runs tool calls without asking", description: "Copilot runs all tools without asking for approval.", style: "info" },
    ],
    sandbox: { label: "Sandboxing for terminal", icon: "shield", description: "Run this session's terminal commands inside a sandbox that restricts file system and network access. The applied setting is saved for this session and checked against current organization policy when restored." },
    // Claude: one approvals picker (agentHostClaudePermissionModePicker.ts).
    claudeApprovals: [
      { id: "ask", label: "Ask Before Edits", icon: "shield", detail: "Claude asks before editing files." },
      { id: "edit", label: "Edit Automatically", icon: "edit", detail: "Claude edits files without asking, and asks before using other tools." },
      { id: "plan", label: "Plan Mode", icon: "lightbulb", detail: "Claude creates a plan before making changes." },
      { id: "auto", label: "Auto Mode", icon: "sparkle", detail: "Claude decides whether to ask for each tool operation." },
      { id: "bypass", label: "Bypass Permissions", icon: "warning", detail: "Claude runs all tools without asking." },
    ],
    // Codex: agent mode and approvals pickers (agentHostCodexApprovalsPicker.ts).
    codexModes: [
      { id: "interactive", label: "Interactive", icon: "comment", detail: "Step-by-step collaboration" },
      { id: "plan", label: "Plan", icon: "checklist", detail: "Plan first, execute when ready" },
    ],
    codexApprovals: [
      { id: "default", label: "Default Permissions", icon: "shield", detail: "Codex can read and edit workspace files and run routine local commands under the platform sandbox. It asks before using the internet or requesting broader access." },
      { id: "auto-review", label: "Auto-Review", icon: "sparkle", detail: "Same sandboxed access as Default, but approval requests are routed through the auto-reviewer instead of prompting you." },
      { id: "full", label: "Full Access", icon: "warning", detail: "Codex can edit files outside the workspace and use the internet without asking. Use only when you want full machine access." },
    ],
    effortDescriptions: {
      "None": "No reasoning applied", "Low": "Faster responses with less reasoning", "Medium": "Balanced reasoning and speed",
      "High": "Greater reasoning depth but slower", "Extra High": "Highest reasoning depth but slowest", "Max": "Absolute maximum capability with no constraints",
    },
    sessionModelNotice: "Switching models mid-session resets the prompt cache and may increase cost.",
    models: {
      catalog: {
        "copilot-fusion": {"id": "copilot-fusion", "name": "Copilot Fusion", "icon": "chat-model-provider-copilot", "effort": {"options": ["Standard", "High", "Max"], "value": "Standard"}, "badge": "30% discount", "badgeKind": "fusion", "detail": "Picks or combines the best models for your task", "hover": "Copilot Fusion selects a single model or orchestrates multiple models to complete your task.", "effortDescriptions": {"Standard": "Prioritizes versatile models for efficient everyday coding."}},
        "claude-haiku-5-5": {"id": "claude-haiku-5-5", "name": "Claude Haiku 5.5", "icon": "chat-model-provider-claude", "cost": "Low cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["100K", "1M"], "value": "100K"}, "pricing": {"Input": 10, "Output": 50, "Cache Read": 1, "Cache Write": 12.5}},
        "claude-opus-5-5": {"id": "claude-opus-5-5", "name": "Claude Opus 5.5", "icon": "chat-model-provider-claude", "cost": "High cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 400, "Output": 2000, "Cache Read": 20, "Cache Write": 500}},
        "claude-sonnet-5-5": {"id": "claude-sonnet-5-5", "name": "Claude Sonnet 5.5", "icon": "chat-model-provider-claude", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "High"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 200, "Output": 1000, "Cache Read": 10, "Cache Write": 250}},
        "gemini-3-8-flash": {"id": "gemini-3-8-flash", "name": "Gemini 3.8 Flash", "icon": "chat-model-provider-gemini", "cost": "Low cost", "effort": {"options": ["Low", "Medium", "High"], "value": "Medium"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 75, "Output": 375, "Cache Read": 7.5, "Cache Write": 0}},
        "gemini-4-argon": {"id": "gemini-4-argon", "name": "Gemini 4 Argon", "icon": "chat-model-provider-gemini", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High"], "value": "Medium"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 200, "Output": 1000, "Cache Read": 10, "Cache Write": 0}},
        "gpt-5-6-sol-fast-internal-only": {"id": "gpt-5-6-sol-fast-internal-only", "name": "GPT-5.6 Sol Fast (Internal only)", "icon": "chat-model-provider-openai", "cost": "Very high cost", "effort": {"options": ["None", "Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "1M"], "value": "272K"}, "speed": {"options": ["Standard", "Fast"], "value": "Fast"}, "pricing": {"Input": 800, "Output": 4000, "Cache Read": 80, "Cache Write": 1000}},
        "gpt-6-astra": {"id": "gpt-6-astra", "name": "GPT-6 Astra", "icon": "chat-model-provider-openai", "cost": "Very high cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "1M"], "value": "272K"}, "pricing": {"Input": 1000, "Output": 5000, "Cache Read": 100, "Cache Write": 1250}},
        "gpt-6-luna": {"id": "gpt-6-luna", "name": "GPT-6 Luna", "icon": "chat-model-provider-openai", "cost": "Low cost", "effort": {"options": ["None", "Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "872K"], "value": "272K"}, "pricing": {"Input": 10, "Output": 50, "Cache Read": 1, "Cache Write": 12.5}},
        "gpt-6-1-sol": {"id": "gpt-6-1-sol", "name": "GPT-6.1 Sol", "icon": "chat-model-provider-openai", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "1M"], "value": "272K"}, "pricing": {"Input": 200, "Output": 1000, "Cache Read": 10, "Cache Write": 250}},
        "gpt-6-1-terra": {"id": "gpt-6-1-terra", "name": "GPT-6.1 Terra", "icon": "chat-model-provider-openai", "cost": "Low cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "1M"], "value": "272K"}, "pricing": {"Input": 100, "Output": 500, "Cache Read": 5, "Cache Write": 125}},
        "grok-4-7": {"id": "grok-4-7", "name": "Grok 4.7", "icon": "chat-model-provider-xai", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Extra High"], "value": "Medium"}, "context": {"options": ["200K", "500K"], "value": "200K"}, "pricing": {"Input": 200, "Output": 600, "Cache Read": 50, "Cache Write": 0}},
        "mai-code-1-1-flash": {"id": "mai-code-1-1-flash", "name": "MAI-Code-1.1-Flash", "icon": "chat-model-provider-microsoft", "cost": "Low cost", "effort": {"options": ["Low", "Medium", "High"], "value": "Medium"}, "context": {"max": "256K"}, "pricing": {"Input": 20, "Output": 120, "Cache Read": 2, "Cache Write": 25}},
        "claude-haiku-4-5": {"id": "claude-haiku-4-5", "name": "Claude Haiku 4.5", "icon": "chat-model-provider-claude", "cost": "Low cost", "context": {"max": "200K"}, "pricing": {"Input": 100, "Output": 500, "Cache Read": 10, "Cache Write": 125}},
        "claude-opus-5": {"id": "claude-opus-5", "name": "Claude Opus 5", "icon": "chat-model-provider-claude", "cost": "High cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "High"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 500, "Output": 2500, "Cache Read": 50, "Cache Write": 625}},
        "claude-sonnet-5": {"id": "claude-sonnet-5", "name": "Claude Sonnet 5", "icon": "chat-model-provider-claude", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Extra High", "Max"], "value": "High"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 200, "Output": 1000, "Cache Read": 20, "Cache Write": 250}},
        "gpt-5-3-codex": {"id": "gpt-5-3-codex", "name": "GPT-5.3-Codex", "icon": "chat-model-provider-openai", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Extra High"], "value": "Medium"}, "context": {"max": "400K"}, "pricing": {"Input": 175, "Output": 1400, "Cache Read": 17.5, "Cache Write": 0}},
        "gpt-5-6-luna": {"id": "gpt-5-6-luna", "name": "GPT-5.6 Luna", "icon": "chat-model-provider-openai", "cost": "Low cost", "effort": {"options": ["None", "Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["200K", "1M"], "value": "200K"}, "pricing": {"Input": 20, "Output": 120, "Cache Read": 2, "Cache Write": 25}},
        "gpt-5-6-terra": {"id": "gpt-5-6-terra", "name": "GPT-5.6 Terra", "icon": "chat-model-provider-openai", "cost": "Medium cost", "effort": {"options": ["None", "Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "1M"], "value": "272K"}, "pricing": {"Input": 200, "Output": 1200, "Cache Read": 20, "Cache Write": 250}},
        "gpt-6-sol": {"id": "gpt-6-sol", "name": "GPT-6 Sol", "icon": "chat-model-provider-openai", "cost": "Medium cost", "effort": {"options": ["None", "Low", "Medium", "High", "Extra High", "Max"], "value": "Medium"}, "context": {"options": ["272K", "872K"], "value": "272K"}, "pricing": {"Input": 200, "Output": 1000, "Cache Read": 20, "Cache Write": 250}},
        "grok-4-6": {"id": "grok-4-6", "name": "Grok 4.6", "icon": "chat-model-provider-xai", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Extra High"], "value": "Medium"}, "context": {"options": ["200K", "500K"], "value": "200K"}, "pricing": {"Input": 200, "Output": 600, "Cache Read": 50, "Cache Write": 0}},
        "claude-opus-4-6": {"id": "claude-opus-4-6", "name": "Claude Opus 4.6", "icon": "chat-model-provider-claude", "cost": "High cost", "effort": {"options": ["Low", "Medium", "High", "Max"], "value": "High"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 500, "Output": 2500, "Cache Read": 50, "Cache Write": 625}, "warning": "Claude Opus 4.6 has a planned deprecation date of 2026-09-01.", "badge": "Retiring", "badgeKind": "warning"},
        "claude-sonnet-4-6": {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6", "icon": "chat-model-provider-claude", "cost": "Medium cost", "effort": {"options": ["Low", "Medium", "High", "Max"], "value": "High"}, "context": {"options": ["200K", "1M"], "value": "1M"}, "pricing": {"Input": 300, "Output": 1500, "Cache Read": 30, "Cache Write": 375}, "warning": "Claude Sonnet 4.6 has a planned deprecation date of 2026-09-01.", "badge": "Retiring", "badgeKind": "warning"},
        "gpt-5-2": {"id": "gpt-5-2", "name": "GPT-5.2", "icon": "chat-model-provider-openai", "cost": "Medium cost", "effort": {"options": ["Medium"], "value": "Medium"}, "context": {"max": "400K"}},
        "gpt-5-6-sol": {"id": "gpt-5-6-sol", "name": "GPT-5.6 Sol", "icon": "chat-model-provider-openai", "cost": "High cost", "effort": {"options": ["Medium"], "value": "Medium"}, "context": {"options": ["272K"], "value": "272K"}},
      },
      lists: {
        copilot: {"featured": ["copilot-fusion"], "primary": ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5", "gemini-3-8-flash", "gemini-4-argon", "gpt-5-6-sol-fast-internal-only", "gpt-6-astra", "gpt-6-luna", "gpt-6-1-sol", "gpt-6-1-terra", "grok-4-7", "mai-code-1-1-flash"], "other": ["claude-haiku-4-5", "claude-opus-5", "claude-sonnet-5", "gpt-5-3-codex", "gpt-5-6-luna", "gpt-5-6-terra", "gpt-6-sol", "grok-4-6", "claude-opus-4-6", "claude-sonnet-4-6"]},
        claude: {"featured": [], "primary": ["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"], "other": ["claude-haiku-4-5", "claude-opus-4-6", "claude-opus-5", "claude-sonnet-4-6", "claude-sonnet-5"], "overrides": {"claude-haiku-5-5": {"effort": "High", "contextMax": "1M"}, "claude-opus-5-5": {"effort": "High", "contextMax": "1M"}, "claude-sonnet-5-5": {"contextMax": "1M"}, "claude-haiku-4-5": {"contextMax": "200K"}, "claude-opus-4-6": {"contextMax": "1M"}, "claude-opus-5": {"contextMax": "1M"}, "claude-sonnet-4-6": {"contextMax": "1M"}, "claude-sonnet-5": {"contextMax": "1M"}}},
        codex: {"featured": [], "primary": ["gpt-5-2", "gpt-5-3-codex", "gpt-6-astra", "gpt-6-luna", "gpt-6-1-sol", "gpt-6-1-terra"], "other": ["gpt-5-6-luna", "gpt-5-6-sol", "gpt-5-6-terra", "gpt-6-sol"], "overrides": {"gpt-5-3-codex": {"contextMax": "400K"}}},
      },
      current: {"copilot": "gpt-5-6-sol-fast-internal-only", "claude": "claude-haiku-5-5", "codex": "gpt-5-3-codex"},
    },
  };

  const harness = (id) => DATA.harnesses.find((h) => h.id === id) || DATA.harnesses[0];
  const find = (list, id) => list.find((item) => item.id === id);

  /** A model of a harness, with that harness's overrides (e.g. Claude's effort defaults and fixed context). */
  function model(id, harnessId = "copilot") {
    const base = DATA.models.catalog[id];
    if (!base) return undefined;
    const override = (DATA.models.lists[harnessId] || {}).overrides?.[id] || {};
    const m = JSON.parse(JSON.stringify(base));
    if (override.effort && m.effort) m.effort.value = override.effort;
    if (override.contextMax) m.context = { max: override.contextMax };
    return m;
  }
  function models(harnessId = "copilot") {
    const list = DATA.models.lists[harnessId] || DATA.models.lists.copilot;
    const resolve = (ids) => ids.map((id) => model(id, harnessId)).filter(Boolean);
    return { featured: resolve(list.featured || []), primary: resolve(list.primary), other: resolve(list.other) };
  }
  const defaultModel = (harnessId = "copilot") => DATA.models.current[harnessId] || DATA.models.current.copilot;
  /** "Medium · 272K", "High · 1M", "200K" or "Standard": the model picker's configuration summary. */
  function summary(m) {
    if (!m) return "";
    const context = m.context ? (m.context.max || m.context.value) : undefined;
    return [m.effort && m.effort.value, context].filter(Boolean).join(" · ");
  }
  function modelAria(m) {
    const parts = [m.name];
    if (m.badge) parts.push(m.badge);
    if (m.detail) parts.push(m.detail);
    if (m.cost) parts.push(m.cost);
    if (m.warning) parts.push("Warning: " + m.warning);
    if (m.effort) parts.push("Effort Level: " + m.effort.value);
    if (m.context) parts.push(m.context.max ? "Max context: " + m.context.max : "Context Size: " + m.context.value);
    return parts.join(", ");
  }
  const isHighCost = (m) => /^(High|Very high) cost$/.test(m.cost || "");

  /** Action list items for each list picker. `current` is the selected id. */
  const listItem = (option, current, extra) => option.type === "separator" ? option : {
    id: option.id, label: option.label, icon: option.icon, description: option.description, detail: option.detail, badge: option.badge,
    focused: option.id === current, hover: option.hover, data: option, ...extra,
  };
  const items = {
    environment: (current) => DATA.environments.map((o) => listItem(o, current)),
    workspace: (current) => DATA.workspaces.map((o) => listItem(o, current, o.recent ? { toolbar: [{ icon: "close", ariaLabel: "Remove from Recent" }] } : {})),
    isolation: (current) => DATA.isolation.map((o) => listItem(o, current, { hover: "Enter to Apply" })),
    branch: (current) => DATA.branches.map((o) => listItem(o, current, { hover: "Enter to Apply", toolbar: [{ icon: "diff-multiple", ariaLabel: "View Uncommitted Changes" }] })),
    harness: (current) => DATA.harnesses.map((o) => listItem(o, current, { hover: "Enter to Apply" })),
    claudeApprovals: (current) => [...DATA.claudeApprovals.map((o) => listItem(o, current)), SEPARATOR, { id: "learn-more", label: "Learn more about permissions", icon: "blank", data: { command: true } }],
    codexModes: (current) => DATA.codexModes.map((o) => listItem(o, current)),
    codexApprovals: (current) => DATA.codexApprovals.map((o) => listItem(o, current)),
    /** Copilot's Mode and Permissions popup: two collapsible sections, one open at a time. */
    modePermissions(state) {
      const { mode, permission, sandbox, open, environment } = state;
      const modeItem = find(DATA.modes, mode) || DATA.modes[0];
      const level = find(DATA.permissions, permission) || DATA.permissions[2];
      const out = [{
        id: "section:mode", label: "Agent mode", icon: open === "mode" ? "chevron-down" : "chevron-right", description: modeItem.label, custom: true, class: "agent-host-mode-section",
        role: "menuitem", expanded: open === "mode", hover: "Enter to Apply", ariaLabel: "Agent mode, Current mode: " + modeItem.label, focused: open === "permissions" ? false : undefined,
      }];
      if (open === "mode") {
        for (const m of DATA.modes) out.push({ id: m.id, label: m.label, icon: m.icon, detail: environment === "cloud" ? m.cloudDetail : m.detail, role: "menuitemradio", checked: m.id === mode, focused: m.id === mode, hover: "Enter to Apply", data: { kind: "mode", option: m } });
        out.push(SEPARATOR);
      }
      out.push({
        id: "section:permissions", label: "Permissions", icon: open === "permissions" ? "chevron-down" : "chevron-right", description: level.short, custom: true,
        class: ["agent-host-mode-permissions", level.style].filter(Boolean).join(" "), role: "menuitem", expanded: open === "permissions", checked: open === "permissions", hover: "Enter to Apply",
        ariaLabel: "Permissions, " + level.label.replace(" permissions", ""), toolbar: [{ icon: "gear", ariaLabel: "Configure Permissions", id: "configure" }],
      });
      if (open === "permissions") {
        for (const p of DATA.permissions) out.push({ id: p.id, label: p.label, icon: p.icon, detail: p.detail, badge: p.badge, custom: !!p.class, class: p.class, role: "menuitemradio", checked: p.id === permission, focused: p.id === permission, ariaLabel: [p.label, p.badge, p.detail, p.description].filter(Boolean).join(", "), data: { kind: "permission", option: p } });
        out.push(SEPARATOR,
          { id: "sandbox", label: DATA.sandbox.label, icon: DATA.sandbox.icon, toggle: !!sandbox, toggleLabel: DATA.sandbox.description, role: "menuitem", ariaLabel: DATA.sandbox.label + ", " + (sandbox ? "on" : "off"), data: { kind: "sandbox" } },
          SEPARATOR,
          { id: "learn-more", label: "Learn more about permissions", icon: "blank", role: "menuitem", hover: "Enter to Apply", data: { command: true } });
      }
      return out;
    },
  };

  /** Open the list for a simple picker kind and report the chosen option. Widths are the product's (measured in the capture). */
  const LISTS = {
    environment: { items: items.environment, label: "Environment", listClass: "sessions-new-chat-picker-list", minWidth: 240 },
    workspace: { items: items.workspace, label: "Workspace", listClass: "sessions-new-chat-picker-list", minWidth: 386, maxWidth: 386 },
    isolation: { items: items.isolation, label: "Isolation", minWidth: 295 },
    branch: { items: items.branch, label: "Branch", minWidth: 265 },
    harness: { items: items.harness, label: "Session Type", listClass: "sessions-new-chat-picker-list", minWidth: 200 },
    "claude-approvals": { items: items.claudeApprovals, label: "Approvals", minWidth: 255 },
    "codex-modes": { items: items.codexModes, label: "Agent Mode", minWidth: 200 },
    "codex-approvals": { items: items.codexApprovals, label: "Approvals", minWidth: 255, maxWidth: 360 },
  };
  function openList(kind, anchor, current, onPick) {
    const spec = LISTS[kind];
    if (!spec) return null;
    return ds.actionList.open(anchor, {
      items: spec.items(current), label: spec.label, listClass: spec.listClass, minWidth: spec.minWidth, maxWidth: spec.maxWidth,
      onSelect: (item) => { if (!(item.data && item.data.command)) onPick(item.data || item); },
    });
  }

  return { data: DATA, harness, model, models, defaultModel, summary, modelAria, isHighCost, items, openList, find };
})();

class ChatPicker extends ds.Element {
  static hostClass = "action-item chat-input-picker-item";
  static props = ["kind", "icon", "label", "disabled"];
  render() {
    const kind = this.attr("kind", "");
    this.setClasses({ "chat-mode-picker-item": kind === "mode", "chat-session-target-picker-item": kind === "target" });
    this.setAttribute("role", "presentation");
    const label = this.attr("label", this.textContent.trim());
    const icon = this.attr("icon");
    return ds.h("div.monaco-dropdown", null,
      ds.h("div.dropdown-label", null,
        ds.h("a.action-label" + (this.flag("disabled") ? ".disabled" : ""), {
          role: "button", "aria-haspopup": "true", "aria-expanded": "false", "aria-label": label, tabindex: "0",
          "aria-disabled": this.hasAttribute("disabled") ? String(this.flag("disabled")) : undefined,
        },
          icon ? ds.icon(icon) : null,
          ds.h("span.chat-input-picker-label", null, label))));
  }
}
ds.define("vsc-chat-picker", ChatPicker);
