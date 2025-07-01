#!/usr/bin/env python3
import sys
import pkg_resources

print(f"Python version: {sys.version}")
print("\nInstalled packages:")
for package in sorted(pkg_resources.working_set, key=lambda x: str(x).lower()):
    print(f"{package.project_name}=={package.version}")

# Try to import pydantic_ai to get more specific version information
try:
    import pydantic_ai
    print(f"\nPydantic-AI version: {pydantic_ai.__version__}")
    
    # Check if the usage function exists in the API
    try:
        import inspect
        from pydantic_ai.completion import CompletionResult
        print("\nCompletionResult usage method signature:")
        if hasattr(CompletionResult, 'usage'):
            usage_attr = getattr(CompletionResult, 'usage')
            if callable(usage_attr):
                print(f"usage is callable: {inspect.signature(usage_attr)}")
            else:
                print(f"usage is a property or attribute, not callable")
    except (ImportError, AttributeError) as e:
        print(f"Error checking CompletionResult.usage: {e}")
except ImportError:
