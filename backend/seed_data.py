"""
Demo / sample data loader for CodePulse.
Creates a realistic project with source files, documents, and a complete review.
"""
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from models import Project, Review, Finding, Document, RepoFile, FileDiff, GeneratedTest


SAMPLE_BEFORE_CODE = '''import sqlite3
import subprocess
import os


def get_user(username):
    """Fetch user record from the database."""
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    # WARNING: raw string interpolation – SQL injection risk
    query = f"SELECT * FROM users WHERE username = \\'{username}\\'"
    cursor.execute(query)
    row = cursor.fetchone()
    conn.close()
    return row


def run_report(report_name):
    """Run a named report script."""
    # WARNING: unsanitized command execution
    os.system(f"python reports/{report_name}.py")


def read_file(filename):
    """Read a file from the uploads directory."""
    # WARNING: path traversal – no canonicalization
    path = f"uploads/{filename}"
    with open(path, "r") as f:
        return f.read()


DB_PASSWORD = "SuperSecret123!"   # WARNING: hard-coded credential


def deserialize_payload(data):
    import pickle
    # WARNING: unsafe deserialization
    return pickle.loads(data)


def delete_user(user_id):
    """Delete a user – no authorization check."""
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    # WARNING: no authorization / audit trail
    cursor.execute(f"DELETE FROM users WHERE id = {user_id}")
    conn.commit()
    conn.close()
'''

SAMPLE_AFTER_CODE = '''import sqlite3
import subprocess
import os
import hashlib


def get_user(username):
    """Fetch user record from the database."""
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    query = "SELECT * FROM users WHERE username = ?"
    cursor.execute(query, (username,))
    row = cursor.fetchone()
    conn.close()
    return row


def run_report(report_name):
    """Run a named report script."""
    allowed = ["summary", "monthly", "weekly"]
    if report_name not in allowed:
        raise ValueError(f"Unknown report: {report_name}")
    subprocess.run(["python", f"reports/{report_name}.py"], check=True)


def read_file(filename):
    """Read a file from the uploads directory."""
    safe_name = os.path.basename(filename)
    path = os.path.realpath(os.path.join("uploads", safe_name))
    if not path.startswith(os.path.realpath("uploads")):
        raise ValueError("Path traversal detected")
    with open(path, "r") as f:
        return f.read()


DB_PASSWORD = "SuperSecret123!"   # TODO: move to env var


def deserialize_payload(data):
    import json
    return json.loads(data)


def delete_user(user_id, requesting_user_id):
    """Delete a user with authorization check."""
    if not is_admin(requesting_user_id):
        raise PermissionError("Admin access required")
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()


def is_admin(user_id):
    conn = sqlite3.connect("app.db")
    cursor = conn.cursor()
    cursor.execute("SELECT is_admin FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return row and row[0]
'''

SAMPLE_TEST_BEFORE = '''import unittest
from app import get_user, run_report

class TestGetUser(unittest.TestCase):
    def test_get_user_exists(self):
        user = get_user("admin")
        self.assertIsNotNone(user)
'''

SAMPLE_TEST_AFTER = '''import unittest
from unittest.mock import patch, MagicMock
from app import get_user, run_report, read_file, delete_user

class TestGetUser(unittest.TestCase):
    def test_get_user_exists(self):
        user = get_user("admin")
        self.assertIsNotNone(user)

class TestRunReport(unittest.TestCase):
    def test_invalid_report_raises(self):
        with self.assertRaises(ValueError):
            run_report("../../etc/passwd")

    def test_valid_report_allowed(self):
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            run_report("summary")

class TestReadFile(unittest.TestCase):
    def test_path_traversal_blocked(self):
        with self.assertRaises(ValueError):
            read_file("../../../etc/passwd")
'''

README_CONTENT = """# PaymentService API

A lightweight REST API for processing payments and managing user accounts.

## Architecture

- **Backend**: Python 3.11, FastAPI
- **Database**: SQLite (dev), PostgreSQL (prod)
- **Auth**: JWT tokens, 15-minute expiry

## Security Requirements

- All user-controlled database input MUST use parameterized queries.
- Shell commands MUST NOT be constructed from user input.
- File access MUST be restricted to the designated uploads/ directory.
- Credentials MUST NOT be hard-coded; use environment variables or a secrets manager.
- Deserialization of untrusted data MUST use safe formats (JSON, not pickle).
- All destructive operations MUST verify authorization before execution.
- All mutations MUST be logged to the audit trail.

## API Endpoints

- `GET /users/{username}` – look up user
- `POST /reports/run` – execute a named report
- `GET /files/{filename}` – read an uploaded file
- `DELETE /users/{id}` – delete a user (admin only)

## Coding Standards

- Functions must have docstrings.
- No bare `except` clauses.
- All external calls must be wrapped in try/except with specific exception types.
- Test coverage must be ≥ 85%.
- No `print()` statements in production code; use the `logging` module.
"""

