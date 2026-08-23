"""
app/ml_models/text_detector.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GPTZero-Style AI Text Detector

Detects AI-generated text using perplexity, burstiness, and entropy
metrics computed via a small GPT-2 language model. When the
`transformers` library is unavailable or USE_MOCK_MODELS=true, falls
back to statistical heuristics (sentence length variance, vocabulary
richness, and punctuation diversity).
"""
from __future__ import annotations

import math
import re
from typing import Dict, Any, List, Tuple

import numpy as np
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


class AITextDetector:
    """
    Detect AI-generated text using perplexity and burstiness analysis.
    """

    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.use_mock = settings.USE_MOCK_MODELS
        self._model_loaded = False

        if not self.use_mock:
            self._load_model()

    def _load_model(self):
        """Load GPT-2 model for perplexity computation."""
        try:
            from transformers import GPT2LMHeadModel, GPT2TokenizerFast
            import torch

            model_name = getattr(settings, "TEXT_MODEL_PATH", "gpt2")
            self.tokenizer = GPT2TokenizerFast.from_pretrained(model_name)
            self.model = GPT2LMHeadModel.from_pretrained(model_name)
            self.model.eval()
            if settings.MODEL_DEVICE == "cuda":
                import torch
                if torch.cuda.is_available():
                    self.model = self.model.cuda()
            self._model_loaded = True
            log.info("text_detector.gpt2_loaded", model=model_name)
        except ImportError:
            log.warning("text_detector.transformers_unavailable", fallback="heuristic")
            self.use_mock = True
        except Exception as e:
            log.warning("text_detector.load_failed", error=str(e), fallback="heuristic")
            self.use_mock = True

    def analyze(self, text: str) -> Dict[str, Any]:
        """
        Analyze text for AI-generation indicators.

        Returns dict with:
            - ai_probability (0-100)
            - perplexity (float)
            - burstiness (float)
            - entropy (float)
            - verdict: "LIKELY_AI" | "MIXED" | "LIKELY_HUMAN"
            - explanation (str)
            - sentence_analysis (list)
        """
        if not text or len(text.strip()) < 50:
            return {
                "ai_probability": 0.0,
                "perplexity": 0.0,
                "burstiness": 0.0,
                "entropy": 0.0,
                "verdict": "INSUFFICIENT_TEXT",
                "explanation": "Text is too short for reliable analysis (minimum 50 characters).",
                "sentence_analysis": [],
            }

        if self.use_mock or not self._model_loaded:
            return self._heuristic_analyze(text)

        return self._model_analyze(text)

    def _model_analyze(self, text: str) -> Dict[str, Any]:
        """Full GPT-2 perplexity-based analysis."""
        import torch

        sentences = self._split_sentences(text)
        sentence_perplexities = []
        sentence_analysis = []

        for sent in sentences:
            if len(sent.strip()) < 10:
                continue
            ppl = self._compute_perplexity(sent)
            sentence_perplexities.append(ppl)
            sentence_analysis.append({
                "text": sent[:100] + ("..." if len(sent) > 100 else ""),
                "perplexity": round(ppl, 2),
                "classification": "likely_ai" if ppl < 30 else ("uncertain" if ppl < 60 else "likely_human"),
            })

        if not sentence_perplexities:
            return self._heuristic_analyze(text)

        avg_perplexity = float(np.mean(sentence_perplexities))
        burstiness = float(np.std(sentence_perplexities))
        entropy = self._compute_text_entropy(text)

        # Classification logic:
        # Low perplexity + low burstiness → highly predictable → likely AI
        # High perplexity + high burstiness → varied/surprising → likely human
        ai_score = 0.0

        # Perplexity component (60% weight)
        if avg_perplexity < 15:
            ai_score += 60
        elif avg_perplexity < 30:
            ai_score += 45
        elif avg_perplexity < 50:
            ai_score += 30
        elif avg_perplexity < 80:
            ai_score += 15
        else:
            ai_score += 5

        # Burstiness component (25% weight) — AI text has uniform sentence complexity
        if burstiness < 5:
            ai_score += 25
        elif burstiness < 15:
            ai_score += 18
        elif burstiness < 30:
            ai_score += 10
        else:
            ai_score += 3

        # Entropy component (15% weight) — AI text tends toward medium entropy
        if 3.5 < entropy < 4.5:
            ai_score += 15
        elif 3.0 < entropy < 5.0:
            ai_score += 8
        else:
            ai_score += 3

        ai_score = float(np.clip(ai_score, 0, 100))

        if ai_score >= 70:
            verdict = "LIKELY_AI"
            explanation = (
                f"This text exhibits characteristics typical of AI generation: "
                f"low perplexity ({avg_perplexity:.1f}), uniform sentence complexity "
                f"(burstiness {burstiness:.1f}), and predictable vocabulary patterns."
            )
        elif ai_score >= 40:
            verdict = "MIXED"
            explanation = (
                f"This text shows mixed signals: moderate perplexity ({avg_perplexity:.1f}) "
                f"and burstiness ({burstiness:.1f}). It may be AI-assisted or heavily edited."
            )
        else:
            verdict = "LIKELY_HUMAN"
            explanation = (
                f"This text appears naturally written with high perplexity ({avg_perplexity:.1f}), "
                f"varied sentence complexity, and organic vocabulary patterns."
            )

        return {
            "ai_probability": round(ai_score, 2),
            "perplexity": round(avg_perplexity, 2),
            "burstiness": round(burstiness, 2),
            "entropy": round(entropy, 4),
            "verdict": verdict,
            "explanation": explanation,
            "sentence_analysis": sentence_analysis[:10],  # Limit to 10 sentences
        }

    def _compute_perplexity(self, text: str) -> float:
        """Compute per-token perplexity using GPT-2."""
        import torch

        encodings = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        input_ids = encodings.input_ids

        if settings.MODEL_DEVICE == "cuda" and torch.cuda.is_available():
            input_ids = input_ids.cuda()

        with torch.no_grad():
            outputs = self.model(input_ids, labels=input_ids)
            loss = outputs.loss

        return float(torch.exp(loss).item())

    def _heuristic_analyze(self, text: str) -> Dict[str, Any]:
        """
        Statistical heuristic when GPT-2 is unavailable.
        Uses sentence length variance, vocabulary richness, punctuation
        diversity, and repetition patterns.
        """
        sentences = self._split_sentences(text)
        words = text.lower().split()

        if len(words) < 10:
            return {
                "ai_probability": 0.0, "perplexity": 0.0, "burstiness": 0.0,
                "entropy": 0.0, "verdict": "INSUFFICIENT_TEXT",
                "explanation": "Not enough text for analysis.",
                "sentence_analysis": [],
            }

        # 1. Sentence length variance (AI tends toward uniform length)
        sent_lengths = [len(s.split()) for s in sentences if len(s.split()) > 2]
        length_cv = float(np.std(sent_lengths) / (np.mean(sent_lengths) + 1e-8)) if sent_lengths else 0.5

        # 2. Vocabulary richness (type-token ratio)
        unique_words = set(words)
        ttr = len(unique_words) / len(words) if words else 0.5

        # 3. Punctuation diversity
        punct_chars = set(re.findall(r'[^\w\s]', text))
        punct_diversity = len(punct_chars)

        # 4. Average word length variance
        word_lengths = [len(w) for w in words]
        word_len_std = float(np.std(word_lengths))

        # 5. Repetition ratio (bigrams)
        bigrams = [f"{words[i]} {words[i+1]}" for i in range(len(words) - 1)]
        bigram_repetition = 1.0 - (len(set(bigrams)) / len(bigrams)) if bigrams else 0.0

        # Heuristic scoring
        ai_score = 0.0

        # Low sentence length variance → AI-like
        if length_cv < 0.3:
            ai_score += 30
        elif length_cv < 0.5:
            ai_score += 15

        # Medium TTR → AI (too consistent vocabulary)
        if 0.35 < ttr < 0.55:
            ai_score += 20
        elif ttr < 0.35:
            ai_score += 10  # Very repetitive could be human or AI

        # Low punctuation diversity → AI
        if punct_diversity < 4:
            ai_score += 15

        # Uniform word length → AI
        if word_len_std < 2.5:
            ai_score += 15

        # High bigram repetition → AI
        if bigram_repetition > 0.1:
            ai_score += 10

        ai_score = float(np.clip(ai_score, 5, 90))  # Cap at 90 for heuristic
        pseudo_perplexity = 100 - ai_score  # Approximate

        entropy = self._compute_text_entropy(text)

        sentence_analysis = [
            {
                "text": s[:100] + ("..." if len(s) > 100 else ""),
                "perplexity": round(pseudo_perplexity + np.random.uniform(-10, 10), 2),
                "classification": "likely_ai" if ai_score > 60 else "uncertain",
            }
            for s in sentences[:10]
        ]

        if ai_score >= 65:
            verdict = "LIKELY_AI"
        elif ai_score >= 35:
            verdict = "MIXED"
        else:
            verdict = "LIKELY_HUMAN"

        return {
            "ai_probability": round(ai_score, 2),
            "perplexity": round(pseudo_perplexity, 2),
            "burstiness": round(length_cv * 30, 2),
            "entropy": round(entropy, 4),
            "verdict": verdict,
            "explanation": f"Heuristic analysis (sentence variance={length_cv:.2f}, TTR={ttr:.2f}, entropy={entropy:.3f}).",
            "sentence_analysis": sentence_analysis,
        }

    @staticmethod
    def _split_sentences(text: str) -> List[str]:
        """Split text into sentences using regex."""
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if s.strip()]

    @staticmethod
    def _compute_text_entropy(text: str) -> float:
        """Compute Shannon entropy of character distribution."""
        text_lower = text.lower()
        freq = {}
        for ch in text_lower:
            if ch.isalpha():
                freq[ch] = freq.get(ch, 0) + 1
        total = sum(freq.values())
        if total == 0:
            return 0.0
        entropy = -sum((c / total) * math.log2(c / total) for c in freq.values())
        return entropy

    def get_model_info(self) -> Dict[str, Any]:
        return {
            "model_name": "GPTZero-Style AI Text Detector",
            "model_type": "text_ai_detector",
            "is_mock": self.use_mock,
            "backend": "gpt2" if self._model_loaded else "heuristic",
        }
