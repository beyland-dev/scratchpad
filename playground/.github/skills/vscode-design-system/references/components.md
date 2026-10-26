# VS Code components

48 components. Root context: `<vsc-workbench>`.

## `<vsc-chat-view>` — Chat view

Kind: context · Category: chat · Status: draft · Verification: verified

The chat view pane (secondary side bar): `.chat-viewpane > .chat-controls-container > .interactive-session`. Chat widgets render inside it.

**Usage:** Wrap chat widgets (<vsc-chat-input>, …). Give it a height to lay out a full panel; the composer sits at the bottom.

**Must be inside:** `<vsc-workbench>`

**Example — Panel**

```html
<vsc-chat-view style="height: 794px;"></vsc-chat-view>
```

Source: `src/vs/workbench/contrib/chat/browser/widgetHosts/viewPane/chatViewPane.ts`, `src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts`

## `<vsc-workbench>` — Workbench

Kind: context · Category: foundations · Status: draft · Verification: verified

Root of every VS Code UI: the `.monaco-workbench` element. Applies the theme (token values), platform font, modern-UI flags and the shell background.

**Usage:** Wrap every prototype in exactly one <vsc-workbench theme="dark-2026|light-2026">. Give it a size (e.g. style="width: 1440px; height: 900px") for full-window layouts.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `theme` | `dark-2026` \| `light-2026` | `dark-2026` | Color theme |

**Example — Window**

```html
<vsc-workbench style="width: 1440px; height: 900px;"></vsc-workbench>
```

**Example — Full window layout**: Title bar, activity bar, Explorer, empty editor, chat in the secondary side bar and status bar, positioned like the default 1440×900 window.

```html
<vsc-workbench style="position: relative; width: 1440px; height: 900px;">
  <vsc-titlebar label="ws" style="position: absolute; left: 0; top: 0; width: 1440px;"></vsc-titlebar>
  <div style="position: absolute; left: 0; top: 35px; width: 48px; height: 837px;"><vsc-activitybar style="height: 833px;"></vsc-activitybar></div>
  <div style="position: absolute; left: 48px; top: 35px; width: 300px; height: 837px;">
    <vsc-sidebar heading="Explorer" style="height: 833px;">
      <vsc-action slot="actions" icon="toolbar-more" label="Views and More Actions..." dropdown></vsc-action>
      <vsc-pane heading="ws" expanded>
        <vsc-tree><vsc-tree-item kind="folder" label="src"></vsc-tree-item><vsc-tree-item label="package.json" selected focused></vsc-tree-item><vsc-tree-item label="README.md"></vsc-tree-item></vsc-tree>
      </vsc-pane>
      <vsc-pane heading="Outline"></vsc-pane>
      <vsc-pane heading="Timeline"></vsc-pane>
    </vsc-sidebar>
  </div>
  <div style="position: absolute; left: 348px; top: 35px; width: 664px; height: 837px;">
    <vsc-editor style="height: 833px;">
      <vsc-watermark style="height: 831px;"><vsc-watermark-entry icon="watermark-chat" label="Open Chat" keys="Ctrl+Alt+I"></vsc-watermark-entry><vsc-watermark-entry icon="watermark-commands" label="Show All Commands" keys="Ctrl+Shift+P"></vsc-watermark-entry><vsc-watermark-entry icon="watermark-settings" label="Open Settings" keys="Ctrl+,"></vsc-watermark-entry></vsc-watermark>
    </vsc-editor>
  </div>
  <div style="position: absolute; left: 1012px; top: 35px; width: 428px; height: 837px;">
    <vsc-sidebar position="right" style="height: 833px;">
      <vsc-chat-view style="height: 794px;"><vsc-chat-welcome></vsc-chat-welcome><vsc-chat-input></vsc-chat-input></vsc-chat-view>
    </vsc-sidebar>
  </div>
  <vsc-statusbar style="position: absolute; left: 0; top: 872px; width: 1440px;"><vsc-status-item text="$(remote)" label="remote"></vsc-status-item><vsc-status-item text="$(error) 0 $(warning) 0" label="No Problems"></vsc-status-item><vsc-status-item align="right" text="Layout: us"></vsc-status-item><vsc-status-item align="right" text="$(copilot)" label="Copilot status"></vsc-status-item><vsc-status-item align="right" text="$(bell)" label="Notifications"></vsc-status-item></vsc-statusbar>
</vsc-workbench>
```

Source: `src/vs/workbench/browser/workbench.ts`, `src/vs/workbench/browser/media/style.css`

## `<vsc-editor>` — Editor area

Kind: context · Category: workbench · Status: draft

The editor part and active editor group (`.part.editor > .content > .editor-group-container`).

**Usage:** Wrap <vsc-tabs> and editor content, or a <vsc-watermark> for an empty group.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `empty` | boolean |  | Empty editor group (set automatically when it contains a <vsc-watermark>) |

**Example — Empty group**

```html
<vsc-editor style="height: 300px;"><vsc-watermark><vsc-watermark-entry icon="watermark-chat" label="Open Chat" keys="Ctrl+Alt+I"></vsc-watermark-entry></vsc-watermark></vsc-editor>
```

Source: `src/vs/workbench/browser/parts/editor/editorPart.ts`, `src/vs/workbench/browser/parts/editor/editorGroupView.ts`

## `<vsc-search-view>` — Search view

Kind: context · Category: workbench · Status: draft · Verification: verified

The Search view container: search widget (`.search-widget > .search-container`) above the results.

**Usage:** Put a <vsc-find-input> inside (it is placed in the search box automatically); other children render as results.

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>`

**Composed of:** `<vsc-find-input>`

**Slots:**
- default (children): Results (a <vsc-find-input> child goes to the search box)
- `slot="input"`: Search input
- `slot="message"`: Result summary line, e.g. '1 result in 1 file - <a class="pointer">Open in editor</a>'

**Example — Search with results**

```html
<vsc-search-view style="height: 794px;"><vsc-find-input placeholder="Search (⇅ for history)" value="app" focused></vsc-find-input><span slot="message">1 result in 1 file - <a class="pointer" tabindex="0">Open in editor</a></span></vsc-search-view>
```

Source: `src/vs/workbench/contrib/search/browser/searchView.ts`, `src/vs/workbench/contrib/search/browser/searchWidget.ts`

## `<vsc-sidebar>` — Side bar

Kind: context · Category: workbench · Status: draft · Verification: verified

The primary side bar part with an optional view title (`.composite.title`) and a single pane body for view content.

**Usage:** Wrap side bar views: <vsc-tree>, <vsc-search-view>, <vsc-welcome-view>. Set heading for the title; put title actions in slot="actions".

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `heading` | string |  | View title, e.g. 'Explorer' |
| `position` | `left` \| `right` | `left` | right = secondary side bar (e.g. chat) |

**Slots:**
- default (children): View content, or <vsc-pane> sections
- `slot="actions"`: <vsc-action> items in the title bar

**Example — Explorer title**

```html
<vsc-sidebar heading="Explorer" style="height: 833px;"><vsc-action slot="actions" icon="toolbar-more" label="Views and More Actions..." dropdown></vsc-action></vsc-sidebar>
```

Source: `src/vs/workbench/browser/parts/sidebar/sidebarPart.ts`, `src/vs/workbench/browser/parts/compositePart.ts`

## `<vsc-chat-model-picker>` — Model picker

Kind: component · Category: chat · Status: draft · Verification: verified

Language model picker in the chat input toolbar (split button: model name + configuration).

**Must be inside:** `<vsc-workbench>` › `<vsc-chat-view>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string | `Models` | Model name |
| `badge` | string |  |  |

