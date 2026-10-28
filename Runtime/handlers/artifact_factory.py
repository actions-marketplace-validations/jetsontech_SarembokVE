# ============================================================================
# Copyright (c) 2026 Timothy Hall Jr. / Jetsontech. All rights reserved.
#
# This source code is licensed under the Business Source License 1.1 (BSL).
# Commercial use, deployment in production environments, or redistribution 
# for profit is strictly prohibited without a valid commercial license.
#
# For commercial inquiries, licensing, or partnerships, contact the Licensor.
# ============================================================================

"""Multi-Format Artifact Creation Factory for SarembokVE.

Provides deterministic compilation of agent data into:
- 📊 Structured Data & Analytics (.csv, .xlsx) via pandas / openpyxl
- 📝 Corporate & Rich Text Documentation (.docx, .md, .txt, .pdf) via python-docx / ReportLab
- 📉 Presentation Decks (.pptx) via python-pptx
- 🛠️ Production-Ready Source Code & Configurations (.py, .js, .json, .yaml, .tf) with AST validation
"""

from __future__ import annotations

import ast
import csv
import hashlib
import json
import logging
import os
from pathlib import Path
import shutil
import time
from typing import Any, Dict, List, Optional, Sequence, Union

logger = logging.getLogger("sarembok.artifact_factory")

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_EXPORT_DIR = REPO_ROOT / "public" / "exports"


def ensure_export_dir(custom_dir: Optional[Union[str, Path]] = None) -> Path:
    target = Path(custom_dir) if custom_dir else DEFAULT_EXPORT_DIR
    target.mkdir(parents=True, exist_ok=True)
    return target


def calculate_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


# ============================================================================
# 1. Structured Data & Analytics (.csv, .xlsx)
# ============================================================================

def generate_csv_dataset(
    filename: str,
    records: Sequence[Union[Dict[str, Any], Sequence[Any]]],
    headers: Optional[Sequence[str]] = None,
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Compiles tabular data into a structured CSV artifact."""
    target_dir = ensure_export_dir(output_dir)
    clean_name = filename if filename.endswith(".csv") else f"{filename}.csv"
    dest = target_dir / clean_name

    if not records:
        dest.write_text("", encoding="utf-8")
    elif isinstance(records[0], dict):
        keys = list(headers) if headers else list(records[0].keys())
        with open(dest, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
            writer.writeheader()
            for row in records:
                if isinstance(row, dict):
                    writer.writerow(row)
    else:
        with open(dest, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if headers:
                writer.writerow(headers)
            for row in records:
                writer.writerow(list(row))

    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": "csv",
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
        "rowCount": len(records),
    }


def generate_excel_spreadsheet(
    filename: str,
    sheets_data: Union[Dict[str, Sequence[Dict[str, Any]]], Sequence[Dict[str, Any]]],
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Compiles multi-sheet or single-sheet tabular data into an Excel (.xlsx) artifact."""
    target_dir = ensure_export_dir(output_dir)
    clean_name = filename if filename.endswith(".xlsx") else f"{filename}.xlsx"
    dest = target_dir / clean_name

    try:
        import pandas as pd  # type: ignore

        if isinstance(sheets_data, dict):
            with pd.ExcelWriter(dest, engine="openpyxl") as writer:
                for sheet_name, rows in sheets_data.items():
                    df = pd.DataFrame(rows)
                    df.to_excel(writer, sheet_name=sheet_name[:31], index=False)
        else:
            df = pd.DataFrame(sheets_data)
            df.to_excel(dest, index=False, engine="openpyxl")
    except Exception as exc:
        logger.warning(f"Excel generation using pandas/openpyxl fallback failed: {exc}")
        # Fallback to direct openpyxl if pandas fails
        import openpyxl  # type: ignore

        wb = openpyxl.Workbook()
        if isinstance(sheets_data, dict):
            first = True
            for sheet_name, rows in sheets_data.items():
                ws = wb.active if first else wb.create_sheet(title=sheet_name[:31])
                first = False
                if rows and isinstance(rows[0], dict):
                    headers = list(rows[0].keys())
                    ws.append(headers)
                    for r in rows:
                        ws.append([r.get(h, "") for h in headers])
        else:
            ws = wb.active
            if sheets_data and isinstance(sheets_data[0], dict):
                headers = list(sheets_data[0].keys())
                ws.append(headers)
                for r in sheets_data:
                    ws.append([r.get(h, "") for h in headers])
        wb.save(dest)

    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": "xlsx",
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
        "sheetCount": len(sheets_data) if isinstance(sheets_data, dict) else 1,
    }


