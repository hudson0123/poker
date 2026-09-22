# S2V Poker — Sprint Poker Web App

## Overview

A real-time sprint poker (planning poker) web app for Talkiatry sprint planning sessions. Allows a host to create a session with Jira tickets, invite participants via a shareable link, and run voting rounds with hidden votes that are revealed simultaneously.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Server | Custom server.ts with Socket.io |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Confetti | canvas-confetti |
| IDs | nanoid |
| Language | TypeScript |
| Client state | React context + useReducer (synced via socket) |
| Server state | In-memory Map (no database) |

Single deployable — `npm run dev` starts Next.js + WebSocket server on the same process.

## Data Model (in-memory)

```typescript
interface Session {
  id: string;               // nanoid
  name: string;
  hostId: string;           // participant ID of host
  createdAt: Date;
  tickets: Ticket[];
  activeTicketId: string | null;
  participants: Map<string, Participant>; // keyed by participantId
  jiraConfig?: JiraConfig;  // optional, set by host
}

interface JiraConfig {
  baseUrl: string;          // e.g. "talkiatry.atlassian.net"
  email: string;
  apiToken: string;
}

interface Ticket {
  id: string;
  title: string;
  jiraKey?: string;         // e.g. "TA2-1234", parsed from URL or entered directly
  jiraUrl?: string;
  jiraDescription?: string; // fetched from Jira API, plain text
  jiraComments?: JiraComment[]; // fetched from Jira API
  status: 'waiting' | 'voting' | 'revealed';
  votes: Map<string, number | '?' | '☕'>; // participantId → vote
  comments: Comment[];
  round: number;            // tracks re-votes (starts at 1)
}

interface JiraComment {
  author: string;
  body: string;             // ADF converted to plain text
  created: string;          // ISO date
}

interface Participant {
  id: string;               // persistent, stored in client localStorage
  socketId: string;
  name: string;
  isHost: boolean;
  isSpectator: boolean;
  isConnected: boolean;
}

interface Comment {
  id: string;
  participantName: string;
  text: string;
  timestamp: Date;
}
```

Key decisions:
- Participant identity is a persistent ID stored in localStorage, not a socket ID. Reconnecting preserves identity and votes.
- Votes are never sent to clients until the ticket status is `'revealed'`. The server strips vote values from session state for non-revealed tickets.
- Sessions with no connected participants for 30 minutes are auto-purged.

## Pages

| Route | Purpose |
|---|---|
| `/` | Home — "Create Session" button + "Join Session" input |
| `/session/[id]` | Main poker room (host and participants) |
| `/join/[id]` | Name entry screen → redirects to `/session/[id]` |

## UI Layout

```
┌──────────────┬────────────────────────────────────┐
│   SIDEBAR    │         MAIN AREA                  │
│              │                                     │
│  Session:    │  ┌──────────────────────────────┐  │
│  "Sprint 42" │  │ TICKET-123: User login flow  │  │
│              │  │ jira.atlassian.net/...  →     │  │
│  ● Ticket 1  │  └──────────────────────────────┘  │
│    Ticket 2  │                                     │
│    Ticket 3  │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌──┐ ┌──┐  │
│    Ticket 4  │  │1│ │2│ │3│ │5│ │8│ │13│ │21│   │
│              │  └─┘ └─┘ └─┘ └─┘ └─┘ └──┘ └──┘   │
│  + Add ticket│  ┌─┐ ┌─┐                           │
│              │  │?│ │☕│                            │
│              │  └─┘ └─┘                           │
│              │                                     │
│              │  ── Participants ─────────────      │
│              │  ✓ Alice    ✓ Bob    ⏳ Carol       │
│              │                                     │
│              │  [💬 Comments] [⏱ Timer] [Reveal]  │
└──────────────┴────────────────────────────────────┘
```

### Sidebar
- Lists all tickets in the session
- Green dot next to the host's currently active ticket
- Any participant can click any ticket to view it independently (no notification to others)
- Host's active ticket is always highlighted for all users
- Host can add/remove/edit/reorder tickets
- Tickets show status: waiting (gray), voting (blue pulse), revealed (green + final estimate)

### Main Area — Voting
- Point cards: 1, 2, 3, 5, 8, 13, 21, ?, ☕
- Selected card gets bounce + teal glow animation
- Clicking a selected card deselects it
- Participant row shows who has voted (✓) vs hasn't (⏳) — vote values hidden
- Spectators shown separately (no vote indicator)

### Main Area — Reveal
- Host clicks "End Voting" → all face-down cards flip simultaneously (Framer Motion)
- If consensus (all numeric votes equal): confetti burst + "Consensus!" banner
- Stats displayed: average, median, highest, lowest
- Outliers highlighted (votes 2+ Fibonacci steps from median)
- Host options: "Re-vote" (clears votes, increments round) or "Next Ticket"

