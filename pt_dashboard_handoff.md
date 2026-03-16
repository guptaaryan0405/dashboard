# PT Dashboard AI Handoff Document

This document serves as an architectural and UI/UX reference to bootstrap the new PrimeTime (PT) Dashboard. **The goal is to replicate the premium, high-density data visualization experience of the Innovus Run Tracker dashboard, adapted for the new PT JSON data structure.**

## 1. Core Technology Stack
- **Framework:** React (v19) + TypeScript + Vite.
- **State Management:** Zustand.
  - *Crucial Note:* Use Zustand's `persist` middleware for UI settings (like theme, filters, auto-refresh intervals), but **never persist the raw JSON payload/array**. The raw output files often exceed 15-20MB, which causes the browser's 5MB `localStorage` limit to crash with a "Quota Exceeded" exception.
- **UI Library & Styling:** Material-UI (MUI v6/v7) custom-themed with Emotion. Vanilla CSS (`index.css`) is used for global resets and keyframe micro-animations.
- **Icons:** `@mui/icons-material` and `lucide-react`.
- **Data Visualization:** `recharts` for tracking metrics across selected runs.

## 2. UI/UX Paradigm & Design Language
The dashboard must feel premium, modern, and highly responsive.
- **Aesthetics:** Utilize dark mode by default, glassmorphism overlays, subtle box-shadows, and smooth micro-animations. Avoid generic flat colors; use tailored HSL palettes (e.g., deep slates, vibrant primary blues/teals). 
- **Typography:** Clean, sans-serif fonts suitable for dense tabular data (e.g., Inter, Roboto).
- **High Data Density:** The UI must comfortably display thousands of data points without feeling cluttered. Use clear borders, zebra-striping, and sticky headers.

## 3. Core Features & Layout Architecture

### A. The Top Banner (Header)
The top banner handles global data ingestion and session state.
- **Empty State:** When no data is loaded, replacing the entire toolbar with a prominent, dashed-border "Load Dashboard JSON" button.
- **Tracking State:** Once a file is loaded, display:
  - The currently tracked JSON path and exactly when it was last updated.
  - A "Refresh Now" icon button to manually poll the disk for new data.
  - An "Auto-Load" toggle switch that polls the target file every 5 minutes by default.
  - A Settings Cog to configure the Auto-Load interval and manually override the file path.
- *Implementation detail:* For local file polling to work without a backend server, utilize the File System Access API (`window.showOpenFilePicker()`). If the user types a literal filename instead of browsing, parse it using a Vite dynamic `/@fs/...` local URL to bypass SPA routing errors.

### B. Floating Action Bar & Filtering
Global controls should float or stick slightly below the header to preserve vertical space.
- **Contextual Search:** A single search input that filters rows by run names, tags, or keys.
- **Focus Mode ("Eye" Toggle):** Allows the user to select specific runs using table checkboxes and click a "View Only Selected" button to instantly hide all other rows.
- **Quick Filters:** Dropdowns or toggle-groups to hide/show specific stages or groups of runs.

### C. The Main Data Table
A robust table capable of displaying the complex PT telemetry data.
- **View Modes:** Split the columns into semantic modes using a toggle group (e.g., *Timing*, *Area*, *Power*, *DRCs*). The user can switch modes to see entirely different subsets of metrics without horizontal scrolling forever.
- **Context Menus:** Implement a React custom context menu so the user can right-click any run row to trigger actions (like "View Error Logs").
- **Visual Thresholds:** Color-code metrics critically. (e.g., If WNS is negative, color the text red. If DRCs > 0, highlight it).

### D. Metric Visualization (Recharts)
- Allow users to select 2 to 5 runs using checkboxes and visualize their metrics (WNS, Power, Area) against each other on a bar chart or line graph rendered via Recharts.

## 4. Bootstrapping Instructions for the AI Agent
1. **Initialize Project:** Run `npx -y create-vite@latest ./ --template react-ts`.
2. **Install Deps:** `npm i @mui/material @mui/icons-material @emotion/react @emotion/styled zustand recharts lucide-react uuid`.
3. **Scaffold Theme:** Immediately establish a rich `theme.ts` file extending MUI's palette.
4. **Data Ingestion:** Analyze the provided `pt_dashboard.json` scheme the user provides and write Typescript Interfaces to strictly type the incoming data.
5. **Build Components:** Follow the component structure (Header, Floating ActionBar, RunsTable, ErrorModal).