# ============================================================================
# 2. Corporate & Rich Text Documentation (.docx, .md, .txt, .pdf)
# ============================================================================

def generate_word_document(
    filename: str,
    title: str,
    sections: Sequence[Dict[str, Any]],
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Compiles structured document sections into Microsoft Word (.docx) artifact."""
    target_dir = ensure_export_dir(output_dir)
    clean_name = filename if filename.endswith(".docx") else f"{filename}.docx"
    dest = target_dir / clean_name

    import docx  # type: ignore

    doc = docx.Document()
    doc.add_heading(title, level=0)

    for sec in sections:
        sec_title = sec.get("heading") or sec.get("title")
        if sec_title:
            doc.add_heading(str(sec_title), level=sec.get("level", 1))

        body = sec.get("content") or sec.get("text") or ""
        if isinstance(body, list):
            for para in body:
                doc.add_paragraph(str(para))
        elif body:
            doc.add_paragraph(str(body))

        # Optional bullet points
        items = sec.get("bullets") or sec.get("items") or []
        for it in items:
            doc.add_paragraph(str(it), style="List Bullet")

        # Optional table
        table_data = sec.get("table")
        if table_data and isinstance(table_data, list) and len(table_data) > 0:
            cols = list(table_data[0].keys()) if isinstance(table_data[0], dict) else [f"Col {i}" for i in range(len(table_data[0]))]
            tbl = doc.add_table(rows=1, cols=len(cols))
            hdr_cells = tbl.rows[0].cells
            for idx, c in enumerate(cols):
                hdr_cells[idx].text = str(c)
            for row in table_data:
                row_cells = tbl.add_row().cells
                for idx, c in enumerate(cols):
                    val = row.get(c, "") if isinstance(row, dict) else row[idx]
                    row_cells[idx].text = str(val)

    doc.save(dest)
    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": "docx",
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
        "sectionCount": len(sections),
    }


def write_markdown_file(
    filename: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None,
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Generates standard GitHub-flavored Markdown (.md) or text (.txt) document."""
    target_dir = ensure_export_dir(output_dir)
    clean_name = filename if (filename.endswith(".md") or filename.endswith(".txt")) else f"{filename}.md"
    dest = target_dir / clean_name

    full_text = ""
    if metadata:
        full_text += "---\n"
        for k, v in metadata.items():
            full_text += f"{k}: {json.dumps(v) if isinstance(v, (dict, list)) else v}\n"
        full_text += "---\n\n"
    full_text += content

    dest.write_text(full_text, encoding="utf-8")
    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": "markdown",
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
        "lineCount": len(full_text.splitlines()),
    }


