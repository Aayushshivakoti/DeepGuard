import pytest
import io
from app.services.pdf_forensic_service import analyze_text_forensics, extract_pdf_text, analyze_pdf_forensics

def test_analyze_text_forensics_uniform_llm_text():
    # Uniform sentence length text with LLM transition phrases
    llm_sample = (
        "In conclusion, it is important to note that artificial intelligence plays a crucial role in modern society. "
        "Furthermore, we must consider the ethical implications of automated decision systems in today's digital landscape. "
        "Moreover, the rapid advancement of machine learning technology presents both unprecedented opportunities and challenges. "
        "In summary, a balanced regulatory framework is a testament to responsible innovation."
    )
    res = analyze_text_forensics(llm_sample)
    assert res["ai_text_score"] >= 50.0
    assert res["burstiness"] < 0.4
    assert len(res["llm_phrases_found"]) >= 2
    assert any("BURSTINESS" in f["category"] for f in res["findings"])

def test_analyze_text_forensics_human_varied_text():
    # Highly varied sentence lengths, informal writing
    human_sample = (
        "Wait, what? No way! "
        "I was walking down the street yesterday when I suddenly realized I had forgotten my keys at home after leaving the front door wide open. "
        "Ouch. That really sucked. "
        "Anyway, called a locksmith."
    )
    res = analyze_text_forensics(human_sample)
    assert res["ai_text_score"] < 40.0
    assert res["burstiness"] > 0.6
    assert res["llm_phrase_count"] == 0

def test_analyze_pdf_forensics_with_mock_buffer():
    # Simple PDF header buffer
    mock_pdf_buffer = b"%PDF-1.4\n1 0 obj\n<< /Title (Test Document) >>\nendobj\n%%EOF"
    res = analyze_pdf_forensics(mock_pdf_buffer)
    assert "forgery_score" in res
    assert "text_forensics" in res
    assert "findings" in res
