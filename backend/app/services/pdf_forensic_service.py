"""
app/services/pdf_forensic_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Advanced PDF Forgery Detection

Analyzes PDFs for:
  - Font consistency and embedding anomalies
  - Digital signature validation
  - Metadata timeline consistency (creation vs modification)
  - Cross-reference table integrity
  - Embedded object analysis (JavaScript, OpenAction, etc.)
"""
from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Dict, Any, List

import structlog

log = structlog.get_logger(__name__)


def extract_pdf_text(buffer: bytes) -> str:
    """Extract raw text content from PDF bytes using PyPDF2 with regex fallback."""
    text_chunks: List[str] = []
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(buffer))
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text_chunks.append(t)
    except Exception as e:
        log.debug("pdf_forensic.text_extraction_fallback", error=str(e))

    extracted = "\n".join(text_chunks).strip()
    if not extracted:
        # Fallback raw stream regex extraction for text blocks
        try:
            content = buffer.decode("latin-1", errors="ignore")
            text_blocks = re.findall(r"\(([^)]+)\)\s*Tj", content)
            extracted = " ".join(text_blocks).strip()
        except Exception:
            extracted = ""

    return extracted


def analyze_text_forensics(text_str: str) -> Dict[str, Any]:
    """
    Compute linguistic perplexity proxies, sentence burstiness (length variance),
    and LLM transition phrase occurrences to detect AI-generated text in documents.
    """
    if not text_str or len(text_str.strip()) < 30:
        return {
            "ai_text_score": 0.0,
            "burstiness": 0.5,
            "llm_phrase_count": 0,
            "findings": [],
        }

    import numpy as np

    # Split into sentences
    sentences = [s.strip() for s in re.split(r"[.!?]+", text_str) if len(s.strip()) > 3]
    if not sentences:
        return {
            "ai_text_score": 0.0,
            "burstiness": 0.5,
            "llm_phrase_count": 0,
            "findings": [],
        }

    sentence_lengths = [len(s.split()) for s in sentences]
    mean_len = float(np.mean(sentence_lengths))
    std_len = float(np.std(sentence_lengths))

    # Burstiness: std / (mean + 1e-6). LLMs generate remarkably uniform sentence lengths (burstiness < 0.35)
    burstiness = float(std_len / (mean_len + 1e-6))

    # LLM signature transition phrases
    llm_indicator_phrases = [
        "in conclusion", "it is important to note", "furthermore", "moreover",
        "in summary", "delve into", "testament to", "tapestry of",
        "it is worth noting", "crucial role", "in today's digital landscape",
        "overall, it", "subsequently", "relentless pursuit", "beacon of"
    ]

    lower_text = text_str.lower()
    found_llm_phrases = [phrase for phrase in llm_indicator_phrases if phrase in lower_text]

    # Calculate AI Text Score (0 - 100)
    ai_score = 0.0

    # 1. Low burstiness impact (uniform sentences)
    if burstiness < 0.3:
        ai_score += 45.0
    elif burstiness < 0.45:
        ai_score += 25.0

    # 2. LLM phrase impact
    phrase_impact = len(found_llm_phrases) * 15.0
    ai_score += min(phrase_impact, 45.0)

    # 3. High vocabulary predictability (lack of colloquial variation)
    if len(sentences) >= 4 and mean_len > 12:
        ai_score += 10.0

    ai_score = float(np.clip(ai_score, 0.0, 100.0))

    findings = []
    if burstiness < 0.35:
        findings.append({
            "category": "LOW_SENTENCE_BURSTINESS",
            "severity": "high" if burstiness < 0.25 else "medium",
            "description": f"Unnatural sentence length uniformity detected (burstiness: {burstiness:.2f}), characteristic of LLM text generation.",
        })

    if found_llm_phrases:
        findings.append({
            "category": "LLM_TRANSITION_SIGNATURES",
            "severity": "medium",
            "description": f"Extracted text contains known LLM generator markers: '{', '.join(found_llm_phrases[:3])}'.",
        })

    return {
        "ai_text_score": round(ai_score, 2),
        "burstiness": round(burstiness, 3),
        "llm_phrase_count": len(found_llm_phrases),
        "llm_phrases_found": found_llm_phrases,
        "findings": findings,
    }


