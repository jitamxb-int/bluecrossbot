"""RAG chat orchestration: LOAD history -> RUN retrieval+LLM -> SAVE turn.

Implements ``docs/CONVERSATION_HISTORY.md``. Each turn:

1. LOAD the session transcript + rolling summary from MongoDB.
2. Rewrite the query to standalone form (for retrieval only) using the history.
3. Retrieve top-k chunks (blended across doc types) from Qdrant.
4. Build the prompt: [system instructions] + [summary] + windowed history +
   [retrieved context, with products/videos tagged P#/V#] + the raw query.
5. One structured LLM call returns the answer, the new rolling summary, and the
   tags of products/videos worth referencing.
6. Resolve those tags back to the retrieved payloads so references carry the
   REAL image/video URLs from the vector store (never model-invented).
7. SAVE the turn (raw query + final answer) and the refreshed summary; timing
   updates inside ``append_turn``.
"""

from __future__ import annotations

import asyncio
import re
import random
import time
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

from src.api.models.chat import (
    ChatCountResponse,
    ChatRequest,
    ChatResponse,
    ChatSessionItem,
    ChatSessionListResponse,
    ChatTranscriptsResponse,
    DeleteSessionsRequest,
    DeleteSessionsResponse,
    ProductReference,
    SessionInfo,
    VideoReference,
)
from src.core.config import Settings
from src.core.logging.setup import get_logger
from src.services.llm.errors import LLMError
from src.services.llm.openai_chat import OpenAIChatProvider
from src.services.retrieval.service import RetrievalService
from src.storage.mongo.config import ConfigRepository
from src.storage.mongo.session import SessionRepository

logger = get_logger(__name__)

# Detects queries asking to LIST / ENUMERATE / NAME / give EXAMPLES of the
# company's medicines or products (e.g. 'list me 10 examples of medicine',
# 'what medicines do you have', 'name some products'). Such queries trigger a
# catalog-scoped retrieval so the model only ever lists real Blue Cross
# products instead of padding from world knowledge (e.g. cetirizine).
_PRODUCT_LIST_RE = re.compile(
    r"\b(?:"
    r"(?:list|enumerate|name|give|show|suggest|recommend|tell)\b.{0,40}?"
    r"(?:medicine|medication|meds\b|drug|product|tablet|brand|syrup|ointment|capsule)\w*"
    r"|alternatives?\s+(?:to|of|for)\b"
    r"|examples?\s+of\b.{0,8}?(?:medicine|medication|drug|product|brand)\w*"
    r"|(?:what|which)\s+(?:medicines?|medications?|drugs?|products?|brands?|tablets?)"
    r"\b.{0,25}?(?:have|has|manufactur\w+|produc\w+|make\w*|stock|offer|sell|available)"
    r"|how\s+many\s+(?:medicines?|products?|drugs?)\w*"
    r"|(?:medicine|medication|drug|product|brand)\w*\s+(?:list|range|catalog|catalogue)"
    r"|(?:list|range|catalog|catalogue)\s+of\b.{0,8}?(?:medicines?|products?|drugs?)\w*"
    r"|(?:medicines?|products?|drugs?)\s+(?:you\s+)?(?:manufactur\w+|produc\w+|make\w*|offer|stock|sell)\b"
    r")",
    re.IGNORECASE,
)

# Narrower than _PRODUCT_LIST_RE: requests for SEVERAL medicines ('suggest some
# medicines', 'list 10 meds', 'alternatives to X'). For these the PI-priority step
# (which scopes the context to ONE product's PI/PIL) is skipped so the model keeps
# every Blue Cross product retrieval found. Single-product questions ('tell me
# about X tablets', 'dosage of X tablets') deliberately do NOT match.
_MULTI_PRODUCT_RE = re.compile(
    r"\b(?:alternatives?|substitutes?)\b"
    r"|\b(?:list|suggest|recommend|enumerate|name|some|few|any|other|more|\d+)\b[^.?!]{0,30}?"
    r"\b(?:medicines|medications|meds|drugs|products|brands|tablets|syrups|options)\b"
    r"|\b(?:what|which)\s+(?:other\s+)?(?:medicines|medications|meds|drugs|products|brands)\b"
    r"|\bexamples?\s+of\b",
    re.IGNORECASE,
)

# PI/PIL `product_name`s are derived from upload filenames and can carry noise
# ('Pack insert - ', ' PI', 'ver00 web copy', 'Sept 2022'). Stripped only for the
# product label shown to the model in the context.
_PDF_NAME_NOISE = re.compile(
    r"(?i)^\s*pack\s+insert\s*-\s*"
    r"|\b(?:insert|nashik|exp|final|leamak|nsk|nepal|akums)\b"
    r"|\bweb\s*copy\d*|\bver\s*\d*\b"
    r"|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s_]+\d{2,4}\b"
    r"|\b20\d\d\b|_?\bpi\b|\(\d+\)"
)


def _display_product_name(name: str | None) -> str:
    """Clean a PI/PIL product_name for display, e.g. 'Pack insert - Eterna Syrup ver00'."""
    cleaned = _PDF_NAME_NOISE.sub(" ", (name or "").replace("_", " "))
    return re.sub(r"\s{2,}", " ", cleaned).strip(" -")


# --- Multi-product answer verification (see ChatService._verify_product_list) -----
NO_PRODUCT_MATCH_MESSAGE = (
    "I couldn't find a Blue Cross Laboratories product for that in the information I "
    "have. Please consult a healthcare professional for advice, or email us at "
    "info@bluecrosslabs.com and our team will be happy to help."
)
_LIST_ITEM = re.compile(r"^\s*(?:[-*•]|\d+[.)])\s+(.*)$")
_BOLD = re.compile(r"\*\*(.+?)\*\*")
# Where a PI/PIL states what a product IS for: the indication statement itself
# ('is indicated for…'), else the 'Therapeutic indications' heading. '\b' so
# 'contraindicated' never matches; 'indications of renal damage' (toxicology) is not
# a statement and only matches the weaker heading pattern.
_INDICATED_FOR = re.compile(r"(?<!not )\bindicated (?:for|in|as)\b", re.I)
# Patient-leaflet wording, used only when a document has no 'indicated for' statement.
_USED_FOR = re.compile(
    r"\bused (?:to treat|to relieve|in the treatment of)\b"
    r"|\bfor the (?:symptomatic )?(?:relief|treatment) of\b",
    re.I,
)
_INDICATION = re.compile(r"\b(?:therapeutic )?indications?\b", re.I)


def _brand_key(name: str) -> str:
    """'MEFTAL-P Suspension' -> 'meftalp'; used to match listed names to real products.

    Spaces around hyphens are collapsed first, so 'TUSQ- D Lozenges' -> 'tusqd'.
    """
    first = re.sub(r"\s*-\s*", "-", (name or "").strip()).split(" ")[0]
    return re.sub(r"[^a-z0-9]", "", first.lower())


def _item_name(item_text: str) -> str:
    """A list item's product name: its bold part, else the text before a dash/colon."""
    bold = _BOLD.search(item_text)
    return bold.group(1) if bold else re.split(r"\s[—–:-]\s", item_text)[0]


def _listed_names(answer: str) -> list[str]:
    """Product names an answer lists (list items), plus any bold names in prose."""
    names = [_item_name(m.group(1)) for line in (answer or "").splitlines()
             if (m := _LIST_ITEM.match(line))]
    return names + [m.group(1) for m in _BOLD.finditer(answer or "")]


def _indication_excerpt(text: str, per_match: int = 220, max_matches: int = 3) -> str:
    """What a PI/PIL says the product is for: up to ``max_matches`` distinct
    'indicated for …' statements, else the first 'Indications' passage."""
    text = text or ""
    parts: list[str] = []
    for pattern in (_INDICATED_FOR, _USED_FOR):  # statements first, leaflet wording after
        for m in pattern.finditer(text):
            # From the start of the statement's sentence (at most 60 chars back).
            start = max(m.start() - 60, text.rfind(". ", 0, m.start()) + 2, 0)
            part = re.sub(r"\s+", " ", text[start : m.end() + per_match]).strip()
            if part not in parts:
                parts.append(part)
            if len(parts) >= max_matches:
                break
        if parts:
            break
    if not parts:
        m = _INDICATION.search(text)
        start = m.start() if m else 0
        parts.append(re.sub(r"\s+", " ", text[start : start + 2 * per_match]).strip())
    return " … ".join(parts)

# Returned (HTTP 200) when a message targets a session past its max duration.
SESSION_EXPIRED_MESSAGE = (
    "Your chat session has reached the maximum allowed duration and has now ended. "
    "Please refresh the page to start a new session. "
    "If you require any additional information or assistance, feel free to email us at "
    "info@bluecrosslabs.com, and our team will get back to you as soon as possible."
)

# After more than this many questions about the SAME product in one session, the
# bot stops giving detailed product answers and routes the user to email support.
PRODUCT_QUERY_LIMIT = 5
EMAIL_SUPPORT_MESSAGE = (
    "If you require any additional information or assistance regarding this "
    "product, please feel free to email us at info@bluecrosslabs.com. Our team will "
    "be happy to assist you and will get back to you as soon as possible."
)

# Canonical refusal used whenever the model reports the answer isn't grounded in
# the retrieved context (response_type == "no_info"). Kept identical to the
# fallback wording embedded in the system prompt.
NO_INFO_MESSAGE = (
    "I'm sorry, I don't have enough information to answer that question at the moment. "
    "If you need a more detailed or prompt response, please feel free to email us at "
    "info@bluecrosslabs.com, and our team will be happy to assist you."
)

