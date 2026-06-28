import fs from "fs";
import { exec } from "child_process";

export const workspaceTools = [
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a shell command in the workspace directory (npm install, git status, etc.).",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "Shell command to execute" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories at a given workspace path.",
      parameters: {
        type: "object",
        properties: { dir: { type: "string", description: "Directory path (default: '.')" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the text contents of a workspace file.",
      parameters: {
        type: "object",
        properties: { filepath: { type: "string", description: "Relative or absolute file path" } },
        required: ["filepath"],
      },
    },
  },
];

/**
 * Execute a workspace tool and return its result as a JSON string.
 * @param {string} name
 * @param {Record<string,string>} args
 * @returns {Promise<string>}
 */
export const executeWorkspaceTool = async (name, args) => {
  console.log(`[Tool] Executing "${name}" with args:`, args);
  try {
    switch (name) {
      case "run_command":
        return new Promise((resolve) => {
          exec(args.command, { timeout: 15_000 }, (err, stdout, stderr) => {
            resolve(JSON.stringify(err ? { error: err.message, stdout, stderr } : { stdout, stderr }));
          });
        });

      case "list_files": {
        const entries = await fs.promises.readdir(args.dir || ".", { withFileTypes: true });
        const list = entries.map(e => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`);
        return JSON.stringify({ files: list });
      }

      case "read_file": {
        const stat = await fs.promises.stat(args.filepath);
        if (stat.size > 1_024 * 1_024) return JSON.stringify({ error: "File exceeds 1 MB safety limit" });
        const content = await fs.promises.readFile(args.filepath, "utf-8");
        return JSON.stringify({ content });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
};