**Example — In the chat input**

```html
<vsc-chat-input></vsc-chat-input>
```

Source: `src/vs/workbench/contrib/chat/browser/widget/input/modelPicker`

## `<vsc-chat-picker>` — Chat picker

Kind: component · Category: chat · Status: draft · Verification: verified

Dropdown picker in the chat input toolbars: icon + label (agent mode, session target, permissions, …).

**Usage:** Inside <vsc-chat-input> slot="toolbar" or slot="secondary".

**Must be inside:** `<vsc-workbench>` › `<vsc-chat-view>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `kind` | `mode` \| `target` \| `` |  | mode = agent picker, target = session target picker |
| `icon` | string |  | Codicon id (use the -compact variants: agent-compact, vm-compact, shield-compact) |
| `label` | string |  |  |
| `disabled` | boolean |  |  |

**Example — In the chat input**

```html
<vsc-chat-input></vsc-chat-input>
```

Source: `src/vs/workbench/contrib/chat/browser/widget/input/chatInputPickerActionItem.ts`

## `<vsc-chat-submit>` — Send button

Kind: component · Category: chat · Status: draft · Verification: verified

Chat send button (arrow up), disabled while the input is empty.

**Must be inside:** `<vsc-workbench>` › `<vsc-chat-view>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `disabled` | boolean |  |  |
| `label` | string | `Send` |  |

**Example — Empty input**

```html
<vsc-chat-input></vsc-chat-input>
```

**Example — Ready to send**

```html
<vsc-chat-input value="Add a dark mode toggle"></vsc-chat-input>
```

Source: `src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts`

## `<vsc-chat-welcome>` — Chat welcome

Kind: component · Category: chat · Status: draft · Verification: verified

Empty-state of the chat view: icon, title, message and disclaimer.

**Usage:** Inside <vsc-chat-view>, before <vsc-chat-input>; it fills the space above the composer.

**Must be inside:** `<vsc-workbench>` › `<vsc-chat-view>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `heading` | string | `Build with Agent` |  |
| `message` | string | `AI responses may be inaccurate` |  |
| `icon` | string | `chat-sparkle` |  |

**Slots:**
- default (children): Disclaimer (rich text, links)

**Example — Empty chat**

```html
<vsc-chat-view style="height: 794px;"><vsc-chat-welcome style="flex: none; height: 660px;"><a href="" data-href="command:workbench.action.chat.generateAgentInstructions">Generate Agent Instructions</a> to onboard AI onto your codebase.</vsc-chat-welcome><vsc-chat-input></vsc-chat-input></vsc-chat-view>
```

Source: `src/vs/workbench/contrib/chat/browser/viewsWelcome/chatViewWelcomeController.ts`

## `<vsc-icon>` — Icon (codicon)

Kind: component · Category: foundations · Status: draft

A codicon glyph from @vscode/codicons (16px icon font). All 1,100+ icon ids are available.

**Usage:** Use for standalone icons. Inside VS Code widgets (actions, pickers, buttons) pass the icon id as an attribute instead.

| Attribute | Type | Default | Description |
|---|---|---|---|
| `name` | string |  | Codicon id, e.g. 'add', 'gear', 'chevron-down', 'copilot' |
| `spin` | boolean |  | Spin animation (loading, sync, gear) |

**Example — Icons**

```html
<span style="display: inline-flex; gap: 12px; padding: 12px;"><vsc-icon name="add"></vsc-icon><vsc-icon name="search"></vsc-icon><vsc-icon name="gear"></vsc-icon><vsc-icon name="copilot"></vsc-icon><vsc-icon name="sync" spin></vsc-icon></span>
```

Source: `src/vs/base/browser/ui/codicons/codicon/codicon.css`, `src/vs/base/common/codiconsLibrary.ts`

## `<vsc-hover>` — Hover (tooltip)

Kind: component · Category: overlays · Status: draft · Verification: verified

Workbench hover / tooltip, e.g. over activity bar items and actions.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `text` | string |  |  |

**Slots:**
- default (children): Rich content (when text is not set)

**Example — Tooltip**

```html
<vsc-hover text="Explorer (Ctrl+Shift+E)"></vsc-hover>
```

Source: `src/vs/editor/browser/services/hoverService/hoverWidget.ts`, `src/vs/base/browser/ui/hover/hoverWidget.css`

## `<vsc-menu>` — Context menu

Kind: component · Category: overlays · Status: draft · Verification: verified

Context menu (`.monaco-menu`): items with keybindings, separators, check marks and submenus.

**Usage:** Inside <vsc-workbench>; position with x/y (px). Children: <vsc-menu-item>, <vsc-menu-separator>.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-menu-item>`, `<vsc-menu-separator>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `x` | number |  |  |
| `y` | number |  |  |
| `label` | string |  |  |

**Slots:**
- default (children): <vsc-menu-item> and <vsc-menu-separator>

**Example — Explorer file context menu**

```html
<vsc-menu x="0" y="0"><vsc-menu-item label="Open Preview"></vsc-menu-item><vsc-menu-item label="Open to the Side" keys="Ctrl+Enter"></vsc-menu-item><vsc-menu-item label="Open With..."></vsc-menu-item><vsc-menu-item label="Open in Integrated Terminal"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Select for Compare"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Find File References"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Open Timeline"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Add File to Chat"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Cut" keys="Ctrl+X"></vsc-menu-item><vsc-menu-item label="Copy" keys="Ctrl+C"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Download..."></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Copy Path" keys="Ctrl+Alt+C"></vsc-menu-item><vsc-menu-item label="Copy Relative Path" keys="Ctrl+Shift+Alt+C"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Rename..." keys="F2"></vsc-menu-item><vsc-menu-item label="Delete Permanently" keys="Del"></vsc-menu-item></vsc-menu>
```

**Example — Checked and submenu items**

```html
<vsc-menu x="0" y="0"><vsc-menu-item label="Word Wrap" keys="Alt+Z" checked></vsc-menu-item><vsc-menu-item label="Minimap" checked></vsc-menu-item><vsc-menu-item label="Breadcrumbs"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Appearance" submenu></vsc-menu-item><vsc-menu-item label="Editor Layout" submenu></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Zen Mode" keys="Ctrl+K Z" disabled></vsc-menu-item></vsc-menu>
```

Source: `src/vs/base/browser/ui/menu/menu.ts`, `src/vs/platform/contextview/browser/contextMenuHandler.ts`

## `<vsc-menu-item>` — Menu item

Kind: component · Category: overlays · Status: draft

A context menu entry: check mark, label, keybinding or submenu chevron.

**Must be inside:** `<vsc-workbench>` › `<vsc-menu>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string |  |  |
| `keys` | string |  | Keybinding text, e.g. 'Ctrl+C' |
| `checked` | boolean |  |  |
| `disabled` | boolean |  |  |
| `submenu` | boolean |  |  |
| `focused` | boolean |  |  |

