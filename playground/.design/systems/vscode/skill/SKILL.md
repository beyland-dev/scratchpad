---
name: vscode-design-system
description: Build design-tool prototypes that look exactly like VS Code, using its codified design system — 48 web components (<vsc-chat-view>, <vsc-workbench>, <vsc-editor>, <vsc-search-view>, <vsc-sidebar>, <vsc-chat-model-picker>, …) and 3373 theme tokens. Use when creating or editing a prototype that should match VS Code, or when looking up its components, states, tokens, or icons.
---

# VS Code design system

The VS Code workbench design system (2026 themes): theme tokens, codicons, core widgets and chat UI, codified from the running product.

This library was codified from the real product (VS Code - Insiders (web, serve-web) 1.144.0-insider, commit 58173d0ebc18). Components render the product's real DOM and are styled by its real CSS, so composing them gives pixel-accurate results. **Compose; don't recreate.**

## Setup

In a prototype's `index.html` (design-tool serves these paths on the prototype sandbox):

```html
<link rel="stylesheet" href="/s/vscode/system.css" />
<script type="module" src="/s/vscode/system.js"></script>
```

Everything goes inside the root context, which applies the theme:

```html
<vsc-workbench theme="dark-2026">
  …
</vsc-workbench>
```

Themes: `dark-2026` (Dark 2026), `light-2026` (Light 2026). Default: `dark-2026`.

## Rules

1. **Compose from the components below.** Don't hand-copy markup or CSS from the source code. If something you need is missing, use the closest component, keep custom parts minimal, and say what's missing.
2. **Respect required context.** A component only looks right inside the context elements listed in "Must be inside" (outermost first).
3. **Use tokens for anything custom.** Style custom parts with `var(--…)` tokens (see references/tokens.md or the `token_search` tool), never literal colors or sizes, so both themes work.
4. **Load `system.js` as a module** (as above), and put components in the HTML or create them with `document.createElement`. Attributes are reactive; children are read when an element first connects.
5. **Use real states.** Set state attributes (`disabled`, `checked`, `focused`, …) instead of restyling.
6. **Check your work.** View the prototype in design-tool (and take a screenshot if your tools allow) in each theme.

## Notes

## Capture runtime

Values were captured from VS Code Insiders running as a web app (`code-insiders serve-web`), driven through a headless Chromium with CDP:

```sh
code-insiders serve-web --port 8457 --host 127.0.0.1 --without-connection-token \
  --accept-server-license-terms --server-data-dir /tmp/dt-vsc/server \
  --cli-data-dir /tmp/dt-vsc/cli --default-folder /tmp/dt-vsc/ws
```

Open one page per theme (`?folder=/tmp/dt-vsc/ws&dt-theme=dark` / `dt-theme=light`) and target them with `{ cdp: "http://127.0.0.1:9333", page: "dt-theme=dark" }`.

- serve-web downloads the newest Insiders build when a page loads, so `capturedFrom.commit` is the build that was served.
- The web default theme is Light 2026 regardless of `prefers-color-scheme`; pick **Dark 2026** with Ctrl+K Ctrl+T on the dark page.
- Trust the folder, then close the Workspace Trust modal editor ("Close Modal Editor"): `.monaco-modal-editor-block` intercepts pointer events.
- Widen the secondary side bar (chat) to 420px by dragging its sash; the chat composer is then 393px wide like the desktop default.
- Captures use the 1440×900 window at 2× scale. Rules from `contributedColorTheme` are theme-scoped (`themeSheets`); `--modern-ui-*` variables are theme rules, not tokens.

## Conventions

- Every component's host *is* the captured root element (light DOM); `hostTag` widens type selectors (`a`, `li`, `div`) to match hosts.
- `<vsc-workbench theme="dark-2026|light-2026">` is the root context; surface contexts (`<vsc-chat-view>`, `<vsc-sidebar>`, `<vsc-editor>`) recreate the ancestor classes that captured rules depend on.
- Icons are codicons: `<vsc-icon name="…">` or `ds.icon(name)`; file icons use the Seti file icon theme classes.
- `<vsc-workbench>` carries the body classes VS Code uses for the agent status pill (`agent-status-enabled unified-agents-bar`) and the default layout flags (`nopanel floating-panels …`).
- For a full window, see the "Full window layout" example of `<vsc-workbench>`: parts are positioned like the default 1440×900 window (activity bar 48px, side bar 300px, secondary side bar 428px).