ARCHITECTURE_DOC = """# PaymentService – Architecture & Design

## Component Overview

```
Client → API Gateway → PaymentService → Database
                              ↓
                        AuditLogger
```

## Data Flow

1. Client authenticates via `/auth/token` with username + password.
2. JWT is returned with a 15-minute expiry.
3. All subsequent requests carry the JWT in the `Authorization` header.
4. PaymentService validates the JWT before any operation.
5. All mutations (create, update, delete) are forwarded to AuditLogger.

## Security Architecture

- Role-based access: `admin`, `operator`, `viewer`.
- Admins can delete users and run reports.
- Operators can read/write payment records.
- Viewers are read-only.

## Error Handling

- 400 Bad Request – invalid input.
- 401 Unauthorized – missing or invalid token.
- 403 Forbidden – insufficient role.
- 500 Internal Server Error – unexpected failure (never expose stack traces).
"""

SECURITY_GUIDELINES = """# Security Guidelines

## Input Validation

- Validate all input at the API boundary.
- Use allowlists, not blocklists.
- Reject any input that does not conform to the expected schema.

## SQL Queries

- Always use parameterized queries or an ORM.
- Never build SQL strings with f-strings or string concatenation involving user data.

## File Operations

- Canonicalize paths with `os.path.realpath`.
- Confirm the resolved path is within the expected directory.

## Secrets Management

- Store secrets in environment variables or a vault.
- Never commit secrets to source control.
- Rotate credentials on any suspected exposure.

## Serialization

- Use JSON for all serialized payloads.
- Never use Python `pickle` for untrusted data.

## Authorization

- Check role before every destructive operation.
- Log every destructive operation to the audit trail.
"""

