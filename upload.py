import msvcrt
import os
import shutil
import subprocess
import sys
import time

TYPES = [
    ("feat",     "新功能"),
    ("fix",      "修复 Bug"),
    ("docs",     "文档"),
    ("style",    "代码格式（不影响逻辑）"),
    ("refactor", "重构"),
    ("perf",     "性能优化"),
    ("test",     "测试相关"),
    ("chore",    "杂项 / 工具"),
    ("ci",       "CI 配置"),
    ("build",    "构建系统"),
    ("revert",   "回滚"),
    ("feat!",    "新功能（破坏性变更）"),
    ("fix!",     "修复（破坏性变更）"),
]

PUSH_URL = "https://github.com/TanJikun/markdown-looker.git"
BRANCH = "main"
REMOTE = "origin"


class Cancelled(Exception):
    pass


def setup():
    for s in (sys.stdout, sys.stderr):
        if hasattr(s, "reconfigure"):
            try:
                s.reconfigure(encoding="utf-8")
            except Exception:
                pass
    if os.name == "nt":
        os.system("")  # 激活 ANSI 转义序列


def read_key():
    ch = msvcrt.getch()
    if ch in (b"\xe0", b"\x00"):
        ch2 = msvcrt.getch()
        return {"H": "up", "P": "down", "K": "left", "M": "right"}.get(
            ch2.decode("latin-1", "ignore"), "other"
        ), None
    if ch == b"\r":
        return "enter", None
    if ch == b"\x1b":
        return "esc", None
    if ch == b"\x03":
        return "ctrl_c", None
    if b"1" <= ch <= b"9":
        return "num", int(ch)
    return "char", ch


def build_menu(selected):
    lines = []
    for i, (t, desc) in enumerate(TYPES):
        num = f"{i + 1:>2}." if i < 9 else "   "
        if i == selected:
            lines.append(f"\x1b[7m > {num} {t:<9s} {desc}\x1b[0m")
        else:
            lines.append(f"   {num} {t:<9s} {desc}")
    return "\n".join(lines) + "\n"


def select_type():
    sys.stdout.write("\x1b[2J\x1b[H")
    sys.stdout.write("\x1b[1m=== Markdown Looker 提交工具 ===\x1b[0m\n")
    sys.stdout.write(
        "↑/↓ 选择类型，数字键 1-9 直选（主键盘/小键盘均可），Enter 确认，Esc 取消\n\n"
    )
    sys.stdout.write(build_menu(0))
    sys.stdout.flush()

    total = len(TYPES)
    selected = 0
    while True:
        k, v = read_key()
        if k == "up":
            selected = (selected - 1) % total
        elif k == "down":
            selected = (selected + 1) % total
        elif k == "num" and 1 <= v <= min(9, total):
            selected = v - 1
            sys.stdout.write(f"\x1b[{total}A\x1b[J")
            sys.stdout.write(build_menu(selected))
            sys.stdout.flush()
            return TYPES[selected]
        elif k == "enter":
            return TYPES[selected]
        elif k in ("esc", "ctrl_c"):
            raise Cancelled()
        else:
            continue
        sys.stdout.write(f"\x1b[{total}A\x1b[J")
        sys.stdout.write(build_menu(selected))
        sys.stdout.flush()


def flush_kb():
    while msvcrt.kbhit():
        msvcrt.getch()


def confirm(prompt, default=True):
    sys.stdout.write(prompt + (" [Y/n] " if default else " [y/N] "))
    sys.stdout.flush()
    while True:
        ch = msvcrt.getch()
        if ch in (b"\r", b"\n"):
            sys.stdout.write("Y\n" if default else "N\n")
            return default
        if ch in (b"y", b"Y"):
            sys.stdout.write("y\n")
            return True
        if ch in (b"n", b"N"):
            sys.stdout.write("n\n")
            return False
        if ch == b"\x03":
            raise Cancelled()


