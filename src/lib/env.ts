export function getOpenAIApiKey() {
  const key = process.env.OPENAI_API_KEY
    ?? process.env.NEXT_PUBLIC_OPENAI_API_KEY;
  if (!key) return undefined;
  const trimmed = key.trim();
  if (!trimmed || trimmed.includes('your-openai') || trimmed.length < 10) return undefined;
  return trimmed;
}

// Legacy shim — some routes still call getGroqApiKey; redirect to OpenAI key
export function getGroqApiKey() {
  return getOpenAIApiKey();
}

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? process.env.SUPABASE_URL
    ?? process.env.VITE_SUPABASE_URL
    ?? '';

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ?? process.env.SUPABASE_ANON_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.SUPABASE_PUBLISHABLE_KEY
    ?? process.env.VITE_SUPABASE_ANON_KEY
    ?? '';

  return { url, anonKey };
}