FINDINGS_DATA = [
    {
        "finding_id": "SEC-001",
        "severity": "CRITICAL",
        "category": "Security",
        "title": "Hard-coded credential in source file",
        "description": "The variable `DB_PASSWORD` is assigned a literal string credential directly in the source file. This credential will be committed to version control and visible to anyone with repository access.",
        "evidence": 'DB_PASSWORD = "SuperSecret123!"   # TODO: move to env var',
        "file_path": "app.py",
        "line_start": 37,
        "line_end": 37,
        "affected_component": "Configuration / DB connection",
        "related_requirement": "Credentials MUST NOT be hard-coded; use environment variables or a secrets manager. (README – Security Requirements)",
        "potential_impact": "Full database compromise if credential is discovered. Credential rotation requires a code change and redeployment.",
        "suggested_fix": "Remove the literal value. Read from `os.environ['DB_PASSWORD']` and document the required env var in .env.example.",
        "test_recommendation": "Add a test that asserts `DB_PASSWORD` is never a non-empty string literal in the source. Consider a pre-commit hook that scans for secrets.",
        "validation_status": "open",
        "agent_source": "Security Agent",
    },
    {
        "finding_id": "SEC-002",
        "severity": "HIGH",
        "category": "Security",
        "title": "SQL injection via f-string query construction (partially fixed)",
        "description": "`get_user()` originally concatenated the username directly into a SQL string using an f-string. The fix correctly adopts a parameterized query (`?` placeholder). However, `delete_user()` in the original code had the same pattern and has not been completely verified across all database access points.",
        "evidence": 'query = f"SELECT * FROM users WHERE username = \'{username}\'"',
        "file_path": "app.py",
        "line_start": 11,
        "line_end": 11,
        "affected_component": "get_user() / Database layer",
        "related_requirement": "All user-controlled database input MUST use parameterized queries. (README – Security Requirements)",
        "potential_impact": "An attacker could extract, modify, or delete arbitrary database records by injecting SQL metacharacters into the username field.",
        "suggested_fix": "All DB queries have been parameterized in the new version. Audit remaining raw `.execute()` calls across the codebase.",
        "test_recommendation": "Add a regression test: `get_user(\"' OR 1=1 --\")` must not return any row.",
        "validation_status": "fixed",
        "agent_source": "Security Agent",
    },
    {
        "finding_id": "SEC-003",
        "severity": "HIGH",
        "category": "Security",
        "title": "Unsafe OS command execution via user-controlled input (fixed)",
        "description": "`run_report()` passed the `report_name` argument directly to `os.system()`. The fix replaces this with an allowlist check and `subprocess.run()` with a list argument.",
        "evidence": 'os.system(f"python reports/{report_name}.py")',
        "file_path": "app.py",
        "line_start": 22,
        "line_end": 22,
        "affected_component": "run_report() / Report execution",
        "related_requirement": "Shell commands MUST NOT be constructed from user input. (Security Guidelines)",
        "potential_impact": "Remote code execution. An attacker could append `; rm -rf /` or similar to execute arbitrary system commands.",
        "suggested_fix": "Allowlist is correctly implemented. Ensure the allowlist is externalized to configuration rather than hard-coded.",
        "test_recommendation": "Test that `run_report('../../etc/passwd')` raises ValueError. Test that valid report names succeed.",
        "validation_status": "fixed",
        "agent_source": "Security Agent",
    },
    {
        "finding_id": "SEC-004",
        "severity": "HIGH",
        "category": "Security",
        "title": "Path traversal in file read operation (fixed)",
        "description": "`read_file()` concatenated a caller-supplied filename directly into a path. The fix uses `os.path.basename` and `os.path.realpath` with a prefix check.",
        "evidence": 'path = f"uploads/{filename}"',
        "file_path": "app.py",
        "line_start": 29,
        "line_end": 29,
        "affected_component": "read_file() / File system access",
        "related_requirement": "File access MUST be restricted to the designated uploads/ directory. (Security Guidelines)",
        "potential_impact": "An attacker can read arbitrary server files, including `/etc/passwd`, private keys, and configuration files.",
        "suggested_fix": "Fix applied. Consider additionally validating file extension and MIME type.",
        "test_recommendation": "Regression test: `read_file('../../../etc/passwd')` must raise ValueError.",
        "validation_status": "fixed",
        "agent_source": "Security Agent",
    },
    {
        "finding_id": "SEC-005",
        "severity": "CRITICAL",
        "category": "Security",
        "title": "Unsafe deserialization using Python pickle (fixed)",
        "description": "`deserialize_payload()` used `pickle.loads()` on untrusted data. Pickle deserialization of attacker-controlled bytes allows arbitrary code execution during deserialization. The fix switches to `json.loads()`.",
        "evidence": "return pickle.loads(data)",
        "file_path": "app.py",
        "line_start": 41,
        "line_end": 41,
        "affected_component": "deserialize_payload()",
        "related_requirement": "Deserialization of untrusted data MUST use safe formats (JSON, not pickle). (Security Guidelines)",
        "potential_impact": "Remote code execution via crafted pickle payload. CVSSv3 base score 9.8.",
        "suggested_fix": "Replaced with `json.loads()`. Ensure callers now send JSON-encoded payloads.",
        "test_recommendation": "Unit test that a JSON payload round-trips correctly and that a pickle-bytes input raises an exception.",
        "validation_status": "fixed",
        "agent_source": "Security Agent",
    },
    {
        "finding_id": "SEC-006",
        "severity": "HIGH",
        "category": "Security",
        "title": "Missing authorization on destructive operation (fixed)",
        "description": "The original `delete_user()` executed a DELETE query without verifying the caller's role. The fix adds an `is_admin()` check and raises `PermissionError` for non-admins.",
        "evidence": 'cursor.execute(f"DELETE FROM users WHERE id = {user_id}")',
        "file_path": "app.py",
        "line_start": 46,
        "line_end": 49,
        "affected_component": "delete_user()",
        "related_requirement": "All destructive operations MUST verify authorization before execution. (README – Security Requirements)",
        "potential_impact": "Any authenticated user could delete arbitrary user accounts.",
        "suggested_fix": "Authorization check applied. Ensure `is_admin()` is the authoritative source of truth and cannot be bypassed.",
        "test_recommendation": "Test that a non-admin call to `delete_user()` raises PermissionError.",
        "validation_status": "fixed",
        "agent_source": "Security Agent",
    },
    {
        "finding_id": "CODE-001",
        "severity": "MEDIUM",
        "category": "Correctness",
        "title": "Missing audit logging on user deletion",
        "description": "The updated `delete_user()` now checks authorization, but still does not emit an audit log entry after successful deletion. The architecture document requires all mutations to be forwarded to AuditLogger.",
        "evidence": "conn.commit()\n    conn.close()\n    # No call to AuditLogger",
        "file_path": "app.py",
        "line_start": 62,
        "line_end": 64,
        "affected_component": "delete_user() / AuditLogger",
        "related_requirement": "All mutations MUST be logged to the audit trail. (Architecture – Data Flow)",
        "potential_impact": "Security events cannot be reconstructed during incident response. Compliance violations possible.",
        "suggested_fix": "After `conn.commit()`, call `AuditLogger.record(action='delete_user', target=user_id, actor=requesting_user_id)`.",
        "test_recommendation": "Mock AuditLogger and assert it is called with the correct arguments after a successful deletion.",
        "validation_status": "open",
        "agent_source": "Code Quality Agent",
    },
    {
        "finding_id": "CODE-002",
        "severity": "MEDIUM",
        "category": "Maintainability",
        "title": "Repeated database connection boilerplate",
        "description": "Each function opens and closes its own SQLite connection. This pattern duplicates connection management code across multiple functions and will not scale to connection pooling or transaction management.",
        "evidence": "conn = sqlite3.connect(\"app.db\")\n    cursor = conn.cursor()\n    ...\n    conn.close()",
        "file_path": "app.py",
        "line_start": 7,
        "line_end": 14,
        "affected_component": "Database access layer",
        "related_requirement": "Coding standard: avoid duplication. (README – Coding Standards)",
        "potential_impact": "Difficult to add connection pooling, transactions, or consistent error handling later.",
        "suggested_fix": "Introduce a context manager or a repository pattern that centralizes connection management.",
        "test_recommendation": "No specific regression test required, but refactoring should not break existing tests.",
        "validation_status": "open",
        "agent_source": "Code Quality Agent",
    },
    {
        "finding_id": "CODE-003",
        "severity": "LOW",
        "category": "Maintainability",
        "title": "Allowlist hard-coded in function body",
        "description": "The `allowed` list in `run_report()` is a hard-coded literal inside the function. Adding a new report type requires a code change.",
        "evidence": 'allowed = ["summary", "monthly", "weekly"]',
        "file_path": "app.py",
        "line_start": 19,
        "line_end": 19,
        "affected_component": "run_report()",
        "related_requirement": "",
        "potential_impact": "Low operational flexibility; code changes required for configuration changes.",
        "suggested_fix": "Read allowed report names from a configuration file or environment variable.",
        "test_recommendation": "Test that the allowlist can be overridden via configuration without code changes.",
        "validation_status": "open",
        "agent_source": "Code Quality Agent",
    },
    {
        "finding_id": "TEST-001",
        "severity": "HIGH",
        "category": "Testing",
        "title": "Insufficient test coverage for security-critical functions",
        "description": "The original test suite had a single test that merely checks that `get_user('admin')` returns a non-None value. Security-critical paths (`run_report`, `read_file`, `delete_user`, `deserialize_payload`) had zero tests.",
        "evidence": "class TestGetUser(unittest.TestCase):\n    def test_get_user_exists(self):\n        ...",
        "file_path": "tests/test_app.py",
        "line_start": 1,
        "line_end": 7,
        "affected_component": "Test suite",
        "related_requirement": "Test coverage must be ≥ 85%. (README – Coding Standards)",
        "potential_impact": "Security regressions will not be caught by CI. The pickle vulnerability could be re-introduced without any test failing.",
        "suggested_fix": "Generated test cases cover path traversal rejection, OS command injection rejection, and authorization enforcement.",
        "test_recommendation": "See generated tests. Add coverage reporting to CI and enforce the 85% threshold as a gate.",
        "validation_status": "fixed",
        "agent_source": "Testing Agent",
    },
    {
        "finding_id": "REQ-001",
        "severity": "MEDIUM",
        "category": "Requirements",
        "title": "No logging module usage detected",
        "description": "The coding standards require use of the `logging` module instead of `print()`. Neither the before nor after code uses the `logging` module at all, and several error paths are handled silently.",
        "evidence": "# No import logging found in app.py",
        "file_path": "app.py",
        "line_start": 1,
        "line_end": 5,
        "affected_component": "Application logging",
        "related_requirement": "No `print()` statements in production code; use the `logging` module. (README – Coding Standards)",
        "potential_impact": "Operational issues will be invisible in production log aggregation.",
        "suggested_fix": "Add `import logging` at the top of the file. Replace any debug prints and add `logging.info/warning/error` calls at key decision points.",
        "test_recommendation": "Assert that key operations emit log records at the appropriate level.",
        "validation_status": "open",
        "agent_source": "Requirements Agent",
    },
    {
        "finding_id": "REQ-002",
        "severity": "LOW",
        "category": "Requirements",
        "title": "Missing docstring on is_admin helper",
        "description": "The newly introduced `is_admin()` function does not have a docstring. All functions must have docstrings per the coding standards.",
        "evidence": "def is_admin(user_id):\n    conn = sqlite3.connect(\"app.db\")",
        "file_path": "app.py",
        "line_start": 65,
        "line_end": 66,
        "affected_component": "is_admin()",
        "related_requirement": "Functions must have docstrings. (README – Coding Standards)",
        "potential_impact": "Minor: reduces code readability and auto-documentation quality.",
        "suggested_fix": 'Add: """Return True if the given user_id has admin role."""',
        "test_recommendation": "No specific test needed; enforce via a linting rule (pydocstyle).",
        "validation_status": "open",
        "agent_source": "Requirements Agent",
    },
]

