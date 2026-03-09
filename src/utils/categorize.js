const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

/**
 * Send the session transcript to Gemini Flash and get back
 * categorized items in 4 ADHD-friendly buckets.
 *
 * @param {Array<{role: string, text: string}>} messages — the chat log
 * @returns {Promise<{tasks: string[], ideas: string[], thoughts: string[], emotions: string[]}>}
 */
export async function categorizeTranscript(messages) {
  if (!messages.length) return null

  // Build a readable transcript from the messages
  const transcript = messages
    .filter(m => m.text?.trim())
    .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`)
    .join('\n')

  if (!transcript.trim()) return null

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are organizing a brain dump session for someone with ADHD. Read the transcript below and categorize everything the USER said into exactly 4 buckets. Only categorize the user's thoughts — ignore the AI's responses.

CATEGORIES:
1. tasks — Actionable items that require doing something (e.g., "Email the boss", "Buy groceries")
2. ideas — Creative thoughts, "someday" projects, or inspiration (e.g., "I should start a podcast")
3. thoughts — Context, facts, or information worth remembering but not actionable (e.g., "Rent is due on the 5th now")
4. emotions — Feelings, vents, or emotional states (e.g., "I feel guilty about missing that deadline")

RULES:
- Keep each item SHORT — one concise sentence max
- Rephrase for clarity but preserve the user's intent
- If nothing fits a category, leave its array empty
- Extract ALL relevant items, don't skip anything the user mentioned

TRANSCRIPT:
${transcript}

Respond with ONLY valid JSON, no markdown formatting.`
          }]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              tasks: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              ideas: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              thoughts: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              },
              emotions: {
                type: 'ARRAY',
                items: { type: 'STRING' }
              }
            },
            required: ['tasks', 'ideas', 'thoughts', 'emotions']
          }
        }
      })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    console.error('[categorize] API error:', err)
    throw new Error('Failed to categorize transcript')
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from categorization')

  return JSON.parse(text)
}
