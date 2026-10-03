# Cimple InfiCanvas

An infinite research canvas and interactive mindmap application built for the Potato ecosystem.

## Features

- **Infinite Canvas Navigation**:
  - Pan freely by dragging the canvas background or holding `Space` + drag.
  - Smooth zooming with mouse wheel, pinch gesture, zoom buttons, or `+` / `-` keys.
  - "Fit All" (`Maximize`) to automatically center and scale all cards into view.
  - "Reset View" (`100%`) to return to default coordinates.
  - Interactive **Minimap** in the bottom corner showing the full canvas layout and active viewport box.

- **Mindmap & Visual Connections**:
  - Four connection anchor handles on every card (Left, Right, Top, Bottom).
  - Smooth cubic bezier curves with directional arrowheads connecting nodes.
  - **Quick Branching (`+`)**: Hover over any anchor handle and click the `+` button to instantly spawn and connect a new child card in that direction.
  - **Connect Mode**: Click the `↗ Connect` tool to wire any two cards together.
  - **Auto-Layout Mindmap**: Automatically arranges connected cards into a hierarchical tree layout.
  - Double-click any link curve to remove the connection.

- **Files & Image Integration (libspace.js)**:
  - **Space File Picker**: Integrated with `window.spaceFilePicker(token)` from `libspace.js` to browse and select existing images/files in the Potatoverse Space.
  - **Drag & Drop to Canvas**: Drag image files from your computer or file manager directly onto the infinite canvas to create image cards right at the drop coordinates.
  - **Clipboard Paste**: Press `Ctrl+V` with an image in your clipboard to immediately upload and place it on the canvas.
  - **Direct Upload**: Upload local images to `/zz/api/core/space_file/upload` with automatic fallback to local base64 preview when testing offline.
  - **Space File Previews**: Automatically converts file paths and IDs into Potatoverse preview URLs (`/zz/api/core/space_file/preview/...`).

- **Rich Card Types**:
  - **Text Note**: Research notes, hypotheses, and analytical deductions with inline editing.
  - **Sticky Note**: Colorful sticky note thoughts with custom pastel colors.
  - **Image Reference & Collage**: Visual cards supporting multiple images in an adaptive collage layout (1, 2, 3, or 4+ photos with overflow badge).
  - **Link / Bookmark**: Web reference cards with domain badges and direct external link buttons.
  - **Quote**: Highlighted quotations with quotation typography and author/source attribution.
  - **Checklist**: Interactive action items with checkboxes, progress bar, and item management.

- **Creation & Editing**:
  - Floating dock at the bottom for quick one-click card creation.
  - Double-click empty canvas space to immediately place a card at your cursor position.
  - Natural dynamic card height that adapts automatically to content and collage sizes.
  - Full **Slide-over Card Editor Drawer** for detailed adjustments (title, content, type, custom colors, collage management, Space file picker).
  - Search bar in the topbar to find and highlight matching cards.
  - Duplicate, delete, and rearrange cards effortlessly.

- **Database & Persistence**:
  - SQLite backend via `server.lua` storing `Cards` and `CardLinks`.
  - Debounced auto-save with live status indicator (`Saved`, `Saving...`, `Local DB`).
  - Offline / local fallback ensuring instant responsiveness and zero data loss.