GENERATED_TESTS = [
    {
        "test_name": "test_sql_injection_rejected",
        "test_code": """import unittest
from unittest.mock import patch, MagicMock
import sqlite3

class TestSQLInjectionRejection(unittest.TestCase):
    \"\"\"SEC-002: Parameterized queries prevent SQL injection.\"\"\"

    @patch("sqlite3.connect")
    def test_injection_payload_does_not_alter_query(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn

        from app import get_user
        result = get_user("' OR '1'='1")

        # With parameterized query the cursor receives the raw payload as a bound param
        call_args = mock_cursor.execute.call_args
        self.assertIn("?", call_args[0][0])
        self.assertEqual(call_args[0][1], ("' OR '1'='1",))
        self.assertIsNone(result)

if __name__ == "__main__":
    unittest.main()
""",
        "finding_id": "SEC-002",
        "status": "passed",
        "output": "test_injection_payload_does_not_alter_query ... ok\n\nRan 1 test in 0.003s\n\nOK",
    },
    {
        "test_name": "test_path_traversal_blocked",
        "test_code": """import unittest

class TestPathTraversal(unittest.TestCase):
    \"\"\"SEC-004: Path traversal attempts must be rejected.\"\"\"

    def test_dot_dot_slash_raises_value_error(self):
        from app import read_file
        with self.assertRaises((ValueError, OSError)):
            read_file("../../../etc/passwd")

    def test_absolute_path_raises(self):
        from app import read_file
        with self.assertRaises((ValueError, OSError)):
            read_file("/etc/shadow")

if __name__ == "__main__":
    unittest.main()
""",
        "finding_id": "SEC-004",
        "status": "passed",
        "output": "test_dot_dot_slash_raises_value_error ... ok\ntest_absolute_path_raises ... ok\n\nRan 2 tests in 0.001s\n\nOK",
    },
    {
        "test_name": "test_command_injection_blocked",
        "test_code": """import unittest

class TestCommandInjection(unittest.TestCase):
    \"\"\"SEC-003: Only allowlisted report names must be accepted.\"\"\"

    def test_traversal_report_name_rejected(self):
        from app import run_report
        with self.assertRaises(ValueError):
            run_report("../../etc/passwd")

    def test_semicolon_payload_rejected(self):
        from app import run_report
        with self.assertRaises(ValueError):
            run_report("summary; rm -rf /")

    def test_valid_report_name_accepted(self):
        import subprocess
        from unittest.mock import patch
        from app import run_report
        with patch("subprocess.run") as mock_run:
            mock_run.return_value = None
            run_report("summary")  # should not raise

if __name__ == "__main__":
    unittest.main()
""",
        "finding_id": "SEC-003",
        "status": "passed",
        "output": "test_traversal_report_name_rejected ... ok\ntest_semicolon_payload_rejected ... ok\ntest_valid_report_name_accepted ... ok\n\nRan 3 tests in 0.002s\n\nOK",
    },
    {
        "test_name": "test_delete_user_authorization",
        "test_code": """import unittest
from unittest.mock import patch, MagicMock

class TestDeleteUserAuth(unittest.TestCase):
    \"\"\"SEC-006: delete_user must enforce admin role.\"\"\"

    @patch("app.is_admin", return_value=False)
    def test_non_admin_raises_permission_error(self, mock_is_admin):
        from app import delete_user
        with self.assertRaises(PermissionError):
            delete_user(user_id=42, requesting_user_id=99)

    @patch("app.is_admin", return_value=True)
    @patch("sqlite3.connect")
    def test_admin_can_delete(self, mock_connect, mock_is_admin):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        from app import delete_user
        delete_user(user_id=42, requesting_user_id=1)  # should not raise
        mock_cursor.execute.assert_called_once()

if __name__ == "__main__":
    unittest.main()
""",
        "finding_id": "SEC-006",
        "status": "passed",
        "output": "test_non_admin_raises_permission_error ... ok\ntest_admin_can_delete ... ok\n\nRan 2 tests in 0.002s\n\nOK",
    },
    {
        "test_name": "test_pickle_deserialization_removed",
        "test_code": """import unittest
import json

class TestDeserialization(unittest.TestCase):
    \"\"\"SEC-005: deserialize_payload must use JSON, not pickle.\"\"\"

    def test_valid_json_roundtrips(self):
        from app import deserialize_payload
        payload = json.dumps({"user_id": 1, "action": "login"})
        result = deserialize_payload(payload)
        self.assertEqual(result["user_id"], 1)

    def test_invalid_json_raises(self):
        from app import deserialize_payload
        with self.assertRaises(Exception):
            deserialize_payload(b"\\x80\\x03}q\\x00.")  # pickle bytes

if __name__ == "__main__":
    unittest.main()
""",
        "finding_id": "SEC-005",
        "status": "passed",
        "output": "test_valid_json_roundtrips ... ok\ntest_invalid_json_raises ... ok\n\nRan 2 tests in 0.001s\n\nOK",
    },
    {
        "test_name": "test_coverage_critical_paths",
        "test_code": """import unittest
from unittest.mock import patch, MagicMock

class TestCoverageCriticalPaths(unittest.TestCase):
    \"\"\"TEST-001: Ensure all security-critical functions have baseline tests.\"\"\"

    @patch("sqlite3.connect")
    def test_get_user_returns_none_for_unknown(self, mock_connect):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        from app import get_user
        self.assertIsNone(get_user("unknownuser"))

if __name__ == "__main__":
    unittest.main()
""",
        "finding_id": "TEST-001",
        "status": "passed",
        "output": "test_get_user_returns_none_for_unknown ... ok\n\nRan 1 test in 0.002s\n\nOK",
    },
]

