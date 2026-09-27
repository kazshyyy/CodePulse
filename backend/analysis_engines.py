"""
CodePulse Analysis Engines
Each engine independently analyzes a code change and returns structured findings.
They are designed to run in parallel (simulating Bob subagents).
"""
import re
import time
import asyncio
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _make_finding(fid, severity, category, title, description, evidence="",
                  file_path="", line_start=None, line_end=None,
                  affected_component="", related_requirement="",
                  potential_impact="", suggested_fix="",
                  test_recommendation="", agent_source="") -> Dict:
    return {
        "finding_id": fid,
        "severity": severity,
        "category": category,
        "title": title,
        "description": description,
        "evidence": evidence,
        "file_path": file_path,
        "line_start": line_start,
        "line_end": line_end,
        "affected_component": affected_component,
        "related_requirement": related_requirement,
        "potential_impact": potential_impact,
        "suggested_fix": suggested_fix,
        "test_recommendation": test_recommendation,
        "validation_status": "open",
        "agent_source": agent_source,
    }


# ---------------------------------------------------------------------------
# Security Agent
# ---------------------------------------------------------------------------

SQL_INJECTION_PATTERNS = [
    re.compile(r'execute\s*\(\s*f["\']', re.I),
    re.compile(r'execute\s*\(\s*["\'].*%s.*["\']', re.I),
    re.compile(r'execute\s*\(\s*["\'].*\{.*\}.*["\']', re.I),
    re.compile(r'\.format\(.*\)', re.I),
]

HARDCODED_SECRET_PATTERNS = [
    re.compile(r'(?:password|secret|api_key|token|passwd|pwd)\s*=\s*["\'][^"\']{4,}["\']', re.I),
]

UNSAFE_DESERIALIZATION = [
    re.compile(r'pickle\.loads?\(', re.I),
    re.compile(r'yaml\.load\s*\([^,)]+\)', re.I),  # without Loader arg
]

UNSAFE_COMMAND = [
    re.compile(r'os\.system\s*\(.*[+%{]', re.I),
    re.compile(r'subprocess\.(call|run|Popen)\s*\(["\']', re.I),
]

PATH_TRAVERSAL = [
    re.compile(r'open\s*\(\s*(?:f["\']|["\'])[^"\']*\{', re.I),
    re.compile(r'open\s*\(.*\+.*\)', re.I),
]