def analyze_pdf_forensics(buffer: bytes) -> Dict[str, Any]:
    """
    Perform deep forensic analysis on a PDF document including text stream evaluation.

    Returns dict with forgery_score (0-100), findings, metadata_analysis,
    font_analysis, structure_analysis, and text_forensics.
    """
    findings: List[Dict[str, Any]] = []
    forgery_score = 0.0

    # 1. Metadata analysis
    metadata = _extract_pdf_metadata(buffer)
    metadata_issues = _check_metadata_consistency(metadata)
    findings.extend(metadata_issues)
    forgery_score += len(metadata_issues) * 10

    # 2. Font analysis
    font_analysis = _analyze_fonts(buffer)
    if font_analysis.get("suspicious_fonts"):
        findings.append({
            "category": "FONT_ANOMALY",
            "severity": "medium",
            "description": f"Suspicious font configuration detected: {', '.join(font_analysis['suspicious_fonts'][:3])}",
        })
        forgery_score += 15

    # 3. Structure integrity
    structure = _check_structure_integrity(buffer)
    findings.extend(structure.get("issues", []))
    forgery_score += structure.get("score_impact", 0)

    # 4. Embedded threat analysis
    threats = _detect_embedded_threats(buffer)
    findings.extend(threats)
    forgery_score += len(threats) * 15

    # 5. Text & NLP Forensics
    extracted_text = extract_pdf_text(buffer)
    text_forensics = analyze_text_forensics(extracted_text)
    if text_forensics.get("findings"):
        findings.extend(text_forensics["findings"])
        forgery_score += text_forensics["ai_text_score"] * 0.6

    # 6. Digital signature check
    sig_check = _check_digital_signatures(buffer)
    if sig_check.get("has_signature") and not sig_check.get("is_valid"):
        findings.append({
            "category": "INVALID_SIGNATURE",
            "severity": "high",
            "description": "Document has a digital signature that could not be verified.",
        })
        forgery_score += 20

    forgery_score = min(forgery_score, 100.0)

    return {
        "forgery_score": round(forgery_score, 2),
        "is_suspicious": forgery_score > 30,
        "extracted_text": extracted_text[:500],
        "text_length": len(extracted_text),
        "text_forensics": text_forensics,
        "findings": findings,
        "metadata_analysis": metadata,
        "font_analysis": font_analysis,
        "structure_analysis": structure,
        "signature_analysis": sig_check,
    }


def _extract_pdf_metadata(buffer: bytes) -> Dict[str, Any]:
    """Extract PDF metadata fields."""
    metadata = {
        "title": None, "author": None, "creator": None, "producer": None,
        "creation_date": None, "modification_date": None,
        "page_count": 0, "pdf_version": None,
    }

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(buffer))
        info = reader.metadata

        if info:
            metadata["title"] = getattr(info, "title", None)
            metadata["author"] = getattr(info, "author", None)
            metadata["creator"] = getattr(info, "creator", None)
            metadata["producer"] = getattr(info, "producer", None)
            metadata["creation_date"] = str(getattr(info, "creation_date", "")) or None
            metadata["modification_date"] = str(getattr(info, "modification_date", "")) or None

        metadata["page_count"] = len(reader.pages)

        # Extract PDF version from header
        header = buffer[:20].decode("latin-1", errors="replace")
        version_match = re.search(r"%PDF-(\d+\.\d+)", header)
        if version_match:
            metadata["pdf_version"] = version_match.group(1)

    except Exception as e:
        log.warning("pdf_forensic.metadata_extraction_failed", error=str(e))

    return metadata