REPO_FILES = [
    {
        "path": "app.py",
        "file_type": "source",
        "language": "Python",
        "content": SAMPLE_AFTER_CODE,
    },
    {
        "path": "tests/test_app.py",
        "file_type": "test",
        "language": "Python",
        "content": SAMPLE_TEST_AFTER,
    },
    {
        "path": "README.md",
        "file_type": "doc",
        "language": "Markdown",
        "content": README_CONTENT,
    },
    {
        "path": "docs/architecture.md",
        "file_type": "doc",
        "language": "Markdown",
        "content": ARCHITECTURE_DOC,
    },
    {
        "path": "docs/security_guidelines.md",
        "file_type": "doc",
        "language": "Markdown",
        "content": SECURITY_GUIDELINES,
    },
    {
        "path": "requirements.txt",
        "file_type": "config",
        "language": "Text",
        "content": "fastapi==0.111.0\nsqlalchemy==2.0.30\npydantic==2.7.1\nuvicorn==0.29.0\n",
    },
    {
        "path": "pyproject.toml",
        "file_type": "config",
        "language": "TOML",
        "content": '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n\n[tool.coverage.run]\nsource = ["app"]\n',
    },
    {
        "path": "config/settings.py",
        "file_type": "source",
        "language": "Python",
        "content": "import os\n\nDB_URL = os.environ.get('DATABASE_URL', 'sqlite:///app.db')\nSECRET_KEY = os.environ.get('SECRET_KEY', 'changeme')\nDEBUG = os.environ.get('DEBUG', 'false').lower() == 'true'\n",
    },
    {
        "path": "models/user.py",
        "file_type": "source",
        "language": "Python",
        "content": "from dataclasses import dataclass\n\n@dataclass\nclass User:\n    id: int\n    username: str\n    email: str\n    is_admin: bool = False\n",
    },
    {
        "path": "models/payment.py",
        "file_type": "source",
        "language": "Python",
        "content": "from dataclasses import dataclass\nfrom decimal import Decimal\n\n@dataclass\nclass Payment:\n    id: int\n    user_id: int\n    amount: Decimal\n    currency: str\n    status: str\n",
    },
]

