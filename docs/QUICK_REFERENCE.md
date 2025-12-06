# Combined BPMN + DMN Modeler - Quick Reference

## Component Import

```tsx
import CombinedCamundaWebModeler from "@/components/CombinedCamundaWebModeler";
import "@miragon/camunda-web-modeler/dist/bundle.css";
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `initialBpmnXml` | `string` | No | Default BPMN template | Initial BPMN XML content |
| `initialDmnXml` | `string` | No | Default DMN template | Initial DMN XML content |
| `onBpmnChange` | `(xml: string) => void` | No | - | Callback when BPMN changes |
| `onDmnChange` | `(xml: string) => void` | No | - | Callback when DMN changes |
| `userId` | `string` | No | - | User ID for authentication |

## Minimal Example

```tsx
<div className="h-screen w-full">
  <CombinedCamundaWebModeler />
</div>
```

## Full Example

```tsx
<CombinedCamundaWebModeler
  initialBpmnXml={existingBpmnXml}
  initialDmnXml={existingDmnXml}
  onBpmnChange={(xml) => saveBpmn(xml)}
  onDmnChange={(xml) => saveDmn(xml)}
  userId={user?.id}
/>
```

## AI Generation

### BPMN Prompts
- "Create a customer onboarding process"
- "Design an order fulfillment workflow"
- "Build a support ticket resolution process"
- "Generate an employee hiring workflow"
- "Create an invoice approval process"

### DMN Prompts
- "Create a loan approval decision table"
- "Design a pricing decision based on customer tier"
- "Build a risk assessment decision table"
- "Generate a discount eligibility decision"
- "Create a product recommendation decision"

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Enter` | Generate diagram from prompt |
| Standard BPMN/DMN shortcuts | All modeler shortcuts available |

## Routes

| Route | Description |
|-------|-------------|
| `/modeler` | Standalone combined modeler page |
| `dmn.localhost:8080` | DMN subdomain (uses combined modeler) |

## Backend Functions

| Function | Purpose | Input | Output |
|----------|---------|-------|--------|
| `generate-bpmn` | Generate BPMN from prompt | `{ prompt, diagramType }` | `{ bpmnXml }` |
| `generate-dmn` | Generate DMN from prompt | `{ prompt }` | `{ dmnXml }` |

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 429 | Rate limit exceeded | Wait and retry |
| 402 | AI credits depleted | Add credits |
| 401 | Not authenticated | Log in |
| 500 | Server error | Check logs |

## Common Patterns

### Save to Supabase

```tsx
const handleBpmnChange = async (xml: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('bpmn_diagrams').upsert({
    user_id: user.id,
    xml_content: xml,
    updated_at: new Date().toISOString()
  });
};
```

### Load from Supabase

```tsx
const loadDiagram = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data } = await supabase
    .from('bpmn_diagrams')
    .select('xml_content')
    .eq('user_id', user.id)
    .single();

  return data?.xml_content;
};
```

### Programmatic Generation

```tsx
const generateDiagram = async (prompt: string, type: 'bpmn' | 'dmn') => {
  const { invokeFunction } = await import('@/utils/api-client');
  const functionName = type === 'dmn' ? 'generate-dmn' : 'generate-bpmn';
  
  const { data, error } = await invokeFunction(functionName, {
    prompt,
    diagramType: type === 'dmn' ? undefined : 'bpmn'
  });

  if (error) throw error;
  return data?.bpmnXml || data?.dmnXml;
};
```

## Styling

### Required CSS

```tsx
import "@miragon/camunda-web-modeler/dist/bundle.css";
```

### Container Requirements

```tsx
// Component needs full height container
<div className="h-screen w-full">
  <CombinedCamundaWebModeler />
</div>
```

## Troubleshooting

### Issue: Diagrams not rendering
**Solution:** Import CSS: `import "@miragon/camunda-web-modeler/dist/bundle.css"`

### Issue: AI generation fails
**Solution:** Check authentication and GOOGLE_API_KEY

### Issue: TypeScript errors
**Solution:** Verify min-dash override in package.json

### Issue: Download not working
**Solution:** Check browser popup blocker

## Performance Tips

1. Use `useMemo` for modeler options
2. Use `useCallback` for event handlers
3. Lazy load API client
4. Enable semantic caching
5. Optimize XML parsing

## Best Practices

1. **Always handle errors** - Use try/catch and display user-friendly messages
2. **Validate user input** - Check prompts before sending to AI
3. **Save frequently** - Implement auto-save or prompt users to save
4. **Provide feedback** - Use loading states and progress indicators
5. **Test on multiple browsers** - Ensure compatibility

## Environment Setup

```env
# Required
GOOGLE_API_KEY=your_gemini_api_key

# Optional
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_key
```

## Package.json Configuration

```json
{
  "dependencies": {
    "@miragon/camunda-web-modeler": "^latest"
  },
  "overrides": {
    "min-dash": "4.1.1"
  },
  "resolutions": {
    "min-dash": "4.1.1"
  }
}
```

## Testing Checklist

- [ ] Component renders
- [ ] BPMN/DMN toggle works
- [ ] AI generation works
- [ ] Download works
- [ ] Change callbacks fire
- [ ] Authentication checks work
- [ ] Error handling works
- [ ] Keyboard shortcuts work

## Support

For issues or questions:
1. Check browser console for errors
2. Review Supabase Edge Function logs
3. Verify environment variables
4. Check documentation at `/docs/COMBINED_MODELER.md`

## Resources

- [Full Documentation](./COMBINED_MODELER.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Usage Examples](../src/examples/CombinedModelerExamples.tsx)
- [BPMN Spec](https://www.omg.org/spec/BPMN/2.0/)
- [DMN Spec](https://www.omg.org/spec/DMN/1.3/)
