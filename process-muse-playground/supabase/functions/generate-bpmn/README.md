# Generate BPMN Edge Function

This edge function generates BPMN or P&ID diagrams using either Google Gemini API or Ollama (for local development).

## Setup

### Using Google Gemini API (Production)

1. Set your Google API key in Supabase:
   ```bash
   supabase secrets set GOOGLE_API_KEY=your_api_key_here
   ```

2. The function will automatically use Google Gemini API when `USE_OLLAMA` is not set to `true`.

### Using Ollama (Local Development)

1. **Install Ollama** (if not already installed):
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Or download from https://ollama.ai
   ```

2. **Pull the Gemma model**:
   ```bash
   ollama pull gemma:7b
   # Or use a smaller model:
   ollama pull gemma:2b
   ```

3. **Start Ollama** (if not running):
   ```bash
   ollama serve
   ```
   This will start Ollama on `http://localhost:11434` by default.

4. **Set environment variables** for local development:
   
   Create a `.env` file in your project root or set these in your Supabase local environment:
   ```bash
   USE_OLLAMA=true
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=gemma:7b
   ```

   Or set them when running Supabase locally:
   ```bash
   supabase functions serve generate-bpmn --env-file .env.local
   ```

   In your `.env.local` file:
   ```
   USE_OLLAMA=true
   OLLAMA_URL=http://localhost:11434
   OLLAMA_MODEL=gemma:7b
   ```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_OLLAMA` | `false` | Set to `true` to use Ollama instead of Google Gemini |
| `OLLAMA_URL` | `http://localhost:11434` | URL where Ollama is running |
| `OLLAMA_MODEL` | `gemma:7b` | Ollama model to use (e.g., `gemma:7b`, `gemma:2b`) |
| `GOOGLE_API_KEY` | - | Required if `USE_OLLAMA=false` |

## Available Ollama Models

- `gemma:7b` - 7 billion parameter model (recommended for better quality)
- `gemma:2b` - 2 billion parameter model (faster, lower quality)
- `gemma:13b` - 13 billion parameter model (best quality, requires more RAM)

## Testing Locally

1. Start Supabase locally:
   ```bash
   supabase start
   ```

2. Serve the function with Ollama enabled:
   ```bash
   supabase functions serve generate-bpmn --env-file .env.local
   ```

3. Test the function:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/generate-bpmn \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Create a simple order process", "diagramType": "bpmn"}'
   ```

## Notes

- Ollama is best suited for local development and testing
- For production, use Google Gemini API for better performance and reliability
- Make sure Ollama is running before making requests when `USE_OLLAMA=true`
- The function automatically selects the appropriate model based on diagram complexity