ORCHESTRATOR_LOG = [
    {"step": "init", "message": "Review initialized", "status": "done", "timestamp": "0.0s"},
    {"step": "context_repo", "message": "Repository context loaded (10 files, 3 docs)", "status": "done", "timestamp": "0.3s"},
    {"step": "context_change", "message": "Change analyzed: app.py — 52 lines modified across 6 functions", "status": "done", "timestamp": "0.6s"},
    {"step": "context_docs", "message": "Documentation context extracted: 14 requirements identified", "status": "done", "timestamp": "0.9s"},
    {"step": "parallel_start", "message": "Launching parallel analysis agents…", "status": "done", "timestamp": "1.1s"},
    {"step": "agent_security", "message": "Security Agent: 6 findings (2 CRITICAL, 3 HIGH, 0 MEDIUM)", "status": "done", "timestamp": "3.2s"},
    {"step": "agent_code", "message": "Code Quality Agent: 3 findings (0 CRITICAL, 0 HIGH, 2 MEDIUM, 1 LOW)", "status": "done", "timestamp": "3.5s"},
    {"step": "agent_testing", "message": "Testing Agent: 1 finding (0 CRITICAL, 1 HIGH, 0 MEDIUM)", "status": "done", "timestamp": "3.8s"},
    {"step": "agent_requirements", "message": "Requirements Agent: 2 findings (0 CRITICAL, 0 HIGH, 1 MEDIUM, 1 LOW)", "status": "done", "timestamp": "4.0s"},
    {"step": "aggregation", "message": "Aggregating findings — 12 raw findings received", "status": "done", "timestamp": "4.2s"},
    {"step": "dedup", "message": "Deduplication: 12 findings retained (no duplicates found)", "status": "done", "timestamp": "4.3s"},
    {"step": "correlation", "message": "Correlation: SEC-002 and SEC-006 share the same DB access pattern", "status": "done", "timestamp": "4.5s"},
    {"step": "severity", "message": "Severity normalization complete", "status": "done", "timestamp": "4.6s"},
    {"step": "tests", "message": "Test generation: 6 test cases generated for 6 findings", "status": "done", "timestamp": "5.8s"},
    {"step": "validation", "message": "Test validation: 6/6 tests passed", "status": "done", "timestamp": "6.4s"},
    {"step": "report", "message": "Final review report compiled", "status": "done", "timestamp": "6.6s"},
]

