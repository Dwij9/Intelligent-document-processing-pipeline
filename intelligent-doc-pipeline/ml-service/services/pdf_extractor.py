"""
Document text extraction — PDFs via pdfplumber, CSVs via pandas.
"""

import pdfplumber
import pandas as pd
from io import StringIO


def extract_pdf_text(file_path: str) -> str:
    """Extract all text from a PDF, preserving table structure where possible."""
    pages = []

    with pdfplumber.open(file_path) as pdf:
        for i, page in enumerate(pdf.pages):
            page_text = []

            # Try table extraction first for structured content
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    rows = []
                    for row in table:
                        cleaned = [str(cell).strip() if cell else "" for cell in row]
                        rows.append(" | ".join(cleaned))
                    page_text.append("\n".join(rows))

            # Also grab free-form text
            text = page.extract_text()
            if text:
                page_text.append(text)

            if page_text:
                pages.append(f"--- Page {i + 1} ---\n" + "\n\n".join(page_text))

    return "\n\n".join(pages)


def extract_csv_text(file_path: str) -> str:
    """Read a CSV and return it as a readable text representation."""
    df = pd.read_csv(file_path)

    parts = [
        f"CSV with {len(df)} rows and {len(df.columns)} columns.",
        f"Columns: {', '.join(df.columns.tolist())}",
        "",
        "Data summary:",
        df.describe(include="all").to_string(),
        "",
        "First 20 rows:",
        df.head(20).to_string(index=False),
    ]

    if len(df) > 20:
        parts.append(f"\n... and {len(df) - 20} more rows.")

    return "\n".join(parts)


def parse_document(file_path: str, file_type: str) -> str:
    """Route to the right parser."""
    if file_type == "pdf":
        return extract_pdf_text(file_path)
    elif file_type == "csv":
        return extract_csv_text(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