## Capture conventions

- Runtime list ids (`list_id_N`) differ per page; light captures are normalized to the dark capture's ids so both themes share CSS (components use the dark ids, e.g. quick input = `list_id_5`).
- Overlays (quick input, menus, dialog, hover, notifications) were captured while open; verification finishes their fade/scale animations first.
- Watermark shortcuts rotate between page loads, so dark and light references use different examples.
- Some states depend on focus (e.g. pane header actions only show while the pane has focus); references ignore those parts.

## Components

### Contexts

| Tag | What | Key attributes | Must be inside |
|---|---|---|---|
| `<vsc-chat-view>` | Chat view: The chat view pane (secondary side bar): `.chat-viewpane > .chat-controls-container > .interactive-session`. |  | `vsc-workbench` |
| `<vsc-workbench>` | Workbench: Root of every VS Code UI: the `.monaco-workbench` element. | theme=dark-2026\\|light-2026 |  |
| `<vsc-editor>` | Editor area: The editor part and active editor group (`.part.editor > .content > .editor-group-container`). | empty | `vsc-workbench` |
| `<vsc-search-view>` | Search view: The Search view container: search widget (`.search-widget > .search-container`) above the results. |  | `vsc-workbench` › `vsc-sidebar` |
| `<vsc-sidebar>` | Side bar: The primary side bar part with an optional view title (`.composite.title`) and a single pane body for view content. | heading=…, position=left\\|right | `vsc-workbench` |

### Components

