# Collapsible & Drag-and-Drop Categories in Sidebar

## Overview
Add collapsible category sections and drag-and-drop reordering to the sidebar navigation.

## Current State
- `Sidebar.tsx` renders a static `sections` array with 9 categories (Media, Image Tools, Sprites, etc.)
- Each category has a title and a list of tool links
- No collapse/expand behavior — all categories are always visible
- No drag-and-drop — order is hardcoded

## Implementation Plan

### 1. Add state for collapsed categories
- Add a `collapsedSections` state (a `Set<string>` of section titles) to `Sidebar`
- Persist collapsed state to `localStorage` so it survives page reloads
- Make the section title header clickable with a chevron icon that rotates on collapse/expand
- Animate the collapse/expand with CSS `grid-template-rows: 0fr → 1fr` transition for smooth open/close
- Auto-expand a category when the user navigates to a tool within it

### 2. Add drag-and-drop category reordering
- Implement using the **HTML5 Drag and Drop API** (no new dependencies needed)
- Add `draggable` to category headers with a drag handle icon (GripVertical from lucide-react)
- Track `draggedIndex` and `overIndex` in state to show visual drop indicators
- On drop, reorder the sections array and persist the new order to `localStorage`
- Store order as an array of section titles in localStorage, and derive the displayed order by sorting sections according to this saved order
- Add subtle visual feedback: dragged item gets opacity reduction, drop target gets a blue line indicator

### 3. Files to modify
- **`src/components/layout/Sidebar.tsx`** — Main changes:
  - Add `useState` for collapsed sections, `useState` for section order
  - Add `useEffect` for localStorage persistence
  - Add `useEffect` to auto-expand the active category
  - Make section titles clickable with chevron
  - Add drag handle, drag events, and drop indicator styling
  - Wrap tool lists in a collapsible container div

### 4. No new dependencies
- HTML5 Drag and Drop API is native
- ChevronRight and GripVertical icons already available in lucide-react
- All styling via Tailwind classes