DIFF_HUNKS = [
    {
        "hunk_header": "@@ -8,5 +8,5 @@ def get_user(username):",
        "lines": [
            {"type": "context", "content": "    conn = sqlite3.connect(\"app.db\")"},
            {"type": "context", "content": "    cursor = conn.cursor()"},
            {"type": "removed", "content": "    query = f\"SELECT * FROM users WHERE username = '{username}'\""},
            {"type": "added",   "content": "    query = \"SELECT * FROM users WHERE username = ?\""},
            {"type": "removed", "content": "    cursor.execute(query)"},
            {"type": "added",   "content": "    cursor.execute(query, (username,))"},
            {"type": "context", "content": "    row = cursor.fetchone()"},
        ],
    },
    {
        "hunk_header": "@@ -18,5 +18,8 @@ def run_report(report_name):",
        "lines": [
            {"type": "context", "content": "def run_report(report_name):"},
            {"type": "context", "content": "    \"\"\"Run a named report script.\"\"\""},
            {"type": "removed", "content": "    os.system(f\"python reports/{report_name}.py\")"},
            {"type": "added",   "content": "    allowed = [\"summary\", \"monthly\", \"weekly\"]"},
            {"type": "added",   "content": "    if report_name not in allowed:"},
            {"type": "added",   "content": "        raise ValueError(f\"Unknown report: {report_name}\")"},
            {"type": "added",   "content": "    subprocess.run([\"python\", f\"reports/{report_name}.py\"], check=True)"},
        ],
    },
    {
        "hunk_header": "@@ -26,5 +30,9 @@ def read_file(filename):",
        "lines": [
            {"type": "context", "content": "def read_file(filename):"},
            {"type": "context", "content": "    \"\"\"Read a file from the uploads directory.\"\"\""},
            {"type": "removed", "content": "    path = f\"uploads/{filename}\""},
            {"type": "added",   "content": "    safe_name = os.path.basename(filename)"},
            {"type": "added",   "content": "    path = os.path.realpath(os.path.join(\"uploads\", safe_name))"},
            {"type": "added",   "content": "    if not path.startswith(os.path.realpath(\"uploads\")):"},
            {"type": "added",   "content": "        raise ValueError(\"Path traversal detected\")"},
            {"type": "context", "content": "    with open(path, \"r\") as f:"},
            {"type": "context", "content": "        return f.read()"},
        ],
    },
    {
        "hunk_header": "@@ -35,3 +43,3 @@ DB_PASSWORD = ...",
        "lines": [
            {"type": "removed", "content": "DB_PASSWORD = \"SuperSecret123!\"   # WARNING: hard-coded credential"},
            {"type": "added",   "content": "DB_PASSWORD = \"SuperSecret123!\"   # TODO: move to env var"},
        ],
    },
    {
        "hunk_header": "@@ -38,4 +46,4 @@ def deserialize_payload(data):",
        "lines": [
            {"type": "context", "content": "def deserialize_payload(data):"},
            {"type": "removed", "content": "    import pickle"},
            {"type": "removed", "content": "    return pickle.loads(data)"},
            {"type": "added",   "content": "    import json"},
            {"type": "added",   "content": "    return json.loads(data)"},
        ],
    },
    {
        "hunk_header": "@@ -43,8 +51,16 @@ def delete_user(user_id):",
        "lines": [
            {"type": "removed", "content": "def delete_user(user_id):"},
            {"type": "added",   "content": "def delete_user(user_id, requesting_user_id):"},
            {"type": "context", "content": "    \"\"\"Delete a user with authorization check.\"\"\""},
            {"type": "added",   "content": "    if not is_admin(requesting_user_id):"},
            {"type": "added",   "content": "        raise PermissionError(\"Admin access required\")"},
            {"type": "context", "content": "    conn = sqlite3.connect(\"app.db\")"},
            {"type": "context", "content": "    cursor = conn.cursor()"},
            {"type": "removed", "content": "    cursor.execute(f\"DELETE FROM users WHERE id = {user_id}\")"},
            {"type": "added",   "content": "    cursor.execute(\"DELETE FROM users WHERE id = ?\", (user_id,))"},
            {"type": "context", "content": "    conn.commit()"},
            {"type": "context", "content": "    conn.close()"},
        ],
    },
]


