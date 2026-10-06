#!/usr/bin/env python3
"""GB1 · CONTRACT.md -> CONTRACT.html, the same words on a Scintilla page.

The Markdown is the source (it is what the coordinator pastes to Grok Bot); the HTML is built from it so the two
cannot say different things. tests/grokbot-inbox.test.mjs fails if the page is older than the text.
Run:  python3 deliverables/20261005/gb1-grokbot-inbox/tools/build-contract-html.py   then   python3 scripts/inject-scnav.py
"""
import html, pathlib, re, hashlib

HERE = pathlib.Path(__file__).resolve().parent.parent
SRC = HERE / "CONTRACT.md"
OUT = HERE / "CONTRACT.html"

CSS = """
  :root{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }
  main{ max-width:1100px; margin:0 auto; padding:56px 16px 80px; }
  h1{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 10px; }
  h2{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:26px 0 8px; color:var(--ink); font-weight:600; border-top:1px solid var(--line); padding-top:16px; }
  h3{ font-size:14px; margin:20px 0 6px; color:var(--ink); font-weight:600; }
  p, li{ max-width:900px; } ul{ padding-left:18px; margin:8px 0; } li{ margin:4px 0; }
  b, strong{ color:var(--ink); font-weight:600; }
  code{ color:var(--ink); background:#18181d; padding:1px 4px; font-size:13px; overflow-wrap:anywhere; }
  pre{ background:var(--panel); border:1px solid var(--line); padding:12px 14px; overflow-x:auto; font-size:12px; line-height:1.5; color:var(--ink); margin:8px 0 10px; }
  pre code{ background:none; padding:0; font-size:12px; overflow-wrap:normal; }
  .tw{ overflow-x:auto; } table{ border-collapse:collapse; width:100%; min-width:640px; font-size:12px; margin:8px 0; }
  th, td{ border:1px solid var(--line); padding:7px 9px; text-align:left; vertical-align:top; }
  th{ color:var(--ink3); letter-spacing:.12em; text-transform:uppercase; font-weight:600; font-size:11px; background:var(--panel); }
  .src{ color:var(--ink3); font-size:12px; margin-top:28px; border-top:1px solid var(--line); padding-top:10px; overflow-wrap:anywhere; }
  h1, h3{ overflow-wrap:anywhere; }
"""


def inline(text):
    out = html.escape(text, quote=False)
    out = re.sub(r"`([^`]+)`", r"<code>\1</code>", out)
    out = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", out)
    return out


def render(md):
    lines, out, i = md.split("\n"), [], 0
    para, items = [], []

    def flush():
        nonlocal para, items
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>"); para = []
        if items:
            out.append("<ul>" + "".join("<li>" + inline(x) + "</li>" for x in items) + "</ul>"); items = []

    while i < len(lines):
        line = lines[i]
        if line.startswith("```"):
            flush(); block = []; i += 1
            while not lines[i].startswith("```"):
                block.append(lines[i]); i += 1
            out.append("<pre><code>" + html.escape("\n".join(block), quote=False) + "</code></pre>")
        elif line.startswith("|"):
            flush(); rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            i -= 1
            head, body = rows[0], rows[2:]
            out.append('<div class="tw"><table><tr>' + "".join("<th>" + inline(c) + "</th>" for c in head) + "</tr>" +
                       "".join("<tr>" + "".join("<td>" + inline(c) + "</td>" for c in r) + "</tr>" for r in body) + "</table></div>")
        elif re.match(r"#{1,3} ", line):
            flush(); n = len(line.split(" ")[0])
            out.append("<h%d>%s</h%d>" % (n, inline(line[n + 1:]), n))
        elif line.startswith("- "):
            if para: flush()
            items.append(line[2:])
        elif line.startswith("  ") and items:
            items[-1] += " " + line.strip()
        elif not line.strip():
            flush()
        else:
            if items: flush()
            para.append(line.strip())
        i += 1
    flush()
    return "\n".join(out)


def build():
    md = SRC.read_text()
    sha = hashlib.sha256(md.encode()).hexdigest()
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
            '<title>GB1 · Grok Bot inbox contract · 5 Oct 2026</title>\n<style>' + CSS + '</style>\n</head>\n<body>\n<main>\n'
            + render(md) +
            '\n<p class="src">Built from CONTRACT.md (the text the coordinator pastes to Grok Bot) · source sha256 '
            '<span data-contract-sha>' + sha + '</span> · every example on this page is run through the function in the tests.</p>'
            '\n</main>\n</body>\n</html>\n')


if __name__ == "__main__":
    OUT.write_text(build())
    print("wrote", OUT)