def run(cmd):
    sys.stdout.write(f"\n\x1b[36m$ {' '.join(cmd)}\x1b[0m\n")
    sys.stdout.flush()
    try:
        return subprocess.run(cmd).returncode
    except FileNotFoundError:
        sys.stdout.write(f"\x1b[31m找不到命令：{cmd[0]}\x1b[0m\n")
        return 127


def _norm_url(u):
    u = u.strip()
    if u.endswith(".git"):
        u = u[:-4]
    u = u.lower()
    u = u.replace("git@github.com:", "https://github.com/")
    u = u.replace("ssh://git@github.com/", "https://github.com/")
    return u


def ensure_origin():
    r = subprocess.run(["git", "remote", "get-url", REMOTE],
                       capture_output=True, text=True)
    if r.returncode != 0:
        subprocess.run(["git", "remote", "add", REMOTE, PUSH_URL], check=True)
        sys.stdout.write(f"\x1b[33m已添加 remote {REMOTE} -> {PUSH_URL}\x1b[0m\n")
        return
    url = r.stdout.strip()
    if _norm_url(url) != _norm_url(PUSH_URL):
        raise RuntimeError(
            f"remote {REMOTE} 指向 {url}，与预期 {PUSH_URL} 不一致，请手动检查"
        )


def check_gh():
    if shutil.which("gh") is None:
        raise RuntimeError(
            "未找到 gh 命令，请先安装 GitHub CLI（https://cli.github.com/）并执行 gh auth login"
        )
    r = subprocess.run(["gh", "auth", "status"], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError("gh 未登录或认证失效，请先执行 gh auth login")


def get_current_branch():
    r = subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"],
                       capture_output=True, text=True)
    return r.stdout.strip()


def has_changes():
    r = subprocess.run(["git", "status", "--porcelain"],
                       capture_output=True, text=True)
    return bool(r.stdout.strip())


