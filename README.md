# Graphdule

> **Projects are graphs of evolving understanding.**

Graphdule is a local-first, graph-based personal project and task management application.

Unlike conventional hierarchical task lists, Graphdule treats:
* **Graph** as the representation of reasoning and dependency (DAG).
* **Timeline** as the temporal projection of the graph.
* **My Day** as the execution surface (Project tasks + Standalone tasks).
* **History** as the evolution of the plan (Immutable versioned snapshots).
* **Storage** as user-controlled and local-first (Browser IndexedDB + Canonical JSON file backup).
* **MCP** as a structured, machine-readable interface to the underlying knowledge graph.

---

## 🏗️ Architecture

Graphdule is built with a strict Hexagonal / Ports-and-Adapters architecture:

```text
┌────────────────────────────────────────────────────────┐
│                      CLIENTS / UI                      │
│   • React 19 Web / PWA UI (@xyflow/react + Dagre)      │
│   • MCP Server / LLM Tools Interface                   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                   PURE DOMAIN SERVICES                 │
│   • ProjectService (Single EGN invariant, Progress)    │
│   • GraphService (DAG cycle prevention, Topo sort)     │
│   • TemporalService (Chronology, Cascade shifts)       │
│   • MyDayService (Today vs Current tasks fallback)     │
│   • HistoryService (Immutable snapshots & diffs)       │
│   • MigrationService (Canonical schema validation)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│                STORAGE ABSTRACTION LAYER               │
│   • BrowserStorageProvider (IndexedDB via idb)         │
│   • JsonFileProvider (Canonical JSON export/import)    │
│   • Cloud Storage Extension points                     │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

1. **Exact Single End Goal Node (EGN)**: Every project has exactly one terminal rightmost objective.
2. **DAG Dependency & Cycle Detection**: Temporal edges enforce `A -> B` where $dueDate(A) \le dueDate(B)$ and forbid cycles.
3. **Temporal Cascade Impact Preview**: Changing a node's date detects chronological impact across downstream successors and requests explicit confirmation before shifting connected tasks.
4. **Derived Spans for Decomposed Tasks**: Higher-level nodes derive start dates and durations from descendant subtasks without altering their explicit deadline.
5. **Preservation of Abandoned Work**: Abandoned branches are preserved in the graph and history for post-mortem context.
6. **My Day Execution Surface**: Clear separation between project tasks and standalone tasks, with persistent toggle between *Today* and *Current Tasks* modes.
7. **Local-First & Data Ownership**: Zero cloud lock-in. Stored locally in IndexedDB with persistent storage warnings and one-click JSON backups.
8. **Immutable Version Snapshots**: Capture and diff project states over time; restore past working states safely.
9. **MCP Ready**: Structured domain methods (`getProjects`, `getProjectGraph`, `getNodeDependencies`, `getOverdueTasks`, etc.) ready for LLM agent integration.

---

## 🛠️ Development & Commands

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run automated unit & integration test suites
npm test

# Build production bundle for GitHub Pages static hosting
npm run build
```

---

## 🌐 GitHub Pages Deployment

Graphdule is configured with relative base paths (`./`) in Vite and includes an automated GitHub Actions deployment workflow (`.github/workflows/deploy.yml`) to deploy statically to `https://<user>.github.io/<repo>/`.

---

## 📄 License

MIT License.
