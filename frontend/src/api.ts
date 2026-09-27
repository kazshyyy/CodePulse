import axios from 'axios';

// When served from FastAPI at port 8000, use relative path.
// When running vite dev server, proxy /api → 8000 handles it.
const api = axios.create({ baseURL: '/api' });

export default api;

export interface Project {
  id: number; name: string; description: string;
  repository_url: string; language: string; created_at: string;
}
export interface Review {
  id: number; project_id: number; title: string; description: string;
  branch: string; author: string; status: string;
  orchestrator_log: OrchestratorStep[]; requirements_text: string;
  coding_guidelines: string; changed_files: string[];
  severity_counts: Record<string, number>;
  tests_generated: number; tests_passed: number; tests_failed: number;
  duration_seconds: number; created_at: string; completed_at: string | null;
}
export interface Finding {
  id: number; review_id: number; finding_id: string;
  severity: string; category: string; title: string; description: string;
  evidence: string; file_path: string; line_start: number | null;
  line_end: number | null; affected_component: string;
  related_requirement: string; potential_impact: string;
  suggested_fix: string; test_recommendation: string;
  validation_status: string; agent_source: string;
}
export interface Document {
  id: number; project_id: number; name: string; doc_type: string;
  content: string; created_at: string;
}
export interface RepoFile {
  id: number; project_id: number; path: string; file_type: string;
  language: string; content: string;
}
export interface FileDiff {
  id: number; review_id: number; file_path: string;
  before_content: string; after_content: string; diff_hunks: DiffHunk[];
}
export interface DiffHunk {
  hunk_header: string;
  lines: { type: 'added' | 'removed' | 'context'; content: string }[];
}
export interface GeneratedTest {
  id: number; review_id: number; test_name: string; test_code: string;
  finding_id: string; status: string; output: string;
}
export interface OrchestratorStep {
  step: string; message: string; status: string; timestamp: string;
}
export interface DashboardData {
  total_reviews: number; completed_reviews: number; running_reviews: number;
  total_findings: number;
  severity_breakdown: Record<string, number>;
  total_tests: number; tests_passed: number; tests_failed: number;
  total_projects: number;
  recent_reviews: {
    id: number; title: string; status: string; author: string;
    branch: string; severity_counts: Record<string, number>;
    created_at: string; duration_seconds: number;
  }[];
}
