---
name: Institutional Operational Precision
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#444651'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#00312d'
  on-tertiary: '#ffffff'
  tertiary-container: '#004944'
  on-tertiary-container: '#65bbb1'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#9cf2e8'
  tertiary-fixed-dim: '#80d5cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#00504a'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-tabular:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-dense: 0.5rem
  margin: 1.5rem
  margin-compact: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system establishes an authoritative, reliable, and transparent digital infrastructure for mission-critical civic governance. Built specifically for high-stakes public works, lifecycle tracking, and inter-departmental statutory approvals, the visual language avoids decorative trends, playful consumerisms, and ephemeral styling.

### Design Movement & Core Philosophy
The aesthetic is **Institutional Modernism** anchored in high-density operational utility. It combines:
- **Structural Integrity:** Crisp planar hierarchy, strict alignment, and calibrated data density.
- **Auditable Provenance:** Every metric, rule clearance, sanction ID, and sign-off state carries explicit institutional attribution.
- **Clarity Under Scrutiny:** Prioritizing legible tabular data, precise micro-indicators, and unambiguous visual state over decorative white space.

The emotional tone conveys accountability, administrative permanence, and effortless navigational control for state engineers, nodal officers, and financial comptrollers.

## Colors

The palette is tuned for high-contrast accessibility and long-duration operational focus under daylight office environments.

### Core Architecture
- **Primary Canvas Background:** `#f8fafc` (Slate 50) establishes a non-glare, solid operational base.
- **Secondary Canvas / Recessed Shelves:** `#f1f5f9` (Slate 100) provides grounding for table toolbars, side rails, and workflow canvases.
- **Surface Elevation (Cards & Panels):** Pure white `#ffffff` ensures sharp separation against slate backdrops.
- **Structural Rules & Borders:** `#e2e8f0` (Slate 200) for interior cell rules; `#cbd5e1` (Slate 300) for interactive container borders and card perimeters.

### Administrative Accents
- **Primary Navy (`#1e3a8a`):** Used for global navigation bars, top-level headings, primary commitment buttons, and definitive legal sign-offs.
- **Operational Blue (`#2563eb`):** Active interaction indicators, selected tabs, focused inputs, and interactive data links.

### Strict Semantic State Indicators
State indicators must maintain immediate distinction without reliance on color alone:
- **Verified / Sanctioned / Complete:** Emerald `#059669` (Surface tint: `#ecfdf5`, Border: `#a7f3d0`).
- **Pending / At-Risk / Statutory Review:** Amber `#d97706` (Surface tint: `#fffbeb`, Border: `#fde68a`).
- **Root Blocker / Non-Compliant / Rejected:** Rose `#dc2626` (Surface tint: `#fef2f2`, Border: `#fecaca`).
- **Conditional / Draft / Inactive:** Slate `#64748b` (Surface tint: `#f8fafc`, Border: `#e2e8f0`).

### High-Contrast Typography Tiers
- **Primary Administrative Text:** `#0f172a` (Slate 900) ensures AAA contrast compliance.
- **Body & Tabular Content:** `#1e293b` (Slate 800).
- **Secondary Metadata & Field Labels:** `#334155` (Slate 700).
- **Muted Structural Captions:** `#64748b` (Slate 500).

## Typography

The typography system pairs **Inter** for operational clarity with **JetBrains Mono** for sovereign registry numbers, rule citations, geospatial coordinates, and financial reconciliation values.

### Systematic Hierarchy Rules
- **Inter** handles all narrative documentation, table headers, forms, and administrative titles. Tabular figures (`tnum`) and slashed zeros are forced on Inter across all numeric reporting screens.
- **JetBrains Mono** is mandatory for statutory references (e.g., `GUJ-PWD-2024-8891`), milestone timestamps, GIS lat/long references, rule engine validation IDs, and raw currency units in data grids.
- Font sizes are systematically calibrated to maintain legibility in dense data matrices without forcing excessive vertical scroll.

## Layout & Spacing

The layout is governed by a strict 8px spatial grid, with a secondary 4px micro-grid for input fields, status chips, and table-cell padding.

### Grid Architecture
- **Desktop (1440px and above):** 12-column grid, fluid within a maximum containment barrier of 1800px. Standard gutters are `1rem` (16px); dense data views collapse to `0.5rem` (8px). Section margins standardise at `1.5rem` (24px).
- **Split Workspaces:** Left-anchored statutory navigation rail (fixed at 256px or icon-collapsed at 64px), central operational stage (flexible), and contextual right-side Provenance & Audit Inspector (fixed at 384px).
- **Tablet / Large Screen Reflow:** Under 1024px, the right audit panel transitions into an overlay sheet, and the 12-column layout reflows to an 8-column layout with 16px margins.
- **Dense Data Rhythms:** Data rows standardize on fixed row heights of 36px (dense) or 44px (default standard), preventing layout shifts during bulk state updates.

## Elevation & Depth

This design system avoids high-blur drop shadows and multi-colored ambient glows in favor of **structural containment borders paired with subtle low-diffusion contact shadows**.

