import { serve } from '../shared/aws-shim';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const handler = serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { messages } = body;
    
    // Validate messages array
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (messages.length > 50) {
      return new Response(
        JSON.stringify({ error: "Too many messages (max 50)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and sanitize each message
    const validatedMessages = messages.map((m: { role?: string; content?: string }) => {
      if (!m || typeof m.content !== 'string') {
        throw new Error("Invalid message format");
      }
      return {
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, 10000) // Limit content length
      };
    });

    const OPENAI_API_KEY = process.env["OPENAI_API_KEY"];
    
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const systemPrompt = `You are ProssMind AI Assistant, an expert helper for the ProssMind application.

**About ProssMind:**
ProssMind is an AI-powered process intelligence platform that helps users create BPMN (Business Process Model and Notation) diagrams through natural language, voice input, document analysis, and screen recording.

**Key Features:**
1. **Text to BPMN**: Users can describe a process in plain text, and AI generates a BPMN 2.0 diagram
2. **Voice to BPMN**: Users can speak their process description in multiple languages, and it's converted to BPMN
3. **Document Analysis**: Upload images, PDFs, Word docs, or text files - OCR extracts content and generates BPMN
4. **Screen Recording**: Record screen activities and convert them into BPMN workflows
5. **BPMN Refinement**: After generation, users can refine diagrams using natural language instructions
6. **Vision AI**: Advanced computer vision for automating visual tasks

**Interface Elements:**
- Navigation: App, Features, Vision AI, Pricing, Contact pages
- Try ProssMind section: Main input area with text input, file upload, and voice recording
- BPMN Viewer: Displays generated diagrams with zoom, download (PNG/SVG/XML), and refinement tools
- Free users get 5 prompts before needing to sign up
- Language selector for voice recognition (supports 14+ languages)

**Common User Questions:**
1. "How do I create a BPMN diagram?" - Describe your process in the text area or use voice/upload documents
2. "What file types are supported?" - Images (PNG, JPEG, WebP), PDFs, Word docs (.docx, .doc), and text files
3. "How do I refine my diagram?" - Use the refinement input below the generated diagram with natural language instructions
4. "Can I download my diagram?" - Yes, use the Tools menu to download as PNG, SVG, or XML
5. "What is BPMN?" - Business Process Model and Notation - a graphical representation for specifying business processes

**Troubleshooting:**
- If generation fails, check if you've exceeded free prompts (sign up for unlimited)
- For document uploads, ensure files are clear and readable
- Voice recording requires microphone permissions
- BPMN refinement requires authentication

Always be helpful, concise, and guide users step-by-step. If users face technical issues, ask for specific error messages or behaviors.`;

    console.log("Calling OpenAI API for chatbot response...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...validatedMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenAI API error:", response.status, text);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limits exceeded, please try again later." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 401) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key is invalid or missing." }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${text}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Chatbot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
