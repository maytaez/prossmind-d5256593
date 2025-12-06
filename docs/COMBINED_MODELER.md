# Combined BPMN + DMN Modeler with AI Generation

This component provides a unified interface for creating and editing both BPMN (Business Process Model and Notation) and DMN (Decision Model and Notation) diagrams with integrated AI generation powered by Google Gemini.

## Features

- **Dual Modeler**: Switch seamlessly between BPMN and DMN editing modes
- **AI-Powered Generation**: Generate diagrams from natural language descriptions
- **Full Editing Capabilities**: Complete modeler with properties panel, XML editing, and visual design
- **Download Support**: Export diagrams as XML files
- **Suggestion Prompts**: Quick-start templates for common use cases
- **Real-time Updates**: Automatic saving and change tracking

## Technology Stack

- **@miragon/camunda-web-modeler**: Professional-grade BPMN/DMN modeler
- **Google Gemini AI**: Advanced language model for diagram generation
- **React + TypeScript**: Type-safe component architecture
- **Shadcn/ui**: Modern UI components

## Installation

The required dependencies are already installed:

```bash
npm install @miragon/camunda-web-modeler
```

Package.json includes necessary overrides for compatibility:

```json
{
  "overrides": {
    "min-dash": "4.1.1"
  },
  "resolutions": {
    "min-dash": "4.1.1"
  }
}
```

## Usage

### Basic Implementation

```tsx
import CombinedCamundaWebModeler from "@/components/CombinedCamundaWebModeler";
import "@miragon/camunda-web-modeler/dist/bundle.css";

function MyPage() {
  const handleBpmnChange = (xml: string) => {
    console.log("BPMN updated:", xml);
    // Save to backend
  };

  const handleDmnChange = (xml: string) => {
    console.log("DMN updated:", xml);
    // Save to backend
  };

  return (
    <div className="h-screen w-full">
      <CombinedCamundaWebModeler
        onBpmnChange={handleBpmnChange}
        onDmnChange={handleDmnChange}
      />
    </div>
  );
}
```

### With Initial Diagrams

```tsx
<CombinedCamundaWebModeler
  initialBpmnXml={existingBpmnXml}
  initialDmnXml={existingDmnXml}
  onBpmnChange={handleBpmnChange}
  onDmnChange={handleDmnChange}
  userId={user?.id}
/>
```

## Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialBpmnXml` | `string` | Default BPMN template | Initial BPMN XML content |
| `initialDmnXml` | `string` | Default DMN template | Initial DMN XML content |
| `onBpmnChange` | `(xml: string) => void` | - | Callback when BPMN changes |
| `onDmnChange` | `(xml: string) => void` | - | Callback when DMN changes |
| `userId` | `string` | - | User ID for authentication |

## AI Generation

The component includes an AI generation interface that:

1. **Accepts Natural Language Prompts**: Describe your process or decision logic in plain English
2. **Generates Valid XML**: Creates properly formatted BPMN or DMN diagrams
3. **Provides Suggestions**: Quick-start templates for common scenarios
4. **Handles Errors**: Graceful error handling with user feedback

### Example Prompts

**BPMN:**
- "Create a customer onboarding process"
- "Design an order fulfillment workflow"
- "Build a support ticket resolution process"

**DMN:**
- "Create a loan approval decision table"
- "Design a pricing decision based on customer tier"
- "Build a risk assessment decision table"

## Backend Integration

The component integrates with Supabase Edge Functions:

- **generate-bpmn**: Generates BPMN diagrams from prompts
- **generate-dmn**: Generates DMN diagrams from prompts

Both functions use Google Gemini AI with:
- Semantic caching for improved performance
- Retry logic for reliability
- XML validation and sanitization
- Layout optimization

## Styling

Import the required CSS in your component or page:

```tsx
import "@miragon/camunda-web-modeler/dist/bundle.css";
```

The component uses Tailwind CSS classes and integrates with your existing theme.

## Keyboard Shortcuts

- **Cmd/Ctrl + Enter**: Generate diagram from prompt
- **Standard BPMN/DMN shortcuts**: All standard modeler shortcuts are available

## File Structure

```
src/
├── components/
│   └── CombinedCamundaWebModeler.tsx  # Main component
├── pages/
│   ├── CombinedModelerPage.tsx        # Standalone page
│   └── DmnSubdomain.tsx               # Updated DMN page
└── supabase/functions/
    ├── generate-bpmn/                 # BPMN generation
    └── generate-dmn/                  # DMN generation
```

## Authentication

The component requires user authentication for AI generation. It automatically:
- Checks for active session
- Redirects to `/auth` if not authenticated
- Passes user ID to backend functions

## Error Handling

The component handles various error scenarios:
- **Rate Limiting**: Displays user-friendly message when API limits are reached
- **Credit Depletion**: Notifies when AI credits are exhausted
- **Network Errors**: Graceful degradation with retry options
- **Invalid XML**: Validation and sanitization of generated content

## Performance Optimizations

- **useMemo**: Modeler options are memoized to prevent unnecessary re-renders
- **useCallback**: Event handlers are optimized
- **Lazy Loading**: API client is loaded on-demand
- **Caching**: Semantic caching reduces redundant AI calls

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Limited (desktop recommended)

## Troubleshooting

### Diagrams not rendering
- Ensure CSS is imported: `import "@miragon/camunda-web-modeler/dist/bundle.css"`
- Check browser console for errors
- Verify min-dash version in package.json

### AI generation failing
- Check Supabase Edge Function logs
- Verify GOOGLE_API_KEY environment variable
- Ensure user is authenticated

### Download not working
- Check browser popup blocker settings
- Verify file permissions

## Future Enhancements

- [ ] Collaborative editing
- [ ] Version history
- [ ] Template library
- [ ] Export to multiple formats (SVG, PNG, PDF)
- [ ] Integration with Camunda/Flowable engines
- [ ] Custom element palettes
- [ ] Advanced validation rules

## License

This component is part of the ProssMind project.

## Support

For issues or questions, please contact the development team or create an issue in the project repository.
