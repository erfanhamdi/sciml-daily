"""Single source of truth. The TAGS slugs must match prompts/classify.md."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
DOCS = ROOT / "docs"                       # GitHub Pages serves from here
PROMPT = ROOT / "prompts" / "classify.md"
TEMPLATES = ROOT / "templates"
STATIC = ROOT / "static"
PAPERS_FILE = DATA / "papers.json"         # the feed + the only "seen" record (dedup by id)
STATS_FILE = DATA / "stats.json"           # maintainer-only run log (not shown on the site)

# arXiv: generous but specific categories. Pulled in ONE daily RSS call (rss.arxiv.org), which
# lists exactly this mailing's new/cross-listed papers (~500/day across this set). Edit freely.
ARXIV_CATEGORIES = [
    "cs.LG", "cs.NA", "cs.AI", "cs.CL", "cs.CE", "stat.ML",
    "math.NA", "math.OC", "math.DS", "math.AP", "math.PR", "math-ph",
    "physics.comp-ph", "physics.flu-dyn", "eess.SY",
]
USER_AGENT = "sciml-daily/1.0 (+https://github.com/erfanhamdi/sciml-daily; mailto:erfan@bu.edu)"
# OpenReview-only date window (days): its notes span all submissions ever, so we keep only those
# created in the last couple days. arXiv needs no window — its RSS feed is already today's mailing.
FETCH_WINDOW_DAYS = 2

# OpenReview (set OPENREVIEW = False to skip)
OPENREVIEW = False
OPENREVIEW_VENUES = ["ICLR.cc/2026/Conference", "NeurIPS.cc/2025/Conference"]

# Bedrock — the only model (AWS-hosted DeepSeek via the Converse API). Bump these for new versions.
BEDROCK_MODEL = "us.deepseek.r1-v1:0"      # cross-region inference profile id (DeepSeek-R1 on Bedrock)
AWS_REGION = "us-east-1"                    # Bedrock region; must have the model enabled in the console
BATCH_SIZE = 20                            # papers per request (smaller than DeepSeek-direct: R1 reasoning eats output tokens)
MAX_TOKENS = 8192                          # generous output cap so a full batch is never truncated
MAX_REQUESTS = 200                         # per-run safety cap so a spike can't run up the bill
REQUEST_DELAY = 1.0                        # small gap between calls (avoids Bedrock throttling)

# Subfield tags: slug -> (display name, pill color). Keep slugs in sync with prompts/classify.md.
TAGS = {
    "operator-learning":                    ("Operator Learning",         "#6366f1"),
    "pde-foundation-models":                ("PDE Foundation Models",     "#0ea5e9"),
    "physics-informed-ml":                  ("Physics-Informed ML",       "#14b8a6"),
    "generative-simulation":                ("Generative Simulation",     "#ec4899"),
    "differentiable-simulation":            ("Differentiable Simulation", "#f59e0b"),
    "ml-numerical-methods":                 ("ML Numerical Methods",      "#8b5cf6"),
    "equation-discovery-dynamical-systems": ("Equation Discovery",        "#10b981"),
    "llm-agents-for-sci-computing":         ("LLM Agents for SciComp",    "#ef4444"),
    "uq-inverse-problems":                  ("UQ & Inverse Problems",     "#3b82f6"),
    "foundations":                          ("Foundations",               "#64748b"),
    "mathematical-analysis-of-llm":         ("Math Analysis of LLMs",     "#a855f7"),
}

# Prefilter keywords (lowercased substring match; recall-first, the LLM enforces precision).
KEYWORDS = [
    "neural operator", "fourier neural operator", "deeponet", "operator learning",
    "physics-informed", "physics informed", "pinn", "pino", "deep energy method",
    "differentiable simulation",
    "scientific machine learning", "scientific computing",
    "numerical method", "finite element",
    "preconditioner", "linear solver", "neural ode",
    "inverse problem",
    "uncertainty quantification", "gaussian process",
    "brittle fracture", "phase field modeling of fracture",
    "foundation model", "large language model", " llm", "llm coding benchmark", "finite element agent"
]

SITE_TITLE = "SciML Daily"
SITE_TAGLINE = "New papers in Scientific ML, AI for Scientific Computing & Applied Math — every morning."
SITE_URL = "https://erfanhamdi.github.io/sciml-daily"   # your Pages URL (canonical link)
