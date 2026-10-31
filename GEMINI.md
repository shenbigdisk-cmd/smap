# Antigravity Workspace Rules

## 1. UI Architecture & Design Standards

### Connected Tab & Tabpanel Architecture
Tabs must NEVER look like detached buttons, floating pills, or segmented chips. A tab is an index projection physically attached to the folder/document sheet beneath it.

#### Essential Tab Design Rules:
1. **Physical Connection (Zero Seam)**:
   - The active tab MUST share the exact same surface background color as the tabpanel beneath it (`var(--bg-panel)`).
   - The baseline border separating the tab bar from the tabpanel must be erased/masked under the active tab (`margin-bottom: -1px; z-index: 2; border-bottom: 1px solid var(--bg-panel)`).
   - Visually, the tab and the panel must form ONE continuous, unified physical surface.

2. **Corner Geometry**:
   - The active tab has rounded **top** corners (`border-top-left-radius: 6px; border-top-right-radius: 6px;`).
   - Bottom corners must be **strictly square** (`border-bottom-left-radius: 0; border-bottom-right-radius: 0;`) flush with the panel interface.

3. **Border & Outline Styling**:
   - The active tab has top, left, and right borders matching the panel outline (`border: 1px solid var(--border-color); border-bottom: 1px solid var(--bg-panel);`), with no distracting top accent line.
   - The active tab must **never** have a bottom border cutting it off from its content panel.

4. **Inactive Tabs vs Active Tab**:
   - Inactive tabs must be quiet and submissive, resting flat on the baseline against the tab strip background (`var(--bg-card-subtle)`).
   - Inactive tabs must NOT have full 4-sided button borders, pill shapes, or button drop-shadows.
   - The active tab rises forward, seamlessly fused with the panel content.

5. **Prohibited Anti-Patterns**:
   - ❌ NEVER render tabs as floating pills or buttons with full 4-corner radius with gaps from the panel.
   - ❌ NEVER draw a solid divider border running uninterrupted under the active tab.
   - ❌ NEVER use drop shadows that sever the active tab from the panel content.
   - ❌ NEVER give the active tab a different background color than the tabpanel body.

### User Avatar Context Menu & Settings Access Architecture
Settings will ALWAYS open from the User Avatar context menu. Standalone settings buttons or gear icons are strictly prohibited.

#### Essential Settings & Avatar Rules:
1. **Single Point of Settings & Status Control**:
   - The User Avatar Menu (`UserAvatarMenu.svelte`) is the exclusive, canonical entry point for opening Application Settings (`SettingsModal.svelte`), toggling Maximus (fullscreen canvas), switching user session status (Active, In Session, Field Mode), and resetting map workspace bounds.
   - Settings must **never** be triggered from standalone gear buttons, separate header icons, or direct tab actions.

2. **Layout Placement Conventions**:
   - **GIS Application Layout**: Positioned at the bottom of the left Action Bar rail (`.rail-bottom`) with `placement="bottom-left"`.
   - **Compact Layout**: Integrated directly into the floating search card with `placement="bottom-right"`.
   - **Public Portal Layout**: Positioned at the top right of the government header (`.header-right`) with `placement="top-right"`.

3. **Zero Map Widget Overlap**:
   - The avatar button must never be placed as a free-floating overlay on the map canvas where it can collide with `.map-tools-floating` (zoom, bearing, home, 2D/3D).

4. **Prohibited Anti-Patterns**:
   - ❌ NEVER create a standalone gear button or "Settings" button in toolbars, rails, tab strips, or headers.
   - ❌ NEVER trigger `mapStore.settingsModalOpen = true` directly from secondary panels or empty states; always route through the avatar context menu.

### UI Simplicity & Anti-Clutter Standard (Strict Anti-Bloat)
AI assistants frequently generate tedious, cluttered interfaces loaded with redundant text, nested subtitles, and duplicated actions. This pattern is strictly prohibited. Keep the interface lean, fast, and high-density.

#### Essential Simplicity Rules:
1. **Zero Explanatory Subtitle Bloat**:
   - ❌ NEVER stack `Title + Subtitle + Explanatory Help Text / Hint` on cards, headers, or setting sections.
   - ❌ NEVER write subtitles stating the obvious (e.g., "Toggle layers to turn on or off", "Filter features using SQL criteria", "Changes take effect immediately", "Flat list of spatial services").
   - A single, crisp title or label is all that is needed. Let standard controls (checkboxes, sliders, inputs) speak for themselves without narrative text.

2. **Single Canonical Action (No Duplicate Pathways)**:
   - ❌ NEVER provide multiple buttons, links, or pathways for the same function in the same view.
   - If an entire card/row is clickable to view details, do NOT add duplicate "Inspect →" or "View Details →" buttons inside that same card.
   - One obvious, clean interaction per capability.

3. **High Signal-to-Noise Ratio**:
   - Minimize visual noise: eliminate superfluous decorative badges, redundant chips, repetitive icons, and unnecessary container boxes.
   - Every element on screen must earn its place by delivering functional utility or essential spatial information.
   - Prioritize primary content (the map canvas, actual property/cadastral data, direct controls) over UI chrome and explanatory copy.

## 2. Core Preferences & Philosophy
- **Frontend Stack**: TypeScript, Svelte (with Vite).
- **Philosophy**: Local-first, user-owned state, clean architecture, privacy-first.