**Example — Items**

```html
<vsc-menu-item label="Copy" keys="Ctrl+C"></vsc-menu-item><vsc-menu-item label="Word Wrap" checked></vsc-menu-item><vsc-menu-item label="Appearance" submenu></vsc-menu-item>
```

Source: `src/vs/base/browser/ui/menu/menu.ts`

## `<vsc-menu-separator>` — Menu separator

Kind: component · Category: overlays · Status: draft

Horizontal rule between menu groups.

**Must be inside:** `<vsc-workbench>` › `<vsc-menu>`

**Example — Separator**

```html
<vsc-menu-item label="Cut"></vsc-menu-item><vsc-menu-separator></vsc-menu-separator><vsc-menu-item label="Copy"></vsc-menu-item>
```

Source: `src/vs/base/browser/ui/menu/menu.ts`

## `<vsc-notifications-center>` — Notifications center

Kind: component · Category: overlays · Status: draft · Verification: verified

Notification center panel (bottom right) with header actions and a list of notifications.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `heading` | string |  | Header title (default depends on content) |

**Slots:**
- default (children): Notification rows

**Example — Empty**

```html
<vsc-notifications-center></vsc-notifications-center>
```

Source: `src/vs/workbench/browser/parts/notifications/notificationsCenter.ts`

## `<vsc-quick-pick-item>` — Quick pick item

Kind: component · Category: overlays · Status: draft · Verification: verified

A row in the quick input list: optional file icon, label with match highlight, description, keybinding, group separator label and row actions.

**Must be inside:** `<vsc-workbench>` › `<vsc-quick-input>`

**Composed of:** `<vsc-keybinding>`, `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string |  |  |
| `highlight` | string |  | Substring of the label to highlight (the filter match) |
| `description` | string |  | Secondary text after the label (present-but-empty for file rows) |
| `keys` | string |  | Keybinding, e.g. 'Alt+T' |
| `separator` | string |  | Group label shown at the right of the first row of a group, e.g. 'recently opened' |
| `file` | string |  | Show a file icon (value = file name; empty = use label) |
| `icon` | string |  | Codicon shown before the label |
| `focused` | boolean |  |  |

**Slots:**
- `slot="actions"`: <vsc-action> row actions (shown on hover/focus)

**Example — Command rows**

```html
<vsc-quick-pick-item label="Chat Agent Sessions: Toggle Agent Sessions Sidebar" highlight="Toggle" focused><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Chat: Toggle Thinking Content in Accessible View" highlight="Toggle" keys="Alt+T"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item>
```

Source: `src/vs/platform/quickinput/browser/quickInputList.ts`

## `<vsc-setting>` — Setting

Kind: component · Category: settings · Status: draft · Verification: verified

A row in the Settings editor: category + label, description (rich text allowed) and a control (checkbox, number/text input or select).

**Usage:** Inside <vsc-settings-editor>. Description goes in the children; use <a> and <code> for rich descriptions.

**Must be inside:** `<vsc-workbench>` › `<vsc-settings-editor>`

**Composed of:** `<vsc-checkbox>`, `<vsc-input>`, `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `type` | `bool` \| `number` \| `text` \| `enum` | `text` |  |
| `category` | string |  | e.g. 'Editor: ' (with trailing space) |
| `label` | string |  | e.g. 'Font Size' |
| `key` | string |  | Setting id, e.g. editor.fontSize |
| `value` | string |  |  |
| `options` | string |  | enum: comma-separated values |
| `checked` | boolean |  | bool: value |

**Slots:**
- default (children): Description

**Example — Commonly used**

```html
<vsc-settings-group label="Commonly Used"></vsc-settings-group><vsc-setting type="number" category="Editor: " label="Font Size" key="editor.fontSize" value="14">Controls the font size in pixels.</vsc-setting><vsc-setting type="bool" category="Editor: " label="Format On Save" key="editor.formatOnSave">Format a file on save. A formatter must be available and the editor must not be shutting down. When <a href="" title="files.autoSave" data-href="#files.autoSave">Files: Auto Save</a> is set to <code>afterDelay</code>, the file will only be formatted when saved explicitly.</vsc-setting><vsc-setting type="enum" category="Files: " label="Auto Save" key="files.autoSave" options="off,afterDelay,onFocusChange,onWindowChange" value="afterDelay">Controls <a href="https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save">auto save</a> of editors that have unsaved changes.</vsc-setting><vsc-setting type="text" category="Editor: " label="Font Family" key="editor.fontFamily" value="'Droid Sans Mono', monospace">Controls the font family.</vsc-setting>
```

Source: `src/vs/workbench/contrib/preferences/browser/settingsTree.ts`

## `<vsc-settings-group>` — Settings group title

Kind: component · Category: settings · Status: draft · Verification: verified

Group heading row in the Settings editor (e.g. 'Commonly Used').