# Official careers page + contact for job / vacancy / fresher questions. Retrieved
# chunks carry their URL only in the payload (never in the text the model sees), so
# the page is given to the model explicitly — same approach as the DPCO price list.
CAREERS_URL = "https://www.bluecrosslabs.com/current-opening/"
CAREERS_GUIDANCE_MESSAGE = (
    "For the latest job vacancies at Blue Cross Laboratories, including any "
    f"opportunities for freshers, please visit our Current Openings page: {CAREERS_URL} "
    "Openings are updated from time to time, so if you'd like to confirm whether a "
    "specific role or a fresher position is available, please email us at "
    "info@bluecrosslabs.com and our team will be happy to assist you."
)

# Detects questions about jobs / vacancies / careers / fresher opportunities. Used
# only to replace the generic no_info refusal with careers guidance.
_CAREERS_RE = re.compile(
    r"\b(?:"
    r"vacanc(?:y|ies)|careers?|hiring|recruit\w*|freshers?|internships?|employment"
    r"|jobs?\b(?!\s+of\b)"
    r"|(?:current|job|any)\s+openings?|openings?\s+(?:at|in|for|with)\b"
    r"|apply\s+(?:for\s+)?(?:a\s+|an\s+)?(?:job|position|post|role)"
    r"|(?:work|join)\s+(?:(?:at|for|with|in)\s+)?"
    r"(?:blue\s*cross|your\s+(?:company|team|organi[sz]ation))"
    r")",
    re.IGNORECASE,
)

# --- Conversation closing (see "CLOSING THE CONVERSATION" in the prompt) ---------
# Short sign-offs used when the model tries to ask the closing question a second
# time; varied so the ending never reads as a canned loop.
_FAREWELL_MESSAGES = (
    "You're welcome! Take care, and goodbye.",
    "It was a pleasure helping you. Goodbye and take care!",
    "Glad I could help. Have a good day — goodbye!",
)
# Sentences that re-open the chat ("feel free to reach out", "if you have any more
# questions…"); stripped from the final sign-off so it actually closes the chat.
_REOPENING_SENTENCE = re.compile(
    r"[^.!?]*\b(?:feel free|don'?t hesitate|reach out|let me know|i'?m (?:always )?here"
    r"|any (?:more|other|further) (?:questions|help|assistance)|anything else)\b[^.!?]*[.!?]?",
    re.IGNORECASE,
)
# Injected before the user's message so the model knows the closing state instead
# of inferring it from the transcript.
_CLOSING_STATE_NOTES = {
    "asked": (
        "[CLOSING STATE] Your previous reply already asked the user if they need "
        "anything else. Do NOT ask it again. If this message declines, thanks you "
        "again, acknowledges, or says goodbye, give the one-sentence final sign-off "
        "(response_type 'farewell'). If it says yes or asks something, continue helping."
    ),
    "ended": (
        "[CLOSING STATE] You already said goodbye and closed this chat. If this "
        "message is just another thanks / acknowledgement / goodbye, reply with a "
        "very short sign-off only (response_type 'farewell'). If it asks something "
        "new, answer it normally."
    ),
}

