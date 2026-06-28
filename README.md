# 🌌 FlowMind

### 🔗 Live Production Demo: [https://flowmind-frontend-production-e15c.up.railway.app/login](https://flowmind-frontend-production-e15c.up.railway.app/login)

[![Node.js](https://img.shields.io/badge/Backend-Node.js%2020-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Microservice-Python%20FastAPI-blue?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Database](https://img.shields.io/badge/Database-PostgreSQL-blue?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Cache](https://img.shields.io/badge/Queue-Redis-red?style=flat-square&logo=redis)](https://redis.io/)
[![Deployment](https://img.shields.io/badge/Hosting-Railway-purple?style=flat-square&logo=railway)](https://railway.app)

> A modern, real-time collaborative Kanban workspace featuring an **Autonomous AI Project Manager** that audits board health, predicts sprint risks, estimates task complexity, and schedules weekly digests. Syncs with GitHub and features a Chrome extension to capture tasks from anywhere on the web.

---

## 📸 Product Screenshots

### Sign In Screen
![Welcome Signin Screen](assets/images/signin_page_1782399378167.png)

### Workspace Dashboard
![Workspace Boards Dashboard](assets/images/boards_page_scrolled_1782399445898.png)

### Kanban Board Workspace (GitHub Imported)
![Board View After GitHub Import](assets/images/github_imported_cards_1782402078404.png)

### AI PM Telemetry insights
![AI Project Manager Analysis completed](assets/images/ai_analysis_completed_1782403351696.png)

### Weekly Executive Digests
![Weekly Digest Sidebar Panel (Formatted Markdown)](assets/images/weekly_digest_verified_1782405933833.png)

---

## ✨ Key Features

* ⚡ **Real-Time Collaboration**: Drag-and-drop cards and edit columns with instant synchronization across all active browser windows using Socket.io and Redis.
* 🤖 **Autonomous AI Project Manager**: Powered by **Llama-3.3-70b via Groq**, our AI PM runs background checks to detect bottleneck columns, flag sprint risks, predict task complexity, and stream insights.
* 🔒 **Optimistic UI & Concurrency**: Employs integer-based **Optimistic Concurrency Control (OCC)** to reject stale edits and prevent concurrent update overwrites.
* 🐙 **GitHub Scraper**: Import issues directly from any public GitHub repository with automatic label mapping, assignee resolution, pagination, and deduplication.
* 🧩 **Chrome Extension**: Clip highlight snippets, full-page summaries, and URLs from any website straight into your Kanban boards in real time.
* 🐍 **Python Mail Microservice**: A dedicated FastAPI worker that handles SMTP/IMAP verification protocols and parses OTPs using Regex for E2E tests.
* ✉️ **Brevo HTTPS REST Bypass**: Integrates Brevo's HTTPS REST API over port `443` to bypass cloud firewalls and send emails to any recipient without requiring a custom domain.

---

## 🏗 System Architecture

```mermaid
graph TD
    Client[Next.js Web Client] <-->|1. Real-Time Sockets| SocketServer[Express + Socket.io Server]
    ChromeExt[Chrome Task Clipper] -->|2. HTTP POST /api/cards| SocketServer
    SocketServer <-->|3. Pub/Sub Synced| Redis[Redis Queue Adapter]
    SocketServer <-->|4. Database Schema| Postgres[(PostgreSQL DB)]
    SocketServer -->|5. HTTP POST /send-otp| PyMail[Python FastAPI Mail Worker]
    PyMail -->|6. Deliver OTP| UserInbox[User Mail Inbox]
    SocketServer -->|7. API Inference| Groq[Groq Llama-3.3-70b]
```

### Detailed Network Topology

```mermaid
graph TD
    subgraph Client Layer [Browser & Extension Clients]
        BrowserA[Browser Window A - Next.js]
        BrowserB[Browser Window B - Next.js]
        ChromeExt[Chrome Extension - Popup + Background]
    end

    subgraph Router Layer [Load Balancer & Reverse Proxy]
        Proxy[Railway Ingress / Reverse Proxy]
    end

    subgraph Application Cluster [Microservice Layer]
        NodeServer1[Express Server 1]
        NodeServer2[Express Server 2]
        PyMail[Python FastAPI Email Worker]
    end

    subgraph Infrastructure Cache [State & Sync Replication]
        RedisPubSub[(Redis Cache & Adapter)]
    end

    subgraph Database Layer [Persistence]
        Postgres[(PostgreSQL Database)]
    end

    subgraph External APIs [External Service Nodes]
        GroqAPI[Groq AI API - Llama-3.3-70b]
        GithubAPI[GitHub Public API v3]
        BrevoAPI[Brevo Email HTTP API]
    end

    %% Client Connections
    BrowserA <-->|WebSockets | Proxy
    BrowserB <-->|WebSockets | Proxy
    ChromeExt -->|HTTP POST| Proxy

    %% Proxy routing
    Proxy <--> NodeServer1
    Proxy <--> NodeServer2

    %% Server cluster sync
    NodeServer1 <-->|Pub/Sub Socket Sync| RedisPubSub
    NodeServer2 <-->|Pub/Sub Socket Sync| RedisPubSub

    %% Node DB & APIs
    NodeServer1 <-->|Prisma ORM| Postgres
    NodeServer2 <-->|Prisma ORM| Postgres
    NodeServer1 -->|HTTP POST| GroqAPI
    NodeServer1 -->|HTTP GET| GithubAPI
    NodeServer1 -->|HTTP POST| BrevoAPI
    
    %% Python Mail Worker Connections
    NodeServer1 -->|HTTP POST /send-otp| PyMail
    PyMail -->|SSL Port 465| Gmail[Gmail / SMTP Server]
    UserInbox[User Mailbox] <-->|SSL Port 993| PyMail
```

---

## 🔒 Concurrency Control & Conflict Resolution (OCC)

FlowMind implements **Optimistic Concurrency Control (OCC)** using integer versioning. This guarantees that concurrent operations on the same task card (e.g. User A editing details while User B drags the card to another column) are resolved atomically without database corruption or silent overrides.

### Sequence Flow: Concurrent Drag and Drop Update

```mermaid
sequenceDiagram
    autonumber
    actor UserA as User A (Browser)
    actor UserB as User B (Browser)
    participant Server as Socket.io Server (Express)
    database DB as PostgreSQL DB

    Note over UserA, UserB: Both users hold Card 42 (Version: 5)
    
    UserA->>UserA: Moves card to 'In Progress' (Optimistic UI)
    UserA->>Server: Emit 'card:move' (Card ID: 42, Version: 5, Target: In Progress)
    
    UserB->>UserB: Moves card to 'Done' (Optimistic UI)
    UserB->>Server: Emit 'card:move' (Card ID: 42, Version: 5, Target: Done)

    Note over Server: Server processes User A first
    Server->>DB: UPDATE Card SET columnId='In Progress', version=6 WHERE id=42 AND version=5
    DB-->>Server: Success (1 row updated)
    Server-->>UserA: Emit 'card:move:success' (Acknowledge)
    Server->>UserB: Broadcast 'card:moved' (Card ID: 42, Version: 6, Col: In Progress)

    Note over Server: Server processes User B
    Server->>DB: UPDATE Card SET columnId='Done', version=6 WHERE id=42 AND version=5
    DB-->>Server: Failed (0 rows updated - version mismatch)
    Server-->>UserB: Emit 'card:move:failed' (Version Conflict)
    UserB->>UserB: Revert Optimistic UI: Card snaps back to 'In Progress'
    UserB->>UserB: Show Toast: "Conflict detected. Card state updated to latest version."
```

---

## 🤖 AI Project Manager & Scheduling

The background AI PM agent acts as a virtual Scrum Master, analyzing boards on a configurable schedule:

### 1. Bottleneck Scoring Methodology
Every column's congestion index ($C$) is calculated by the background worker:
$$C = \frac{\text{Cards Entered in Last 7 Days}}{\text{Cards Completed/Moved out in Last 7 Days}}$$
* If $C \ge 1.5$ and column task counts exceed 5, a **bottleneck** is declared.
* The AI is triggered with the board state, analyzing assignee work limits, labels, and dependencies to pinpoint the root cause (e.g. an overloaded assignee).

### 2. Sprint Risk Assessment Mathematical Formula
When a sprint deadline is set, the system calculates the required daily velocity ($V_{\text{req}}$) vs actual velocity ($V_{\text{act}}$):
$$V_{\text{req}} = \frac{\text{Remaining Story Points on Board}}{\text{Days Left in Sprint}}$$
$$V_{\text{act}} = \frac{\text{Story Points Completed in Last 7 Days}}{7}$$
* **High Risk**: $V_{\text{act}} < 0.8 \times V_{\text{req}}$ (The team is moving too slowly to make the deadline).
* **Medium Risk**: $0.8 \times V_{\text{req}} \le V_{\text{act}} < V_{\text{req}}$
* **On Track**: $V_{\text{act}} \ge V_{\text{req}}$

### 3. Task Complexity Inference
Using **Groq Llama-3.3-70b**, the system analyzes the title, description, and tags when a card is created. It compares these with completed tasks and suggests a story point (1, 2, 3, 5, 8) with a written justification.

---

## 🗄️ 4. Database Schema Domain Model (Prisma)

The application domain maps directly to PostgreSQL through the following relationship hierarchy:

```
+---------------+      1:N      +---------------+      1:N      +---------------+
|     User      |-------------->|  ActivityLog  |<--------------|     Board     |
+---------------+               +---------------+               +---------------+
        |                                                               |
        | 1:N (Owner)                                                   | 1:N
        v                                                               v
+---------------+                                               +---------------+
|     Board     |                                               |    Column     |
+---------------+                                               +---------------+
        |                                                               |
        | 1:N                                                           | 1:N
        v                                                               v
+---------------+                                               +---------------+
|    Column     |                                               |     Card      |
+---------------+                                               +---------------+
```

---

## 📡 5. Key API Contracts

### 🔐 Authentication

#### 1. Registration (`POST /api/auth/signup`)
* **Request**:
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword",
    "name": "Alex Mercer"
  }
  ```
* **Response (201 Created)**:
  ```json
  {
    "message": "Account created. Verification OTP code sent to your email.",
    "email": "user@example.com"
  }
  ```

#### 2. OTP Verification (`POST /api/auth/verify-otp`)
* **Request**:
  ```json
  {
    "email": "user@example.com",
    "otpCode": "123456"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "message": "OTP verification successful. Account is active.",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "547dff98-85f5-4c0c-9422-c3e3220b08a3",
      "email": "user@example.com",
      "name": "Alex Mercer",
      "role": "USER"
    }
  }
  ```

---

## 🧩 6. Chrome Extension Architecture

The Chrome Extension is structured using Google Manifest V3 specifications. It clips page details and communicates directly with your backend:

```mermaid
graph LR
    User[Select Text on Webpage] -->|Click Ext Icon| Popup[popup.js]
    ActiveTab[content.js] -->|Scrape Selection & Title| Popup
    Popup -->|HTTP POST /api/cards| CloudBackend[FlowMind Railway API]
    CloudBackend -->|Socket.io Broadcast| WebApp[Next.js Client UI]
```

### Manifest Configuration (`manifest.json`)
```json
{
  "manifest_version": 3,
  "name": "FlowMind Clipper",
  "version": "1.0",
  "description": "Clip tasks from any webpage into your FlowMind Kanban boards.",
  "permissions": ["activeTab", "scripting"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": "icon.png"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ]
}
```

---

## 🚀 Installation & Local Development

Follow the step-by-step setup in the [Quick Start Guide](#quick-start--installation) above to run each service (Backend, Next.js Frontend, Python Mail Worker, Chrome Extension) locally.
