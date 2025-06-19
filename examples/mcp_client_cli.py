#!/usr/bin/env python3
"""
MCP Client CLI - Interactive chat interface with streaming and tool approval
Similar to ChatGPT or Claude Desktop experience
"""

import asyncio
import sys
import time
from typing import Optional
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStdio
from pydantic_ai.messages import (
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)

class MCPChatClient:
    def __init__(self):
        """Initialize the MCP Chat Client"""
        self.server = MCPServerStdio(
            'npx',
            args=[
                '-y',
                '@wonderwhy-er/desktop-commander',
                'stdio',
            ]
        )
        self.agent = Agent('openai:gpt-4.1-mini', mcp_servers=[self.server])

    def get_user_approval(self, tool_name: str, args: dict) -> bool:
        """Ask user for approval to execute a tool call."""
        print(f"\n⚠️  **TOOL CALL APPROVAL REQUIRED**", flush=True)
        print(f"🔧 Tool: {tool_name}", flush=True)
        print(f"📋 Arguments:", flush=True)

        if isinstance(args, dict):
            for key, value in args.items():
                print(f"   {key}: {value}", flush=True)
        else:
            print(f"   {args}", flush=True)

        print(f"\n❓ Do you want to execute this tool? (y/n): ", end="", flush=True)

        while True:
            try:
                response = input().strip().lower()
                if response in ['y', 'yes']:
                    print("✅ Tool execution approved!", flush=True)
                    return True
                elif response in ['n', 'no']:
                    print("❌ Tool execution rejected!", flush=True)
                    return False
                else:
                    print("Please enter 'y' for yes or 'n' for no: ", end="", flush=True)
            except KeyboardInterrupt:
                print("\n❌ Tool execution rejected (interrupted)!", flush=True)
                return False

    async def stream_response(self, user_input: str) -> None:
        """Stream the agent's response to user input"""
        print(f"🤖 Assistant: ", end="", flush=True)

        # Begin a node-by-node, streaming iteration
        async with self.agent.iter(user_input) as run:
            async for node in run:
                if Agent.is_user_prompt_node(node):
                    # User prompt - no need to show this as it's already known
                    pass
                elif Agent.is_model_request_node(node):
                    # Stream the model's thinking/response
                    async with node.stream(run.ctx) as request_stream:
                        async for event in request_stream:
                            if isinstance(event, PartDeltaEvent):
                                if isinstance(event.delta, TextPartDelta):
                                    # Stream text responses like ChatGPT
                                    print(event.delta.content_delta, end="", flush=True)
                            # Don't show tool call building - we'll show the complete call later
                elif Agent.is_call_tools_node(node):
                    # Show tool usage with approval
                    tool_calls_pending = {}  # Track pending approvals

                    async with node.stream(run.ctx) as handle_stream:
                        async for event in handle_stream:
                            if isinstance(event, FunctionToolCallEvent):
                                # Get user approval before showing tool execution
                                tool_name = event.part.tool_name
                                args = event.part.args
                                tool_call_id = event.part.tool_call_id

                                # Ask for approval
                                approved = self.get_user_approval(tool_name, args)
                                tool_calls_pending[tool_call_id] = approved

                                if approved:
                                    print(f"\n🔧 **Executing tool: {tool_name}**", flush=True)
                                    # Note: Tool execution happens asynchronously in the agent
                                else:
                                    print(f"\n⛔ **Tool execution blocked: {tool_name}**", flush=True)
                                    print("   (Note: The agent may not proceed without this tool)", flush=True)

                            elif isinstance(event, FunctionToolResultEvent):
                                tool_call_id = event.tool_call_id
                                was_approved = tool_calls_pending.get(tool_call_id, False)

                                if was_approved:
                                    print(f"\n📋 **Tool result:**", flush=True)
                                    result_content = str(event.result.content).strip()
                                    # Format the result nicely
                                    if '\n' in result_content:
                                        for line in result_content.split('\n'):
                                            if line.strip():
                                                print(f"   {line}", flush=True)
                                    else:
                                        print(f"   {result_content}", flush=True)
                                    print("", flush=True)  # Add space after tool result
                                else:
                                    print(f"\n⛔ **Tool result blocked** (tool was not approved)", flush=True)
                elif Agent.is_end_node(node):
                    # Final output - already streamed above, so just add newline
                    print("\n", flush=True)

    def print_welcome(self):
        """Print welcome message and instructions"""
        print("=" * 60)
        print("🚀 MCP Client CLI - Interactive AI Chat")
        print("=" * 60)
        print("Features:")
        print("  • Real-time streaming responses")
        print("  • MCP tool integration with approval")
        print("  • Desktop commander tools available")
        print("  • ChatGPT/Claude-like experience")
        print()
        print("Commands:")
        print("  • Type your message and press Enter")
        print("  • Type 'quit', 'exit', or 'bye' to exit")
        print("  • Type 'help' to see this message again")
        print("  • Use Ctrl+C to interrupt")
        print("=" * 60)
        print()

    def print_help(self):
        """Print help message"""
        print("\n📖 Help:")
        print("  • Ask questions, request tasks, or have conversations")
        print("  • The AI has access to terminal commands via MCP tools")
        print("  • You'll be asked to approve any tool executions")
        print("  • Responses stream in real-time like ChatGPT")
        print("  • Examples:")
        print("    - 'What files are in my Downloads folder?'")
        print("    - 'Help me find large files on my system'")
        print("    - 'Show me my system information'")
        print()

    async def run_chat_loop(self):
        """Main chat loop with persistent MCP server connection"""
        self.print_welcome()

        print("🔄 Initializing MCP servers (one-time setup)...", flush=True)

        # Initialize MCP servers once and keep them running for the entire session
        async with self.agent.run_mcp_servers():
            print("✅ MCP servers ready!\n")

            while True:
                try:
                    # Get user input
                    print("💬 You: ", end="", flush=True)
                    user_input = input().strip()

                    # Handle special commands
                    if user_input.lower() in ['quit', 'exit', 'bye']:
                        print("\n👋 Goodbye! Thanks for using MCP Client CLI.")
                        break
                    elif user_input.lower() == 'help':
                        self.print_help()
                        continue
                    elif not user_input:
                        print("Please enter a message or command.")
                        continue

                    # Stream the response (no more MCP server initialization needed)
                    await self.stream_response(user_input)

                    print()  # Add spacing between conversations

                except KeyboardInterrupt:
                    print("\n\n⚠️  Interrupted. Type 'quit' to exit properly.")
                    continue
                except EOFError:
                    print("\n👋 Goodbye! Thanks for using MCP Client CLI.")
                    break
                except Exception as e:
                    print(f"\n❌ Error: {e}")
                    print("Please try again or type 'quit' to exit.")

async def main():
    """Main entry point"""
    client = MCPChatClient()
    await client.run_chat_loop()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye! Thanks for using MCP Client CLI.")
        sys.exit(0)
