# from pydantic_core import to_jsonable_python

# from pydantic_ai import Agent
# from pydantic_ai.messages import ModelMessagesTypeAdapter



# agent = Agent('openai:gpt-4o-mini', system_prompt='Be a helpful assistant.')

# @agent.tool_plain
# def get_weather(city: str):
#     return f"It's 80 degrees outside"

# result1 = agent.run_sync('How is the weather in Tokyo?')
# print("result1.output", result1.output)

# history_step_1 = result1.all_messages()
# print("\n\nhistory_step_1", history_step_1)

# as_python_objects = to_jsonable_python(history_step_1)  
# print("\n\nas_python_objects", as_python_objects)

# same_history_as_step_1 = ModelMessagesTypeAdapter.validate_python(as_python_objects)
# print("\n\nsame_history_as_step_1", same_history_as_step_1)

# # result2 = agent.run_sync(  
# #     'Tell me a different joke.', message_history=same_history_as_step_1
# # )

# # print("\n\nresult2.output", result2.output)



import asyncio
from pydantic_ai import Agent

agent = Agent('openai:gpt-4.1-mini')


async def main():
    nodes = []
    # Begin an AgentRun, which is an async-iterable over the nodes of the agent's graph
    async with agent.iter('What is the capital of France?') as agent_run:
        async for node in agent_run:
            # Each node represents a step in the agent's execution
            nodes.append(node)
    print(nodes)
    """
    [
        UserPromptNode(
            user_prompt='What is the capital of France?',
            instructions=None,
            instructions_functions=[],
            system_prompts=(),
            system_prompt_functions=[],
            system_prompt_dynamic_functions={},
        ),
        ModelRequestNode(
            request=ModelRequest(
                parts=[
                    UserPromptPart(
                        content='What is the capital of France?',
                        timestamp=datetime.datetime(...),
                    )
                ]
            )
        ),
        CallToolsNode(
            model_response=ModelResponse(
                parts=[TextPart(content='Paris')],
                usage=Usage(
                    requests=1, request_tokens=56, response_tokens=1, total_tokens=57
                ),
                model_name='gpt-4o',
                timestamp=datetime.datetime(...),
            )
        ),
        End(data=FinalResult(output='Paris')),
    ]
    """
    print(agent_run.result.output)
    #> Paris
    print(agent_run.result.all_messages())

if __name__ == "__main__":
    asyncio.run(main())