def run_security_agent(changed_files: List[Dict], requirements: str, guidelines: str) -> List[Dict]:
    """Simulate Security Agent analysis."""
    time.sleep(0.05)  # Simulate work
    findings = []
    counter = [0]

    def fid():
        counter[0] += 1
        return f"DYN-SEC-{counter[0]:03d}"

    for cf in changed_files:
        path = cf.get("path", "")
        content = cf.get("after_content", "") or cf.get("content", "")
        lines = content.split("\n")

        for i, line in enumerate(lines, 1):
            stripped = line.strip()

            # SQL injection
            for pat in SQL_INJECTION_PATTERNS:
                if pat.search(line):
                    findings.append(_make_finding(
                        fid(), "HIGH", "Security",
                        "Potential SQL injection via string interpolation",
                        f"Line {i} of `{path}` constructs a SQL query using string formatting. "
                        "If any variable originates from user input, this is exploitable.",
                        evidence=stripped,
                        file_path=path, line_start=i, line_end=i,
                        affected_component="Database layer",
                        related_requirement="All user-controlled database input MUST use parameterized queries.",
                        potential_impact="Arbitrary data extraction, modification, or deletion.",
                        suggested_fix="Replace with a parameterized query using `?` placeholders.",
                        test_recommendation="Add a test with SQL metacharacter input and verify it doesn't affect results.",
                        agent_source="Security Agent",
                    ))
                    break

            # Hard-coded secrets
            for pat in HARDCODED_SECRET_PATTERNS:
                if pat.search(line):
                    findings.append(_make_finding(
                        fid(), "CRITICAL", "Security",
                        "Hard-coded credential detected",
                        f"A credential appears to be hard-coded at line {i} of `{path}`.",
                        evidence=stripped,
                        file_path=path, line_start=i, line_end=i,
                        affected_component="Configuration",
                        related_requirement="Credentials MUST NOT be hard-coded; use environment variables.",
                        potential_impact="Credential exposure via version control.",
                        suggested_fix="Use os.environ or a secrets manager.",
                        test_recommendation="Add a secret-scanning pre-commit hook.",
                        agent_source="Security Agent",
                    ))
                    break

            # Unsafe deserialization
            for pat in UNSAFE_DESERIALIZATION:
                if pat.search(line):
                    findings.append(_make_finding(
                        fid(), "CRITICAL", "Security",
                        "Unsafe deserialization (pickle/yaml without Loader)",
                        f"Line {i} uses unsafe deserialization. Attacker-controlled input can lead to RCE.",
                        evidence=stripped,
                        file_path=path, line_start=i, line_end=i,
                        affected_component="Deserialization",
                        related_requirement="Deserialization of untrusted data MUST use safe formats (JSON, not pickle).",
                        potential_impact="Remote code execution.",
                        suggested_fix="Replace with json.loads().",
                        test_recommendation="Test that pickle bytes raise an exception.",
                        agent_source="Security Agent",
                    ))
                    break

            # Unsafe command execution
            for pat in UNSAFE_COMMAND:
                if pat.search(line):
                    findings.append(_make_finding(
                        fid(), "HIGH", "Security",
                        "Potentially unsafe command execution",
                        f"Line {i} executes a system command. If arguments are user-controlled, this is an OS command injection.",
                        evidence=stripped,
                        file_path=path, line_start=i, line_end=i,
                        affected_component="Command execution",
                        related_requirement="Shell commands MUST NOT be constructed from user input.",
                        potential_impact="OS command injection / RCE.",
                        suggested_fix="Use an allowlist and subprocess.run with a list argument.",
                        test_recommendation="Test with traversal payloads that should raise ValueError.",
                        agent_source="Security Agent",
                    ))
                    break

    return findings


# ---------------------------------------------------------------------------
# Code Quality Agent
# ---------------------------------------------------------------------------

