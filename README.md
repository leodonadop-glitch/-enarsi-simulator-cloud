# ENARSI Exam Simulator (Cloud & Local)

Welcome to the **Cisco ENARSI Exam Simulator** repository. This project is a high-fidelity Cisco IOS-XE command-line simulator and multiple-choice / drag-and-drop exam preparation tool specifically designed for the Cisco 300-410 ENARSI exam.

---

## 📂 Project Structure & Key Files

### 1. Frontend & Core Simulator Engine
*   **[src/lib/ios-simulator/index.js](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/lib/ios-simulator/index.js)**: The core Cisco IOS-XE simulator engine. It manages 19 nested configuration modes, multi-word command prefix matching, contextual help (`?`), autocompletion (`Tab`), and structured history tracking (`{ typed, normalized }`).
*   **[src/components/LabCliSimulator.jsx](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/components/LabCliSimulator.jsx)**: The React component wrapper for the terminal interface. Handles multi-device tabs, prevents deletion of the command line prompts, and evaluates student terminal command history against the expected rubrics.
*   **[src/components/QuestionViewer.jsx](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/components/QuestionViewer.jsx)**: Handles rendering of multiple choice questions, drag-and-drop layouts, image Zoom/Lightbox overlays, and coordinates question state (marked correct, incorrect, or skipped).
*   **[src/data.json](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/src/data.json)**: The central database containing all 483 exam questions, answers, references, images, and expected lab terminal command sequences.

### 2. Cloud Backend & Deployment
*   **[supabase-schema.sql](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/supabase-schema.sql)**: Database schema definitions for Supabase, including profiles, study sessions, and history. Contains strict Row Level Security (RLS) policies enforcing `auth.uid() = user_id` boundaries.
*   **[vite.config.js](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/vite.config.js)**: Bundler configuration (React + PWA integration).
*   **Wrangler Deployment**: Cloudflare Pages integration configuration for serverless edge-hosting.

### 3. Utility Scripts & Tests
*   **[test-simulator.js](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/test-simulator.js)**: Unit test suite for CLI simulator engine validating mode transitions (RIP, EIGRP, OSPF, BGP, VRF, Route-maps, SLA, DHCP, etc.), command resolution, and exit/end cascaded returns.
*   **[scripts/enrich_data_advanced.cjs](file:///c:/Users/leona/Documents/GitHub/agen_v1.2%20-%20copia/enarsi-simulator-cloud/scripts/enrich_data_advanced.cjs)**: Utility to compile, clean, and enrich OCR-extracted questions.

---

## 🚀 Setting Up the Development Environment

### 1. Installation
Clone the repository and install the dependencies:
```bash
npm install
```

### 2. Run Locally
Start the local Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Running Unit Tests
Validate the IOS-XE simulator logic locally:
```bash
node test-simulator.js
```

### 4. Build & Production Preview
Build the production bundle and preview it locally:
```bash
npm run build
npm run preview
```

### 5. Deployment
Publish the production-ready build to Cloudflare Pages (requires Wrangler authentication):
```bash
npx wrangler pages deploy dist
```

---

## 🤖 Agent Roles: Forge & Atlas

This repository utilizes specialized AI workflows during coding sessions:

### 🛠️ Forge (The Builder)
*   **Focus**: Development, refactoring, expansion, and bug fixing.
*   **Primary Tasks**: Extending CLI parser grammar, implementing new IOS configuration modes, fixing autocompletion regressions, and updating UI states.

### ⚖️ Atlas (The Auditor)
*   **Focus**: Quality Assurance, security verification, code structure, and regression safety.
*   **Primary Tasks**: Validating data boundaries (RLS and client/server validation), review of XSS vectors (e.g. avoiding `dangerouslySetInnerHTML`), checking old lab backward compatibility, and ensuring clean builds / separated deployment steps.
