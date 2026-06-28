// This is where you can define and add your own MCP tools for the application.
// By default, the UI points to https://mcpui.dev/ as a visual tool interface.

export interface MCPTool {
  id: string;
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

class MCPToolService {
  private tools: Map<string, MCPTool> = new Map();

  registerTool(tool: MCPTool) {
    this.tools.set(tool.id, tool);
    console.log(`Registered MCP Tool: ${tool.name}`);
  }

  getTool(id: string) {
    return this.tools.get(id);
  }

  async executeTool(id: string, args: any) {
    const tool = this.tools.get(id);
    if (!tool) {
      throw new Error(`Tool with ID ${id} not found.`);
    }
    return await tool.execute(args);
  }
}

export const mcpService = new MCPToolService();