def generate_pdf_document(
    filename: str,
    title: str,
    content_paragraphs: Sequence[Union[str, Dict[str, Any]]],
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Compiles styled PDF technical document via ReportLab."""
    target_dir = ensure_export_dir(output_dir)
    clean_name = filename if filename.endswith(".pdf") else f"{filename}.pdf"
    dest = target_dir / clean_name

    from reportlab.lib.pagesizes import letter  # type: ignore
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer  # type: ignore
    from reportlab.lib import colors  # type: ignore

    doc = SimpleDocTemplate(str(dest), pagesize=letter)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "SarembokTitle",
        parent=styles["Heading1"],
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=14,
    )
    body_style = ParagraphStyle(
        "SarembokBody",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )
    section_style = ParagraphStyle(
        "SarembokSection",
        parent=styles["Heading2"],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=10,
        spaceAfter=6,
    )

    story = [Paragraph(title, title_style), Spacer(1, 10)]

    for item in content_paragraphs:
        if isinstance(item, str):
            story.append(Paragraph(item, body_style))
        elif isinstance(item, dict):
            if item.get("heading"):
                story.append(Paragraph(item["heading"], section_style))
            if item.get("content"):
                story.append(Paragraph(str(item["content"]), body_style))
        story.append(Spacer(1, 4))

    doc.build(story)
    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": "pdf",
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
    }


# ============================================================================
# 3. Presentation Decks (.pptx)
# ============================================================================

def generate_presentation_deck(
    filename: str,
    title: str,
    slides: Sequence[Dict[str, Any]],
    subtitle: str = "Generated by Sarembok Autonomous Swarm",
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Compiles structured slide definitions into a Microsoft PowerPoint (.pptx) artifact."""
    target_dir = ensure_export_dir(output_dir)
    clean_name = filename if filename.endswith(".pptx") else f"{filename}.pptx"
    dest = target_dir / clean_name

    import pptx  # type: ignore

    prs = pptx.Presentation()

    # 1. Title Slide (Layout index 0)
    title_layout = prs.slide_layouts[0]
    slide = prs.slides.add_slide(title_layout)
    slide.shapes.title.text = title
    if slide.placeholders and len(slide.placeholders) > 1:
        slide.placeholders[1].text = subtitle

    # 2. Content Slides (Layout index 1: Title and Content)
    bullet_layout = prs.slide_layouts[1]
    for s_def in slides:
        s = prs.slides.add_slide(bullet_layout)
        s.shapes.title.text = s_def.get("title", "Untitled Slide")
        tf = s.placeholders[1].text_frame

        body = s_def.get("content") or s_def.get("text")
        if body:
            tf.text = str(body)

        points = s_def.get("bullet_points") or s_def.get("points") or []
        for p in points:
            p_para = tf.add_paragraph()
            p_para.text = str(p)
            p_para.level = 0

    prs.save(dest)
    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": "pptx",
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
        "slideCount": len(slides) + 1,
    }


# ============================================================================
# 4. Production-Ready Source Code & Configurations (.py, .js, .json, .yaml, .tf)
# ============================================================================

