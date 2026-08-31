"""
check_boundaries.py

AST-based architectural boundary checker for the Mausam engine.

Enforces the rule from 14_implementation_blueprint.md §2 and 06_system_architecture.md §2:
  '/engine must not import fastapi, requests, sqlite3, or anything from
   /adapters, /backend, or /cache.'

Uses Python's ast module for accurate, parse-level analysis.  The previous
string-scan approach was brittle:
  - It missed imports inside functions or docstrings-with-code.
  - It could not distinguish comment lines from real code.
  - It could not handle dotted module paths (e.g. 'import http.client').

Usage
-----
  python check_boundaries.py            # Check engine/ directory
  python check_boundaries.py --self-test  # Plus run self-test proof

Exit codes
----------
  0  All clear.
  1  One or more violations found.
  2  Self-test failed (only with --self-test).

Milestone 1 Audit: F-03 hardening.
"""
from __future__ import annotations

import ast
import glob
import sys
import os
import tempfile


# ---------------------------------------------------------------------------
# Prohibited module roots — any import whose top-level module name is in this
# set (or begins with this prefix) is a boundary violation.
# ---------------------------------------------------------------------------

PROHIBITED_MODULES: frozenset[str] = frozenset([
    # Network / HTTP clients (engine must never make network calls)
    "requests",
    "httpx",
    "aiohttp",
    "urllib",          # catches urllib.request, urllib.parse, etc.
    "http",            # catches http.client, http.server, etc.

    # Web framework (engine must have zero framework deps)
    "fastapi",
    "starlette",
    "uvicorn",

    # Database / storage (engine must have zero I/O deps)
    "sqlite3",
    "sqlalchemy",
    "alembic",

    # Shell / process execution (never acceptable inside a pure function)
    "subprocess",

    # Internal package boundaries (relative paths handled separately)
    "adapters",
    "backend",
    "cache",
])

# Safe stdlib modules that share prefixes with potentially dangerous names.
# Not currently needed (we match exact root names) but kept as explicit
# documentation that these are NOT banned:
#   os, sys, math, re, json, datetime, dataclasses, typing, enum,
#   functools, copy, collections, abc, contextlib, pathlib, itertools

# Note: 'os' itself is NOT prohibited.  The architectural concern is
# side-effects (shell exec, network, filesystem writes), not the os module
# namespace.  Expression-level detection below handles os.system/os.popen.

# ---------------------------------------------------------------------------
# Dangerous call patterns — detected via AST attribute/call inspection.
# These are calls that constitute side-effects even without a top-level import.
# ---------------------------------------------------------------------------

DANGEROUS_CALLS: frozenset[str] = frozenset([
    "os.system",
    "os.popen",
    "os.exec",       # os.execv, os.execvp, etc. — matched by prefix
    "os.spawn",      # os.spawnl, etc.
    "eval",
    "exec",
    "compile",       # dynamic code compilation
    "__import__",    # dynamic import
])


# ---------------------------------------------------------------------------
# Visitor
# ---------------------------------------------------------------------------