### Elevation Stack
- **Level 0 (Recessed / Canvas):** Pure flat `#f8fafc` or `#f1f5f9`. No shadow. Inset 1px line `#e2e8f0` for wells and table header bands.
- **Level 1 (Card & Content Blocks):** Pure white `#ffffff` surface, bounded by a 1px solid `#cbd5e1` or `#e2e8f0` border, reinforced by a micro contact shadow: `0 1px 2px 0 rgba(15, 23, 42, 0.05)`.
- **Level 2 (Hovered Entities, Popovers, & Dropdown Menus):** Pure white surface, 1px border `#cbd5e1`, with shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Modal Dialogs, Provenance Drawers):** 1px border `#94a3b8`, shadow: `0 10px 15px -3px rgba(15, 23, 42, 0.12), 0 4px 6px -4px rgba(15, 23, 42, 0.05)`. Accompanied by a solid neutral scrim `#0f172a` at 40% opacity.

## Shapes

The shape geometry utilizes controlled **Soft** corner radiuses (8px default for cards, inputs, and functional wrappers; 4px for nested tags and table components) to maintain geometric discipline and institutional formality.

### Corner Radius System
- **Base Containers & Cards (`rounded-lg`):** `0.5rem` (8px). Provides clean, structural enclosure without floating bubble effects.
- **Inputs, Buttons, and Filter Bars:** `0.375rem` (6px) to `0.5rem` (8px).
- **Badges, Code Snippets, and Node Tags:** `0.25rem` (4px).
- **Circular Indicators:** Reserved strictly for true status micro-dots, progress rings, and user avatar initials (`rounded-full`). Never use pill shapes for operational buttons or administrative data chips.

## Components

### Buttons
- **Primary Administrative:** Navy `#1e3a8a` background, `#ffffff` text, 1px border `#172554`. Hover: `#1e40af`. Active: `#1e3a5f`. Height: 36px (standard), 32px (compact). Padding: 0 14px. Font: Inter 13px, weight 600.
- **Secondary / Actionable:** Surface `#ffffff`, border 1px solid `#cbd5e1`, text `#1e293b`. Hover: background `#f8fafc`, border `#94a3b8`.
- **Critical / Blocker Action:** Surface `#dc2626`, text `#ffffff`. Hover: `#b91c1c`. Focus: outline 2px solid `#fca5a5` with 2px offset.
- **Icon Attachment:** 16x16px monochrome glyphs aligned strictly to the baseline, spaced 6px from the label.

### Status Badges & Rule Indicators
- Constructed with a 3-part anatomy: 6px solid circular status dot, high-contrast label (Inter 11px uppercase, tracking 0.04em, weight 600), and an optional JetBrains Mono rule code.
- **Verified:** Background `#ecfdf5`, border `#a7f3d0`, text `#065f46`, dot `#059669`.
- **At-Risk / Action Required:** Background `#fffbeb`, border `#fde68a`, text `#92400e`, dot `#d97706`.
- **Root Blocker:** Background `#fef2f2`, border `#fecaca`, text `#991b1b`, dot `#dc2626`.
- **Draft / Dormant:** Background `#f1f5f9`, border `#cbd5e1`, text `#475569`, dot `#64748b`.

### Dense Operational Data Tables
- **Header:** Background `#f8fafc`, text `#475569` (Inter 11px, weight 600, uppercase), border-bottom 1px solid `#cbd5e1`. Fixed row height: 36px.
- **Cells:** Background `#ffffff`, text `#1e293b` (Inter 13px), border-bottom 1px solid `#e2e8f0`. Height: 40px standard, 32px high-density.
- **Numeric & Code Columns:** Monospaced tabular alignment (`font-variant-numeric: tabular-nums`, JetBrains Mono 12px for codes), right-aligned with header alignment matching.
- **Row States:** Hover: background `#f8fafc`. Selected: background `#eff6ff`, left 3px indicator border `#2563eb`.

### Form Fields & Inputs
- **Text Inputs:** Height 36px. Background `#ffffff`, border 1px solid `#cbd5e1`, border-radius 6px. Text `#0f172a`, placeholder `#94a3b8`.
- **Focus State:** Border `#2563eb`, box-shadow `0 0 0 1px #2563eb`.
- **Validation Message:** Directly below input; 12px font size with matching status icon (Rose `#dc2626` for errors, Emerald `#059669` for validated sanction locks).

### Checkboxes & Radio Buttons
- Square 16x16px checkbox with 3px border-radius; 16x16px round radio.
- Border 1.5px solid `#94a3b8`, background `#ffffff`.
- Checked state: Navy `#1e3a8a` fill with `#ffffff` geometric check or centered 6px dot.

### Cards & Container Panels
- White `#ffffff` background, 1px solid border `#cbd5e1`, border-radius 8px.
- Distinct card header segment: 12px vertical padding, 16px horizontal padding, separated from card body by a 1px solid divider line `#f1f5f9`.

### Workflow Node Graphs
- **Nodes:** Rectangular cards with 8px radius, 1px border (`#cbd5e1`), white background. Dimensions: 240px wide by 76px tall.
- **Status Edge Rail:** A 4px vertical accent bar on the left edge indicates milestone state (emerald, amber, rose, slate).
- **Connector Lines:** 2px solid `#94a3b8` for completed pathways, 2px dashed `#cbd5e1` for pending stages.
- **Provenance Badges:** Attached directly to node anchors showing department code and approval timestamp in JetBrains Mono 10px.

### Provenance & Audit Inspector Panels
- Fixed side panels utilizing Level 1 elevation with a solid `#cbd5e1` left border.
- Chronological timeline events connected by a continuous 1px solid vertical trace line (`#e2e8f0`).
- Each entry features: Official seal/department code, officer clearance ID in JetBrains Mono, timestamp down to the second, and a cryptographic checksum hash snippet in muted monospace text.