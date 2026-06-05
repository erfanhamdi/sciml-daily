# classify.py
import json
import time
import config

def load_instruction():
    """The fixed system-instruction block from prompts/classify.md."""
    t = config.PROMPT.read_text(encoding="utf-8")
    block = t[t.index("## SYSTEM INSTRUCTION"):t.index("## USER MESSAGE")]
    return block.split("\n", 1)[1].strip()           # drop the header line

def build_message(batch):
    lines = ['Classify each paper. Return a JSON array, one object per paper, '
             'in the same order, each with its "id".', ""]
    for i, p in enumerate(batch, 1):
        lines += [f"[{i}]", f"Title: {p['title']}", f"Abstract: {p['abstract']}",
                  f"Categories: {', '.join(p['categories'])}", ""]
    return "\n".join(lines)

def _parse(text):
    """DeepSeek returns a JSON array; tolerate stray code fences or an object wrapper."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.index("\n") + 1:] if "\n" in text else text
    data = json.loads(text)
    if isinstance(data, dict):                        # e.g. {"papers": [...]}
        data = next((v for v in data.values() if isinstance(v, list)), [])
    return data

def _apply(item, p):
    valid = set(config.TAGS)
    in_scope = bool(item.get("in_scope"))
    tags = [t for t in (item.get("tags") or []) if t in valid] if in_scope else []
    return {**p, "in_scope": in_scope, "tags": tags, "summary": str(item.get("summary", ""))[:600]}

def _index(item, pos):
    """Match a result to its paper by the model's echoed 1-based "id" when present, else by the
    array position (the prompt returns one object per paper, in order — and in practice omits id)."""
    try:
        return int(item["id"])
    except (KeyError, TypeError, ValueError):
        return pos

def _is_quota_error(e):
    s = str(e).lower()
    return any(k in s for k in ("insufficient balance", "402", "429", "rate limit", "quota",
                                "throttl", "too many requests", "serviceunavailable"))

def classify(papers, generate, instruction=None, sleep=time.sleep):
    """Classify papers in batches. Returns (results, requests_used).
    A balance/rate-limit error stops the run cleanly; any paper we never reach is simply
    not returned — it stays unseen and is retried on the next run."""
    instruction = instruction or load_instruction()
    done, used = [], 0
    total = (len(papers) + config.BATCH_SIZE - 1) // max(config.BATCH_SIZE, 1)
    for i in range(0, len(papers), config.BATCH_SIZE):
        if used >= config.MAX_REQUESTS:
            print(f"[classify] request cap ({config.MAX_REQUESTS}) hit; deferring {len(papers) - i} papers")
            break
        batch = papers[i:i + config.BATCH_SIZE]
        try:
            parsed = _parse(generate(instruction, build_message(batch)))
        except Exception as e:
            if _is_quota_error(e):
                print(f"[classify] stopped (balance/rate limit): {str(e)[:120]} — {len(papers) - i} papers deferred")
                break
            print(f"[classify] batch failed, skipping: {str(e)[:120]}")
            used += 1
            sleep(config.REQUEST_DELAY)
            continue
        by_pos = {_index(item, pos): item for pos, item in enumerate(parsed, 1) if isinstance(item, dict)}
        for j, p in enumerate(batch, 1):
            if j in by_pos:
                done.append(_apply(by_pos[j], p))
        used += 1
        kept = sum(1 for d in done if d["in_scope"])
        print(f"[classify] batch {used}/{total} · processed {len(done)}/{len(papers)} · in-scope {kept}")
        sleep(config.REQUEST_DELAY)
    return done, used

# Bedrock has no account-balance endpoint, so the maintainer cost signal is token usage instead:
# bedrock_generate accumulates per-call usage here, and bedrock_usage() reports the running total.
_USAGE = {"in": 0, "out": 0}

def bedrock_generate(instruction, message):
    """Real Bedrock call via the Converse API (not exercised by unit tests).
    DeepSeek-R1 returns its chain-of-thought as separate reasoningContent blocks; we keep only the
    final `text` blocks, which carry the JSON answer the prompt asks for."""
    import boto3
    client = boto3.client("bedrock-runtime", region_name=config.AWS_REGION)
    resp = client.converse(
        modelId=config.BEDROCK_MODEL,
        system=[{"text": instruction}],
        messages=[{"role": "user", "content": [{"text": message}]}],
        inferenceConfig={"maxTokens": config.MAX_TOKENS, "temperature": 0.0})
    u = resp.get("usage") or {}
    _USAGE["in"] += u.get("inputTokens", 0)
    _USAGE["out"] += u.get("outputTokens", 0)
    blocks = resp["output"]["message"]["content"]
    return "".join(b["text"] for b in blocks if "text" in b)

def bedrock_usage():
    """Running token total for the maintainer log (Bedrock's stand-in for a balance reading)."""
    return f"tokens in={_USAGE['in']} out={_USAGE['out']}"
