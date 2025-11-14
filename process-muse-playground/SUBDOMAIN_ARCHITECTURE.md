# Subdomain Architecture & User Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ProssMind Application                     │
│              (Same codebase for all subdomains)             │
└─────────────────────────────────────────────────────────────┘
                            ▲
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
    
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  prossmind.com   │ │ bpmn.prossmind.. │ │ pid.prossmind... │
│                  │ │      .com        │ │      .com        │
│  Main Landing    │ │                  │ │                  │
│  - Show both     │ │  BPMN Platform   │ │  P&ID Platform   │
│    options       │ │  - BPMN selected │ │  - P&ID selected │
│  - Navigation    │ │  - BPMN nav      │ │  - P&ID nav      │
│    switcher      │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
     All serve the same React application - subdomain detection changes UI
```

## User Flow Diagram

```
                         ┌─────────────────┐
                         │  User Lands on  │
                         │  Main Domain    │
                         │ prossmind.com   │
                         └────────┬────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
              ▼                             ▼
    ┌──────────────────┐        ┌──────────────────┐
    │   Click "Try     │        │  Click "BPMN"    │
    │   It Free"       │        │  Diagrams        │
    └────────┬─────────┘        └────────┬─────────┘
             │                           │
             ▼                           ▼
    ┌──────────────────┐        ┌──────────────────┐
    │  Generator       │        │  bpmn.prossmind  │
    │  (diagram type   │        │  .com             │
    │   selector       │        │                  │
    │   visible)       │        │  Generator       │
    │                  │        │  BPMN selected   │
    └────────┬─────────┘        └────────┬─────────┘
             │                           │
             └───────────┬───────────────┘
                         │
                  Can switch between
                  BPMN and P&ID via
                  Navigation header
                         │
                    ▼    or    ▼
    ┌──────────────────┐        ┌──────────────────┐
    │  bpmn.prossmind  │        │  pid.prossmind   │
    │  .com            │        │  .com            │
    └──────────────────┘        └──────────────────┘
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    App.tsx (Router)                      │
│  getSubdomain() → shows BpmnIndex | PidIndex | Index   │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Navigation   │  │ Hero          │
│ - Subdomain  │  │ - SubdomainSel│
│   switcher   │  │   ector       │
│ - Subdomain  │  │   component   │
│   nav items  │  │               │
└──────────────┘  └──────────────┘
    │                 │
    └────────┬────────┘
             │
             ▼
        ┌──────────────┐
        │ TryProssMe   │
        │ - Detects    │
        │   subdomain  │
        │ - Auto-selects│
        │   diagram    │
        │   type       │
        └──────────────┘
```

## Subdomain Detection Logic

```
getSubdomain()
│
├─ Check hostname: window.location.hostname
│
├─ If localhost or IP:
│  └─ Check query parameter ?subdomain=bpmn|pid
│     └─ Return 'bpmn' | 'pid' | 'main'
│
└─ If actual domain:
   ├─ Split: "bpmn.prossmind.com" → ["bpmn", "prossmind", "com"]
   ├─ Check first part for 'bpmn' or 'pid'
   └─ Return 'bpmn' | 'pid' | 'main'
```

## Data Flow: Local Storage

```
User on bpmn subdomain
        │
        ├─ Generates diagram
        │  └─ Stores in localStorage:
        │     ├─ generatedBpmn (XML)
        │     └─ diagramType: 'bpmn'
        │
        ├─ Navigates to pid subdomain
        │  └─ TryProssMe loads
        │     └─ Checks localStorage
        │        └─ Finds generatedBpmn + diagramType
        │           └─ Displays diagram
        │              └─ Clears localStorage
        │
        └─ Fresh page load
           └─ No cached diagram
```

## DNS Resolution

```
User enters: bpmn.prossmind.com
           │
           ├─ Browser queries DNS
           │
           ├─ DNS returns: CNAME bpmn.prossmind.com → prossmind.com
           │
           ├─ Browser resolves prossmind.com → 123.45.67.89
           │
           ├─ Browser connects to 123.45.67.89
           │
           ├─ Server/Hosting recognizes bpmn.prossmind.com
           │
           └─ Serves same React app (with getSubdomain detection)
```

## Responsive Navigation

```
DESKTOP (> 768px):
┌────────────────────────────────────────┐
│ Logo | Nav Items | BPMN/P&ID | Account │
│                                        │
│ If on main: BPMN|P&ID switcher visible│
│ If on BPMN: Shows BPMN-specific nav    │
│ If on P&ID: Shows P&ID-specific nav    │
└────────────────────────────────────────┘

MOBILE (< 768px):
┌──────────────────────────┐
│ Logo        [≡] Menu     │
└──────────────────────────┘
  ┌──────────────────────┐
  │ Menu:                │
  │ ├─ Theme Toggle      │
  │ ├─ BPMN/P&ID Switch  │
  │ │  (if main domain)  │
  │ ├─ Nav Items         │
  │ ├─ Account Info      │
  │ └─ Sign Out          │
  └──────────────────────┘
```

## Feature Matrix

| Feature | Main | BPMN | P&ID |
|---------|------|------|------|
| Subdomain Switcher | ✅ | ⤴️ | ⤴️ |
| Subdomain-specific Nav | ✅ | ✅ | ✅ |
| Auto-select Diagram Type | N/A | ✅ | ✅ |
| Generator Component | ✅ | ✅ | ✅ |
| Vision AI Upload | ✅ | ✅ | ✅ |
| Diagram Refinement | ✅ | ✅ | ✅ |

Legend: ✅ = Present, ⤴️ = Can navigate back, N/A = Not applicable

## Environment Support

```
DEVELOPMENT:
localhost:8080/                    → main mode
localhost:8080/?subdomain=bpmn     → BPMN mode
localhost:8080/?subdomain=pid      → P&ID mode

PRODUCTION:
prossmind.com                       → main mode
bpmn.prossmind.com                 → BPMN mode
pid.prossmind.com                  → P&ID mode
```

## Certificate Coverage

```
Required SSL Certificates:

Option 1: Wildcard Certificate
└─ *.prossmind.com (covers all subdomains)

Option 2: Multi-domain Certificate  
├─ prossmind.com
├─ bpmn.prossmind.com
└─ pid.prossmind.com

Most hosting providers (Vercel, Netlify) handle this automatically
```

---

For detailed setup instructions, see `SUBDOMAIN_SETUP.md`
