#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
find-save-prompt.py

用途：自动定位「未保存提示 / 关闭标签页 / 关闭窗口」相关代码，
      生成 save-prompt-context.txt（命中文件全文 + 行号），直接发给我即可。

用法：把本文件放到项目根目录，执行：
      python find-save-prompt.py
"""

import os
import re
import sys
from pathlib import Path

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT = Path(__file__).resolve().parent

# ---------------- 扫描配置 ----------------
SKIP_DIRS = {
    "node_modules", "dist", ".git", "target", "build", "out",
    "__pycache__", ".vscode", ".idea", ".svelte-kit", ".next",
}
SKIP_PREFIXES = ("src/comrak", "src/libs")        # 第三方库，跳过
TEXT_EXTS = {
    ".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".vue",
    ".rs", ".toml", ".json", ".html", ".css",
    ".bat", ".cmd", ".ps1", ".py",
}
MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_DUMP_LINES = 4000

# ---------------- 匹配规则：(名字, 正则, 权重) ----------------
RULES = [
    ("拦截关闭", r"onCloseRequested|CloseRequested|prevent_close|preventClose|api\.prevent|"
                 r"window\.close\s*\(|\.destroy\s*\(|close-requested", 6),
    ("确认弹窗", r"\bconfirm\s*\(|\bask\s*\(|MessageDialog|\bmessage\s*\(|"
                 r"plugin-dialog|plugin_dialog|\bdialog\b", 6),
    ("保存逻辑", r"saveFile|saveAs|save_file|saveDocument|saveCurrent|doSave|handleSave|"
                 r"writeTextFile|write_text|fs::write|File::create|invoke\(\s*['\"]save", 5),
    ("脏标记",   r"dirty|isDirty|modified|unsaved|hasUnsaved|needSave|_dirty|未保存", 5),
    ("中文文案", r"保存|取消|放弃|关闭|是否保存|不保存", 3),
    ("页面卸载", r"beforeunload|\bunload\b", 4),
    ("标签页",   r"closeTab|close_tab|removeTab|\btabs\b|activeTab|tabList", 2),
]

PATH_BONUS = [
    ("src/main.js", 15),
    ("src/toolbar.js", 12),
    ("src/core/", 8),
    ("src-tauri/src/lib.rs", 12),
    ("src-tauri/src/main.rs", 8),
    ("src-tauri/tauri.conf.json", 6),
    ("src-tauri/capabilities/", 4),
    ("package.json", 4),
]

# 无论是否命中，都附上的配置文件
FORCE_FILES = [
    "package.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/capabilities/default.json",
]

COMPILED = [(n, re.compile(rx, re.IGNORECASE | re.UNICODE), w) for n, rx, w in RULES]


def iter_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            p = Path(dirpath) / fn
            try:
                rel = p.relative_to(ROOT).as_posix()
            except ValueError:
                continue
            if any(rel.startswith(pre) for pre in SKIP_PREFIXES):
                continue
            if p.suffix.lower() not in TEXT_EXTS:
                continue
            try:
                if p.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            yield p, rel


def scan(p: Path, rel: str):
    try:
        text = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return None

    hits, score = [], 0
    for i, line in enumerate(text.splitlines(), 1):
        names, wsum = [], 0
        for name, rx, w in COMPILED:
            if rx.search(line):
                names.append(name)
                wsum += w
        if names:
            hits.append((i, "+".join(names), line.strip()[:220]))
            score += wsum

    if score == 0:
        return None

    for key, bonus in PATH_BONUS:
        if key in rel:
            score += bonus

    return {"path": p, "rel": rel, "score": score, "hits": hits}


def main():
    results = [r for r in (scan(p, rel) for p, rel in iter_files()) if r]
    results.sort(key=lambda r: (-r["score"], r["rel"]))

    print("=" * 78)
    print(f"扫描根目录: {ROOT}")
    print(f"命中文件数: {len(results)}")
    print("=" * 78)

    for idx, r in enumerate(results[:15], 1):
        print(f"\n[{idx:>2}] {r['rel']}    score={r['score']}  hits={len(r['hits'])}")
        for ln, tag, text in r["hits"][:8]:
            print(f"      L{ln:<5d} <{tag}> {text}")
        if len(r["hits"]) > 8:
            print(f"      ... 还有 {len(r['hits']) - 8} 处")

    # ---- 生成上下文文件 ----
    dump_paths = []
    for r in results[:12]:
        dump_paths.append(r["path"])
    for extra in FORCE_FILES:
        p = ROOT / extra
        if p.exists() and p not in dump_paths:
            dump_paths.append(p)

    out = ROOT / "save-prompt-context.txt"
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write("请分析以下代码中「未保存提示弹窗」的取消按钮行为。\n")
        f.write("需求：点击取消应放弃保存并继续关闭，而不是中止关闭。\n\n")
        for p in dump_paths:
            rel = p.relative_to(ROOT).as_posix()
            f.write("\n" + "=" * 74 + "\n")
            f.write(f"===== FILE: {rel} =====\n")
            f.write("=" * 74 + "\n")
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
            except Exception as e:
                f.write(f"<读取失败: {e}>\n")
                continue
            for i, line in enumerate(text.splitlines()[:MAX_DUMP_LINES], 1):
                f.write(f"{i:5d}| {line}\n")

    print("\n" + "=" * 78)
    print(f"已生成：{out.name}  （共 {len(dump_paths)} 个文件）")
    print("包含文件：")
    for p in dump_paths:
        print("  -", p.relative_to(ROOT).as_posix())
    print("=" * 78)
    print("把 save-prompt-context.txt 发给我即可。")


if __name__ == "__main__":
    main()