_SYSTEM_INSTRUCTIONS = (
    # ── ROLE ──────────────────────────────────────────────────────────
    "You are Luna, an assistant for Blue Cross Laboratories, here to help "
    "users with information related to our products and services.\n\n"

    # ── 0. IDENTITY (who you are) ─────────────────────────────────────
    "## IDENTITY\n"
    "Your name is Luna. You are the assistant for Blue Cross Laboratories, and "
    "your purpose is to help users with information related to Blue Cross "
    "Laboratories' products and services. Hold this as your own understanding "
    "of who you are — not a script to recite.\n"
    "When the user asks about you or the bot — e.g. 'who are you', 'what are "
    "you', 'what is your name', 'what can you do', 'tell me about yourself', "
    "'what is this bot' — answer naturally in your OWN words, adapting to what "
    "they actually asked. Someone asking your name just needs your name; "
    "someone asking what you can do wants a short sense of how you help; a "
    "general 'who are you' gets a brief, warm introduction. Vary the wording "
    "turn to turn — never repeat one fixed, canned sentence.\n"
    "Keep these replies to the core idea (you're Luna, an assistant for Blue "
    "Cross Laboratories, here to help with its products and services) and, "
    "when it fits, invite them to ask what they need. For reference tone, a "
    "natural intro might read: 'I'm Luna, an assistant for Blue Cross "
    "Laboratories — here to help you with information about our products and "
    "services. How can I assist you today?' — but treat that as an example of "
    "the tone, not a line to copy verbatim.\n"
    "For identity questions, return empty product_ids, video_ids, and "
    "source_ids. Do not mention context or tags.\n\n"

    # ── 1. GROUNDING ──────────────────────────────────────────────────
    "## GROUNDING\n"
    "Answer ONLY from the [RETRIEVED CONTEXT]. "
    "If the answer isn't there, say so plainly — never invent facts.\n\n"

    # ── 2. STRICT NO-HALLUCINATION RULE (highest priority) ────────────
    "## NO-HALLUCINATION RULE (HIGHEST PRIORITY)\n"
    "Never invent, guess, or fabricate facts that are NOT present in the "
    "[RETRIEVED CONTEXT].\n"
    "BUT — if the information needed to answer IS present in the context, you "
    "MUST answer. This holds even when the relevant facts are spread across "
    "several chunks, worded differently from the user's question, or need to "
    "be pulled together into one clear reply. Combining, summarising, or "
    "rephrasing facts that are actually in the context is NOT hallucination — "
    "it is your job. Do NOT refuse just because the wording doesn't match the "
    "question, or because one minor sub-detail is missing; answer the part the "
    "context supports.\n"
    "Use the fallback below ONLY when the context contains NO relevant "
    "information about what the user asked — i.e. the answer is genuinely "
    "absent, not merely phrased differently or requiring you to connect a "
    "couple of stated facts. When in doubt and the context clearly supports an "
    "answer, ANSWER rather than refuse.\n"
    "Fallback (use ONLY when the answer is truly not in the context):\n"
    "  'I'm sorry, I don't have enough information to answer that question at the moment. "
    "If you need a more detailed or prompt response, please feel free to email us at "
    "info@bluecrosslabs.com, and our team will be happy to assist you.'\n"
    "Rephrase naturally, but keep the meaning: you lack the data, you won't "
    "invent an answer, and the user can reach out by email for further help. "
    "Return empty product_ids, video_ids, and source_ids in this case.\n"
    "An honest 'I don't know' is correct only when the context truly lacks the "
    "answer. A plausible but unsupported answer is never acceptable.\n\n"

    # ── 3. COMPOSITION / INGREDIENT QUESTIONS (HIGH PRIORITY) ─────────
    "## COMPOSITION / INGREDIENT QUESTIONS\n"
    "This rule overrides any instinct to reuse the full context chunk as-is.\n"
    "If the user asks about a product's 'composition', 'ingredients', 'what "
    "does it contain', 'formula', or similar — and does NOT explicitly say "
    "'inactive ingredients', 'excipients', or 'full formulation' — then:\n"
    "- Answer with ONLY the active ingredient(s) and strength, in one short "
    "sentence.\n"
    "- Do NOT use the words 'inactive', 'excipient', 'microcrystalline "
    "cellulose', 'starch', 'stabilization', 'flavouring', or any other "
    "excipient name in this reply, even briefly or in passing.\n"
    "- Do NOT structure the answer as a list with an active/inactive split. "
    "One plain sentence is enough.\n"
    "- Example — user asks 'tell me about its composition':\n"
    "  CORRECT: 'MEFTAL-P Dispersible Tablets contain 100 mg of mefenamic "
    "acid per tablet.'\n"
    "  INCORRECT: any version that also mentions inactive ingredients or "
    "excipients.\n"
    "- Only give the inactive ingredients / excipients list if the user's "
    "own message explicitly asks for them.\n\n"

    # ── 3B. PURCHASING / ORDERING MEDICINE ────────────────────────────
    "## PURCHASING / ORDERING MEDICINE\n"
    "When the user asks how to GET, BUY, ORDER, or OBTAIN a medicine — e.g. "
    "'how can I get your medicine', 'can I order meds directly to my home', "
    "'how do I buy this online', 'can I get it directly from the plant / from "
    "employees', 'where can I purchase it', or any similar purchase/delivery "
    "request — do NOT provide ordering links, delivery options, or direct-"
    "supply routes. Instead, convey this compliance guidance:\n"
    "  - The medication requires a valid prescription from a licensed medical "
    "practitioner.\n"
    "  - Per applicable regulations, it should only be purchased from an "
    "authorized pharmacist or licensed chemist.\n"
    "  - Advise the user to consult their healthcare provider and obtain the "
    "medicine through an approved pharmacy.\n"
    "Phrase this naturally in your own words — do NOT recite a fixed line. It "
    "is perfectly fine if your wording does NOT match the quoted line below "
    "exactly; what matters is that you CONVEY the same meaning. Rephrase it "
    "intelligently and vary it from turn to turn, so the chat never feels "
    "robotic or repetitive — just keep all three points above intact and never "
    "suggest buying directly from the plant, employees, or any unauthorized "
    "source. For reference tone: "
    "'The requested medication is a scheduled drug and requires a valid "
    "prescription from a licensed medical practitioner. As per applicable "
    "regulations, it should only be purchased from an authorized pharmacist or "
    "licensed chemist. Please consult your healthcare provider and obtain the "
    "medicine through an approved pharmacy.' — this is only an example of the "
    "tone and meaning to preserve, NOT a script to copy word for word.\n"
    "Return empty product_ids and source_ids for these purchase questions; "
    "populate video_ids only if a video genuinely helps.\n\n"
    
    # ── 3C. PRICING / COST OF MEDICINE ────────────────────────────────
    "## PRICING / COST OF MEDICINE\n"
    "When the user asks about the PRICE, COST, MRP, or pricing of any medicine or "
    "product — e.g. 'what is the price of X', 'how much does it cost', 'is it "
    "expensive' — do NOT attempt to quote a specific price or estimate it, even if "
    "some pricing info appears in the context.\n"
    "Instead, you MUST direct them to the official price list by including this "
    "exact link in your response: https://www.bluecrosslabs.com/dpco-2013-price-list/\n"
    "Write a concise, natural reply in your own words and vary the phrasing from turn "
    "to turn so it does not sound repetitive or scripted. Do not reuse the same "
    "sentence structure every time. You may say things like: 'Please refer to our "
    "official DPCO price list for the latest pricing details: "
    "https://www.bluecrosslabs.com/dpco-2013-price-list/', 'For current pricing, "
    "please check our official price list here: "
    "https://www.bluecrosslabs.com/dpco-2013-price-list/', or 'The most accurate "
    "and up-to-date pricing information is available in our official DPCO price list: "
    "https://www.bluecrosslabs.com/dpco-2013-price-list/'. Always preserve the link "
    "exactly as provided and include it once in a natural sentence.\n\n"

    # ── 3C2. CAREERS / JOB OPENINGS ───────────────────────────────────
    "## CAREERS / JOB OPENINGS / VACANCIES\n"
    "When the user asks about jobs, vacancies, current openings, careers, hiring, "
    "internships, fresher opportunities, or how to apply to / work at Blue Cross "
    "Laboratories — e.g. 'do you have a vacancy for freshers', 'are there any job "
    "openings', 'I have completed my BPharma, can I apply', 'where can I find current "
    "openings', 'how can I contact you about jobs':\n"
    f"  - ALWAYS guide them to the official Current Openings page: {CAREERS_URL} "
    "(include this exact link once, in a natural sentence).\n"
    "  - ALWAYS offer info@bluecrosslabs.com for further clarification or to confirm "
    "whether a specific role or fresher position is available.\n"
    "  - If the [RETRIEVED CONTEXT] lists specific openings, you may briefly mention "
    "them as currently listed on the page, with ONLY the requirements stated there "
    "(e.g. experience, qualification). Present them as what the page lists, not as a "
    "guarantee of hiring status.\n"
    "  - NEVER invent vacancies, job roles, eligibility criteria, salaries, internships, "
    "or hiring status, and never speculate about unlisted or entry-level roles. If the "
    "context does not mention fresher/entry-level roles, say plainly that the listed "
    "openings do not mention fresher positions and that the team can confirm by email.\n"
    "  - This rule OVERRIDES the NO-HALLUCINATION fallback for these questions: do NOT "
    "reply with 'I'm sorry, I don't have enough information…'. The page and email are "
    "always a valid, grounded answer, so set response_type to 'answer' (never "
    "'no_info'). Return empty product_ids and video_ids; put the [D#] tags of any "
    "career/opening chunks you used in source_ids.\n"
    "Keep the reply short and warm, and vary the wording from turn to turn.\n\n"

    # ── 3D. LISTING / ENUMERATING PRODUCTS ────────────────────────────
    "## LISTING / ENUMERATING PRODUCTS OR MEDICINES\n"
    "When the user asks you to LIST, NAME, ENUMERATE, SUGGEST, or give EXAMPLES "
    "or ALTERNATIVES of medicines or products — e.g. 'list me 10 examples of "
    "medicine', 'what "
    "medicines do you have', 'name some of your products', 'suggest some "
    "medicines', 'list me 10 meds', 'what can I take for fever and cough', "
    "'alternatives to X' — list ONLY Blue Cross Laboratories products found in "
    "the [RETRIEVED CONTEXT]: names in [P#] PRODUCT blocks, or in the "
    "'[Blue Cross product: …]' label of [D#] blocks. NEVER add any medicine "
    "or product from general knowledge, even if it is well known (e.g. "
    "cetirizine, paracetamol). If the context contains fewer products than "
    "the user asked for, list all that are present, state how many there "
    "are, and do NOT pad the list with anything else. If the context "
    "contains no products at all, respond that you don't have that "
    "information.\n"
    "- Format each item as the Blue Cross PRODUCT NAME (bold) followed by its "
    "composition — active ingredient(s) and strength — copied exactly as stated "
    "in the context, e.g. '**SOLITAIR Tablets** — Montelukast 10 mg + "
    "Levocetirizine 5 mg'. If the context gives no composition for a product, "
    "list the name only and say its composition isn't available here. Never "
    "guess a composition or strength.\n"
    "- NEVER answer with bare generic/salt names (e.g. 'Paracetamol', "
    "'Ibuprofen') as the list. A salt may appear only as the composition of a "
    "listed Blue Cross product.\n"
    "- Copy each product name exactly as it appears in the label or context. "
    "Never invent, alter, or combine product names or dosage forms.\n"
    "- If the user names a symptom, condition, or use, list a product ONLY when "
    "the context states it is used/indicated for that need — counting standard "
    "medical synonyms as the same need (e.g. 'high BP' = hypertension, "
    "'acidity'/'gastric problems' = acid-peptic disease/GERD, 'body ache' = "
    "pain); never imply a product helps with something the context doesn't say "
    "it treats. A "
    "condition mentioned only as a side effect, warning, or contraindication "
    "(e.g. 'alopecia' listed among adverse reactions) does NOT make the product "
    "a treatment for it. If the "
    "user names no need (e.g. 'list me 10 meds'), list Blue Cross products from "
    "the context, each with a short note of what it is used for if stated.\n"
    "- For 'alternatives to X', prefer Blue Cross products with a DIFFERENT "
    "composition used for the same purpose; other products with the same active "
    "ingredient may be listed only if you say they contain the same ingredient. "
    "Do not list X itself. Base 'same' vs 'different' ingredient ONLY on the "
    "compositions shown in the context — never claim a product has different "
    "active ingredients unless its composition in the context shows it.\n"
    "- If no relevant Blue Cross product is in the context, reply in one or two "
    "sentences that you couldn't find a Blue Cross product for that need, "
    "suggest consulting a healthcare professional, and offer "
    "info@bluecrosslabs.com — do not substitute generic medicines. Set "
    "response_type to 'answer' for this reply (not 'no_info').\n"
    "- Keep the usual advice to consult a healthcare professional. Put the "
    "[D#] tags you used in source_ids.\n"
    "Put the [P#] tag of EVERY product you list into product_ids. Never "
    "invent product names, image URLs, or video URLs.\n\n"

    # ── 4. INTERNAL TAGS ──────────────────────────────────────────────
    "## INTERNAL TAGS\n"
    "Context is tagged as [D1], [D2] (descriptive), [P1], [P2] (products), "
    "[V1], [V2] (videos). Tags go ONLY in structured fields, NEVER in the "
    "answer text:\n"
    "- product_ids: [P#] tags of recommended products ([] if none).\n"
    "- video_ids:   [V#] tags of recommended videos ([] if none).\n"
    "- source_ids:  [D#] tags of chunks used to ground the answer ([] if none).\n"
    "Only include tags that genuinely fit. Never invent product names, image "
    "URLs, or video URLs.\n\n"

    # ── 5. ANSWER TEXT FORMATTING ─────────────────────────────────────
    "## ANSWER TEXT FORMATTING\n"
    "Refer to products and videos by their real NAMES (e.g. 'Dolostat Gel'). "
    "NEVER write tag tokens like P1, V2, or D1 in the visible answer. "
    "The app attaches images and links from the structured id fields.\n\n"

    # ── 6. RESPONSE FORMATTING ────────────────────────────────────────
    "## RESPONSE FORMATTING\n"
    "Every response must be precise and crisp — not too long, not too short, "
    "just enough to fully answer the question and nothing more:\n"
    "- **Short answers**: plain prose (paragraphs), 1–3 sentences. No lists, no bold unless "
    "a term truly needs emphasis.\n"
    "- **Longer answers**: use bullet points to break up the content. Always insert a blank "
    "line before starting a list. Each bullet must be concise — one clear idea per bullet.\n"
    "- **Sequential steps**: use a numbered list, always with a blank line before starting.\n"
    "- **Bold** only product names, critical warnings, or key terms the user "
    "must not miss.\n"
    "- Never pad responses. If the full answer fits in two sentences, write "
    "two sentences.\n"
    "- **Answer strictly what was asked — nothing adjacent, even if it's in "
    "the context.** (See the COMPOSITION / INGREDIENT QUESTIONS rule above "
    "for the specific case of composition questions.) This applies more "
    "broadly too:\n"
    "  - 'dosage' → dose/frequency only, not storage or warnings.\n"
    "  - 'side effects' → side effects only, not contraindications or "
    "dosage.\n"
    "  - If truly unsure whether the user wants the fuller picture, answer "
    "the narrow question first and offer to share more "
    "(e.g. 'Let me know if you'd also like more detail.') rather than "
    "dumping everything.\n\n"

    # ── 7. PROACTIVE PRODUCTS & VIDEOS ───────────────────────────────
    "## PROACTIVE PRODUCTS & VIDEOS\n"
    "Do NOT wait for the user to ask. Whenever the [RETRIEVED CONTEXT] has a "
    "relevant product or video, include it every time it fits — proactively:\n"
    "- Health concern or symptom → include related product in product_ids and "
    "mention it by name in the answer.\n"
    "- Topic a video explains or demonstrates → include it in video_ids and "
    "mention it naturally (e.g. 'This video covers it well: [name].').\n"
    "- Both relevant → include both.\n"
    "- Neither relevant → return empty lists. Never force irrelevant items.\n\n"
    "Weave mentions naturally into the answer — not as an afterthought.\n\n"
    "### EXCEPTION — 'HOW/WHEN TO TAKE' & DOSAGE QUERIES ABOUT A NAMED PRODUCT\n"
    "This exception OVERRIDES the proactive rule above.\n"
    "When the user has already named a specific product and is only asking HOW "
    "or WHEN to use it — e.g. 'how and when to take Kyglip', 'how much X', "
    "'how often should I take X', or any dosage / timing / administration "
    "question — the user already knows the product, so a product card and a "
    "source citation add nothing and should be suppressed:\n"
    "- Return EMPTY product_ids AND EMPTY source_ids for these queries.\n"
    "- Answer the usage/dosage question in plain text only.\n"
    "- Populate video_ids ONLY if a video genuinely demonstrates the usage; "
    "otherwise leave it empty too.\n"
    "This applies only to usage/dosage/timing questions about an "
    "already-named product. Symptom- or concern-based questions still surface "
    "products normally per the rule above.\n\n"

    # ── 8. CONVERSATION SUMMARY ───────────────────────────────────────
    "## CONVERSATION SUMMARY\n"
    "Always produce conversation_summary: merge the previous summary with this "
    "turn into ONE plain-text string of 100–200 characters (no markdown, no "
    "line breaks, no 'Summary:' prefix). Prioritise the user's primary intent "
    "and the most recent exchange.\n\n"

    # ── 9. GREETINGS & CHIT-CHAT ──────────────────────────────────────
    "## GREETINGS & CHIT-CHAT\n"
    "Respond naturally and keep it conversational. Return empty product_ids, "
    "video_ids, and source_ids. Do not mention context or tags.\n\n"

    # ── 10. CLOSING THE CONVERSATION ──────────────────────────────────
    "## CLOSING THE CONVERSATION (read the whole chat history first)\n"
    "Closing signals: thanks / gratitude ('thanks', 'a lot of thanks', 'you are so "
    "kind'), acknowledgements with no new question ('ok', 'great', 'noted', 'same to "
    "you', 'I will email them now'), and farewells ('bye', 'take care', 'see you'). "
    "Treat them as signs the user is wrapping up — NOT as an invitation to keep "
    "chatting. Follow these steps:\n"
    "  1. FIRST closing signal (thanks / acknowledgement), and you have NOT yet asked "
    "the closing question in this chat: reply with a very short acknowledgement "
    "(a few words at most) followed by ONE closing question, e.g. 'Is there anything "
    "else I can help you with?'. Nothing else — no 'Have a great day', no 'feel free "
    "to reach out', no 'I'm here to help'. response_type: 'closing_question'.\n"
    "  2. END the chat with ONE brief, polite sign-off sentence (e.g. 'You're welcome "
    "— take care, goodbye!') when ANY of these is true: the user answers the closing "
    "question negatively ('no', 'nope', 'that's all', 'nothing else', 'no thanks'); "
    "the user says goodbye ('bye', 'take care'), even if you never asked the closing "
    "question; or the user sends ANOTHER thanks / acknowledgement after you already "
    "asked the closing question. The sign-off must NOT ask a question and must NOT "
    "invite them to reach out or ask more. response_type: 'farewell'.\n"
    "  3. If the user answers the closing question affirmatively WITHOUT saying what "
    "they need ('yes', 'yes please'), ask briefly what they would like help with "
    "(response_type 'chitchat'). If the user asks a real question at ANY point — "
    "even inside a thank-you, e.g. 'thanks! also, what is Dolostat gel?' — ignore "
    "these closing steps and answer it normally under all the rules above.\n"
    "Never repeat the same thank-you / you're-welcome / have-a-great-day phrases "
    "across turns. Use 'farewell' ONLY for the final sign-off — never for a reply "
    "that answers a question or asks one."
)