def seed_demo_data(db: Session):
    """Seed the database with a complete demo project + review if not already present."""
    if db.query(Project).filter_by(name="PaymentService API").first():
        return  # already seeded

    project = Project(
        name="PaymentService API",
        description="A lightweight REST API for processing payments and managing user accounts.",
        repository_url="https://github.com/acme/payment-service",
        language="Python",
    )
    db.add(project)
    db.flush()

    # Documents
    docs = [
        Document(project_id=project.id, name="README.md", doc_type="readme", content=README_CONTENT),
        Document(project_id=project.id, name="Architecture", doc_type="architecture", content=ARCHITECTURE_DOC),
        Document(project_id=project.id, name="Security Guidelines", doc_type="security", content=SECURITY_GUIDELINES),
    ]
    for d in docs:
        db.add(d)

    # Repository files
    for rf in REPO_FILES:
        db.add(RepoFile(project_id=project.id, **rf))

    db.flush()

    # Completed review
    t0 = datetime.utcnow() - timedelta(hours=1)
    review = Review(
        project_id=project.id,
        title="Fix security vulnerabilities in core API layer",
        description="This PR addresses multiple critical security issues identified during a security audit: SQL injection, OS command injection, path traversal, hard-coded credentials, unsafe deserialization, and missing authorization checks.",
        branch="feature/security-fixes",
        author="alice@acme.com",
        status="completed",
        orchestrator_log=ORCHESTRATOR_LOG,
        requirements_text="All user-controlled DB input must use parameterized queries.\nNo shell commands from user input.\nFile access restricted to uploads/ directory.\nNo hard-coded credentials.\nNo pickle deserialization of untrusted data.\nAll destructive operations require admin authorization.\nAudit trail for all mutations.",
        coding_guidelines="Functions must have docstrings.\nNo bare except clauses.\nTest coverage >= 85%.\nUse logging module, not print().\nNo secrets in code.",
        changed_files=["app.py", "tests/test_app.py"],
        severity_counts={"CRITICAL": 2, "HIGH": 4, "MEDIUM": 3, "LOW": 2, "INFO": 1},
        tests_generated=6,
        tests_passed=6,
        tests_failed=0,
        duration_seconds=6.6,
        created_at=t0,
        completed_at=t0 + timedelta(seconds=6.6),
    )
    db.add(review)
    db.flush()

    for f in FINDINGS_DATA:
        db.add(Finding(review_id=review.id, **f))

    db.add(FileDiff(
        review_id=review.id,
        file_path="app.py",
        before_content=SAMPLE_BEFORE_CODE,
        after_content=SAMPLE_AFTER_CODE,
        diff_hunks=DIFF_HUNKS,
    ))
    db.add(FileDiff(
        review_id=review.id,
        file_path="tests/test_app.py",
        before_content=SAMPLE_TEST_BEFORE,
        after_content=SAMPLE_TEST_AFTER,
        diff_hunks=[],
    ))

    for gt in GENERATED_TESTS:
        db.add(GeneratedTest(review_id=review.id, **gt))

    db.commit()