**Must be inside:** `<vsc-workbench>` › `<vsc-settings-editor>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string |  |  |
| `level` | number | `1` |  |

**Example — Group**

```html
<vsc-settings-group label="Commonly Used"></vsc-settings-group>
```

Source: `src/vs/workbench/contrib/preferences/browser/settingsTree.ts`

## `<vsc-action>` — Action

Kind: component · Category: widgets · Status: draft · Verification: verified

Icon action in an action bar or toolbar (`li.action-item > a.action-label.codicon`), optionally with a dropdown.

**Usage:** Children of <vsc-toolbar>, view/title action slots and chat toolbars.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `icon` | string |  | Codicon id |
| `label` | string |  | Accessible label / tooltip |
| `disabled` | boolean |  |  |
| `checked` | boolean |  |  |
| `dropdown` | boolean |  | Opens a menu |
| `menu` | boolean |  | Menu-contributed action (adds .menu-entry) |

**States:**
- `hover` (pointer): 
- `disabled` (attribute): 
- `checked` (attribute): 

**Example — In the chat toolbar**

```html
<vsc-chat-view><vsc-chat-input></vsc-chat-input></vsc-chat-view>
```

**Example — Toolbar**

```html
<vsc-toolbar><vsc-action icon="add" label="New"></vsc-action><vsc-action icon="refresh" label="Refresh"></vsc-action><vsc-action icon="collapse-all" label="Collapse All" disabled></vsc-action></vsc-toolbar>
```

Source: `src/vs/base/browser/ui/actionbar/actionViewItems.ts`, `src/vs/base/browser/ui/actionbar/actionbar.css`

## `<vsc-button>` — Button

Kind: component · Category: widgets · Status: draft · Verification: verified

Text button (`.monaco-button.monaco-text-button`), primary or secondary, with an optional leading codicon. Colors are applied inline from button tokens, including hover.

**Usage:** Calls to action in views and dialogs. In welcome views, place buttons inside <vsc-welcome-view> to get full-width layout.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `secondary` | boolean |  | Secondary style |
| `icon` | string |  | Leading codicon id |
| `disabled` | boolean |  |  |

**Slots:**
- default (children): Label

**States:**
- `hover` (pointer): 
- `focus` (keyboard): 
- `disabled` (attribute): 

**Example — In a welcome view**

```html
<vsc-sidebar><vsc-welcome-view><vsc-button>Initialize Repository</vsc-button></vsc-welcome-view></vsc-sidebar>
```

**Example — With icon**

```html
<vsc-sidebar><vsc-welcome-view><vsc-button icon="github">Publish to GitHub</vsc-button></vsc-welcome-view></vsc-sidebar>
```

**Example — Variants**

```html
<div style="display: flex; gap: 8px; padding: 12px; width: 360px;"><vsc-button>Primary</vsc-button><vsc-button secondary>Secondary</vsc-button></div>
```

Source: `src/vs/base/browser/ui/button/button.ts`, `src/vs/base/browser/ui/button/button.css`

## `<vsc-checkbox>` — Checkbox

Kind: component · Category: widgets · Status: draft · Verification: verified

Checkbox (`.monaco-custom-toggle.codicon-check`). Toggles on click.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `checked` | boolean |  |  |
| `disabled` | boolean |  |  |
| `label` | string |  | Accessible label |
| `variant` | `` \| `settings` |  | settings = Settings editor checkbox |

**Example — Settings checkbox**

```html
<vsc-settings-editor style="height: 300px;"><vsc-setting type="bool" category="Editor: " label="Format On Save" key="editor.formatOnSave">Format a file on save.</vsc-setting></vsc-settings-editor>
```

Source: `src/vs/base/browser/ui/toggle/toggle.ts`

## `<vsc-count-badge>` — Count badge

Kind: component · Category: widgets · Status: draft · Verification: verified

Small rounded count (`.monaco-count-badge`), e.g. result counts in Search.

**Must be inside:** `<vsc-workbench>`

**Slots:**
- default (children): The count

**Example — Count**

```html
<vsc-count-badge>1</vsc-count-badge>
```

Source: `src/vs/base/browser/ui/countBadge/countBadge.ts`

## `<vsc-find-input>` — Find input

Kind: component · Category: widgets · Status: draft · Verification: verified

Search box with inline option toggles (`.monaco-findInput`): Match Case, Match Whole Word, Use Regular Expression by default.

**Usage:** Inside <vsc-search-view> (Search) or anywhere a find box is needed. Pass <vsc-toggle> children to replace the default toggles.

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>` › `<vsc-search-view>`

**Composed of:** `<vsc-toggle>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `placeholder` | string |  |  |
| `value` | string |  |  |
| `focused` | boolean |  | Show the focused border |

**Slots:**
- default (children): Custom <vsc-toggle> controls

**Example — Search**

```html
<vsc-find-input placeholder="Search" value="app" focused></vsc-find-input>
```

Source: `src/vs/base/browser/ui/findinput/findInput.ts`, `src/vs/base/browser/ui/inputbox/inputBox.ts`

## `<vsc-input>` — Input box

Kind: component · Category: widgets · Status: draft · Verification: verified

Single-line text input (`.monaco-inputbox`).

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `value` | string |  |  |
| `placeholder` | string |  |  |
| `type` | `text` \| `number` | `text` |  |
| `focused` | boolean |  |  |
| `variant` | `` \| `settings` |  |  |

**Example — Settings text input**

```html
<vsc-settings-editor style="height: 300px;"><vsc-setting type="text" category="Editor: " label="Font Family" key="editor.fontFamily" value="'Droid Sans Mono', monospace">Controls the font family.</vsc-setting></vsc-settings-editor>
```

**Example — Plain**

```html
<div style="padding: 12px; width: 320px;"><vsc-input placeholder="Branch name"></vsc-input></div>
```

Source: `src/vs/base/browser/ui/inputbox/inputBox.ts`

## `<vsc-keybinding>` — Keybinding label

Kind: component · Category: widgets · Status: draft · Verification: verified

Keyboard shortcut rendered as keycaps (`.monaco-keybinding`).

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `keys` | string |  | Keys joined with '+', e.g. 'Ctrl+Shift+P' |

**Example — Shortcut**

```html
<vsc-keybinding keys="Ctrl+Alt+I"></vsc-keybinding>
```

Source: `src/vs/base/browser/ui/keybindingLabel/keybindingLabel.ts`

## `<vsc-select>` — Select box

Kind: component · Category: widgets · Status: draft

Native select styled as a VS Code dropdown (`select.monaco-select-box`).

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `options` | string |  | Comma-separated options |
| `value` | string |  |  |
| `label` | string |  |  |
| `variant` | `` \| `settings` |  |  |

**Example — Dropdown**

```html
<div style="padding: 12px; width: 320px;"><vsc-select options="off,afterDelay,onFocusChange,onWindowChange" value="afterDelay" label="Auto Save"></vsc-select></div>
```

Source: `src/vs/base/browser/ui/selectBox/selectBoxNative.ts`, `src/vs/base/browser/ui/selectBox/selectBox.css`

## `<vsc-toggle>` — Toggle (input option)

Kind: component · Category: widgets · Status: draft · Verification: verified

Icon toggle used inside inputs (Match Case, Whole Word, Regex): `.monaco-custom-toggle.codicon`.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `icon` | string |  | Codicon id |
| `checked` | boolean |  |  |
| `disabled` | boolean |  |  |
| `label` | string |  | Accessible label / tooltip |

**States:**
- `checked` (attribute or click): 
- `hover` (pointer): 

**Example — Off**

```html
<vsc-toggle icon="case-sensitive" label="Match Case (Alt+C)"></vsc-toggle>
```

**Example — On**

```html
<vsc-toggle icon="regex" label="Use Regular Expression (Alt+R)" checked></vsc-toggle>
```

Source: `src/vs/base/browser/ui/toggle/toggle.ts`

## `<vsc-toolbar>` — Toolbar

Kind: component · Category: widgets · Status: draft

Horizontal (or vertical) action bar: `.monaco-toolbar > .monaco-action-bar > ul.actions-container`.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `vertical` | boolean |  |  |
| `label` | string |  | Accessible name |

**Slots:**
- default (children): <vsc-action> items

**Example — Actions**

```html
<vsc-toolbar><vsc-action icon="new-file" label="New File..."></vsc-action><vsc-action icon="new-folder" label="New Folder..."></vsc-action><vsc-action icon="refresh" label="Refresh Explorer"></vsc-action><vsc-action icon="collapse-all" label="Collapse Folders in Explorer"></vsc-action></vsc-toolbar>
```

Source: `src/vs/base/browser/ui/toolbar/toolbar.ts`, `src/vs/base/browser/ui/actionbar/actionbar.ts`

## `<vsc-tree>` — Tree (Explorer)

Kind: component · Category: widgets · Status: draft · Verification: verified

File tree list (`.explorer-folders-view .monaco-list`) with Seti file icons; rows are <vsc-tree-item>s laid out at 22px.

**Usage:** Inside <vsc-sidebar>. Children: <vsc-tree-item> rows in display order (use level for nesting).

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>`

