# ADK + A2A Protocol — Reference Notes

> Source: https://google.github.io/adk-docs/a2a/

## What is A2A?

**Agent2Agent (A2A) Protocol** is Google's open standard for agents to communicate with each other over a network. It enables multi-agent systems where specialized agents collaborate across services, languages, and teams.

- Official site: https://a2a-protocol.org/
- SDKs: [adk-python](https://github.com/google/adk-python) | [adk-js](https://github.com/google/adk-js) | [adk-go](https://github.com/google/adk-go) | [adk-java](https://github.com/google/adk-java)

---

## Core Concepts

### Two Types of Agents

| | Local Sub-Agents | Remote Agents (A2A) |
|---|---|---|
| **Where** | Same process, in-memory | Separate services, over network |
| **Speed** | Fast (no network overhead) | Network latency |
| **Use case** | Internal code organization | Cross-service / cross-team / cross-language |

### Two Sides of A2A

1. **Exposing** — Making your agent available as an A2A service that other agents can call
2. **Consuming** — Your agent calling another agent's A2A service

---

## When to Use A2A

**Use A2A when:**
- Integrating with a third-party service (e.g. external financial data provider)
- Microservices architecture (Order Agent ↔ Inventory Agent ↔ Shipping Agent)
- Cross-language communication (Python agent ↔ Java legacy system)
- Formal API enforcement between different teams' agents

**DON'T use A2A when (use local sub-agents instead):**
- Internal code organization (e.g. `DataValidator` sub-agent)
- Performance-critical internal operations (high-frequency, low-latency)
- Agents need shared memory / direct state access
- Simple helper functions that don't need independent deployment

---

## Architecture Pattern

```
Consuming Side:
+----------------------+         +-----------------------------------+
|      Root Agent      |         |         RemoteA2aAgent            |
| (Your existing code) |<------->|         (ADK Client Proxy)        |
+----------------------+         |                                   |
                                 |  +-----------------------------+  |
                                 |  |         Remote Agent        |  |
                                 |  |      (External Service)     |  |
                                 |  +-----------------------------+  |
                                 +-----------------------------------+
                                                 |
                                                 | (Network Communication)
                                                 v
Exposing Side:
                                               +-----------------+
                                               |   A2A Server    |
                                               | (ADK Component) |
                                               +-----------------+
                                                       |
                                                       v
                                               +-------------------+
                                               | Your Agent Code   |
                                               | (Exposed Service) |
                                               +-------------------+
```

---

## Exposing an Agent (Server Side)

### Method 1: `to_a2a()` function (recommended for quick setup)

```python
pip install google-adk[a2a]
```

```python
from google.adk.a2a.utils.agent_to_a2a import to_a2a

root_agent = Agent(
    model='gemini-2.0-flash',
    name='my_agent',
    # ...agent config...
)

# Auto-generates agent card from your agent's metadata
a2a_app = to_a2a(root_agent, port=8001)
```

Run with uvicorn:
```bash
uvicorn my_module.agent:a2a_app --host localhost --port 8001
```

**Key points:**
- Auto-generates an agent card at `/.well-known/agent-card.json`
- Agent card contains: name, description, skills, capabilities, input/output modes
- You can also provide a custom `AgentCard` object or JSON file path

### Custom agent card example:

```python
from a2a.types import AgentCard

my_card = AgentCard(
    name="my_agent",
    url="http://example.com",
    description="My agent description",
    version="1.0.0",
    capabilities={},
    skills=[],
    defaultInputModes=["text/plain"],
    defaultOutputModes=["text/plain"],
    supportsAuthenticatedExtendedCard=False,
)
a2a_app = to_a2a(root_agent, port=8001, agent_card=my_card)
```

### Method 2: `adk api_server --a2a`

- Works with `adk web` for debugging/testing
- Supports multiple agents in a parent folder — each with its own `agent.json`
- Requires you to manually create agent cards
- See: https://a2a-protocol.org/latest/tutorials/python/1-introduction/

---

## Consuming an Agent (Client Side)

Use `RemoteA2aAgent` as a client-side proxy:

```python
from google.adk.agents import RemoteA2aAgent

remote_agent = RemoteA2aAgent(
    agent_card_url="http://localhost:8001/.well-known/agent-card.json"
)
```

- Acts like a local tool/function from your code's perspective
- ADK abstracts away network communication, auth, and data formatting
- The root agent can mix local sub-agents and remote A2A agents

---

## Agent Card

The **agent card** (`agent.json` or auto-generated) is the discovery mechanism. It lives at:
```
http://<host>:<port>/.well-known/agent-card.json
```

Contains:
- `name` — agent name
- `description` — what the agent does
- `skills` — list of capabilities (auto-extracted from agent tools/instructions)
- `capabilities` — supported features
- `defaultInputModes` / `defaultOutputModes` — e.g. `["text/plain"]`
- `protocolVersion` — A2A protocol version (e.g. `0.2.6`)

---

## Folder Structure (Sample)

```
a2a_root/
├── remote_a2a/
│   └── hello_world/
│       ├── __init__.py
│       └── agent.py      # Remote agent (exposed via to_a2a)
├── README.md
└── agent.py               # Root agent (consumes remote via RemoteA2aAgent)
```

---

## Relevance to Brain Dump Project

Potential future uses:
- **Expose brain dump agent as A2A service** — let other agents query the user's brain dump data
- **Consume external agents** — e.g. a calendar agent, task manager agent, or knowledge base agent that the brain dump AI can delegate to
- **Multi-agent orchestration** — root agent coordinates between brain dump (audio), summarizer, and action-item extractor agents running as separate services

---

## Quick Reference Links

| Resource | URL |
|---|---|
| A2A Overview | https://google.github.io/adk-docs/a2a/ |
| Introduction to A2A | https://google.github.io/adk-docs/a2a/intro/ |
| Exposing (Python) | https://google.github.io/adk-docs/a2a/quickstart-exposing/ |
| Exposing (Go) | https://google.github.io/adk-docs/a2a/quickstart-exposing-go/ |
| Consuming (Python) | https://google.github.io/adk-docs/a2a/quickstart-consuming/ |
| Consuming (Go) | https://google.github.io/adk-docs/a2a/quickstart-consuming-go/ |
| Streaming Dev Guide | https://google.github.io/adk-docs/streaming/ |
| A2A Protocol Site | https://a2a-protocol.org/ |
