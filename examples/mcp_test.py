import asyncio
import time
import sys
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

def get_user_approval(tool_name: str, args: dict) -> bool:
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

server = MCPServerStdio(
    'npx',
    args=[
        '-y',
        '@wonderwhy-er/desktop-commander',
        'stdio',
    ]
)
agent = Agent('openai:gpt-4.1-mini', mcp_servers=[server])

message_count = 0


async def main():
    global message_count
    user_prompt = 'How many files are in my /Users/aristide/Downloads folder? Use a terminal command to do it. Tell me how you did it, the exact command you used.'

    print(f"🤖 Assistant: ", end="", flush=True)

    async with agent.run_mcp_servers():
        # Begin a node-by-node, streaming iteration
        async with agent.iter(user_prompt) as run:
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
                                approved = get_user_approval(tool_name, args)
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

    print(f"✅ Response complete", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