**Composed of:** `<vsc-tree-item>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string |  | Accessible name |

**Slots:**
- default (children): <vsc-tree-item> rows

**Example — Explorer**

```html
<vsc-tree style="height: 710px;"><vsc-tree-item kind="folder" label="src"></vsc-tree-item><vsc-tree-item label="package.json" selected focused></vsc-tree-item><vsc-tree-item label="README.md"></vsc-tree-item></vsc-tree>
```

Source: `src/vs/workbench/contrib/files/browser/views/explorerView.ts`, `src/vs/base/browser/ui/list/listWidget.ts`

## `<vsc-tree-item>` — Tree item

Kind: component · Category: widgets · Status: draft · Verification: verified

A row of the Explorer tree (`.monaco-list-row`): twistie, Seti file/folder icon and label. Selection uses inactive-selection colors (list not focused).

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>` › `<vsc-tree>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string |  | File or folder name (drives the file icon) |
| `kind` | `file` \| `folder` | `file` |  |
| `level` | number | `1` | Nesting depth (1 = top level) |
| `expanded` | boolean |  | Folder is expanded |
| `selected` | boolean |  |  |
| `focused` | boolean |  |  |
| `language` | string |  | Language id override for the icon |

**Example — Files**

```html
<vsc-tree-item kind="folder" label="src"></vsc-tree-item><vsc-tree-item label="package.json" selected focused></vsc-tree-item><vsc-tree-item label="README.md"></vsc-tree-item>
```

**Example — Nested**

```html
<vsc-tree-item kind="folder" label="src" expanded></vsc-tree-item><vsc-tree-item level="2" label="app.ts"></vsc-tree-item><vsc-tree-item level="2" label="styles.css"></vsc-tree-item><vsc-tree-item label="package.json"></vsc-tree-item>
```

Source: `src/vs/workbench/contrib/files/browser/views/explorerViewer.ts`, `src/vs/editor/common/services/getIconClasses.ts`

## `<vsc-activity-item>` — Activity bar item

Kind: component · Category: workbench · Status: draft

A view icon in the activity bar, with active indicator and optional count badge.

**Must be inside:** `<vsc-workbench>` › `<vsc-activitybar>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `icon` | string |  | Codicon id, e.g. explorer-view-icon, search-view-icon, source-control-view-icon, run-view-icon, extensions-view-icon |
| `label` | string |  | Tooltip, e.g. 'Explorer (Ctrl+Shift+E)' |
| `checked` | boolean |  | Active view |
| `badge` | string |  | Badge count |
| `kind` | `` \| `menu` |  | menu = Accounts/Manage style button |

**Example — Items**

```html
<vsc-activity-item icon="explorer-view-icon" label="Explorer (Ctrl+Shift+E)" checked></vsc-activity-item><vsc-activity-item icon="source-control-view-icon" label="Source Control (Ctrl+Shift+G)" badge="3"></vsc-activity-item>
```

Source: `src/vs/workbench/browser/parts/compositeBarActions.ts`

## `<vsc-activitybar>` — Activity bar

Kind: component · Category: workbench · Status: draft · Verification: verified

Vertical view switcher at the window edge: view icons (top) and Accounts/Manage (bottom), with active indicator and badges.

**Usage:** Left edge of a full-window layout (44px wide incl. gutter). Children: <vsc-activity-item>; bottom items in slot="bottom". Without children renders the default views.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-activity-item>`

**Slots:**
- default (children): <vsc-activity-item> views
- `slot="bottom"`: <vsc-activity-item kind="menu"> items

**Example — Search active**

```html
<vsc-activitybar style="height: 833px;"><vsc-activity-item icon="explorer-view-icon" label="Explorer (Ctrl+Shift+E)"></vsc-activity-item><vsc-activity-item icon="search-view-icon" label="Search (Ctrl+Shift+F)" checked></vsc-activity-item><vsc-activity-item icon="source-control-view-icon" label="Source Control (Ctrl+Shift+G)"></vsc-activity-item><vsc-activity-item icon="run-view-icon" label="Run and Debug (Ctrl+Shift+D)"></vsc-activity-item><vsc-activity-item icon="extensions-view-icon" label="Extensions (Ctrl+Shift+X)"></vsc-activity-item></vsc-activitybar>
```

**Example — With a badge**

```html
<vsc-activitybar style="height: 400px;"><vsc-activity-item icon="explorer-view-icon" label="Explorer (Ctrl+Shift+E)" checked></vsc-activity-item><vsc-activity-item icon="search-view-icon" label="Search (Ctrl+Shift+F)"></vsc-activity-item><vsc-activity-item icon="source-control-view-icon" label="Source Control (Ctrl+Shift+G)" badge="3"></vsc-activity-item><vsc-activity-item icon="extensions-view-icon" label="Extensions (Ctrl+Shift+X)" badge="1"></vsc-activity-item></vsc-activitybar>
```

Source: `src/vs/workbench/browser/parts/activitybar/activitybarPart.ts`, `src/vs/workbench/browser/parts/compositeBarActions.ts`

## `<vsc-extension-item>` — Extension item

Kind: component · Category: workbench · Status: draft · Verification: verified

An extension row: icon, name, kind indicator, description, publisher and actions (Manage, or Install when installable).

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>` › `<vsc-extension-list>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `name` | string |  |  |
| `description` | string |  |  |
| `icon` | string |  | Icon URL (default: generic extension icon); /s/vscode/assets/extension-language-icon.svg is bundled |
| `kind` | string |  | e.g. 'Local Extension' |
| `version` | string |  |  |
| `publisher` | string |  |  |
| `installable` | boolean |  | Not installed: shows the Install button |

**Example — Installed**

```html
<vsc-sidebar viewlet="extensions-viewlet" style="height: 200px;"><vsc-extension-list><vsc-extension-item name="JSON Language Basics" description="Provides syntax highlighting &amp; bracket matching in JSON files." kind="Local Extension" icon="/s/vscode/assets/extension-language-icon.svg" version="10.0.0" publisher="vscode"></vsc-extension-item></vsc-extension-list></vsc-sidebar>
```

Source: `src/vs/workbench/contrib/extensions/browser/extensionsList.ts`

## `<vsc-extension-list>` — Extension list

Kind: component · Category: workbench · Status: draft

List of extensions in the Extensions view (72px rows).

**Usage:** Inside <vsc-sidebar viewlet="extensions-viewlet">. Children: <vsc-extension-item>.

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>`

**Composed of:** `<vsc-extension-item>`

**Slots:**
- default (children): <vsc-extension-item> rows

**Example — Built-in extensions**

