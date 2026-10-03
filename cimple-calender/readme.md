# Cimple Calendar

A clean, responsive, and intuitive calendar application built for the Potato platform.

## Features

- **Multiple Views**:
  - **Month View**: 6-week monthly overview grid with current day highlight, overflow indicators (`+N more`), and event badges.
  - **Week View**: 7-day schedule with sticky header, 24-hour time gutter, and real-time current time indicator.
  - **Day View**: Single-day timeline view with hour slots and detailed event views.
  - **Year View**: 12-month bird's-eye view with active event indicators.
- **Sidebar & Mini Calendar**:
  - Interactive mini calendar with month navigation and quick jump to date.
  - Categories & Tag filtering (`Work`, `Personal`, `Focus`, `Other`, and custom tags) with event counts.
  - Custom tag creator with color palette.
- **Event Management**:
  - Create, view, update, and delete events.
  - Supports start and end times, all-day toggle, tags, category color styling, and notes.
  - Click on any slot or date to quickly add an event.
- **Search & Filter**:
  - Real-time search across titles and descriptions.
  - Tag/category filtering.
- **Keyboard Shortcuts**:
  - `N`: New event
  - `T`: Jump to Today
  - `M` / `W` / `D` / `Y`: Switch views (Month, Week, Day, Year)
  - `←` / `→`: Navigate previous / next period
  - `Esc`: Close open modal
  - `?`: Show shortcuts cheat sheet
- **Backend & Database**:
  - SQLite tables `CalEvents` and `CalTags` with indexes.
  - Lua server endpoints (`/events`, `/tags`, `/setup`).
  - Auto-initialization and seeding with default tags and sample events.
  - Transparent frontend local cache / fallback for offline resilience.

## Development

```bash
# Frontend development
cd ui && bun run dev

# Build UI
cd ui && bun run build

# Package Potato application
just build_app
```