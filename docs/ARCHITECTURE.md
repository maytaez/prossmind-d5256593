# Combined BPMN + DMN Modeler Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         CombinedCamundaWebModeler Component              │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           Control Bar                               │ │  │
│  │  │  • BPMN/DMN Toggle                                  │ │  │
│  │  │  • Download Button                                  │ │  │
│  │  │  • AI Generation Section                            │ │  │
│  │  │    - Suggestion Prompts                             │ │  │
│  │  │    - Prompt Input                                   │ │  │
│  │  │    - Generate Button                                │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           Modeler Area                              │ │  │
│  │  │                                                     │ │  │
│  │  │  ┌──────────────┐      ┌──────────────┐           │ │  │
│  │  │  │ BpmnModeler  │  OR  │  DmnModeler  │           │ │  │
│  │  │  │              │      │              │           │ │  │
│  │  │  │ • Canvas     │      │ • Canvas     │           │ │  │
│  │  │  │ • Palette    │      │ • Palette    │           │ │  │
│  │  │  │ • Properties │      │ • Properties │           │ │  │
│  │  │  │ • XML Editor │      │ • XML Editor │           │ │  │
│  │  │  └──────────────┘      └──────────────┘           │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      State Management                           │
│  • active: "bpmn" | "dmn"                                       │
│  • prompt: string                                               │
│  • isGenerating: boolean                                        │
│  • bpmnXml: string                                              │
│  • dmnXml: string                                               │
│  • bpmnRef: React.RefObject                                     │
│  • dmnRef: React.RefObject                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Integration                        │
│                                                                 │
│  ┌──────────────────┐          ┌──────────────────┐            │
│  │ Supabase Auth    │          │  Edge Functions  │            │
│  │                  │          │                  │            │
│  │ • getUser()      │          │ • generate-bpmn  │            │
│  │ • onAuthChange() │          │ • generate-dmn   │            │
│  └──────────────────┘          └──────────────────┘            │
│                                         │                       │
│                                         ▼                       │
│                              ┌──────────────────┐               │
│                              │  Google Gemini   │               │
│                              │                  │               │
│                              │ • Text to BPMN   │               │
│                              │ • Text to DMN    │               │
│                              │ • Validation     │               │
│                              │ • Sanitization   │               │
│                              └──────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
CombinedCamundaWebModeler
│
├── Control Bar (div)
│   ├── Tab Toggle (div)
│   │   ├── BPMN Button
│   │   └── DMN Button
│   │
│   ├── Download Button
│   │
│   └── AI Generation Section (div)
│       ├── Header (h3)
│       ├── Suggestion Prompts (div)
│       │   └── Suggestion Buttons (Button[])
│       └── Prompt Input Area (div)
│           ├── Textarea
│           └── Generate Button
│
└── Modeler Area (div)
    ├── BpmnModeler (conditional)
    │   ├── Canvas
    │   ├── Palette
    │   ├── Properties Panel
    │   └── XML Editor
    │
    └── DmnModeler (conditional)
        ├── Canvas
        ├── Palette
        ├── Properties Panel
        └── XML Editor
```

## Data Flow

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Event Handler                            │
│ • handleGenerate()                       │
│ • handleBpmnEvent()                      │
│ • handleDmnEvent()                       │
│ • handleDownload()                       │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ State Update                             │
│ • setIsGenerating(true)                  │
│ • setBpmnXml(newXml)                     │
│ • setDmnXml(newXml)                      │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Backend Call (if AI generation)          │
│ • invokeFunction('generate-bpmn')        │
│ • invokeFunction('generate-dmn')         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Response Processing                      │
│ • Extract XML                            │
│ • Update state                           │
│ • Show toast notification                │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Callback Execution                       │
│ • onBpmnChange?.(xml)                    │
│ • onDmnChange?.(xml)                     │
└──────────────────────────────────────────┘
```

## AI Generation Flow

```
┌─────────────────┐
│ User enters     │
│ prompt          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Click Generate  │
│ or Cmd+Enter    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Validate Input              │
│ • Check prompt not empty    │
│ • Check authentication      │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Call Edge Function          │
│ • generate-bpmn or          │
│ • generate-dmn              │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Edge Function Processing    │
│ 1. Check cache              │
│ 2. Call Gemini API          │
│ 3. Validate XML             │
│ 4. Sanitize XML             │
│ 5. Fix layout (DMN)         │
│ 6. Store in cache           │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Return XML to Frontend      │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Update Component State      │
│ • setBpmnXml(xml) or        │
│ • setDmnXml(xml)            │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ Modeler Renders Diagram     │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│ User Can Edit               │
└─────────────────────────────┘
```

## File Structure