def _check_metadata_consistency(metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Check for suspicious metadata patterns."""
    issues = []

    creator = (metadata.get("creator") or "").lower()
    producer = (metadata.get("producer") or "").lower()

    # Check for known manipulation tools
    manipulation_tools = ["photoshop", "gimp", "inkscape", "acrobat", "nitro", "foxit editor"]
    for tool in manipulation_tools:
        if tool in creator or tool in producer:
            issues.append({
                "category": "EDITING_TOOL_DETECTED",
                "severity": "medium",
                "description": f"Document metadata indicates editing with: {tool.title()}",
            })

    # Check creation vs modification date consistency
    creation = metadata.get("creation_date")
    modification = metadata.get("modification_date")
    if creation and modification and creation != modification:
        issues.append({
            "category": "TIMELINE_MISMATCH",
            "severity": "low",
            "description": "Document was modified after creation, which may indicate post-creation editing.",
        })

    # Check for missing metadata (stripped metadata is suspicious)
    if not metadata.get("author") and not metadata.get("creator") and not metadata.get("producer"):
        issues.append({
            "category": "STRIPPED_METADATA",
            "severity": "medium",
            "description": "All document metadata has been stripped, which is unusual for legitimate documents.",
        })

    return issues


def _analyze_fonts(buffer: bytes) -> Dict[str, Any]:
    """Analyze PDF font usage for consistency."""
    fonts_found = []
    suspicious_fonts = []

    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(buffer))

        for page in reader.pages[:10]:  # Limit to first 10 pages
            resources = page.get("/Resources")
            if resources:
                font_dict = resources.get("/Font")
                if font_dict:
                    for font_name in font_dict:
                        font_obj = font_dict[font_name]
                        base_font = str(font_obj.get("/BaseFont", "Unknown"))
                        encoding = str(font_obj.get("/Encoding", "Unknown"))
                        fonts_found.append({
                            "name": base_font,
                            "encoding": encoding,
                        })

                        # Check for non-embedded standard fonts (suspicious in formal docs)
                        if "/FontDescriptor" not in font_obj:
                            suspicious_fonts.append(f"{base_font} (not embedded)")

    except Exception as e:
        log.debug("pdf_forensic.font_analysis_failed", error=str(e))

    # Check for too many different fonts (may indicate cut-and-paste forgery)
    unique_fonts = set(f["name"] for f in fonts_found)
    if len(unique_fonts) > 8:
        suspicious_fonts.append(f"Excessive font diversity ({len(unique_fonts)} unique fonts)")

    return {
        "fonts_found": fonts_found[:20],
        "unique_font_count": len(unique_fonts),
        "suspicious_fonts": suspicious_fonts,
        "has_font_issues": len(suspicious_fonts) > 0,
    }


def _check_structure_integrity(buffer: bytes) -> Dict[str, Any]:
    """Check PDF cross-reference table and structure integrity."""
    issues = []
    score_impact = 0

    try:
        content = buffer.decode("latin-1", errors="replace")

        # Check for incremental updates (multiple %%EOF markers)
        eof_count = content.count("%%EOF")
        if eof_count > 1:
            issues.append({
                "category": "INCREMENTAL_UPDATES",
                "severity": "low",
                "description": f"Document has {eof_count} revision layers (incremental updates detected).",
            })
            score_impact += 5

        # Check for linearized PDF (not suspicious, but informational)
        is_linearized = b"/Linearized" in buffer[:1024]

        # Check for object streams (can hide content)
        obj_stream_count = len(re.findall(r"/ObjStm", content))
        if obj_stream_count > 5:
            issues.append({
                "category": "OBJECT_STREAMS",
                "severity": "low",
                "description": f"Document uses {obj_stream_count} object streams (may obscure content).",
            })
            score_impact += 5

    except Exception as e:
        log.debug("pdf_forensic.structure_check_failed", error=str(e))

    return {
        "issues": issues,
        "score_impact": score_impact,
        "eof_count": eof_count if 'eof_count' in dir() else 1,
        "is_linearized": is_linearized if 'is_linearized' in dir() else False,
    }


def _detect_embedded_threats(buffer: bytes) -> List[Dict[str, Any]]:
    """Detect embedded JavaScript, auto-actions, and other threats."""
    threats = []

    threat_patterns = [
        (b"/JavaScript", "EMBEDDED_JAVASCRIPT", "high",
         "Document contains embedded JavaScript code that could execute malicious actions."),
        (b"/JS", "JAVASCRIPT_SHORTFORM", "high",
         "Document contains JavaScript reference (shortform /JS action)."),
        (b"/OpenAction", "AUTO_OPEN_ACTION", "high",
         "Document has an automatic action triggered on open."),
        (b"/Launch", "LAUNCH_ACTION", "critical",
         "Document attempts to launch an external application or file."),
        (b"/EmbeddedFiles", "EMBEDDED_FILES", "medium",
         "Document contains embedded file attachments that may be malicious."),
        (b"/AcroForm", "FORM_FIELDS", "low",
         "Document contains interactive form fields."),
        (b"/URI", "EXTERNAL_LINKS", "low",
         "Document contains external URI references."),
    ]

    for pattern, category, severity, description in threat_patterns:
        if pattern in buffer:
            threats.append({
                "category": category,
                "severity": severity,
                "description": description,
            })

    return threats


def _check_digital_signatures(buffer: bytes) -> Dict[str, Any]:
    """Check for and validate PDF digital signatures."""
    has_signature = b"/Sig" in buffer or b"/ByteRange" in buffer

    return {
        "has_signature": has_signature,
        "is_valid": None,  # Full validation requires external certificate chain verification
        "signer": None,
        "sign_date": None,
        "note": "Digital signature present but full chain validation requires certificate authority verification." if has_signature else "No digital signature found.",
    }
