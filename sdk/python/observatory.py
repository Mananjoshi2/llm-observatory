"""
LLM Observatory — Python SDK
Usage:
    from observatory import Observatory

    obs = Observatory(project="my-app")

    # Wrap any function that calls an LLM
    @obs.trace
    def ask(prompt: str):
        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        return response

    # Or use the context manager
    with obs.span(model="claude-sonnet-4-6", provider="anthropic") as span:
        response = client.messages.create(...)
        span.record(
            prompt_tokens=response.usage.input_tokens,
            completion_tokens=response.usage.output_tokens,
        )
"""

import time
import requests
import functools
from typing import Optional, Callable
from contextlib import contextmanager
from dataclasses import dataclass, field

# Per-million-token pricing (input, output)
PRICING = {
    "gpt-4o":                    (2.50, 10.00),
    "gpt-4o-mini":               (0.15,  0.60),
    "gpt-4-turbo":               (10.0, 30.00),
    "gpt-3.5-turbo":             (0.50,  1.50),
    "claude-opus-4-6":           (15.0, 75.00),
    "claude-sonnet-4-6":         (3.00, 15.00),
    "claude-haiku-4-5":          (0.25,  1.25),
    "gemini-1.5-pro":            (3.50,  7.00),
    "gemini-1.5-flash":          (0.075, 0.30),
}

def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    rates = PRICING.get(model, (1.0, 1.0))
    return (prompt_tokens * rates[0] + completion_tokens * rates[1]) / 1_000_000


@dataclass
class Span:
    model: str
    provider: str
    project: str
    _start: float = field(default_factory=time.time)
    prompt_tokens: int = 0
    completion_tokens: int = 0
    status: str = "success"
    error: Optional[str] = None
    tags: Optional[list] = None
    _obs: object = None

    def record(
        self,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        tags: Optional[list] = None,
    ):
        self.prompt_tokens = prompt_tokens
        self.completion_tokens = completion_tokens
        if tags:
            self.tags = tags

    def fail(self, error: str):
        self.status = "error"
        self.error = error

    def _flush(self):
        latency = (time.time() - self._start) * 1000
        cost = estimate_cost(self.model, self.prompt_tokens, self.completion_tokens)
        if self._obs:
            self._obs._send(
                model=self.model,
                provider=self.provider,
                project=self.project,
                prompt_tokens=self.prompt_tokens,
                completion_tokens=self.completion_tokens,
                latency_ms=latency,
                cost_usd=cost,
                status=self.status,
                error=self.error,
                tags=self.tags,
            )


class Observatory:
    def __init__(
        self,
        project: str = "default",
        host: str = "http://localhost:8000",
        silent: bool = True,
    ):
        self.project = project
        self.host = host.rstrip("/")
        self.silent = silent

    def _send(self, **kwargs):
        try:
            requests.post(f"{self.host}/log", json=kwargs, timeout=2)
        except Exception as e:
            if not self.silent:
                print(f"[observatory] warn: could not send log — {e}")

    @contextmanager
    def span(
        self,
        model: str,
        provider: str = "openai",
        project: Optional[str] = None,
    ):
        s = Span(
            model=model,
            provider=provider,
            project=project or self.project,
            _obs=self,
        )
        try:
            yield s
        except Exception as e:
            s.fail(str(e))
            raise
        finally:
            s._flush()

    def trace(
        self,
        model: str,
        provider: str = "openai",
        project: Optional[str] = None,
        extract: Optional[Callable] = None,
    ):
        """Decorator. extract(response) -> (prompt_tokens, completion_tokens)"""
        def decorator(fn):
            @functools.wraps(fn)
            def wrapper(*args, **kwargs):
                with self.span(model=model, provider=provider, project=project) as s:
                    result = fn(*args, **kwargs)
                    if extract:
                        pt, ct = extract(result)
                        s.record(prompt_tokens=pt, completion_tokens=ct)
                    return result
            return wrapper
        return decorator
