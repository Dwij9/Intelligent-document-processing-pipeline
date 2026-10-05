"""
LLM-based structured data extraction using function-calling.
Supports OpenAI and Anthropic providers.
"""

import os
import json
from typing import Any

# ── Extraction schema (used as the function definition) ─────
EXTRACT_SCHEMA = {
    "name": "extract_document_data",
    "description": "Extract structured financial data from a document.",
    "parameters": {
        "type": "object",
        "properties": {
            "documentType": {
                "type": "string",
                "enum": ["invoice", "receipt", "purchase_order", "expense_report", "statement", "other"],
                "description": "The type of financial document.",
            },
            "vendor": {
                "type": "string",
                "description": "The vendor, supplier, or company name on the document.",
            },
            "invoiceNumber": {
                "type": "string",
                "description": "Invoice or document reference number.",
            },
            "date": {
                "type": "string",
                "description": "Document date in ISO 8601 format (YYYY-MM-DD).",
            },
            "dueDate": {
                "type": "string",
                "description": "Payment due date in ISO 8601 format, if present.",
            },
            "subtotal": {
                "type": "number",
                "description": "Subtotal before tax.",
            },
            "tax": {
                "type": "number",
                "description": "Tax amount.",
            },
            "total": {
                "type": "number",
                "description": "Total amount due.",
            },
            "currency": {
                "type": "string",
                "description": "Three-letter currency code (e.g. USD, EUR).",
            },
            "lineItems": {
                "type": "array",
                "description": "Individual line items on the document.",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "quantity": {"type": "number"},
                        "unitPrice": {"type": "number"},
                        "amount": {"type": "number"},
                        "category": {"type": "string"},
                    },
                    "required": ["description", "amount"],
                },
            },
            "notes": {
                "type": "string",
                "description": "Any additional notes, payment terms, or special instructions.",
            },
        },
        "required": ["documentType", "vendor", "total"],
    },
}

SYSTEM_PROMPT = """You are a document data extraction specialist. Given the raw text of a financial document (invoice, receipt, expense report, etc.), extract all structured data by calling the extract_document_data function.

Rules:
- Extract every field you can identify. Leave optional fields out if not present.
- Dates must be ISO 8601 (YYYY-MM-DD).
- Monetary values must be plain numbers without currency symbols.
- For line items, infer a category when one is not explicitly stated (e.g., "Cloud hosting" → "Cloud Infrastructure").
- If the document is a CSV summary, each row is likely a separate line item.
- Always call the function — never return plain text."""


async def extract_with_openai(text: str) -> dict[str, Any]:
    """Use OpenAI function-calling to extract structured data."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=os.environ["LLM_API_KEY"])

    response = await client.chat.completions.create(
        model=os.environ.get("LLM_MODEL", "gpt-4o"),
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Extract data from this document:\n\n{text[:12000]}"},
        ],
        tools=[{"type": "function", "function": EXTRACT_SCHEMA}],
        tool_choice={"type": "function", "function": {"name": "extract_document_data"}},
        temperature=0,
    )

    tool_call = response.choices[0].message.tool_calls[0]
    return json.loads(tool_call.function.arguments)


async def extract_with_anthropic(text: str) -> dict[str, Any]:
    """Use Anthropic tool-use to extract structured data."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=os.environ["LLM_API_KEY"])

    response = await client.messages.create(
        model=os.environ.get("LLM_MODEL", "claude-sonnet-4-6"),
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": f"Extract data from this document:\n\n{text[:12000]}"},
        ],
        tools=[
            {
                "name": EXTRACT_SCHEMA["name"],
                "description": EXTRACT_SCHEMA["description"],
                "input_schema": EXTRACT_SCHEMA["parameters"],
            }
        ],
        tool_choice={"type": "tool", "name": "extract_document_data"},
    )

    for block in response.content:
        if block.type == "tool_use":
            return block.input

    raise ValueError("No tool_use block returned by Anthropic")


async def extract_structured_data(text: str, file_type: str) -> dict[str, Any]:
    """Route to the configured LLM provider."""
    provider = os.environ.get("LLM_PROVIDER", "openai").lower()

    if provider == "anthropic":
        result = await extract_with_anthropic(text)
    else:
        result = await extract_with_openai(text)

    result["confidence"] = 0.9  # Placeholder; could be derived from model logprobs
    return result