### Comments Panel
- Slide-out drawer from right side, two tabs: "Session Comments" and "Jira Context"
- **Session Comments tab:** Anyone can post comments during or after voting. Shows participant name + timestamp.
- **Jira Context tab:** Shows ticket description + Jira comments fetched from Jira API (read-only). Only visible when Jira is connected and the ticket has a Jira key.
- Useful for noting why estimates differ or referencing original ticket discussion

### Timer
- Optional countdown timer the host can start (configurable: 30s, 60s, 90s, 120s)
- Visual countdown bar in main area
- Gentle nudge only — does not auto-reveal

## Socket Events

### Client → Server

| Event | Payload | Who |
|---|---|---|
| `join-session` | `{sessionId, participantName, participantId, isSpectator}` | Anyone |
| `submit-vote` | `{ticketId, points}` | Voters |
| `clear-vote` | `{ticketId}` | Voters |
| `add-comment` | `{ticketId, text}` | Anyone |
| `configure-jira` | `{baseUrl, email, apiToken}` | Host |
| `add-ticket` | `{title, jiraUrl?}` | Host |
| `add-tickets-bulk` | `{tickets: {title, jiraUrl?}[]}` | Host |
| `remove-ticket` | `{ticketId}` | Host |
| `edit-ticket` | `{ticketId, title?, jiraUrl?}` | Host |
| `reorder-tickets` | `{ticketIds: string[]}` | Host |
| `start-voting` | `{ticketId}` | Host |
| `reveal-votes` | `{ticketId}` | Host |
| `reset-voting` | `{ticketId}` | Host |
| `set-active-ticket` | `{ticketId}` | Host |
| `start-timer` | `{seconds}` | Host |
| `stop-timer` | `{}` | Host |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `session-state` | Full session (votes stripped for unrevealed) | Full sync on join |
| `participant-joined` | `Participant` | Someone joined |
| `participant-left` | `{participantId}` | Someone disconnected |
| `vote-updated` | `{ticketId, participantId, hasVoted}` | Vote cast (no value) |
| `votes-revealed` | `{ticketId, votes, stats}` | All votes + statistics |
| `ticket-added` | `Ticket` | New ticket |
| `tickets-added` | `Ticket[]` | Bulk import |
| `ticket-removed` | `{ticketId}` | Ticket removed |
| `ticket-updated` | `Ticket` | Ticket edited/status changed |
| `tickets-reordered` | `{ticketIds}` | New ticket order |
| `voting-reset` | `{ticketId, round}` | Votes cleared for re-vote |
| `comment-added` | `{ticketId, Comment}` | New comment |
| `active-ticket-changed` | `{ticketId}` | Host moved tickets |
| `timer-started` | `{endsAt}` | Countdown started |
| `timer-stopped` | `{}` | Countdown cancelled |
| `jira-configured` | `{connected: boolean}` | Jira config saved (no credentials exposed) |
| `jira-context-loaded` | `{ticketId, description, comments}` | Jira data fetched for a ticket |
| `jira-error` | `{ticketId?, message}` | Jira fetch failed |

## Server Architecture

### Custom Server (server.ts)
- Creates HTTP server from Next.js handler
- Attaches Socket.io to the same HTTP server
- Socket.io namespace: default (`/`)
- Each session is a Socket.io room (room name = session ID)

### SessionStore
- `Map<string, Session>` with mutation methods
- Validates host-only events (checks `participant.isHost`)
- Never exposes vote values for unrevealed tickets in serialization
- Cleanup interval: every 5 minutes, purge sessions with no connected participants for 30+ minutes

### Reconnection
- Client stores `participantId` in localStorage
- On reconnect, sends stored `participantId` in `join-session`
- Server matches to existing participant record, updates `socketId` and `isConnected`
- All previous votes preserved

## Jira Integration

### Overview
Optional integration that fetches ticket descriptions and comments from Jira. The host provides their Jira API credentials once per session — credentials are stored in server memory only for that session and never sent to clients.

### Host Setup Flow
1. Host clicks "Connect Jira" button in session settings (gear icon in sidebar header)
2. Modal with three fields: Jira base URL, email, API token
3. Helper text with link to Atlassian API token page (`id.atlassian.com/manage-profile/security/api-tokens`)
4. On submit, server validates credentials with a test API call (`GET /rest/api/3/myself`)
5. Success: green "Connected" badge in sidebar. Failure: error message in modal.

### Data Fetching
- When a ticket with a Jira key is added (parsed from URL or entered directly), the server fetches:
  - Issue summary and description via `GET /rest/api/3/issue/{key}?fields=summary,description,comment`
  - Comments are included in the same response (no extra call needed)
- Jira key parsing: extracts from URL (`https://talkiatry.atlassian.net/browse/TA2-1234` → `TA2-1234`) or accepts bare keys
- Fetched data is cached on the Ticket object in memory — no re-fetching unless the host manually refreshes
- If Jira is not connected, tickets work normally without Jira context

