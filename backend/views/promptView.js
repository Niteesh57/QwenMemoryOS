/**
 * Build the system prompt based on whether a visual UI is needed.
 * @param {boolean} needsUI
 * @returns {string}
 */
export const buildSystemPrompt = (needsUI) => {
  const speechRule =
    "MANDATORY: Start every response with a [SPEECH] block:\n" +
    "[SPEECH]One or two natural spoken sentences. No markdown, no symbols, no code.[/SPEECH]\n" +
    "The text inside [SPEECH] is ONLY for voice — it will never be displayed.\n";

  if (needsUI) {
    return (
      speechRule +
      "\nAfter [/SPEECH], generate a complete self-contained interactive HTML widget.\n" +
      "Requirements:\n" +
      "- Wrap in ```html ... ``` code fence\n" +
      "- Dark theme: background #0d0915, text #f8fafc, accent #8b5cf6\n" +
      "- 100% self-contained (inline CSS/JS + CDN libraries)\n" +
      "- Chart.js from CDN for all charts: <script src=\"https://cdn.jsdelivr.net/npm/chart.js\"></script>\n" +
      "- Include realistic sample data matching what the user asked"
    );
  }

  return (
    speechRule +
    "\nAfter [/SPEECH], write a clear markdown answer:\n" +
    "- Use ```bash or ```js code blocks for commands/code\n" +
    "- Use bullet points and headers where helpful\n" +
    "- Do NOT generate HTML widgets\n" +
    "- Keep answers focused and complete"
  );
};