def run_flow():
    if shutil.which("git") is None:
        raise RuntimeError("未找到 git 命令，请确认已安装并加入 PATH")
    check_gh()

    type_str, type_desc = select_type()
    sys.stdout.write(f"\n\x1b[32m已选择类型：\x1b[0m {type_str}  ({type_desc})\n")

    flush_kb()
    sys.stdout.write("\n请输入提交描述（如 add dark mode）：")
    sys.stdout.flush()
    try:
        desc = input().strip()
    except (EOFError, KeyboardInterrupt):
        raise Cancelled()
    if not desc:
        desc = "update"

    msg = f"{type_str}: {desc}"
    sys.stdout.write(f"\n完整提交信息：\x1b[1m{msg}\x1b[0m\n")

    flush_kb()
    if not confirm("确认执行「拉取 main → 新建分支 → 提交 → 推送 → 创建并合并 PR」？"):
        raise Cancelled()

    ensure_origin()

    cur = get_current_branch()
    if cur != BRANCH:
        if has_changes():
            raise RuntimeError(
                f"当前在 {cur} 分支且有未提交变更，请先切换到 {BRANCH} 分支再运行"
            )
        if run(["git", "checkout", BRANCH]) != 0:
            raise RuntimeError(f"切换到 {BRANCH} 分支失败")

    sys.stdout.write(f"\n\x1b[36m[1/6] 拉取远程 {BRANCH}...\x1b[0m\n")
    if run(["git", "pull", "--ff-only", REMOTE, BRANCH]) != 0:
        raise RuntimeError("git pull 失败（本地 main 与远程不一致，请手动处理后再运行）")

    ts = time.strftime("%Y%m%d-%H%M%S")
    safe_type = type_str.replace("!", "-breaking")
    branch_name = f"auto/{safe_type}-{ts}"

    sys.stdout.write(f"\n\x1b[36m[2/6] 创建临时分支 {branch_name}...\x1b[0m\n")
    if run(["git", "checkout", "-b", branch_name]) != 0:
        raise RuntimeError("创建临时分支失败")

    sys.stdout.write("\n\x1b[36m[3/6] 提交变更...\x1b[0m\n")
    if run(["git", "add", "."]) != 0:
        run(["git", "checkout", BRANCH])
        run(["git", "branch", "-D", branch_name])
        raise RuntimeError("git add 失败")
    if run(["git", "commit", "-m", msg]) != 0:
        run(["git", "checkout", BRANCH])
        run(["git", "branch", "-D", branch_name])
        raise RuntimeError("git commit 失败（可能没有变更，或钩子拒绝）")

    sys.stdout.write("\n\x1b[36m[4/6] 推送临时分支...\x1b[0m\n")
    if run(["git", "push", "-u", REMOTE, branch_name]) != 0:
        run(["git", "checkout", BRANCH])
        run(["git", "branch", "-D", branch_name])
        raise RuntimeError("推送临时分支失败")

    sys.stdout.write("\n\x1b[36m[5/6] 创建 Pull Request...\x1b[0m\n")
    pr_body = (
        f"自动提交：{msg}\n\n"
        "本 PR 由上传脚本自动创建并 squash 合并，用于生成 GitHub 发行说明。"
    )
    if run(["gh", "pr", "create",
            "--base", BRANCH,
            "--head", branch_name,
            "--title", msg,
            "--body", pr_body]) != 0:
        raise RuntimeError(
            f"创建 PR 失败。分支 {branch_name} 已推送，可手动在网页创建 PR"
        )

    sys.stdout.write("\n\x1b[36m[6/6] squash 合并 PR...\x1b[0m\n")
    if run(["gh", "pr", "merge", branch_name,
            "--squash", "--delete-branch"]) != 0:
        raise RuntimeError(
            f"合并 PR 失败。分支 {branch_name} 的 PR 已创建，请手动在网页合并"
        )

    # 合并后同步本地 main
    run(["git", "checkout", BRANCH])
    if run(["git", "pull", "--ff-only", REMOTE, BRANCH]) != 0:
        sys.stdout.write("\x1b[33m警告：合并后拉取 main 失败，请手动执行 git pull\x1b[0m\n")

    # ---- 可选：本地打标签并推送（供网页端创建 Release 时选择）----
    flush_kb()
    sys.stdout.write("\n请输入本次发布的版本标签（直接回车跳过，例如 v1.2.0）：")
    sys.stdout.flush()
    try:
        tag = input().strip()
    except (EOFError, KeyboardInterrupt):
        tag = ""

    if tag:
        exist = subprocess.run(
            ["git", "tag", "-l", tag], capture_output=True, text=True
        ).stdout.strip()
        if exist:
            sys.stdout.write(f"\x1b[33m标签 {tag} 已存在，跳过\x1b[0m\n")
        elif run(["git", "tag", tag]) == 0:
            if run(["git", "push", REMOTE, tag]) == 0:
                sys.stdout.write(f"\x1b[32m标签 {tag} 已推送到远程\x1b[0m\n")
            else:
                sys.stdout.write(f"\x1b[33m标签 {tag} 推送失败\x1b[0m\n")
        else:
            sys.stdout.write(f"\x1b[33m创建标签 {tag} 失败\x1b[0m\n")

    sys.stdout.write("\n\x1b[32m✔ 全部完成（PR 已 squash 合并）\x1b[0m\n")


def main():
    setup()
    try:
        run_flow()
    except Cancelled:
        sys.stdout.write("\n\x1b[33m已取消\x1b[0m\n")
    except RuntimeError as e:
        sys.stdout.write(f"\n\x1b[31m✘ {e}\x1b[0m\n")
    except Exception as e:
        sys.stdout.write(f"\n\x1b[31m✘ 未预期错误：{e}\x1b[0m\n")
    finally:
        sys.stdout.write("\n")
        sys.stdout.flush()
        flush_kb()
        try:
            input("按 Enter 键关闭窗口...")
        except (EOFError, KeyboardInterrupt):
            pass


if __name__ == "__main__":
    main()