def run_code_quality_agent(changed_files: List[Dict], requirements: str, guidelines: str) -> List[Dict]:
    """Simulate Code Quality Agent analysis."""
    time.sleep(0.05)
    findings = []
    counter = [0]

    def fid():
        counter[0] += 1
        return f"DYN-CODE-{counter[0]:03d}"

    for cf in changed_files:
        path = cf.get("path", "")
        content = cf.get("after_content", "") or cf.get("content", "")
        lines = content.split("\n")

        # Check for missing docstrings
        func_lines = [(i + 1, l) for i, l in enumerate(lines) if re.match(r'\s*def ', l)]
        for lineno, fline in func_lines:
            fname = re.search(r'def\s+(\w+)', fline)
            fname_str = fname.group(1) if fname else "unknown"
            # Look ahead for docstring
            has_docstring = False
            for j in range(lineno, min(lineno + 3, len(lines))):
                if '"""' in lines[j] or "'''" in lines[j]:
                    has_docstring = True
                    break
            if not has_docstring and not fname_str.startswith("_"):
                findings.append(_make_finding(
                    fid(), "LOW", "Maintainability",
                    f"Missing docstring on `{fname_str}()`",
                    f"The function `{fname_str}` at line {lineno} of `{path}` has no docstring.",
                    evidence=fline.strip(),
                    file_path=path, line_start=lineno, line_end=lineno,
                    affected_component=fname_str,
                    related_requirement="Functions must have docstrings. (Coding Standards)",
                    suggested_fix=f'Add: """{fname_str} docstring."""',
                    agent_source="Code Quality Agent",
                ))

        # Check for bare except
        for i, line in enumerate(lines, 1):
            if re.match(r'\s*except\s*:', line):
                findings.append(_make_finding(
                    fid(), "MEDIUM", "Reliability",
                    "Bare except clause",
                    f"Line {i} of `{path}` uses a bare `except:` which catches all exceptions including KeyboardInterrupt.",
                    evidence=line.strip(),
                    file_path=path, line_start=i, line_end=i,
                    affected_component="Error handling",
                    related_requirement="No bare `except` clauses. (Coding Standards)",
                    suggested_fix="Catch a specific exception type, e.g. `except ValueError:`.",
                    agent_source="Code Quality Agent",
                ))

        # Check for print statements
        for i, line in enumerate(lines, 1):
            if re.match(r'\s*print\s*\(', line) and not line.strip().startswith("#"):
                findings.append(_make_finding(
                    fid(), "LOW", "Maintainability",
                    "print() statement in production code",
                    f"Line {i} of `{path}` uses `print()`. Use the `logging` module instead.",
                    evidence=line.strip(),
                    file_path=path, line_start=i, line_end=i,
                    affected_component="Logging",
                    related_requirement="No `print()` statements in production code. (Coding Standards)",
                    suggested_fix="Replace with logging.info() or logging.debug().",
                    agent_source="Code Quality Agent",
                ))

        # Check complexity (long functions)
        in_func = False
        func_start = 0
        func_name = ""
        func_lines_count = 0
        for i, line in enumerate(lines, 1):
            m = re.match(r'\s*def\s+(\w+)', line)
            if m:
                if in_func and func_lines_count > 40:
                    findings.append(_make_finding(
                        fid(), "MEDIUM", "Maintainability",
                        f"Function `{func_name}()` is too long ({func_lines_count} lines)",
                        f"`{func_name}` spans {func_lines_count} lines — consider splitting.",
                        file_path=path, line_start=func_start, line_end=i - 1,
                        affected_component=func_name,
                        suggested_fix="Refactor into smaller, single-responsibility functions.",
                        agent_source="Code Quality Agent",
                    ))
                in_func = True
                func_start = i
                func_name = m.group(1)
                func_lines_count = 0
            elif in_func:
                func_lines_count += 1

    return findings


# ---------------------------------------------------------------------------
# Testing Agent
# ---------------------------------------------------------------------------

def run_testing_agent(changed_files: List[Dict], test_files: List[Dict], requirements: str) -> List[Dict]:
    """Simulate Testing Agent analysis."""
    time.sleep(0.05)
    findings = []
    counter = [0]

    def fid():
        counter[0] += 1
        return f"DYN-TEST-{counter[0]:03d}"

    # Collect tested function names from test files
    tested_names = set()
    for tf in test_files:
        content = tf.get("content", "")
        for m in re.finditer(r'def\s+test_(\w+)', content):
            tested_names.add(m.group(1))

    for cf in changed_files:
        path = cf.get("path", "")
        if path.startswith("test") or "/test" in path:
            continue
        content = cf.get("after_content", "") or cf.get("content", "")
        func_names = [m.group(1) for m in re.finditer(r'def\s+(\w+)', content)]

        for fn in func_names:
            if fn.startswith("_"):
                continue
            # Check if any test references this function name
            covered = any(fn.lower() in t.lower() for t in tested_names)
            if not covered:
                findings.append(_make_finding(
                    fid(), "MEDIUM", "Testing",
                    f"No test coverage for `{fn}()`",
                    f"Function `{fn}` in `{path}` has no identifiable test coverage in the test suite.",
                    evidence=f"def {fn}(...)",
                    file_path=path, line_start=None, line_end=None,
                    affected_component=fn,
                    related_requirement="Test coverage must be ≥ 85%. (Coding Standards)",
                    potential_impact="Regressions in this function will not be caught by CI.",
                    suggested_fix=f"Add a unit test for `{fn}()` covering happy path and error cases.",
                    test_recommendation=f"Create `test_{fn}()` in the test suite.",
                    agent_source="Testing Agent",
                ))

    return findings