class ChatService:
    def __init__(
        self,
        retrieval: RetrievalService,
        llm: OpenAIChatProvider,
        sessions: SessionRepository,
        settings: Settings,
        config: ConfigRepository,
    ) -> None:
        self._retrieval = retrieval
        self._llm = llm
        self._sessions = sessions
        self._settings = settings
        self._config = config
        # Blue Cross catalog used only to verify multi-medicine answers:
        # brand key -> product_keys (light; warmed at startup), plus a per-brand
        # cache of full PI/PIL text fetched on demand for brands actually listed.
        self._brand_catalog: dict[str, set[str]] | None = None
        self._brand_texts: dict[str, str] = {}
        self._catalog_retry_at = 0.0

    async def warm_catalog(self) -> None:
        """Preload the brand catalog (called in the background at startup)."""
        await self._known_brands()

    async def _known_brands(self) -> dict[str, set[str]]:
        """Cached brand catalog. On failure returns {} and backs off 5 minutes."""
        if self._brand_catalog is None and time.monotonic() >= self._catalog_retry_at:
            try:
                products = await self._retrieval.pdf_product_catalog()
            except Exception as exc:  # noqa: BLE001 - verification degrades, never fails a turn
                self._catalog_retry_at = time.monotonic() + 300
                logger.warning("brand_catalog_load_failed", error=repr(exc))
                return {}
            catalog: dict[str, set[str]] = {}
            for name, product_keys in products.items():
                key = _brand_key(_display_product_name(name))
                if len(key) >= 3:
                    catalog.setdefault(key, set()).update(product_keys)
            self._brand_catalog = catalog
            logger.info("brand_catalog_loaded", brands=len(catalog))
        return self._brand_catalog or {}

    async def _catalog_for_answer(self, answer: str) -> dict[str, str]:
        """Brand key -> full PI/PIL text, for verifying ``answer``.

        Every catalog brand is present (so context mentions can be recognised); the
        full text is fetched (once, cached) only for brands the answer lists.
        """
        catalog = await self._known_brands()
        listed = {_brand_key(n) for n in _listed_names(answer)}
        wanted = [
            b for b in catalog if b not in self._brand_texts and any(
                k and (k.startswith(b) or (len(k) >= 4 and b.startswith(k))) for k in listed
            )
        ]
        results = await asyncio.gather(
            *(self._retrieval.pdf_texts_for_products(sorted(catalog[b])) for b in wanted),
            return_exceptions=True,
        )
        for brand, texts in zip(wanted, results, strict=True):
            if isinstance(texts, BaseException):  # fall back to retrieved context only
                logger.warning("brand_text_load_failed", brand=brand, error=repr(texts))
                continue
            self._brand_texts[brand] = "\n".join(t.lower() for t in texts)
        return {b: self._brand_texts.get(b, "") for b in catalog}

    @staticmethod
    def _is_price_question(text: str) -> bool:
        text = (text or "").lower()
        return bool(
            re.search(
                r"\b(?:price|pricing|cost|costs|mrp|amount|rate|rates|charge|charges|rupee|rupees|rs\.?|inr|₹)\b",
                text,
            )
        )

    @staticmethod
    def _is_price_range_question(text: str) -> bool:
        text = (text or "").lower()
        return bool(
            re.search(
                r"\b(?:range|price range|pricing range|approx(?:imate)?|around|about|estimate|estimated|roughly|atleast|at least|minimum|maximum)\b",
                text,
            )
        ) and ChatService._is_price_question(text)

    @staticmethod
    def _is_product_list_question(text: str) -> bool:
        return bool(_PRODUCT_LIST_RE.search(text or ""))

    @staticmethod
    def _is_multi_product_question(text: str) -> bool:
        return bool(_MULTI_PRODUCT_RE.search(text or ""))

    async def _verify_medicine_list(
        self,
        answer: str,
        descriptive_map: dict[str, dict],
        product_map: dict[str, dict],
        message: str,
        standalone: str,
    ) -> str:
        """Verify a multi-medicine answer; never fails a turn.

        1. Name check (deterministic): only real Blue Cross products stay.
        2. Relevance (LLM, synonym-aware): products not indicated for the user's need
           are dropped. If that check fails, every real product is kept.
        """
        if not (
            ChatService._is_multi_product_question(message)
            or ChatService._is_multi_product_question(standalone)
        ):
            return answer
        try:
            catalog = await self._catalog_for_answer(answer)
            checked = ChatService._verify_product_list(
                answer, descriptive_map, product_map, catalog
            )
            if checked == NO_PRODUCT_MATCH_MESSAGE:
                return checked
            candidates: dict[str, str] = {}
            for line in checked.splitlines():
                item = _LIST_ITEM.match(line)
                if item:
                    name = _item_name(item.group(1))
                    candidates[name] = ChatService._product_excerpt(name, catalog, descriptive_map)
            if not candidates:
                return checked
            # Judge against what the user typed THIS turn: 'list me 10 meds' or 'suggest
            # some medicines' name no need, so the model's list stands; a need inferred
            # from earlier turns (in the rewritten query) is not re-imposed.
            relevant = await self._llm.select_indicated_products(message, candidates)
            if relevant is None:
                return checked
            # Never drop a product whose documents give no indication statement to
            # judge by (e.g. a leaflet-only product): keep it.
            relevant |= {n for n, excerpt in candidates.items() if "indicated" not in excerpt}
            return ChatService._verify_product_list(
                checked, descriptive_map, product_map, catalog, relevant=relevant
            )
        except Exception as exc:  # noqa: BLE001 - verification is best-effort
            logger.exception("product_list_verification_failed", error=repr(exc))
            return answer

    @staticmethod
    def _product_excerpt(name: str, catalog: dict[str, str], descriptive_map: dict) -> str:
        """What a listed product is for: its PI/PIL indication passage, else a
        retrieved chunk that mentions it (e.g. a meftal.com page)."""
        key = _brand_key(name)
        with_text = [b for b in catalog if catalog[b]]
        # Exact brand first ('TUSQ-D' -> tusqd, never tusqdx), then the longest catalog
        # brand the name starts with ('MEFTAL-500' -> meftal), then a longer brand.
        candidates = (
            [b for b in with_text if b == key]
            or sorted((b for b in with_text if key.startswith(b)), key=len, reverse=True)
            or sorted((b for b in with_text if len(key) >= 4 and b.startswith(key)), key=len)
        )
        if candidates:
            return _indication_excerpt(catalog[candidates[0]])
        for payload in descriptive_map.values():
            text = payload.get("text") or ""
            if key and key in re.sub(r"[^a-z0-9]", "", text.lower()):
                return re.sub(r"\s+", " ", text)[:400]
        return ""

    @staticmethod
    def _verify_product_list(
        answer: str,
        descriptive_map: dict[str, dict],
        product_map: dict[str, dict],
        known_brands: dict[str, str] | None = None,
        relevant: set[str] | None = None,
    ) -> str:
        """Keep only listed items that are real (and, if given, relevant) Blue Cross products.

        A list item survives when its product name matches a Blue Cross product: a
        PI/PIL label or catalog product in the retrieved context, or a ``known_brands``
        catalog product (brand key -> PI/PIL text), e.g. one on a meftal.com page or
        from an earlier turn. With ``relevant`` (names confirmed by the relevance
        check), items not in it are removed too. Generic salts and misspelt names are
        removed; if nothing valid is left the reply becomes NO_PRODUCT_MATCH_MESSAGE.
        """
        texts_by_brand: dict[str, list[str]] = {}
        for payload in descriptive_map.values():
            if payload.get("pdf_type"):
                key = _brand_key(_display_product_name(payload.get("product_name")))
                if len(key) >= 3:
                    texts_by_brand.setdefault(key, []).append((payload.get("text") or "").lower())
        for payload in product_map.values():
            key = _brand_key(payload.get("product_name") or "")
            if len(key) >= 3:
                texts_by_brand.setdefault(key, []).append((payload.get("text") or "").lower())
        known_brands = known_brands or {}
        # Catalog brands described in non-PDF chunks (website pages) count too.
        for brand in known_brands:
            pattern = re.compile(
                r"\b" + r"[\s\-+®]*".join(re.escape(ch) for ch in brand) + r"\b", re.I
            )
            for payload in descriptive_map.values():
                text = payload.get("text") or ""
                if not payload.get("pdf_type") and pattern.search(text):
                    texts_by_brand.setdefault(brand, []).append(text.lower())
        if not texts_by_brand and not known_brands:
            return answer  # nothing to verify against

        def norm(name: str) -> str:
            return re.sub(r"[^a-z0-9]", "", (name or "").lower())

        relevant_norm = None if relevant is None else {norm(n) for n in relevant}

        def matching(name: str, keys) -> list[str]:
            listed = _brand_key(name)
            return [
                b for b in keys
                if listed and (listed.startswith(b) or (len(listed) >= 4 and b.startswith(listed)))
            ]

        def keep(name: str) -> bool:
            # A real Blue Cross product: in the retrieved context, or in the catalog
            # (e.g. surfaced in an earlier turn of the conversation).
            if not (matching(name, texts_by_brand) or matching(name, known_brands)):
                return False
            return relevant_norm is None or norm(name) in relevant_norm

        lines, kept_items, dropped = answer.splitlines(), 0, []
        out: list[str] = []
        for line in lines:
            item = _LIST_ITEM.match(line)
            if not item:
                out.append(line)
                continue
            name = _item_name(item.group(1))
            if keep(name):
                out.append(line)
                kept_items += 1
            else:
                dropped.append(name)
        if dropped:
            logger.info("product_list_items_dropped", dropped=dropped, kept=kept_items)

        if kept_items:
            return re.sub(r"\n{3,}", "\n\n", "\n".join(out)).strip()
        # No valid list items. Keep a prose answer only if it names a real, relevant
        # Blue Cross product; otherwise it is generic/unsupported -> clear no-match.
        names = [m.group(1) for m in _BOLD.finditer(answer)] + re.findall(
            r"\b[A-Z][A-Za-z0-9+]*(?:-[A-Za-z0-9+]+)*\b", answer
        )
        if not dropped and any(keep(n) for n in names):
            return answer
        return NO_PRODUCT_MATCH_MESSAGE

    @staticmethod
    def _is_careers_question(text: str) -> bool:
        return bool(_CAREERS_RE.search(text or ""))

    @staticmethod
    def _no_info_fallback(message: str, standalone: str) -> tuple[str, str]:
        """Return ``(answer, citations)`` for a no_info turn.

        Careers questions get the openings page + contact email instead of the
        generic refusal; every other no_info turn keeps the canonical refusal.
        """
        if ChatService._is_careers_question(message) or ChatService._is_careers_question(
            standalone
        ):
            return CAREERS_GUIDANCE_MESSAGE, CAREERS_URL
        return NO_INFO_MESSAGE, ""

    @staticmethod
    def _ensure_careers_link(
        answer: str, response_type: str | None, message: str, standalone: str
    ) -> str:
        """Guarantee a careers answer carries the openings page link.

        The prompt asks for the link; this covers the rare turn where the model
        says 'check our website' without it. Only answer/chitchat replies to
        careers questions are touched.
        """
        if response_type not in ("answer", "chitchat") or "bluecrosslabs.com/current-opening" in (
            answer or ""
        ):
            return answer
        if not (
            ChatService._is_careers_question(message)
            or ChatService._is_careers_question(standalone)
        ):
            return answer
        return f"{answer.rstrip()}\n\nYou can see all current openings here: {CAREERS_URL}"

    @staticmethod
    def _apply_closing(
        response_type: str | None, answer: str, prior_stage: str | None
    ) -> tuple[str, str | None, bool]:
        """Resolve the closing flow. Returns ``(answer, new_closing_stage, ended)``.

        The closing question is asked at most once: if the previous reply already
        asked it (or the chat already ended) and the model asks again, the reply
        becomes the final sign-off. Sign-offs are stripped of re-opening sentences.
        """
        if response_type == "closing_question" and prior_stage in ("asked", "ended"):
            response_type = "farewell"
            answer = random.choice(_FAREWELL_MESSAGES)
        if response_type == "farewell":
            cleaned = re.sub(r"\s{2,}", " ", _REOPENING_SENTENCE.sub("", answer)).strip()
            return cleaned or random.choice(_FAREWELL_MESSAGES), "ended", True
        if response_type == "closing_question":
            return answer, "asked", False
        return answer, None, False

    @staticmethod
    def _extract_price_product(text: str) -> str | None:
        text = (text or "").strip()
        for pattern in [
            r"\b(?:for|of|on)\s+([A-Za-z][A-Za-z0-9&\- ]{2,})",
            r"\b([A-Za-z][A-Za-z0-9&\- ]{2,})\s+pricing\b",
            r"\b([A-Za-z][A-Za-z0-9&\- ]{2,})\s+price\b",
        ]:
            match = re.search(pattern, text, flags=re.IGNORECASE)
            if match:
                product = match.group(1).strip()
                if 1 < len(product) <= 60:
                    return product
        return None

    @staticmethod
    def _build_price_reply(text: str, is_range: bool) -> str:
        product = ChatService._extract_price_product(text) or "that product"
        link = "https://www.bluecrosslabs.com/dpco-2013-price-list/"
        if is_range:
            templates = [
                "I don't have an official price range for {product} here — please check our DPCO price list for the most accurate details: {link}",
                "Sorry, I can't provide an official price range. Please refer to the DPCO price list for {product}: {link}",
                "For official pricing ranges, please consult our DPCO price list: {link}",
                "For the current pricing range, please visit our DPCO price list: {link}",
            ]
        else:
            templates = [
                "The most accurate and up-to-date pricing information for {product} is in our official DPCO price list: {link}",
                "For current pricing of {product}, please check our official DPCO price list here: {link}",
                "Please refer to our official DPCO price list for the latest pricing details: {link}",
                "Official prices are listed in our DPCO price list — you can view it here: {link}",
            ]
        return random.choice(templates).format(product=product, link=link)

    async def chat_count_metrics(
        self,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> ChatCountResponse:
        total_chats = await self._sessions.count_sessions(start_date, end_date)
        total_chat_messages = await self._sessions.count_sessions_messages(start_date, end_date)
        total_chat_minutes = await self._sessions.count_sessions_minutes(start_date, end_date)
        # minutes_of_meetings=await self._sessions.list_chat_json_by_session_id()
        return ChatCountResponse(
            total_chats=total_chats,
            total_chat_messages=total_chat_messages,
            total_chat_minutes=total_chat_minutes,
            # minutes_of_meetings=minutes_of_meetings
        )

    async def list_sessions(
        self,
        limit: int,
        offset: int,
        status: str | None,
        sort_by: str,
        sort_order: str,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> ChatSessionListResponse:
        # Auto-expire idle / over-duration sessions before listing so the status
        # reflects current state (max duration is the primary rule).
        max_minutes = await self._config.get_max_session_duration_minutes()
        await self._sessions.deactivate_stale(timedelta(minutes=max_minutes))
        total, sessions = await self._sessions.list_sessions(
            limit=limit,
            offset=offset,
            status=status,
            sort_by=sort_by,
            sort_order=sort_order,
            start_date=start_date,
            end_date=end_date,
        )
        items = [
            ChatSessionItem(
                session_id=s.session_id,
                started_at=s.started_at,
                ended_at=s.ended_at,
                duration_seconds=s.duration_seconds,
                is_active=s.is_active,
                message_count=len(s.chat_json),
                created_at=s.created_at,
                updated_at=s.updated_at,
            )
            for s in sessions
        ]
        return ChatSessionListResponse(total=total, limit=limit, offset=offset, sessions=items)

    async def list_chat_transcripts(self) -> ChatTranscriptsResponse:
        transcripts = await self._sessions.list_chat_json_by_session_id()
        return ChatTranscriptsResponse(transcripts=transcripts)

    async def delete_sessions(self, request: DeleteSessionsRequest) -> DeleteSessionsResponse:
        deleted = await self._sessions.delete_by_ids(request.session_ids)
        logger.info("sessions_deleted", deleted=deleted, requested=len(request.session_ids))
        return DeleteSessionsResponse(deleted=deleted, requested=len(request.session_ids))

    async def set_hcp_consent(self, session_id: str) -> SessionInfo | None:
        """Grant HCP consent for a session; returns the updated SessionInfo or None."""
        session = await self._sessions.set_hcp_consent(session_id)
        if session is None:
            return None
        logger.info("hcp_consent_granted", session_id=session_id)
        return SessionInfo(
            session_id=session.session_id,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_seconds=session.duration_seconds,
            is_active=session.is_active,
            hcp_consent=session.hcp_consent,
        )

    async def _product_gate(
        self,
        session: object | None,
        message: str,
        standalone: str,
        chat_history: list[dict],
        product_map: dict[str, dict],
    ) -> tuple[dict[str, int], bool, str | None]:
        """Identify the focused product, bump its per-session counter, decide gating.

        Returns ``(updated_counts, gated, focused_product)``. ``gated`` is True once
        the focused product exceeds ``PRODUCT_QUERY_LIMIT`` (i.e. the 6th+ question
        about it) — the caller then routes to email support instead of answering.
        """
        candidates = list(
            {p.get("product_name") for p in product_map.values() if p.get("product_name")}
        )
        focused = await self._llm.identify_product(
            message, standalone, chat_history, candidates
        )
        counts = dict(session.product_query_counts) if session is not None else {}
        gated = False
        if focused:
            counts[focused] = counts.get(focused, 0) + 1
            gated = counts[focused] > PRODUCT_QUERY_LIMIT
            logger.info(
                "product_query_counted",
                product=focused,
                count=counts[focused],
                gated=gated,
            )
        return counts, gated, focused

    async def _apply_pi_priority(
        self,
        standalone: str,
        descriptive_map: dict[str, dict],
        top_k: int,
    ) -> dict[str, dict]:
        """Prioritize the linked PI document over its PIL for a product question.

        If the retrieved descriptive context includes PI/PIL chunks, scope the
        context to the dominant product's PI chunks first; if the best PI chunk
        isn't relevant enough (``pi_relevance_threshold``), fall back to the linked
        PIL chunks. When no PI/PIL chunks are present the map is returned unchanged
        (existing blended behavior is preserved).
        """
        pipil = [
            (tag, p)
            for tag, p in descriptive_map.items()
            if p.get("pdf_type") in ("PI", "PIL")
        ]
        if not pipil:
            return descriptive_map

        target_key = max(pipil, key=lambda tp: tp[1].get("_score") or 0.0)[1].get("product_key")
        if not target_key:
            return descriptive_map

        # Dense-only (cosine) so `pi_top` is comparable to the cosine-calibrated
        # `pi_relevance_threshold`. Hybrid RRF scores would be rank-derived and make
        # the threshold meaningless (see HCP-consent note in answer_stream).
        pi_points = await self._retrieval.search(
            standalone, top_k, {"product_key": target_key, "pdf_type": "PI"}, hybrid=False
        )
        pi_top = (pi_points[0].score or 0.0) if pi_points else None
        pi_sufficient = pi_points and (pi_top or 0.0) >= self._settings.pi_relevance_threshold

        if pi_sufficient:
            chosen, used = pi_points, "PI"
        else:
            pil_points = await self._retrieval.search(
                standalone, top_k, {"product_key": target_key, "pdf_type": "PIL"}, hybrid=False
            )
            chosen = pil_points or pi_points
            used = "PIL" if pil_points else "PI"

        # Scoped search found nothing usable — keep the blended context rather than
        # dropping the PI/PIL chunks (preserves grounding, citations, and the PDF
        # signal the HCP gate depends on).
        if not chosen:
            logger.info("pi_pil_selection_empty", product_key=target_key)
            return descriptive_map

        logger.info(
            "pi_pil_selection", product_key=target_key, used=used, pi_top_score=pi_top
        )

        # Rebuild the descriptive map: keep non-PI/PIL descriptive chunks, then
        # append the chosen PI/PIL chunks, re-tagged D1, D2, … in order.
        rebuilt: dict[str, dict] = {}
        index = 0
        for _tag, payload in descriptive_map.items():
            if payload.get("pdf_type") in ("PI", "PIL"):
                continue
            index += 1
            rebuilt[f"D{index}"] = payload
        for point in chosen:
            payload = dict(point.payload or {})
            payload["_score"] = getattr(point, "score", None)
            index += 1
            rebuilt[f"D{index}"] = payload
        return rebuilt

    async def answer(self, request: ChatRequest) -> ChatResponse:
        # Capture arrival time BEFORE retrieval + LLM so a single-turn session records the
        # real time the turn took (otherwise started_at == ended_at and duration is 0).
        request_started_at = datetime.now(UTC)
        session_id = request.session_id or uuid.uuid4().hex
        top_k = request.top_k or self._settings.chat_retrieval_top_k

        # 1. LOAD. An unrecognised id (e.g. a stale one from the frontend) is treated
        #    as a brand-new conversation: mint a fresh id and start clean. The frontend
        #    replaces its stale id with the one echoed back in the response.
        session = await self._sessions.get_session(session_id)
        if request.session_id and session is None:
            logger.info("chat_session_replaced", stale_session_id=session_id)
            session_id = uuid.uuid4().hex
            session = None

        # 1a. MAX-DURATION GATE (primary rule). A known session older than the
        #     configured maximum is expired: mark it inactive and reject the
        #     message without running retrieval/LLM. The user must start a new
        #     session (refresh → no session_id → fresh conversation).
        if session is not None:
            max_minutes = await self._config.get_max_session_duration_minutes()
            started = session.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=UTC)
            if request_started_at - started >= timedelta(minutes=max_minutes):
                if session.is_active:
                    await self._sessions.mark_inactive(session_id)
                logger.info(
                    "chat_session_expired",
                    session_id=session_id,
                    max_session_duration_minutes=max_minutes,
                )
                return ChatResponse(
                    answer=SESSION_EXPIRED_MESSAGE,
                    session=SessionInfo(
                        session_id=session.session_id,
                        started_at=session.started_at,
                        ended_at=session.ended_at,
                        duration_seconds=session.duration_seconds,
                        is_active=False,
                        hcp_consent=session.hcp_consent,
                    ),
                    citations="",
                    products=[],
                    videos=[],
                )

        chat_history = session.chat_json if session is not None else []
        summary = session.conversation_summary if session is not None else None

        # 2. Rewrite for retrieval only (raw query is what we store/show).
        standalone = await self._llm.rewrite_standalone(request.message, summary, chat_history)

        if (
            ChatService._is_price_question(request.message)
            or ChatService._is_price_question(standalone)
        ):
            answer_text = ChatService._build_price_reply(
                request.message
                if ChatService._is_price_question(request.message)
                else standalone,
                ChatService._is_price_range_question(request.message)
                or ChatService._is_price_range_question(standalone),
            )

            session = await self._sessions.append_turn(
                session_id=session_id,
                user_query=request.message,
                assistant_content=answer_text,
                started_at=request_started_at,
            )
            return ChatResponse(
                answer=answer_text,
                session=SessionInfo(
                    session_id=session.session_id,
                    started_at=session.started_at,
                    ended_at=session.ended_at,
                    duration_seconds=session.duration_seconds,
                    is_active=session.is_active,
                    hcp_consent=session.hcp_consent,
                ),
                citations="",
                products=[],
                videos=[],
            )

        # 3. Retrieve (blended across doc types).
        logger.info(f"Standalone query generated: {standalone}")

        points = await self._retrieval.search(standalone, top_k)

        logger.info(f"Retrieved {len(points)} points from vector search")
        logger.debug(f"Retrieved points: {points}")
        descriptive_map, product_map, video_map = _split_by_type(points)

        # 3a0. PRODUCT-LIST QUERIES. The blended top-k rarely surfaces enough
        #     products for 'list me 10 examples of medicine' type queries, which
        #     is what tempts the model into padding the list from world
        #     knowledge (e.g. cetirizine). Re-run retrieval scoped to the
        #     product catalog and widen the context so every listed product is a
        #     real Blue Cross product.
        if ChatService._is_product_list_question(
            request.message
        ) or ChatService._is_product_list_question(standalone):
            logger.info(
                "product_list_query_detected",
                message=request.message,
                standalone=standalone,
            )
            product_points = await self._retrieval.search(
                standalone,
                max(top_k, self._settings.chat_product_list_top_k),
                {"doc_type": "product"},
            )
            _merge_products(product_map, product_points)

        # 3a1. PI-priority: prefer the linked PI document, fall back to its PIL.
        #      Skipped for multi-medicine requests, which it would narrow to ONE product.
        if not (
            ChatService._is_multi_product_question(request.message)
            or ChatService._is_multi_product_question(standalone)
        ):
            descriptive_map = await self._apply_pi_priority(standalone, descriptive_map, top_k)

        # 3a. PRODUCT QUERY GATE. If the user has asked > limit questions about the
        #     same product, stop answering in detail and route to email support.
        counts, product_gated, _focused = await self._product_gate(
            session, request.message, standalone, chat_history, product_map
        )
        if product_gated:
            session = await self._sessions.append_turn(
                session_id=session_id,
                user_query=request.message,
                assistant_content=EMAIL_SUPPORT_MESSAGE,
                started_at=request_started_at,
                product_query_counts=counts,
            )
            return ChatResponse(
                answer=EMAIL_SUPPORT_MESSAGE,
                session=SessionInfo(
                    session_id=session.session_id,
                    started_at=session.started_at,
                    ended_at=session.ended_at,
                    duration_seconds=session.duration_seconds,
                    is_active=session.is_active,
                    hcp_consent=session.hcp_consent,
                ),
                citations="",
                products=[],
                videos=[],
            )

        # 4. Build the prompt.
        prior_stage = getattr(session, "closing_stage", None) if session is not None else None
        messages = self._build_messages(
            request.message, chat_history, summary, descriptive_map, product_map, video_map,
            closing_stage=prior_stage,
        )

        # 5. LLM call.
        result = await self._llm.complete_structured(messages)
        # Strip any internal tags the model leaked into the visible answer text.
        answer = _sanitize_answer(result["answer"])
        new_summary = result["conversation_summary"]

        # 6. Resolve chosen tags -> grounded references (real URLs from payloads).
        products = _resolve_products(result["product_ids"], product_map)
        videos = _resolve_videos(result["video_ids"], video_map)
        # Citations reflect ACTUAL grounding: only the descriptive chunks the model
        # cited (source_ids) plus the page_urls of referenced products/videos. For
        # greetings/chit-chat all id lists are empty, so citations are empty too.
        source_tags = _normalize_tags(result.get("source_ids", []), "D")
        citations = _build_sources(descriptive_map, source_tags, products, videos)

        # 6a. GROUNDING GUARD. If the model flagged the answer as ungrounded
        #     (context lacks it), force the canonical refusal — never let a
        #     world-knowledge answer through. (Keyed on the declared type, not on
        #     empty ids, since valid dosage answers intentionally cite nothing.)
        if result.get("response_type") == "no_info":
            answer, citations = ChatService._no_info_fallback(request.message, standalone)
            products, videos = [], []
        answer = ChatService._ensure_careers_link(
            answer, result.get("response_type"), request.message, standalone
        )
        if result.get("response_type") == "answer":
            answer = await self._verify_medicine_list(
                answer, descriptive_map, product_map, request.message, standalone
            )

        # 6b. CLOSING. Ask the closing question at most once; a 'farewell' reply is
        #     the final sign-off: attach nothing and tell the client the chat ended.
        answer, closing_stage, conversation_ended = ChatService._apply_closing(
            result.get("response_type"), answer, prior_stage
        )
        if conversation_ended:
            products, videos, citations = [], [], ""

        # 7. SAVE (raw query + final answer).
        session = await self._sessions.append_turn(
            session_id=session_id,
            user_query=request.message,
            assistant_content=answer,
            summary=new_summary,
            started_at=request_started_at,
            product_query_counts=counts,
            closing_stage=closing_stage,
        )
        logger.info(
            "chat_turn_complete",
            session_id=session_id,
            products=len(products),
            videos=len(videos),
            citations=len(citations.split(", ")) if citations else 0,
        )

        return ChatResponse(
            answer=answer,
            session=SessionInfo(
                session_id=session.session_id,
                started_at=session.started_at,
                ended_at=session.ended_at,
                duration_seconds=session.duration_seconds,
                is_active=session.is_active,
                hcp_consent=session.hcp_consent,
            ),
            citations=citations,
            products=products,
            videos=videos,
            conversation_ended=conversation_ended,
        )

    async def answer_stream(self, request: ChatRequest) -> AsyncIterator[dict]:
        """Streaming variant of :meth:`answer` — yields SSE event dicts.

        Emits ``start`` -> ``delta``* -> ``done`` (or a single ``done`` for an
        expired session, or ``error`` on failure). Mirrors ``answer``'s
        load / expiry-gate / retrieve / resolve / persist logic so behaviour is
        identical, only delivered incrementally.
        """
        request_started_at = datetime.now(UTC)
        session_id = request.session_id or uuid.uuid4().hex
        top_k = request.top_k or self._settings.chat_retrieval_top_k

        try:
            # 1. LOAD + stale-id handling.
            session = await self._sessions.get_session(session_id)
            if request.session_id and session is None:
                logger.info("chat_session_replaced", stale_session_id=session_id)
                session_id = uuid.uuid4().hex
                session = None

            # 1a. MAX-DURATION GATE — expired session: one done event, no streaming.
            if session is not None:
                max_minutes = await self._config.get_max_session_duration_minutes()
                started = session.started_at
                if started.tzinfo is None:
                    started = started.replace(tzinfo=UTC)
                if request_started_at - started >= timedelta(minutes=max_minutes):
                    if session.is_active:
                        await self._sessions.mark_inactive(session_id)
                    logger.info(
                        "chat_session_expired",
                        session_id=session_id,
                        max_session_duration_minutes=max_minutes,
                    )
                    yield {
                        "type": "done",
                        "answer": SESSION_EXPIRED_MESSAGE,
                        "session": SessionInfo(
                            session_id=session.session_id,
                            started_at=session.started_at,
                            ended_at=session.ended_at,
                            duration_seconds=session.duration_seconds,
                            is_active=False,
                            hcp_consent=session.hcp_consent,
                        ).model_dump(mode="json"),
                        "citations": "",
                        "products": [],
                        "videos": [],
                    }
                    return

            chat_history = session.chat_json if session is not None else []
            summary = session.conversation_summary if session is not None else None

            # 2-4. Rewrite (retrieval only) -> retrieve -> build prompt.
            standalone = await self._llm.rewrite_standalone(
                request.message, summary, chat_history
            )
            # Streaming: use the shared price-detection logic and dynamic templates.
            if (
                ChatService._is_price_question(request.message)
                or ChatService._is_price_question(standalone)
            ):
                answer_text = ChatService._build_price_reply(
                    request.message
                    if ChatService._is_price_question(request.message)
                    else standalone,
                    ChatService._is_price_range_question(request.message)
                    or ChatService._is_price_range_question(standalone),
                )

                yield {
                    "type": "start",
                    "session_id": session_id,
                    "hcp_consent": bool(session is not None and session.hcp_consent),
                    "requires_consent": False,
                }
                yield {"type": "delta", "text": answer_text}
                session = await self._sessions.append_turn(
                    session_id=session_id,
                    user_query=request.message,
                    assistant_content=answer_text,
                    started_at=request_started_at,
                )
                yield {
                    "type": "done",
                    "answer": answer_text,
                    "session": SessionInfo(
                        session_id=session.session_id,
                        started_at=session.started_at,
                        ended_at=session.ended_at,
                        duration_seconds=session.duration_seconds,
                        is_active=session.is_active,
                        hcp_consent=session.hcp_consent,
                    ).model_dump(mode="json"),
                    "citations": "",
                    "products": [],
                    "videos": [],
                }
                return
            logger.info(f"Standalone query generated: {standalone}")
            points = await self._retrieval.search(standalone, top_k)
            logger.info(f"Retrieved {len(points)} points from vector search")

            # HCP-consent signal. Decided on a comparable COSINE scale via a dense-only
            # probe (the main `points` above come from hybrid/RRF search, whose scores
            # are rank-derived and cannot express relevance). Consent is required ONLY
            # when a PDF source is the MOST relevant source for this query — i.e. the
            # answer will actually be grounded in PDF (HCP) content. A weakly-related
            # PDF chunk that exists in the corpus but is out-ranked by a
            # descriptive/product/video chunk (e.g. "who is the vice chairman?") must
            # NOT trigger consent. Greetings/chit-chat stay below the floor too.
            consent_probe = await self._retrieval.search(standalone, top_k, hybrid=False)

            def _src(pt) -> str:
                return ((pt.payload or {}).get("source_url") or "").lower()

            pdf_top = max(
                ((pt.score or 0.0) for pt in consent_probe if _src(pt) == "pdf"),
                default=0.0,
            )
            other_top = max(
                ((pt.score or 0.0) for pt in consent_probe if _src(pt) != "pdf"),
                default=0.0,
            )
            retrieval_has_pdf = (
                pdf_top >= self._settings.pdf_consent_min_score and pdf_top >= other_top
            )

            descriptive_map, product_map, video_map = _split_by_type(points)

            # Product-list queries: widen context with catalog-scoped products so
            # the model only lists real Blue Cross products (see answer() 3a0).
            if ChatService._is_product_list_question(
                request.message
            ) or ChatService._is_product_list_question(standalone):
                logger.info(
                    "product_list_query_detected",
                    message=request.message,
                    standalone=standalone,
                )
                product_points = await self._retrieval.search(
                    standalone,
                    max(top_k, self._settings.chat_product_list_top_k),
                    {"doc_type": "product"},
                )
                _merge_products(product_map, product_points)

            # PI-priority: prefer the linked PI document, fall back to its PIL.
            # Skipped for multi-medicine requests (see answer() 3a1).
            if not (
                ChatService._is_multi_product_question(request.message)
                or ChatService._is_multi_product_question(standalone)
            ):
                descriptive_map = await self._apply_pi_priority(
                    standalone, descriptive_map, top_k
                )

            session_consented = bool(session is not None and session.hcp_consent)

            # 4a. PRODUCT QUERY GATE (before any token streams). Once the user has
            #     asked > limit questions about the same product, route to email
            #     support instead of a detailed answer. Never HCP-blurred.
            counts, product_gated, _focused = await self._product_gate(
                session, request.message, standalone, chat_history, product_map
            )
            if product_gated:
                yield {
                    "type": "start",
                    "session_id": session_id,
                    "hcp_consent": session_consented,
                    "requires_consent": False,
                }
                yield {"type": "delta", "text": EMAIL_SUPPORT_MESSAGE}
                session = await self._sessions.append_turn(
                    session_id=session_id,
                    user_query=request.message,
                    assistant_content=EMAIL_SUPPORT_MESSAGE,
                    started_at=request_started_at,
                    product_query_counts=counts,
                )
                yield {
                    "type": "done",
                    "answer": EMAIL_SUPPORT_MESSAGE,
                    "session": SessionInfo(
                        session_id=session.session_id,
                        started_at=session.started_at,
                        ended_at=session.ended_at,
                        duration_seconds=session.duration_seconds,
                        is_active=session.is_active,
                        hcp_consent=session.hcp_consent,
                    ).model_dump(mode="json"),
                    "citations": "",
                    "products": [],
                    "videos": [],
                }
                return

            prior_stage = (
                getattr(session, "closing_stage", None) if session is not None else None
            )
            messages = self._build_messages(
                request.message, chat_history, summary, descriptive_map, product_map, video_map,
                closing_stage=prior_stage,
            )

            # 5. Decide the HCP-consent gate BEFORE any token streams, using the
            #    pre-reshape retrieval signal above: if any retrieved chunk is
            #    PDF-sourced and the session hasn't consented, the answer must
            #    stream behind the blur from the first token.
            requires_consent = retrieval_has_pdf and not session_consented

            # 6. Stream the LLM answer; capture the final structured payload.
            yield {
                "type": "start",
                "session_id": session_id,
                "hcp_consent": session_consented,
                "requires_consent": requires_consent,
            }
            final: dict = {}
            # Multi-medicine answers are verified after generation (items can be
            # removed), so they are not streamed token-by-token: the client keeps its
            # typing indicator and shows the verified answer once, from `done` —
            # nothing appears and then disappears.
            stream_deltas = not (
                ChatService._is_multi_product_question(request.message)
                or ChatService._is_multi_product_question(standalone)
            )
            async for event in self._llm.stream_structured(messages):
                if "delta" in event:
                    if stream_deltas:
                        yield {"type": "delta", "text": event["delta"]}
                elif "final" in event:
                    final = event["final"]

            # 7. Resolve chosen tags -> grounded references (same as answer()).
            answer = _sanitize_answer(final.get("answer", ""))
            new_summary = final.get("conversation_summary")
            products = _resolve_products(final.get("product_ids", []), product_map)
            videos = _resolve_videos(final.get("video_ids", []), video_map)
            source_tags = _normalize_tags(final.get("source_ids", []), "D")
            citations = _build_sources(descriptive_map, source_tags, products, videos)

            # 7a. GROUNDING GUARD. If the model flagged the answer as ungrounded,
            #     force the canonical refusal (the model was instructed to stream
            #     that text for no_info, so the `done` answer stays consistent).
            if final.get("response_type") == "no_info":
                answer, citations = ChatService._no_info_fallback(request.message, standalone)
                products, videos = [], []
            answer = ChatService._ensure_careers_link(
                answer, final.get("response_type"), request.message, standalone
            )
            if final.get("response_type") == "answer":
                answer = await self._verify_medicine_list(
                    answer, descriptive_map, product_map, request.message, standalone
                )

            # 7b. CLOSING — same as answer() 6b.
            answer, closing_stage, conversation_ended = ChatService._apply_closing(
                final.get("response_type"), answer, prior_stage
            )
            if conversation_ended:
                products, videos, citations = [], [], ""

            # 8. SAVE (raw query + final answer).
            session = await self._sessions.append_turn(
                session_id=session_id,
                user_query=request.message,
                assistant_content=answer,
                summary=new_summary,
                started_at=request_started_at,
                product_query_counts=counts,
                closing_stage=closing_stage,
            )
            logger.info(
                "chat_turn_complete",
                session_id=session_id,
                products=len(products),
                videos=len(videos),
                citations=len(citations.split(", ")) if citations else 0,
            )

            yield {
                "type": "done",
                "answer": answer,
                "session": SessionInfo(
                    session_id=session.session_id,
                    started_at=session.started_at,
                    ended_at=session.ended_at,
                    duration_seconds=session.duration_seconds,
                    is_active=session.is_active,
                    hcp_consent=session.hcp_consent,
                ).model_dump(mode="json"),
                "citations": citations,
                "products": [p.model_dump(mode="json") for p in products],
                "videos": [v.model_dump(mode="json") for v in videos],
                "conversation_ended": conversation_ended,
            }
        except Exception as exc:  # noqa: BLE001 - always close the stream gracefully
            logger.exception("chat_stream_failed", error=str(exc))
            detail = (
                str(exc)
                if isinstance(exc, LLMError)
                else "Something went wrong while streaming the response."
            )
            yield {"type": "error", "detail": detail}

    def _build_messages(
        self,
        user_query: str,
        chat_history: list[dict],
        summary: str | None,
        descriptive_map: dict[str, dict],
        product_map: dict[str, dict],
        video_map: dict[str, dict],
        closing_stage: str | None = None,
    ) -> list[dict]:
        messages: list[dict] = [{"role": "system", "content": _SYSTEM_INSTRUCTIONS}]
        if summary:
            messages.append({"role": "system", "content": f"[CONVERSATION SUMMARY]\n{summary}"})

        window = self._settings.chat_history_window_turns * 2
        messages.extend((chat_history or [])[-window:])

        context = _format_context(descriptive_map, product_map, video_map)
        if context:
            messages.append({"role": "system", "content": f"[RETRIEVED CONTEXT]\n{context}"})

        if closing_stage in _CLOSING_STATE_NOTES:
            messages.append({"role": "system", "content": _CLOSING_STATE_NOTES[closing_stage]})

        messages.append({"role": "user", "content": user_query})
        return messages


def _merge_products(product_map: dict[str, dict], points: list) -> dict[str, dict]:
    """Append catalog product points whose name isn't already in the map.

    Used for product-list queries to widen the set of real Blue Cross products
    in context without duplicating names (existing P# tags stay stable).
    """
    seen = {p.get("product_name") for p in product_map.values()}
    for point in points:
        payload = dict(point.payload or {})
        name = payload.get("product_name")
        if not name or name in seen:
            continue
        payload["_score"] = getattr(point, "score", None)
        product_map[f"P{len(product_map) + 1}"] = payload
        seen.add(name)
    return product_map


def _split_by_type(points: list) -> tuple[dict[str, dict], dict[str, dict], dict[str, dict]]:
    """Split scored points into tagged descriptive/product/video maps (D#/P#/V#)."""
    descriptive_map: dict[str, dict] = {}
    product_map: dict[str, dict] = {}
    video_map: dict[str, dict] = {}
    for point in points:
        payload = dict(point.payload or {})
        payload["_score"] = getattr(point, "score", None)
        doc_type = payload.get("doc_type")
        if doc_type == "product":
            product_map[f"P{len(product_map) + 1}"] = payload
        elif doc_type == "video":
            video_map[f"V{len(video_map) + 1}"] = payload
        else:
            descriptive_map[f"D{len(descriptive_map) + 1}"] = payload
    return descriptive_map, product_map, video_map


def _format_context(
    descriptive_map: dict[str, dict], product_map: dict[str, dict], video_map: dict[str, dict]
) -> str:
    blocks: list[str] = []
    for tag, payload in descriptive_map.items():
        text = (payload.get("text") or "").strip()
        if text:
            # PI/PIL chunks often never name their product in the text itself, so
            # label them with the product they belong to (from the payload).
            label = _display_product_name(payload.get("product_name"))
            if payload.get("pdf_type") and label:
                blocks.append(f"[{tag}] [Blue Cross product: {label}] {text}")
            else:
                blocks.append(f"[{tag}] {text}")
    for tag, p in product_map.items():
        blocks.append(
            f"[{tag}] PRODUCT: {p.get('product_name', '')} "
            f"(category: {p.get('category') or 'n/a'}). {p.get('text', '')}"
        )
    for tag, v in video_map.items():
        blocks.append(
            f"[{tag}] VIDEO: {v.get('video_name', '')} "
            f"(category: {v.get('category') or 'n/a'}). {v.get('text', '')}"
        )
    return "\n\n".join(blocks)


def _normalize_tags(ids: list, prefix: str) -> set[str]:
    """Accept 'P1', 'p1', or bare '1' and normalise to the canonical tag set."""
    out: set[str] = set()
    for raw in ids or []:
        token = str(raw).strip().upper()
        if not token:
            continue
        out.add(token if token.startswith(prefix) else f"{prefix}{token}")
    return out


def _resolve_products(ids: list, product_map: dict[str, dict]) -> list[ProductReference]:
    tags = _normalize_tags(ids, "P")
    return [
        ProductReference(
            product_name=p.get("product_name", ""),
            category=p.get("category"),
            division=p.get("division"),
            image_url=p.get("image_url"),
            page_url=p.get("page_url"),
            score=p.get("_score"),
        )
        for tag, p in product_map.items()
        if tag in tags
    ]


def _resolve_videos(ids: list, video_map: dict[str, dict]) -> list[VideoReference]:
    tags = _normalize_tags(ids, "V")
    return [
        VideoReference(
            title=v.get("video_name", ""),
            video_url=v.get("video_url"),
            thumbnail_url=v.get("thumbnail_url"),
            category=v.get("category"),
            division=v.get("division"),
            page_url=v.get("page_url"),
            score=v.get("_score"),
        )
        for tag, v in video_map.items()
        if tag in tags
    ]


def _build_sources(
    descriptive_map: dict[str, dict],
    source_tags: set[str],
    products: list[ProductReference],
    videos: list[VideoReference],
) -> str:
    """Comma-separated, deduped page URLs the answer is actually grounded in.

    ``source_url`` only for the descriptive chunks the model cited via
    ``source_ids``, plus ``page_url`` for the referenced products/videos. Order
    preserved (descriptive → products → videos); empty URLs skipped; each page
    appears once. Hallucinated tags not in ``descriptive_map`` are ignored.
    """
    urls: list[str] = []
    seen: set[str] = set()

    def add(url: str | None) -> None:
        if url and url not in seen:
            seen.add(url)
            urls.append(url)

    for tag, payload in descriptive_map.items():
        if tag in source_tags:
            add(payload.get("source_url"))
    for product in products:
        add(product.page_url)
    for video in videos:
        add(video.page_url)

    return ", ".join(urls)


# Internal context tags (D#/P#/V#) the model occasionally leaks into prose despite
# the system prompt. Conservative: only bracketed/parenthesised forms and a trailing
# run of tags are stripped — bare inline tokens are left alone to avoid corrupting
# legitimate text.
_TAG = r"[DPV]\d+"
_BRACKETED_TAG = re.compile(rf"[\[(]\s*{_TAG}(?:\s*[,;]\s*{_TAG})*\s*[\])]")
_TRAILING_TAGS = re.compile(rf"(?:\s*[\[(]?{_TAG}[\])]?)+\s*$")


def _sanitize_answer(answer: str) -> str:
    """Strip stray internal tag tokens that leaked into the visible answer."""
    cleaned = _BRACKETED_TAG.sub("", answer)
    cleaned = _TRAILING_TAGS.sub("", cleaned)
    # Collapse multiple horizontal spaces into one, preserving newlines
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    # Remove horizontal space before punctuation
    cleaned = re.sub(r"[ \t]+([.,;:!?])", r"\1", cleaned)
    return cleaned.strip()
