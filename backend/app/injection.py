import re

_PATTERNS = (
    r"ignore\s+(all\s+|any\s+)?(the\s+|your\s+)?(previous|prior|above|earlier)\s+"
    r"(instructions|prompts|rules|commands)",
    r"disregard\s+(all\s+|any\s+)?(the\s+|your\s+)?(previous|prior|above|earlier)",
    r"(instruction|instructions|message)\s+(for|to)\s+(the\s+)?(ai|assistant|llm|language\s+model)",
    r"zignoruj\s+(wszystkie\s+)?(wcześniejsze|poprzednie|powyższe)\s+(polecenia|instrukcje)",
    r"instrukcj[aei]\s+dla\s+(systemu\s+)?(ai|sztucznej\s+inteligencji|modelu|asystenta)",
    r"ignoriere\s+(alle\s+)?(vorherigen|bisherigen)\s+anweisungen",
)
_INJECTION = re.compile("|".join(f"(?:{p})" for p in _PATTERNS), re.IGNORECASE)

INJECTION_WARNING = (
    "Dokument zawiera tekst wyglądający na polecenia dla systemu AI. "
    "Został potraktowany jako zwykła treść dokumentu i nie został wykonany."
)


def looks_like_prompt_injection(text: str) -> bool:
    """Heuristic only: the prompt itself is the real defence, this just informs the user."""
    return _INJECTION.search(" ".join(text.split())) is not None
