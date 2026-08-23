"""
app/services/email_parser_service.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email (.eml) Header Parser & Phishing Analyzer

Parses RFC 5322 email headers and performs:
  - SPF, DKIM, DMARC validation result extraction
  - Received-chain hop analysis
  - Sender domain reputation check
  - Phishing indicator extraction (urgency language, mismatched reply-to)
"""
from __future__ import annotations

import email
import re
from email import policy
from email.parser import BytesParser
from typing import Dict, Any, List, Optional

import structlog

log = structlog.get_logger(__name__)

# Phishing urgency keywords
URGENCY_KEYWORDS = [
    "urgent", "immediate", "action required", "verify your account",
    "suspend", "locked", "unauthorized", "confirm your identity",
    "click here", "act now", "limited time", "expire",
    "update your payment", "invoice attached", "security alert",
    "your account has been", "unusual activity", "reset your password",
]


def analyze_email(buffer: bytes) -> Dict[str, Any]:
    """
    Analyze a raw .eml file for phishing indicators.

    Returns dict with phishing_score (0-100), auth_results, header_analysis,
    content_analysis, and findings.
    """
    try:
        msg = BytesParser(policy=policy.default).parsebytes(buffer)
    except Exception as e:
        log.warning("email_parser.parse_failed", error=str(e))
        return {
            "phishing_score": 0,
            "error": f"Failed to parse email: {str(e)}",
            "findings": [],
        }

    findings: List[Dict[str, Any]] = []
    phishing_score = 0.0

    # 1. Extract headers
    header_analysis = _analyze_headers(msg)
    findings.extend(header_analysis.get("findings", []))
    phishing_score += header_analysis.get("score_impact", 0)

    # 2. Authentication results (SPF, DKIM, DMARC)
    auth_results = _extract_auth_results(msg)
    auth_findings, auth_score = _evaluate_auth_results(auth_results)
    findings.extend(auth_findings)
    phishing_score += auth_score

    # 3. Received chain analysis
    chain_analysis = _analyze_received_chain(msg)
    findings.extend(chain_analysis.get("findings", []))
    phishing_score += chain_analysis.get("score_impact", 0)

    # 4. Content analysis (urgency, suspicious links)
    content_analysis = _analyze_content(msg)
    findings.extend(content_analysis.get("findings", []))
    phishing_score += content_analysis.get("score_impact", 0)

    phishing_score = min(phishing_score, 100.0)

    if phishing_score >= 65:
        verdict = "PHISHING_DETECTED"
    elif phishing_score >= 35:
        verdict = "SUSPICIOUS"
    else:
        verdict = "AUTHENTIC"

    return {
        "phishing_score": round(phishing_score, 2),
        "verdict": verdict,
        "auth_results": auth_results,
        "header_analysis": {
            "from": header_analysis.get("from"),
            "to": header_analysis.get("to"),
            "subject": header_analysis.get("subject"),
            "reply_to": header_analysis.get("reply_to"),
            "return_path": header_analysis.get("return_path"),
            "date": header_analysis.get("date"),
        },
        "received_chain": chain_analysis.get("hops", []),
        "content_analysis": content_analysis,
        "findings": findings,
    }