```
prossmind-d5256593/
│
├── src/
│   ├── components/
│   │   └── CombinedCamundaWebModeler.tsx  ← Main component
│   │
│   ├── pages/
│   │   ├── CombinedModelerPage.tsx        ← Standalone page
│   │   └── DmnSubdomain.tsx               ← Updated DMN page
│   │
│   ├── examples/
│   │   └── CombinedModelerExamples.tsx    ← Usage examples
│   │
│   ├── utils/
│   │   └── api-client.ts                  ← API utilities
│   │
│   └── App.tsx                             ← Routes
│
├── docs/
│   ├── COMBINED_MODELER.md                ← Full documentation
│   ├── IMPLEMENTATION_SUMMARY.md          ← Implementation details
│   └── QUICK_REFERENCE.md                 ← Quick reference
│
├── supabase/
│   └── functions/
│       ├── generate-bpmn/                 ← BPMN generation
│       │   └── index.ts
│       └── generate-dmn/                  ← DMN generation
│           └── index.ts
│
└── package.json                           ← Dependencies
```

## Technology Stack

```
┌─────────────────────────────────────────┐
│           Frontend Layer                │
│                                         │
│  React 18 + TypeScript                  │
│  ├── @miragon/camunda-web-modeler       │
│  ├── Shadcn/ui Components               │
│  ├── Tailwind CSS                       │
│  └── React Router                       │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│          Backend Layer                  │
│                                         │
│  Supabase                               │
│  ├── Authentication                     │
│  ├── Edge Functions (Deno)              │
│  └── Database (PostgreSQL)              │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│           AI Layer                      │
│                                         │
│  Google Gemini 2.5 Pro                  │
│  ├── Text to BPMN                       │
│  ├── Text to DMN                        │
│  ├── Semantic Caching                   │
│  └── Validation                         │
└─────────────────────────────────────────┘
```

## State Management Pattern

```
┌─────────────────────────────────────────┐
│         Component State                 │
│                                         │
│  const [active, setActive] = useState   │
│  const [prompt, setPrompt] = useState   │
│  const [isGenerating, setIsGenerating]  │
│  const [bpmnXml, setBpmnXml] = useState │
│  const [dmnXml, setDmnXml] = useState   │
│                                         │
│  const bpmnRef = useRef()               │
│  const dmnRef = useRef()                │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      Memoized Values                    │
│                                         │
│  const bpmnModelerTabOptions = useMemo  │
│  const dmnModelerTabOptions = useMemo   │
│  const suggestionPrompts = useMemo      │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│      Callbacks                          │
│                                         │
│  const handleBpmnEvent = useCallback    │
│  const handleDmnEvent = useCallback     │
│  const handleGenerate = async () => {}  │
│  const handleDownload = async () => {}  │
└─────────────────────────────────────────┘
```

## Error Handling Flow

```
┌─────────────────┐
│ User Action     │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│ Try Block                   │
│ • Execute action            │
└────────┬────────────────────┘
         │
         ├─ Success ──────────────────┐
         │                            │
         └─ Error ─┐                  │
                   ▼                  ▼
         ┌─────────────────┐  ┌──────────────┐
         │ Catch Block     │  │ Success Path │
         │ • Log error     │  │ • Update UI  │
         │ • Parse error   │  │ • Show toast │
         │ • Show toast    │  └──────────────┘
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Error Type?     │
         └────────┬────────┘
                  │
         ├────────┼────────┬────────┐
         │        │        │        │
         ▼        ▼        ▼        ▼
      [429]    [402]    [401]   [Other]
    Rate Limit Credits  Auth    Generic
                                Error
```

## Performance Optimizations

```
┌─────────────────────────────────────────┐
│ 1. useMemo for Modeler Options         │
│    • Prevents unnecessary re-renders    │
│    • Stable object references           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 2. useCallback for Event Handlers      │
│    • Optimizes event handling           │
│    • Prevents child re-renders          │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 3. Lazy Loading                         │
│    • API client loaded on-demand        │
│    • Reduces initial bundle size        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 4. Semantic Caching                     │
│    • Reduces redundant AI calls         │
│    • Faster response times              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 5. Optimized XML Parsing                │
│    • Fast diagram loading               │
│    • Efficient validation               │
└─────────────────────────────────────────┘
```

## Security Considerations

```
┌─────────────────────────────────────────┐
│ Authentication                          │
│ • Check user session before AI calls    │
│ • Redirect to /auth if not logged in    │
│ • Pass user ID to backend               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Input Validation                        │
│ • Validate prompts before sending       │
│ • Sanitize XML output                   │
│ • Prevent XSS attacks                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ API Security                            │
│ • GOOGLE_API_KEY stored server-side     │
│ • Rate limiting on Edge Functions       │
│ • CORS headers configured               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Data Privacy                            │
│ • User data encrypted in transit        │
│ • Diagrams stored per user              │
│ • No sensitive data in logs             │
└─────────────────────────────────────────┘
```