def write_source_artifact(
    filename: str,
    code_content: str,
    language: Optional[str] = None,
    validate_syntax: bool = True,
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Writes source code artifact with strict Abstract Syntax Tree (AST) & syntax verification."""
    target_dir = ensure_export_dir(output_dir)
    dest = target_dir / filename
    suffix = dest.suffix.lower()

    # Detect language from file extension
    lang = language or suffix.lstrip(".")

    # Strict syntax validation
    if validate_syntax:
        if lang in {"py", "python"}:
            try:
                ast.parse(code_content, filename=filename)
            except SyntaxError as exc:
                raise ValueError(f"AST Syntax validation failed for Python artifact '{filename}': {exc}") from exc
        elif lang in {"json"}:
            try:
                json.loads(code_content)
            except json.JSONDecodeError as exc:
                raise ValueError(f"JSON Syntax validation failed for '{filename}': {exc}") from exc
        elif lang in {"js", "javascript", "ts", "typescript", "tf", "terraform", "yaml", "yml"}:
            # Basic balanced brace/parenthesis check
            pairs = {"{": "}", "[": "]", "(": ")"}
            stack = []
            for char in code_content:
                if char in pairs:
                    stack.append(pairs[char])
                elif char in pairs.values():
                    if not stack or stack.pop() != char:
                        raise ValueError(f"Structural brace mismatch in source code '{filename}'")

    dest.write_text(code_content, encoding="utf-8")
    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": lang,
        "filename": filename,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{filename}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
        "lineCount": len(code_content.splitlines()),
        "syntaxValidated": validate_syntax,
    }


def generate_config_envelope(
    filename: str,
    config_format: str,
    data: Dict[str, Any],
    output_dir: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """Serializes structured configuration into JSON, YAML, or HCL/Terraform format."""
    fmt = config_format.lower().strip()
    target_dir = ensure_export_dir(output_dir)

    if fmt == "json":
        clean_name = filename if filename.endswith(".json") else f"{filename}.json"
        content = json.dumps(data, indent=2, sort_keys=True)
    elif fmt in {"yaml", "yml"}:
        clean_name = filename if (filename.endswith(".yaml") or filename.endswith(".yml")) else f"{filename}.yaml"
        # Pure-Python YAML formatting
        lines = []
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                lines.append(f"{k}:")
                sub = json.dumps(v, indent=2).splitlines()
                lines.extend(["  " + s for s in sub])
            else:
                lines.append(f"{k}: {v}")
        content = "\n".join(lines) + "\n"
    elif fmt in {"tf", "hcl", "terraform"}:
        clean_name = filename if filename.endswith(".tf") else f"{filename}.tf"
        # Render HCL key-value block
        lines = [f"# Generated by Sarembok Artifact Factory: {clean_name}"]
        for k, v in data.items():
            if isinstance(v, dict):
                lines.append(f'{k} {{')
                for sub_k, sub_v in v.items():
                    lines.append(f'  {sub_k} = {json.dumps(sub_v)}')
                lines.append('}\n')
            else:
                lines.append(f'{k} = {json.dumps(v)}')
        content = "\n".join(lines) + "\n"
    else:
        raise ValueError(f"Unsupported config format: {config_format}")

    dest = target_dir / clean_name
    dest.write_text(content, encoding="utf-8")
    stat = dest.stat()
    return {
        "status": "SUCCESS",
        "format": fmt,
        "filename": clean_name,
        "filePath": str(dest.resolve()),
        "exportUrl": f"/exports/{clean_name}",
        "sizeBytes": stat.st_size,
        "sha256": calculate_sha256(dest),
    }


# ============================================================================
# 5. MCP Gateway Tool Definitions Exporter
# ============================================================================

def get_mcp_artifact_tools() -> List[Dict[str, Any]]:
    """Returns MCP v2026.1 tool descriptors and callable handlers for MCP Gateway."""
    return [
        {
            "name": "generate_csv_dataset",
            "description": "Compiles raw agent data or system metrics into a downloadable CSV artifact.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Target filename with or without .csv extension"},
                    "records": {"type": "array", "description": "Array of records (dictionaries or value lists)"},
                    "headers": {"type": "array", "items": {"type": "string"}, "description": "Optional column headers"},
                },
                "required": ["filename", "records"],
            },
            "handler": lambda args: generate_csv_dataset(
                filename=args["filename"],
                records=args["records"],
                headers=args.get("headers"),
            ),
        },
        {
            "name": "generate_excel_spreadsheet",
            "description": "Compiles structured analytics data into a styled multi-sheet Excel spreadsheet (.xlsx).",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Target filename with or without .xlsx extension"},
                    "sheets_data": {"type": ["object", "array"], "description": "Dict of sheet names to row records, or array of records"},
                },
                "required": ["filename", "sheets_data"],
            },
            "handler": lambda args: generate_excel_spreadsheet(
                filename=args["filename"],
                sheets_data=args["sheets_data"],
            ),
        },
        {
            "name": "generate_word_document",
            "description": "Generates structured corporate and technical documentation (.docx) with headings, paragraphs, and tables.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Target filename with or without .docx extension"},
                    "title": {"type": "string", "description": "Document title"},
                    "sections": {"type": "array", "description": "Array of section objects with heading, content, bullets, or table"},
                },
                "required": ["filename", "title", "sections"],
            },
            "handler": lambda args: generate_word_document(
                filename=args["filename"],
                title=args["title"],
                sections=args["sections"],
            ),
        },
        {
            "name": "write_markdown_file",
            "description": "Writes technical documentation in Markdown (.md) or text (.txt) with optional YAML frontmatter.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Target filename with .md or .txt extension"},
                    "content": {"type": "string", "description": "Markdown body content"},
                    "metadata": {"type": "object", "description": "Optional frontmatter metadata"},
                },
                "required": ["filename", "content"],
            },
            "handler": lambda args: write_markdown_file(
                filename=args["filename"],
                content=args["content"],
                metadata=args.get("metadata"),
            ),
        },
        {
            "name": "generate_pdf_document",
            "description": "Compiles a styled PDF technical document or executive report via ReportLab.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Target filename with or without .pdf extension"},
                    "title": {"type": "string", "description": "Document title"},
                    "content_paragraphs": {"type": "array", "description": "List of text paragraphs or section objects"},
                },
                "required": ["filename", "title", "content_paragraphs"],
            },
            "handler": lambda args: generate_pdf_document(
                filename=args["filename"],
                title=args["title"],
                content_paragraphs=args["content_paragraphs"],
            ),
        },
        {
            "name": "generate_presentation_deck",
            "description": "Translates structural layout strings and bullet points into a PowerPoint (.pptx) deck.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Target filename with or without .pptx extension"},
                    "title": {"type": "string", "description": "Presentation deck title"},
                    "slides": {"type": "array", "description": "List of slide objects with title, content, bullet_points"},
                    "subtitle": {"type": "string", "description": "Optional subtitle for the cover slide"},
                },
                "required": ["filename", "title", "slides"],
            },
            "handler": lambda args: generate_presentation_deck(
                filename=args["filename"],
                title=args["title"],
                slides=args["slides"],
                subtitle=args.get("subtitle", "Generated by Sarembok Autonomous Swarm"),
            ),
        },
        {
            "name": "write_source_artifact",
            "description": "Synthesizes production source code (.py, .js, .json, .yaml, .tf) with AST and syntax verification.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Source file name with extension"},
                    "code_content": {"type": "string", "description": "Raw source code or configuration string"},
                    "validate_syntax": {"type": "boolean", "description": "Whether to perform strict AST/syntax validation"},
                },
                "required": ["filename", "code_content"],
            },
            "handler": lambda args: write_source_artifact(
                filename=args["filename"],
                code_content=args["code_content"],
                validate_syntax=args.get("validate_syntax", True),
            ),
        },
        {
            "name": "generate_config_envelope",
            "description": "Serializes configuration data into JSON, YAML, or Terraform/HCL format.",
            "capability": "compute",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "filename": {"type": "string", "description": "Config filename"},
                    "config_format": {"type": "string", "enum": ["json", "yaml", "tf"], "description": "Format"},
                    "data": {"type": "object", "description": "Configuration dictionary to serialize"},
                },
                "required": ["filename", "config_format", "data"],
            },
            "handler": lambda args: generate_config_envelope(
                filename=args["filename"],
                config_format=args["config_format"],
                data=args["data"],
            ),
        },
    ]


def register_artifact_tools_in_gateway(gateway: Any) -> int:
    """Registers all artifact factory creation tools into an MCPGateway instance."""
    tools = get_mcp_artifact_tools()
    count = 0
    for t in tools:
        gateway.register_tool(
            name=t["name"],
            description=t["description"],
            input_schema=t["inputSchema"],
            handler=t["handler"],
            capability=t.get("capability", "compute"),
        )
        count += 1
    logger.info(f"Registered {count} artifact factory tools in MCP Gateway.")
    return count