def _analyze_headers(msg: email.message.EmailMessage) -> Dict[str, Any]:
    """Analyze email headers for suspicious patterns."""
    findings = []
    score_impact = 0

    from_addr = msg.get("From", "")
    reply_to = msg.get("Reply-To", "")
    return_path = msg.get("Return-Path", "")
    to_addr = msg.get("To", "")
    subject = msg.get("Subject", "")

    # Extract email addresses
    from_email = _extract_email(from_addr)
    reply_email = _extract_email(reply_to)
    return_email = _extract_email(return_path)

    # Check for From/Reply-To mismatch
    if reply_email and from_email:
        from_domain = from_email.split("@")[-1].lower() if "@" in from_email else ""
        reply_domain = reply_email.split("@")[-1].lower() if "@" in reply_email else ""
        if from_domain and reply_domain and from_domain != reply_domain:
            findings.append({
                "category": "REPLY_TO_MISMATCH",
                "severity": "high",
                "description": f"Reply-To domain ({reply_domain}) differs from From domain ({from_domain}). "
                               "This is a common phishing technique.",
            })
            score_impact += 25

    # Check From/Return-Path mismatch
    if return_email and from_email:
        from_domain = from_email.split("@")[-1].lower() if "@" in from_email else ""
        return_domain = return_email.split("@")[-1].lower() if "@" in return_email else ""
        if from_domain and return_domain and from_domain != return_domain:
            findings.append({
                "category": "RETURN_PATH_MISMATCH",
                "severity": "medium",
                "description": f"Return-Path ({return_domain}) differs from From ({from_domain}).",
            })
            score_impact += 10

    # Check for display name deception
    if from_addr and "<" in from_addr:
        display_name = from_addr.split("<")[0].strip().strip('"')
        # If display name looks like an email from a different domain
        if "@" in display_name:
            display_domain = display_name.split("@")[-1].lower()
            actual_domain = from_email.split("@")[-1].lower() if from_email and "@" in from_email else ""
            if display_domain != actual_domain:
                findings.append({
                    "category": "DISPLAY_NAME_SPOOFING",
                    "severity": "high",
                    "description": f"Display name '{display_name}' mimics a different domain than the actual sender.",
                })
                score_impact += 20

    return {
        "from": from_addr,
        "to": to_addr,
        "subject": subject,
        "reply_to": reply_to,
        "return_path": return_path,
        "date": msg.get("Date", ""),
        "findings": findings,
        "score_impact": score_impact,
    }


def _extract_auth_results(msg: email.message.EmailMessage) -> Dict[str, Any]:
    """Extract SPF, DKIM, DMARC results from Authentication-Results header."""
    auth_header = msg.get("Authentication-Results", "")
    arc_header = msg.get("ARC-Authentication-Results", "")

    combined = f"{auth_header} {arc_header}".lower()

    results = {
        "spf": _parse_auth_status(combined, "spf"),
        "dkim": _parse_auth_status(combined, "dkim"),
        "dmarc": _parse_auth_status(combined, "dmarc"),
        "raw_header": auth_header[:500] if auth_header else None,
    }

    return results


def _parse_auth_status(header_text: str, protocol: str) -> str:
    """Parse individual auth protocol status from header."""
    pattern = rf'{protocol}=(\w+)'
    match = re.search(pattern, header_text)
    if match:
        return match.group(1)
    return "none"


def _evaluate_auth_results(auth_results: Dict[str, Any]) -> tuple:
    """Evaluate auth results and generate findings."""
    findings = []
    score = 0

    spf = auth_results.get("spf", "none")
    dkim = auth_results.get("dkim", "none")
    dmarc = auth_results.get("dmarc", "none")

    if spf == "fail":
        findings.append({
            "category": "SPF_FAIL",
            "severity": "high",
            "description": "SPF authentication failed: the sending server is not authorized to send on behalf of this domain.",
        })
        score += 25
    elif spf == "softfail":
        findings.append({
            "category": "SPF_SOFTFAIL",
            "severity": "medium",
            "description": "SPF soft-fail: the sending server may not be authorized for this domain.",
        })
        score += 10
    elif spf == "none":
        findings.append({
            "category": "SPF_MISSING",
            "severity": "low",
            "description": "No SPF record found for the sender's domain.",
        })
        score += 5

    if dkim == "fail":
        findings.append({
            "category": "DKIM_FAIL",
            "severity": "high",
            "description": "DKIM signature validation failed: the email may have been tampered with in transit.",
        })
        score += 25
    elif dkim == "none":
        findings.append({
            "category": "DKIM_MISSING",
            "severity": "low",
            "description": "No DKIM signature present on this email.",
        })
        score += 5

    if dmarc == "fail":
        findings.append({
            "category": "DMARC_FAIL",
            "severity": "high",
            "description": "DMARC policy check failed: the email does not align with the sender domain's authentication policy.",
        })
        score += 20
    elif dmarc == "none":
        score += 3

    return findings, score