### ADF (Atlassian Document Format) Conversion
- Jira descriptions and comments are in ADF (nested JSON)
- Converted to plain text server-side using a simple recursive text extractor
- Preserves paragraph breaks and list structure
- No external ADF library needed — the format is well-documented and a ~50-line recursive function handles it

### Security
- API credentials stored only in server memory, scoped to the session
- Credentials never sent to any client
- Credentials are purged when the session is cleaned up
- The Jira API token has read-only access by default (Atlassian API tokens inherit the user's permissions but the app only makes GET requests)

## Design Theme — Talkiatry Playful

### Colors
| Token | Value | Usage |
|---|---|---|
| Primary | `#0D7377` | Buttons, selected states, active indicators |
| Primary dark | `#0A5C5F` | Hover states |
| Secondary | `#1B2A4A` | Sidebar, headers, text |
| Accent | `#F5A623` | Highlights, warnings, timer |
| Background | `#F7F8FA` | Page background |
| Surface | `#FFFFFF` | Cards, panels |
| Success | `#2ECC71` | Consensus, revealed, connected |
| Muted | `#94A3B8` | Placeholder text, disabled states |

### Typography
- Font: Inter (system fallback: -apple-system, sans-serif)
- Headings: Semi-bold, secondary color
- Body: Regular, slate-700

### Animations
- Card selection: scale bounce (1 → 1.05 → 1) + teal glow border
- Vote reveal: 3D card flip (face-down → face-up), staggered per participant (50ms delay each)
- Consensus confetti: canvas-confetti burst from center, teal + gold particles
- Participant join: fade-in slide-up
- Sidebar ticket status: color transition (200ms ease)
- Timer: smooth width transition on countdown bar

### Card Design
- Rounded corners (12px), subtle shadow
- Face-down: Talkiatry teal gradient with logo pattern
- Face-up: White with large centered number, participant name below
- Hover: lift (translateY -2px) + shadow increase

## Additional Features

1. **"?" and "☕" cards** — Non-numeric options. "?" = need discussion, "☕" = need a break. Excluded from statistics.

2. **Vote statistics** — Average, median, high, low on reveal. Outliers highlighted (2+ Fibonacci steps from median).

3. **Consensus celebration** — Confetti + "Consensus!" banner when all numeric votes match.

4. **Re-vote tracking** — Badge on ticket showing "Round N" if re-voted. Keeps final estimate visible.

5. **Bulk ticket import** — Host can paste multiple lines. Format per line: `TICKET-123 Title` or `TICKET-123 Title https://jira.url`. Parsed automatically.

6. **Spectator mode** — Join as spectator (no vote, just observe). Shown separately in participant list.

7. **Export summary** — Host can copy a markdown summary of all tickets with final estimates, vote breakdowns, and comments. One-click copy to clipboard.

8. **Timer** — Optional countdown (30s/60s/90s/120s). Visual bar, gentle nudge, no auto-reveal.

## File Structure

```
s2v-poker/
├── server.ts                    # Custom Next.js + Socket.io server
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (fonts, theme)
│   │   ├── page.tsx             # Home page (create/join)
│   │   ├── session/
│   │   │   └── [id]/
│   │   │       └── page.tsx     # Main poker room
│   │   └── join/
│   │       └── [id]/
│   │           └── page.tsx     # Name entry + join
│   ├── components/
│   │   ├── Sidebar.tsx          # Session sidebar with ticket list
│   │   ├── VotingArea.tsx       # Main voting interface
│   │   ├── PointCard.tsx        # Individual vote card
│   │   ├── ParticipantList.tsx  # Participant status display
│   │   ├── RevealView.tsx       # Post-reveal stats + cards
│   │   ├── CommentsPanel.tsx    # Slide-out comments drawer (session + Jira tabs)
│   │   ├── JiraSetupModal.tsx   # Jira credentials modal
│   │   ├── Timer.tsx            # Countdown timer
│   │   ├── TicketHeader.tsx     # Ticket title + Jira link + description
│   │   ├── BulkImport.tsx       # Multi-ticket paste import
│   │   ├── ExportSummary.tsx    # Markdown export button
│   │   └── Confetti.tsx         # Consensus celebration
│   ├── context/
│   │   └── SessionContext.tsx   # React context + socket sync
│   ├── lib/
│   │   ├── socket.ts            # Socket.io client singleton
│   │   └── types.ts             # Shared TypeScript types
│   └── server/
│       ├── SessionStore.ts      # In-memory session management
│       ├── socketHandlers.ts    # Socket.io event handlers
│       └── jiraClient.ts        # Jira REST API client + ADF converter
├── public/
│   └── favicon.ico
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── next.config.js
```

## Security (lightweight)

- Host-only events validated server-side (checks `participant.isHost`)
- Vote values stripped from all client-bound payloads until ticket status is `'revealed'`
- Session IDs are nanoid (21 chars, URL-safe, unguessable)
- No authentication — anyone with the link can join
- No PII stored — just display names in memory
- Jira API credentials stored server-side only, scoped to session lifetime, never sent to clients
