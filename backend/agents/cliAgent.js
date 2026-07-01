/**
 * CLI Agent Node
 * Resolves command line instructions, returning the command that has to be run.
 */
export const cliAgentNode = async (state) => {
  console.log("[CLI Agent] Activated. Resolving terminal command instruction...");

  const systemPrompt =
    "MANDATORY: Start every response with a [SPEECH] block:\n" +
    "[SPEECH]One or two natural spoken sentences explaining what command will run or was requested.[/SPEECH]\n" +
    "The text inside [SPEECH] is ONLY for voice — it will never be displayed.\n\n" +
    "After [/SPEECH], return the exact command(s) that need to be run inside a ```bash ... ``` code block.\n" +
    "Provide clear, direct command line answers. Avoid general chit-chat; give the command first.";

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: state.prompt },
  ];

  return {
    needsUI: false,
    messages: messages,
  };
};