def _analyze_received_chain(msg: email.message.EmailMessage) -> Dict[str, Any]:
    """Analyze the Received header chain for hop anomalies."""
    findings = []
    score_impact = 0
    hops = []

    received_headers = msg.get_all("Received", [])

    for i, header in enumerate(received_headers):
        hop = {
            "index": i,
            "raw": str(header)[:200],
        }

        # Extract "from" server
        from_match = re.search(r'from\s+(\S+)', str(header))
        if from_match:
            hop["from_server"] = from_match.group(1)

        # Extract "by" server
        by_match = re.search(r'by\s+(\S+)', str(header))
        if by_match:
            hop["by_server"] = by_match.group(1)

        hops.append(hop)

    # Check for excessive hops (more than 8 is unusual)
    if len(hops) > 8:
        findings.append({
            "category": "EXCESSIVE_HOPS",
            "severity": "low",
            "description": f"Email passed through {len(hops)} servers, which is unusually high.",
        })
        score_impact += 5

    return {
        "hops": hops[:10],
        "hop_count": len(hops),
        "findings": findings,
        "score_impact": score_impact,
    }


def _analyze_content(msg: email.message.EmailMessage) -> Dict[str, Any]:
    """Analyze email body for phishing indicators."""
    findings = []
    score_impact = 0

    # Get plain text body
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode("utf-8", errors="replace")
                    break
            elif part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    body = payload.decode("utf-8", errors="replace")
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            body = payload.decode("utf-8", errors="replace")

    body_lower = body.lower()

    # Check for urgency keywords
    urgency_matches = [kw for kw in URGENCY_KEYWORDS if kw in body_lower]
    if len(urgency_matches) >= 3:
        findings.append({
            "category": "HIGH_URGENCY_LANGUAGE",
            "severity": "high",
            "description": f"Email contains {len(urgency_matches)} urgency indicators: {', '.join(urgency_matches[:5])}",
        })
        score_impact += 20
    elif len(urgency_matches) >= 1:
        findings.append({
            "category": "URGENCY_LANGUAGE",
            "severity": "low",
            "description": f"Email contains urgency language: {', '.join(urgency_matches[:3])}",
        })
        score_impact += 5

    # Check for suspicious URLs in body
    urls = re.findall(r'https?://[^\s<>"\']+', body)
    suspicious_urls = [u for u in urls if _is_suspicious_url(u)]
    if suspicious_urls:
        findings.append({
            "category": "SUSPICIOUS_URLS",
            "severity": "medium",
            "description": f"Found {len(suspicious_urls)} suspicious URL(s) in email body.",
        })
        score_impact += 15

    return {
        "body_length": len(body),
        "urgency_keywords_found": urgency_matches,
        "urls_found": len(urls),
        "suspicious_urls": len(suspicious_urls),
        "findings": findings,
        "score_impact": score_impact,
    }


def _extract_email(header_value: str) -> str:
    """Extract email address from a header value like 'Name <email@domain.com>'."""
    match = re.search(r'<([^>]+)>', header_value)
    if match:
        return match.group(1).strip()
    # Try bare email
    match = re.search(r'[\w.+-]+@[\w.-]+\.\w+', header_value)
    if match:
        return match.group(0).strip()
    return ""


def _is_suspicious_url(url: str) -> bool:
    """Quick heuristic check if a URL looks suspicious."""
    url_lower = url.lower()
    suspicious_patterns = [
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',  # IP address
        r'bit\.ly|tinyurl|t\.co|goo\.gl',          # URL shorteners
        r'\.tk$|\.ml$|\.ga$|\.cf$',                 # Free TLDs
        r'@',                                        # @ in URL (credential stuffing)
        r'-{3,}',                                    # Many dashes
    ]
    return any(re.search(p, url_lower) for p in suspicious_patterns)