```html
<vsc-sidebar heading="Extensions" viewlet="extensions-viewlet" style="height: 400px;"><vsc-extension-list><vsc-extension-item name="JSON Language Basics" description="Provides syntax highlighting &amp; bracket matching in JSON files." kind="Local Extension" icon="/s/vscode/assets/extension-language-icon.svg" version="10.0.0" publisher="vscode"></vsc-extension-item><vsc-extension-item name="JSON Language Features" description="Provides rich language support for JSON files." kind="Local Extension" version="10.0.0" publisher="vscode"></vsc-extension-item><vsc-extension-item name="Python" description="Python language support with extension access points for IntelliSense, debugging and more." installable></vsc-extension-item></vsc-extension-list></vsc-sidebar>
```

Source: `src/vs/workbench/contrib/extensions/browser/extensionsList.ts`

## `<vsc-pane>` — View pane (collapsible section)

Kind: component · Category: workbench · Status: draft · Verification: verified

A collapsible section of a side bar view (e.g. Explorer's folder, Outline, Timeline): header with twistie, title and actions, and a body.

**Usage:** Children of <vsc-sidebar>; several panes stack and the expanded ones share the height. Header actions go in slot="actions". Click the header to toggle.

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>`

**Composed of:** `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `heading` | string |  | Section title, e.g. 'Outline' |
| `section` | string |  | Accessible section name (default: heading) |
| `icon` | string |  | View icon (shown when the view is moved to the panel) |
| `expanded` | boolean |  |  |

**Slots:**
- default (children): Body (e.g. <vsc-tree>)
- `slot="actions"`: <vsc-action> header actions

**Example — Explorer sections**

```html
<vsc-sidebar heading="Explorer" style="height: 833px;"><vsc-action slot="actions" icon="toolbar-more" label="Views and More Actions..." dropdown></vsc-action><vsc-pane heading="ws" section="Explorer Section: ws" icon="explorer-view-icon" expanded><vsc-action slot="actions" menu icon="new-file" label="New File..."></vsc-action><vsc-action slot="actions" menu icon="new-folder" label="New Folder..." focusable="false"></vsc-action><vsc-action slot="actions" menu icon="refresh" label="Refresh Explorer" focusable="false"></vsc-action><vsc-action slot="actions" menu icon="collapse-all" label="Collapse Folders in Explorer" focusable="false"></vsc-action><vsc-tree><vsc-tree-item kind="folder" label="src"></vsc-tree-item><vsc-tree-item label="package.json"></vsc-tree-item><vsc-tree-item label="README.md"></vsc-tree-item></vsc-tree></vsc-pane><vsc-pane heading="Outline" icon="outline-view-icon"><vsc-action slot="actions" menu icon="collapse-all" label="Collapse All"></vsc-action><vsc-action slot="actions" icon="toolbar-more" label="More Actions..." dropdown focusable="false"></vsc-action></vsc-pane><vsc-pane heading="Timeline" icon="timeline-view-icon"></vsc-pane></vsc-sidebar>
```

Source: `src/vs/base/browser/ui/splitview/paneview.ts`, `src/vs/workbench/browser/parts/views/viewPane.ts`

## `<vsc-panel>` — Panel

Kind: component · Category: workbench · Status: draft · Verification: verified

The bottom panel: view tabs (Problems, Output, Debug Console, Terminal), view actions, maximize/close, and the active view's content.

**Usage:** Below the editor in a full-window layout. tabs/active pick the tabs; view actions go in slot="actions"; children render in the view body.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `tabs` | string | `Problems,Output,Debug Console,Terminal` |  |
| `active` | string |  | Active tab (default: last) |

**Slots:**
- default (children): View content
- `slot="actions"`: <vsc-action> view actions

**Example — Terminal**

```html
<vsc-panel style="height: 292px;"><vsc-action slot="actions" menu icon="plus" label="New Terminal (Ctrl+Shift+C)"></vsc-action><vsc-action slot="actions" icon="split-horizontal" label="Split Terminal (Ctrl+Shift+5)" focusable="false"></vsc-action><vsc-action slot="actions" menu icon="trash" label="Kill Terminal" focusable="false"></vsc-action><vsc-action slot="actions" icon="toolbar-more" label="Views and More Actions..." dropdown focusable="false"></vsc-action></vsc-panel>
```

Source: `src/vs/workbench/browser/parts/panel/panelPart.ts`, `src/vs/workbench/browser/parts/paneCompositePart.ts`

## `<vsc-status-item>` — Status bar item

Kind: component · Category: workbench · Status: draft

A status bar entry. text uses VS Code's label syntax: "$(icon) text" renders codicons inline.

**Must be inside:** `<vsc-workbench>` › `<vsc-statusbar>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `text` | string |  | Label, e.g. '$(error) 0 $(warning) 0' or 'Ln 2, Col 1' |
| `label` | string |  | Accessible label (defaults to text without icons) |
| `align` | `left` \| `right` | `left` |  |
| `compact` | `` \| `left` \| `right` |  | Join with the neighbouring item |

**Example — Problems**

```html
<vsc-status-item text="$(error) 0 $(warning) 0" label="No Problems"></vsc-status-item><vsc-status-item text="$(sync~spin) Syncing"></vsc-status-item>
```

Source: `src/vs/workbench/browser/parts/statusbar/statusbarItem.ts`

## `<vsc-statusbar>` — Status bar

Kind: component · Category: workbench · Status: draft · Verification: verified

Bottom status bar (28px) with left and right item groups.

**Usage:** Bottom of a full-window layout. Children: <vsc-status-item>s in visual order; align="right" items go to the right group.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-status-item>`

**Slots:**
- default (children): <vsc-status-item> entries

**Example — Editing a JSON file**

```html
<vsc-statusbar><vsc-status-item text="$(remote)" label="remote"></vsc-status-item><vsc-status-item text="$(error) 0 $(warning) 0" label="No Problems"></vsc-status-item><vsc-status-item align="right" text="Ln 2, Col 1"></vsc-status-item><vsc-status-item align="right" text="Spaces: 4"></vsc-status-item><vsc-status-item align="right" text="UTF-8"></vsc-status-item><vsc-status-item align="right" text="LF"></vsc-status-item><vsc-status-item align="right" compact="right" text="$(bracket)" label="Editor Language Status"></vsc-status-item><vsc-status-item align="right" compact="left" text="JSON"></vsc-status-item><vsc-status-item align="right" text="$(copilot)" label="Copilot status"></vsc-status-item><vsc-status-item align="right" text="Layout: us"></vsc-status-item><vsc-status-item align="right" text="$(bell)" label="Notifications"></vsc-status-item></vsc-statusbar>
```

Source: `src/vs/workbench/browser/parts/statusbar/statusbarPart.ts`, `src/vs/workbench/browser/parts/statusbar/statusbarItem.ts`

## `<vsc-tab>` — Editor tab

Kind: component · Category: workbench · Status: draft · Verification: verified

One editor tab: file icon, label (italic when preview) and close action; the active tab connects to the editor.

**Must be inside:** `<vsc-workbench>` › `<vsc-editor>` › `<vsc-tabs>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string |  | File name (drives the file icon) |
| `active` | boolean |  |  |
| `preview` | boolean |  | Preview (italic) tab |
| `dirty` | boolean |  |  |

**Example — Pinned and active preview tab**

```html
<vsc-tab label="README.md"></vsc-tab><vsc-tab label="package.json" active preview></vsc-tab>
```

Source: `src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts`

## `<vsc-tabs>` — Editor tabs

Kind: component · Category: workbench · Status: draft · Verification: verified

Editor group title: connected tabs, editor actions and breadcrumbs (`.title.tabs`).

**Usage:** Inside <vsc-editor>. Children: <vsc-tab>s; editor actions in slot="actions". Breadcrumbs follow the active tab unless no-breadcrumbs or breadcrumbs="src/app.ts".

**Must be inside:** `<vsc-workbench>` › `<vsc-editor>`

**Composed of:** `<vsc-tab>`, `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `breadcrumbs` | string |  | Breadcrumb path (default: active tab label) |
| `no-breadcrumbs` | boolean |  |  |

**Slots:**
- default (children): <vsc-tab> tabs
- `slot="actions"`: <vsc-action> editor actions

**Example — Two tabs**

```html
<vsc-tabs><vsc-tab label="README.md"></vsc-tab><vsc-tab label="package.json" active preview></vsc-tab><vsc-action slot="actions" menu icon="split-horizontal" label="Split Editor Right (Ctrl+\)"></vsc-action><vsc-action slot="actions" icon="toolbar-more" label="More Actions..." dropdown></vsc-action></vsc-tabs>
```

Source: `src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts`, `src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts`

## `<vsc-titlebar>` — Title bar

Kind: component · Category: workbench · Status: draft · Verification: verified

Window title bar with navigation, the command center (search box + agent status pill) and layout controls.

**Usage:** Top of a full-window layout (35px tall). label is the workspace name shown in the command center; title actions go in slot="actions" (defaults to the layout toggles).

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `label` | string | `ws` | Workspace / search label |
| `can-go-back` | boolean | `true` |  |
| `can-go-forward` | boolean |  |  |
| `no-layout-controls` | boolean |  |  |

**Slots:**
- `slot="actions"`: <vsc-action menu> title actions

**Example — Title bar**

```html
<vsc-titlebar label="ws"></vsc-titlebar>
```

Source: `src/vs/workbench/browser/parts/titlebar/titlebarPart.ts`, `src/vs/workbench/browser/parts/titlebar/commandCenterControl.ts`

## `<vsc-watermark-entry>` — Watermark entry

Kind: component · Category: workbench · Status: draft

Shortcut hint row in the editor watermark: icon, label and keybinding.

**Must be inside:** `<vsc-workbench>` › `<vsc-editor>` › `<vsc-watermark>`

**Composed of:** `<vsc-keybinding>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `icon` | string |  | Codicon id (watermark-chat, watermark-commands, watermark-settings, …) |
| `label` | string |  |  |
| `keys` | string |  | Keybinding, e.g. 'Ctrl+Shift+P' |

**Example — Entry**

```html
<vsc-watermark-entry icon="watermark-commands" label="Show All Commands" keys="Ctrl+Shift+P"></vsc-watermark-entry>
```

Source: `src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts`

## `<vsc-chat-input>` — Chat input

Kind: pattern · Category: chat · Status: draft · Verification: verified

The chat composer: input editor, primary toolbar (add context, agent, model, tools), send button and secondary toolbar (session target, permissions).

**Usage:** Inside <vsc-chat-view>. Without children it renders the default toolbars; pass items with slot="toolbar" / slot="secondary" to customize. Typing enables send.

**Must be inside:** `<vsc-workbench>` › `<vsc-chat-view>`

**Composed of:** `<vsc-action>`, `<vsc-chat-picker>`, `<vsc-chat-model-picker>`, `<vsc-chat-submit>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `placeholder` | string | `Describe what to build` |  |
| `value` | string |  |  |
| `no-secondary` | boolean |  | Hide the default secondary toolbar items |

**Slots:**
- `slot="toolbar"`: Primary toolbar items (<vsc-action menu>, <vsc-chat-picker>, <vsc-chat-model-picker>)
- `slot="secondary"`: Secondary toolbar items (<vsc-chat-picker>)

**States:**
- `focused` (focus the editor): 
- `can send` (non-empty value): 

**Example — Default**

```html
<vsc-chat-input></vsc-chat-input>
```

**Example — With text**

```html
<vsc-chat-input value="Summarize the open pull requests"></vsc-chat-input>
```

Source: `src/vs/workbench/contrib/chat/browser/widget/input/chatInputPart.ts`, `src/vs/workbench/contrib/chat/browser/widget/media/chat.css`

## `<vsc-dialog>` — Dialog

Kind: pattern · Category: overlays · Status: draft · Verification: verified

Modal dialog over a dimmed workbench: severity icon, message, detail, buttons (primary last) and close button.

**Usage:** Inside <vsc-workbench> (covers it). Detail content goes in the children; buttons="Cancel,Save" lists buttons, primary defaults to the last.

**Must be inside:** `<vsc-workbench>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `severity` | `info` \| `warning` \| `error` | `info` |  |
| `message` | string |  | Bold first line |
| `buttons` | string | `OK` | Comma-separated button labels |
| `primary` | string |  | Primary button label (default: last) |

**Slots:**
- default (children): Detail text (use <br> for line breaks)

**Example — About**

```html
<vsc-dialog message="Visual Studio Code - Insiders" buttons="OK,Copy" style="height: 400px;">Version: 1.144.0-insider<br>Commit: 58173d0ebc1838579e3c331e0a47e365904a6456<br>Date: 2026-10-22T18:58:04+02:00 (4 hrs ago)<br>Browser: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36</vsc-dialog>
```

**Example — Unsaved changes**

```html
<vsc-dialog severity="warning" message="Do you want to save the changes you made to app.ts?" buttons="Don't Save,Cancel,Save" style="height: 300px;">Your changes will be lost if you don't save them.</vsc-dialog>
```

Source: `src/vs/base/browser/ui/dialog/dialog.ts`

## `<vsc-quick-input>` — Quick input (Command Palette / Quick Open)

Kind: pattern · Category: overlays · Status: draft · Verification: verified

The quick input widget: filter box above a list of <vsc-quick-pick-item>s. Used by the Command Palette (Ctrl+Shift+P) and Quick Open (Ctrl+P).

**Usage:** Inside <vsc-workbench> (it floats 6px below the top, centered). Set position="static" to lay it out inline. Children: <vsc-quick-pick-item>.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-quick-pick-item>`, `<vsc-count-badge>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `placeholder` | string | `Type the name of a command to run.` |  |
| `value` | string |  | Filter text, e.g. '>toggle' |
| `position` | `top` \| `static` | `top` |  |

**Slots:**
- default (children): <vsc-quick-pick-item> rows

**Example — Quick Open (recent files)**

```html
<vsc-quick-input position="static" placeholder="Search files by name (append : to go to line or @ to go to symbol), or paste a link"><vsc-quick-pick-item label="package.json" file description="" separator="recently opened" focused><vsc-action slot="actions" icon="split-horizontal" label="Open to the Side"></vsc-action><vsc-action slot="actions" icon="close" label="Remove from Recently Opened" focusable="false"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="README.md" file description=""><vsc-action slot="actions" icon="split-horizontal" label="Open to the Side"></vsc-action><vsc-action slot="actions" icon="close" label="Remove from Recently Opened" focusable="false"></vsc-action></vsc-quick-pick-item></vsc-quick-input>
```

**Example — Command Palette**

```html
<vsc-quick-input position="static" value=">toggle"><vsc-quick-pick-item label="Chat Agent Sessions: Toggle Agent Sessions Sidebar" highlight="Toggle" focused><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Chat: Toggle Thinking Content in Accessible View" highlight="Toggle" keys="Alt+T"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Debug: Toggle Auto Attach" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Debug: Toggle Breakpoint" highlight="Toggle" keys="F9"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Debug: Toggle Exception Breakpoints" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Debug: Toggle Skipping this File" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Emmet: Toggle Comment" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="File: Toggle Active Editor Read-only in Session" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="File: Toggle Auto Save" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Git: Toggle Git Blame Editor Decoration" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Git: Toggle Git Blame Status Bar Item" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Notifications: Toggle Do Not Disturb Mode" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Notifications: Toggle Do Not Disturb Mode By Source..." highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Preferences: Toggle between Light/Dark Themes" highlight="Toggle"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Terminal: Toggle Find Using Case Sensitive" highlight="Toggle" keys="Alt+C"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Terminal: Toggle Find Using Regex" highlight="Toggle" keys="Alt+R"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item><vsc-quick-pick-item label="Terminal: Toggle Find Using Whole Word" highlight="Toggle" keys="Alt+W"><vsc-action slot="actions" icon="gear" label="Configure Keybinding"></vsc-action></vsc-quick-pick-item></vsc-quick-input>
```

Source: `src/vs/platform/quickinput/browser/quickInputController.ts`, `src/vs/platform/quickinput/browser/quickInputList.ts`

## `<vsc-settings-editor>` — Settings editor

Kind: pattern · Category: settings · Status: draft · Verification: verified

The Settings editor: search box, scope tabs, Backup and Sync button, table of contents and settings list.

**Usage:** Inside <vsc-editor> (or standalone with a height). Children: <vsc-settings-group> and <vsc-setting> rows.

**Must be inside:** `<vsc-workbench>`

**Composed of:** `<vsc-setting>`, `<vsc-settings-group>`, `<vsc-button>`, `<vsc-action>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `tabs` | string | `User,Workspace` | Comma-separated scope tabs |
| `tab` | string |  | Active tab |
| `toc` | string |  | Table of contents 'Name:count,…' |
| `placeholder` | string | `Search settings` |  |
| `focused` | boolean |  | Search box focused |

**Slots:**
- default (children): <vsc-settings-group>/<vsc-setting> rows

**Example — Settings**

```html
<vsc-settings-editor tabs="User,Remote [127.0.0.1:8457],Workspace" focused style="height: 657px;"><vsc-settings-group label="Commonly Used"></vsc-settings-group><vsc-setting type="number" category="Editor: " label="Font Size" key="editor.fontSize" value="14">Controls the font size in pixels.</vsc-setting><vsc-setting type="bool" category="Editor: " label="Format On Save" key="editor.formatOnSave">Format a file on save. A formatter must be available and the editor must not be shutting down. When <a href="" title="files.autoSave">Files: Auto Save</a> is set to <code>afterDelay</code>, the file will only be formatted when saved explicitly.</vsc-setting><vsc-setting type="enum" category="Files: " label="Auto Save" key="files.autoSave" options="off,afterDelay,onFocusChange,onWindowChange" value="afterDelay">Controls <a href="https://code.visualstudio.com/docs/editor/codebasics#_save-auto-save">auto save</a> of editors that have unsaved changes.</vsc-setting></vsc-settings-editor>
```

Source: `src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts`

## `<vsc-watermark>` — Editor watermark

Kind: pattern · Category: workbench · Status: draft · Verification: verified

Empty editor group: VS Code letterpress and shortcut hints.

**Usage:** Inside <vsc-editor> when no editor is open. Children: <vsc-watermark-entry>.

**Must be inside:** `<vsc-workbench>` › `<vsc-editor>`

**Composed of:** `<vsc-watermark-entry>`, `<vsc-keybinding>`

**Slots:**
- default (children): <vsc-watermark-entry> rows

**Example — Empty editor**

```html
<vsc-watermark style="height: 831px;"><vsc-watermark-entry icon="watermark-chat" label="Open Chat" keys="Ctrl+Alt+I"></vsc-watermark-entry><vsc-watermark-entry icon="watermark-commands" label="Show All Commands" keys="Ctrl+Shift+P"></vsc-watermark-entry><vsc-watermark-entry icon="watermark-settings" label="Open Settings" keys="Ctrl+,"></vsc-watermark-entry></vsc-watermark>
```

**Example — Shortcuts rotate**: VS Code shows a rotating subset of shortcuts.

```html
<vsc-watermark style="height: 831px;"><vsc-watermark-entry icon="watermark-chat" label="Open Chat" keys="Ctrl+Alt+I"></vsc-watermark-entry><vsc-watermark-entry icon="watermark-commands" label="Show All Commands" keys="Ctrl+Shift+P"></vsc-watermark-entry><vsc-watermark-entry icon="watermark-find-in-files" label="Find in Files" keys="Ctrl+Shift+F"></vsc-watermark-entry></vsc-watermark>
```

Source: `src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts`

## `<vsc-welcome-view>` — Welcome view

Kind: pattern · Category: workbench · Status: draft · Verification: verified

Empty-state content of a view: paragraphs, links and full-width buttons (`.welcome-view-content`).

**Usage:** Use inside <vsc-sidebar> for empty states. Children: <p> text (links as <a class="monaco-link">) and <vsc-button>s (wrapped in .button-container automatically).

**Must be inside:** `<vsc-workbench>` › `<vsc-sidebar>`

**Composed of:** `<vsc-button>`

**Slots:**
- default (children): <p> paragraphs and <vsc-button> buttons

**Example — Source Control (no repository)**

```html
<vsc-welcome-view style="height: 794px;"><p>The folder currently open doesn't have a Git repository. You can initialize a repository which will enable source control features powered by Git.</p><vsc-button>Initialize Repository</vsc-button><p>To learn more about how to use Git and source control in VS Code <a class="monaco-link" tabindex="0" href="https://aka.ms/vscode-scm" role="button">read our docs</a>.</p><p>You can directly publish this folder to a GitHub repository. Once published, you'll have access to source control features powered by Git and GitHub.</p><vsc-button icon="github">Publish to GitHub</vsc-button></vsc-welcome-view>
```

Source: `src/vs/workbench/browser/parts/views/viewPane.ts`