| Tag | What | Key attributes | Must be inside |
|---|---|---|---|
| `<vsc-chat-model-picker>` | Model picker: Language model picker in the chat input toolbar (split button: model name + configuration). | label=…, badge=… | `vsc-workbench` › `vsc-chat-view` |
| `<vsc-chat-picker>` | Chat picker: Dropdown picker in the chat input toolbars: icon + label (agent mode, session target, permissions, …). | kind=mode\\|target\\|, icon=…, label=…, disabled | `vsc-workbench` › `vsc-chat-view` |
| `<vsc-chat-submit>` | Send button: Chat send button (arrow up), disabled while the input is empty. | disabled, label=… | `vsc-workbench` › `vsc-chat-view` |
| `<vsc-chat-welcome>` | Chat welcome: Empty-state of the chat view: icon, title, message and disclaimer. | heading=…, message=…, icon=… | `vsc-workbench` › `vsc-chat-view` |
| `<vsc-icon>` | Icon (codicon): A codicon glyph from @vscode/codicons (16px icon font). | name=…, spin |  |
| `<vsc-hover>` | Hover (tooltip): Workbench hover / tooltip, e.g. | text=… | `vsc-workbench` |
| `<vsc-menu>` | Context menu: Context menu (`.monaco-menu`): items with keybindings, separators, check marks and submenus. | x=…, y=…, label=… | `vsc-workbench` |
| `<vsc-menu-item>` | Menu item: A context menu entry: check mark, label, keybinding or submenu chevron. | label=…, keys=…, checked, disabled, submenu, focused | `vsc-workbench` › `vsc-menu` |
| `<vsc-menu-separator>` | Menu separator: Horizontal rule between menu groups. |  | `vsc-workbench` › `vsc-menu` |
| `<vsc-notifications-center>` | Notifications center: Notification center panel (bottom right) with header actions and a list of notifications. | heading=… | `vsc-workbench` |
| `<vsc-quick-pick-item>` | Quick pick item: A row in the quick input list: optional file icon, label with match highlight, description, keybinding, group separator label and row actions. | label=…, highlight=…, description=…, keys=…, separator=…, file=… | `vsc-workbench` › `vsc-quick-input` |
| `<vsc-setting>` | Setting: A row in the Settings editor: category + label, description (rich text allowed) and a control (checkbox, number/text input or select). | type=bool\\|number\\|text\\|enum, category=…, label=…, key=…, value=…, options=… | `vsc-workbench` › `vsc-settings-editor` |
| `<vsc-settings-group>` | Settings group title: Group heading row in the Settings editor (e.g. | label=…, level=… | `vsc-workbench` › `vsc-settings-editor` |
| `<vsc-action>` | Action: Icon action in an action bar or toolbar (`li.action-item > a.action-label.codicon`), optionally with a dropdown. | icon=…, label=…, disabled, checked, dropdown, menu | `vsc-workbench` |
| `<vsc-button>` | Button: Text button (`.monaco-button.monaco-text-button`), primary or secondary, with an optional leading codicon. | secondary, icon=…, disabled | `vsc-workbench` |
| `<vsc-checkbox>` | Checkbox: Checkbox (`.monaco-custom-toggle.codicon-check`). | checked, disabled, label=…, variant=\\|settings | `vsc-workbench` |
| `<vsc-count-badge>` | Count badge: Small rounded count (`.monaco-count-badge`), e.g. |  | `vsc-workbench` |
| `<vsc-find-input>` | Find input: Search box with inline option toggles (`.monaco-findInput`): Match Case, Match Whole Word, Use Regular Expression by default. | placeholder=…, value=…, focused | `vsc-workbench` › `vsc-sidebar` › `vsc-search-view` |
| `<vsc-input>` | Input box: Single-line text input (`.monaco-inputbox`). | value=…, placeholder=…, type=text\\|number, focused, variant=\\|settings | `vsc-workbench` |
| `<vsc-keybinding>` | Keybinding label: Keyboard shortcut rendered as keycaps (`.monaco-keybinding`). | keys=… | `vsc-workbench` |
| `<vsc-select>` | Select box: Native select styled as a VS Code dropdown (`select.monaco-select-box`). | options=…, value=…, label=…, variant=\\|settings | `vsc-workbench` |
| `<vsc-toggle>` | Toggle (input option): Icon toggle used inside inputs (Match Case, Whole Word, Regex): `.monaco-custom-toggle.codicon`. | icon=…, checked, disabled, label=… | `vsc-workbench` |
| `<vsc-toolbar>` | Toolbar: Horizontal (or vertical) action bar: `.monaco-toolbar > .monaco-action-bar > ul.actions-container`. | vertical, label=… | `vsc-workbench` |
| `<vsc-tree>` | Tree (Explorer): File tree list (`.explorer-folders-view .monaco-list`) with Seti file icons; rows are <vsc-tree-item>s laid out at 22px. | label=… | `vsc-workbench` › `vsc-sidebar` |
| `<vsc-tree-item>` | Tree item: A row of the Explorer tree (`.monaco-list-row`): twistie, Seti file/folder icon and label. | label=…, kind=file\\|folder, level=…, expanded, selected, focused | `vsc-workbench` › `vsc-sidebar` › `vsc-tree` |
| `<vsc-activity-item>` | Activity bar item: A view icon in the activity bar, with active indicator and optional count badge. | icon=…, label=…, checked, badge=…, kind=\\|menu | `vsc-workbench` › `vsc-activitybar` |
| `<vsc-activitybar>` | Activity bar: Vertical view switcher at the window edge: view icons (top) and Accounts/Manage (bottom), with active indicator and badges. |  | `vsc-workbench` |
| `<vsc-extension-item>` | Extension item: An extension row: icon, name, kind indicator, description, publisher and actions (Manage, or Install when installable). | name=…, description=…, icon=…, kind=…, version=…, publisher=… | `vsc-workbench` › `vsc-sidebar` › `vsc-extension-list` |
| `<vsc-extension-list>` | Extension list: List of extensions in the Extensions view (72px rows). |  | `vsc-workbench` › `vsc-sidebar` |
| `<vsc-pane>` | View pane (collapsible section): A collapsible section of a side bar view (e.g. | heading=…, section=…, icon=…, expanded | `vsc-workbench` › `vsc-sidebar` |
| `<vsc-panel>` | Panel: The bottom panel: view tabs (Problems, Output, Debug Console, Terminal), view actions, maximize/close, and the active view's content. | tabs=…, active=… | `vsc-workbench` |
| `<vsc-status-item>` | Status bar item: A status bar entry. | text=…, label=…, align=left\\|right, compact=\\|left\\|right | `vsc-workbench` › `vsc-statusbar` |
| `<vsc-statusbar>` | Status bar: Bottom status bar (28px) with left and right item groups. |  | `vsc-workbench` |
| `<vsc-tab>` | Editor tab: One editor tab: file icon, label (italic when preview) and close action; the active tab connects to the editor. | label=…, active, preview, dirty | `vsc-workbench` › `vsc-editor` › `vsc-tabs` |
| `<vsc-tabs>` | Editor tabs: Editor group title: connected tabs, editor actions and breadcrumbs (`.title.tabs`). | breadcrumbs=…, no-breadcrumbs | `vsc-workbench` › `vsc-editor` |
| `<vsc-titlebar>` | Title bar: Window title bar with navigation, the command center (search box + agent status pill) and layout controls. | label=…, can-go-back, can-go-forward, no-layout-controls | `vsc-workbench` |
| `<vsc-watermark-entry>` | Watermark entry: Shortcut hint row in the editor watermark: icon, label and keybinding. | icon=…, label=…, keys=… | `vsc-workbench` › `vsc-editor` › `vsc-watermark` |

### Patterns

| Tag | What | Key attributes | Must be inside |
|---|---|---|---|
| `<vsc-chat-input>` | Chat input: The chat composer: input editor, primary toolbar (add context, agent, model, tools), send button and secondary toolbar (session target, permissions). | placeholder=…, value=…, no-secondary | `vsc-workbench` › `vsc-chat-view` |
| `<vsc-dialog>` | Dialog: Modal dialog over a dimmed workbench: severity icon, message, detail, buttons (primary last) and close button. | severity=info\\|warning\\|error, message=…, buttons=…, primary=… | `vsc-workbench` |
| `<vsc-quick-input>` | Quick input (Command Palette / Quick Open): The quick input widget: filter box above a list of <vsc-quick-pick-item>s. | placeholder=…, value=…, position=top\\|static | `vsc-workbench` |
| `<vsc-settings-editor>` | Settings editor: The Settings editor: search box, scope tabs, Backup and Sync button, table of contents and settings list. | tabs=…, tab=…, toc=…, placeholder=…, focused | `vsc-workbench` |
| `<vsc-watermark>` | Editor watermark: Empty editor group: VS Code letterpress and shortcut hints. |  | `vsc-workbench` › `vsc-editor` |
| `<vsc-welcome-view>` | Welcome view: Empty-state content of a view: paragraphs, links and full-width buttons (`.welcome-view-content`). |  | `vsc-workbench` › `vsc-sidebar` |

Full API (attributes, slots, states, examples): [references/components.md](references/components.md), or the `component_get` tool.

## Tokens

3373 tokens, available as CSS custom properties and themed per theme. Largest groups: icon (2321), editor (43), testing (34), chat (33), symbolIcon (33), terminal (30), tab (29), statusBarItem (25), editorOverviewRuler (24), list (24), settings (21), inlineEdit (20), terminalSymbolIcon (19), notebook (17), debugIcon (15), diffEditor (14), editorGutter (14), editorIndentGuide (14), spacing (14), mergeEditor (13), scmGraph (13), agents (12), editorBracketPairGuide (12), statusBar (11).

Find tokens with the `token_search` tool (e.g. query "button background") or in [references/tokens.md](references/tokens.md).

## Example

Default:

```html
<vsc-workbench theme="dark-2026">
  <vsc-chat-input></vsc-chat-input>
</vsc-workbench>
```

## Tools

When the design-tool MCP server is connected: `system_get` (overview), `component_search` / `component_get` (find and read components), `token_search` (find tokens), `prototype_create` / `prototype_writeFile` (build the prototype).