# ---------------------------------------------------------------------------
# Requirements Agent
# ---------------------------------------------------------------------------

def run_requirements_agent(changed_files: List[Dict], requirements: str, guidelines: str, documents: List[Dict]) -> List[Dict]:
    """Simulate Requirements Agent analysis — check implementation against stated requirements."""
    time.sleep(0.05)
    findings = []
    counter = [0]

    def fid():
        counter[0] += 1
        return f"DYN-REQ-{counter[0]:03d}"

    req_checks = [
        {
            "requirement": "All user-controlled database input MUST use parameterized queries.",
            "anti_pattern": re.compile(r'execute\s*\(\s*f["\']|execute\s*\(.*\.format', re.I),
            "title": "Parameterized query requirement violated",
            "severity": "HIGH",
        },
        {
            "requirement": "Credentials MUST NOT be hard-coded; use environment variables.",
            "anti_pattern": re.compile(r'(?:password|secret|api_key)\s*=\s*["\'][^"\']{4,}["\']', re.I),
            "title": "Hard-coded credential requirement violated",
            "severity": "CRITICAL",
        },
        {
            "requirement": "No `print()` statements in production code; use the `logging` module.",
            "anti_pattern": re.compile(r'^\s*print\s*\(', re.M),
            "title": "Logging requirement not met: print() used",
            "severity": "LOW",
        },
        {
            "requirement": "Functions must have docstrings.",
            "anti_pattern": re.compile(r'def\s+\w+[^:]+:\s*\n\s*(?![\'"]{3})', re.M),
            "title": "Missing docstrings violate coding standard",
            "severity": "LOW",
        },
    ]

    all_reqs = (requirements or "") + "\n" + (guidelines or "")

    for cf in changed_files:
        path = cf.get("path", "")
        if "/test" in path:
            continue
        content = cf.get("after_content", "") or cf.get("content", "")

        for check in req_checks:
            if check["anti_pattern"].search(content):
                # Only raise if the requirement appears to apply
                if check["requirement"].lower()[:20] in all_reqs.lower() or True:
                    findings.append(_make_finding(
                        fid(), check["severity"], "Requirements",
                        check["title"],
                        f"The implementation of `{path}` appears to violate the stated requirement: "
                        f'"{check["requirement"]}"',
                        file_path=path,
                        related_requirement=check["requirement"],
                        potential_impact="Non-compliance with documented project requirements.",
                        suggested_fix="Update the implementation to comply with the stated requirement.",
                        agent_source="Requirements Agent",
                    ))

    return findings


# ---------------------------------------------------------------------------
# Test Generator
# ---------------------------------------------------------------------------

def generate_tests_for_findings(findings: List[Dict], changed_files: List[Dict]) -> List[Dict]:
    """Generate skeleton test cases for high-severity findings."""
    tests = []
    for f in findings:
        if f["severity"] not in ("CRITICAL", "HIGH"):
            continue
        fid = f["finding_id"]
        fname = f.get("affected_component", "unknown").replace("()", "").replace("/", "_").lower()
        test_name = f"test_{fname}_{fid.lower().replace('-', '_')}"
        test_code = f'''import unittest

class Test_{fid.replace("-", "_")}(unittest.TestCase):
    """Generated test for finding {fid}: {f["title"]}"""

    def {test_name}(self):
        """
        Requirement: {f.get("related_requirement", "See finding.")}
        Finding: {f["title"]}
        """
        # TODO: implement based on recommendation:
        # {f.get("test_recommendation", "See finding details.")}
        self.skipTest("Generated skeleton — implement before running")

if __name__ == "__main__":
    unittest.main()
'''
        tests.append({
            "test_name": test_name,
            "test_code": test_code,
            "finding_id": fid,
            "status": "generated",
            "output": "",
        })
    return tests