class _BoundaryVisitor(ast.NodeVisitor):
    """Walk an AST and collect boundary violations."""

    def __init__(self, filepath: str) -> None:
        self.filepath = filepath
        self.violations: list[str] = []

    def _violation(self, lineno: int, message: str) -> None:
        self.violations.append(f"  {self.filepath}:{lineno}: {message}")

    # ---- Import statements -------------------------------------------------

    def _root_module(self, module_name: str) -> str:
        """Return the top-level package name of a dotted module path."""
        return module_name.split(".")[0] if module_name else ""

    def visit_Import(self, node: ast.Import) -> None:
        for alias in node.names:
            root = self._root_module(alias.name)
            if root in PROHIBITED_MODULES:
                self.violations.append(
                    f"  {self.filepath}:{node.lineno}: "
                    f"prohibited import: 'import {alias.name}'"
                )
            # Check absolute imports of internal packages (e.g. 'import backend.deps')
            if alias.name.startswith(("adapters.", "backend.", "cache.")):
                self.violations.append(
                    f"  {self.filepath}:{node.lineno}: "
                    f"prohibited cross-boundary import: 'import {alias.name}'"
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        # Relative imports (from .. import x) — these cross the engine boundary
        # only if the level is high enough to reach adapters/backend/cache.
        # We flag all upward relative imports out of the engine package as a
        # conservative policy; the engine should only import from within itself.
        if node.level and node.level > 0:
            # Level 1 (.) = same package = engine/ — OK.
            # Level 2 (..) = parent = project root — could reach adapters/backend/cache.
            if node.level >= 2:
                names = ", ".join(a.name for a in (node.names or []))
                self.violations.append(
                    f"  {self.filepath}:{node.lineno}: "
                    f"upward relative import (level {node.level}) may cross engine boundary: "
                    f"'from {'.' * node.level}{node.module or ''} import {names}'"
                )
            self.generic_visit(node)
            return

        module = node.module or ""
        root = self._root_module(module)
        if root in PROHIBITED_MODULES:
            names = ", ".join(a.name for a in (node.names or []))
            self.violations.append(
                f"  {self.filepath}:{node.lineno}: "
                f"prohibited import: 'from {module} import {names}'"
            )
        # Absolute internal package imports
        if module.startswith(("adapters.", "backend.", "cache.")) or module in ("adapters", "backend", "cache"):
            names = ", ".join(a.name for a in (node.names or []))
            self.violations.append(
                f"  {self.filepath}:{node.lineno}: "
                f"prohibited cross-boundary import: 'from {module} import {names}'"
            )
        self.generic_visit(node)

    # ---- Dangerous call expressions ----------------------------------------

    def visit_Call(self, node: ast.Call) -> None:
        """Detect dangerous runtime calls like os.system(), eval(), exec()."""
        func = node.func

        # Bare calls: eval(...), exec(...), __import__(...)
        if isinstance(func, ast.Name):
            if func.id in ("eval", "exec", "__import__", "compile"):
                self.violations.append(
                    f"  {self.filepath}:{node.lineno}: "
                    f"dangerous bare call: '{func.id}()' — dynamic code execution forbidden"
                )

        # Attribute calls: os.system(...), os.popen(...)
        if isinstance(func, ast.Attribute):
            if isinstance(func.value, ast.Name):
                qualified = f"{func.value.id}.{func.attr}"
                for danger in DANGEROUS_CALLS:
                    if qualified.startswith(danger):
                        self.violations.append(
                            f"  {self.filepath}:{node.lineno}: "
                            f"dangerous call: '{qualified}()' — process execution forbidden"
                        )
                        break

        self.generic_visit(node)


# ---------------------------------------------------------------------------
# Core checker
# ---------------------------------------------------------------------------

def check_file(filepath: str) -> list[str]:
    """Parse and check a single Python file. Returns list of violation strings."""
    try:
        with open(filepath, encoding="utf-8") as fh:
            source = fh.read()
    except OSError as exc:
        return [f"  {filepath}: could not read file: {exc}"]

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as exc:
        return [f"  {filepath}: syntax error — {exc}"]

    visitor = _BoundaryVisitor(filepath)
    visitor.visit(tree)
    return visitor.violations


def check_boundaries(engine_dir: str = "engine") -> bool:
    """
    Check all production Python files under engine_dir for boundary violations.

    Test files (engine/tests/*.py) are excluded — they are test infrastructure,
    not production modules, and are allowed to import test utilities such as
    subprocess, pathlib, etc.

    Returns True if all clear, False if any violations were found.
    """
    pattern = os.path.join(engine_dir, "**", "*.py")
    all_files = glob.glob(pattern, recursive=True)

    # Exclude files in any 'tests' subdirectory — these are test utilities,
    # not production engine code. The boundary rule from 14_...md §2 applies
    # to production engine modules only.
    sep = os.sep
    files = [
        f for f in all_files
        if f"{sep}tests{sep}" not in f
        and not f.endswith(f"{sep}tests")
        and "conftest" not in os.path.basename(f)
    ]

    if not files:
        print(f"WARNING: No production Python files found under '{engine_dir}/'")
        return True

    all_violations: list[str] = []
    for filepath in sorted(files):
        all_violations.extend(check_file(filepath))

    if all_violations:
        print(f"BOUNDARY CHECK FAILED — {len(all_violations)} violation(s) found:\n")
        for v in all_violations:
            print(v)
        print(
            "\nEngine production files must not import infrastructure packages (fastapi, requests,\n"
            "sqlite3, sqlalchemy, httpx, aiohttp, urllib, http, subprocess, adapters,\n"
            "backend, cache) or use dangerous patterns (eval, exec, os.system, etc.).\n"
            "See 14_implementation_blueprint.md §2 and 06_system_architecture.md §2.\n"
            f"(Test files under engine/tests/ are excluded from this check.)"
        )
        return False

    print(f"Boundary check passed — {len(files)} production file(s) checked, 0 violations.")
    return True


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

def run_self_test(engine_dir: str = "engine") -> bool:
    """
    Prove the checker detects a deliberately forbidden import.

    Creates a temporary .py file inside engine_dir with a known-bad import,
    verifies the checker catches it, then deletes the file.
    No persistent test artifact is left in the repository.
    """
    print("\nRunning self-test...")

    # Write a temp file with a clearly forbidden import
    tmp_path = os.path.join(engine_dir, "_boundary_selftest_DELETEME.py")
    bad_source = (
        "# THIS FILE IS GENERATED BY check_boundaries.py --self-test\n"
        "# It is deleted immediately after the self-test. Do not commit.\n"
        "import requests  # <- should be caught\n"
        "from fastapi import FastAPI  # <- should also be caught\n"
        "import os; os.system('echo bad')  # <- dangerous call\n"
    )

    try:
        with open(tmp_path, "w", encoding="utf-8") as fh:
            fh.write(bad_source)

        violations = check_file(tmp_path)

        if not violations:
            print("SELF-TEST FAILED: checker did NOT detect forbidden imports!")
            return False

        # Verify specific violations are present
        combined = "\n".join(violations)
        checks = [
            ("import requests", "requests" in combined),
            ("from fastapi import", "fastapi" in combined),
            ("os.system call", "os.system" in combined),
        ]
        failed_checks = [name for name, passed in checks if not passed]
        if failed_checks:
            print(f"SELF-TEST FAILED: missed violations: {failed_checks}")
            print("  Detected violations were:")
            for v in violations:
                print(v)
            return False

        print(f"Self-test PASSED: {len(violations)} violation(s) correctly detected.")
        for v in violations:
            print(v)
        return True

    finally:
        # Always clean up — no persistent artifact regardless of pass/fail
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f"Self-test artifact deleted: {tmp_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    self_test_mode = "--self-test" in sys.argv

    ok = check_boundaries()

    if self_test_mode:
        st_ok = run_self_test()
        if not st_ok:
            sys.exit(2)

    if not ok:
        sys.exit(1)
