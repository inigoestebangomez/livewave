# SKILL: Git Flow & Vibe Coding Protocol
# ID: software_engineer_mentor_git_001

## 🎯 Purpose
Maintain a strictly professional, clean, and predictable Git history for solo or team projects, ensuring production stability.

## 🛠️ Core Rules (Directives)
1.⁠ ⁠*Source of Truth:* ⁠ main ⁠ is always production-ready.
2.⁠ ⁠*Integration Hub:* ⁠ dev ⁠ is the base for all new work.
3.⁠ ⁠*Ephemeral Features:* All ⁠ feat/* ⁠ branches MUST be deleted immediately after merge.
4.⁠ ⁠*No Direct Commits:* Commits to ⁠ main ⁠ or ⁠ dev ⁠ are forbidden. Use Pull Requests (PRs).
5.⁠ ⁠*Sync First:* Always ⁠ git merge dev ⁠ into ⁠ feat/* ⁠ before merging back to resolve conflicts early.

## 📋 Branching Strategy
•⁠  ⁠⁠ main ⁠: Production. Only accepts merges from ⁠ qa ⁠ or ⁠ hotfix ⁠.
•⁠  ⁠⁠ qa ⁠: Pre-production. Only accepts merges from ⁠ dev ⁠.
•⁠  ⁠⁠ dev ⁠: Integration. Accepts merges from ⁠ feat ⁠ and ⁠ fix ⁠.
•⁠  ⁠⁠ feat/ ⁠: New features. Origin: ⁠ dev ⁠.
•⁠  ⁠⁠ hotfix/ ⁠: Emergency production fixes. Origin: ⁠ main ⁠. Must be merged to ⁠ main ⁠ AND ⁠ dev ⁠.

## 💬 Conventional Commits (Token Efficient)
Use these prefixes for every commit:
•⁠  ⁠⁠ feat: ⁠ (New feature)
•⁠  ⁠⁠ fix: ⁠ (Bug fix)
•⁠  ⁠⁠ refactor: ⁠ (Code improvement, no logic change)
•⁠  ⁠⁠ docs: ⁠ (Documentation)
•⁠  ⁠⁠ chore: ⁠ (Maintenance, dependencies)

## 🔄 Workflow Execution (The Ritual)
1.⁠ ⁠⁠ checkout dev ⁠ -> ⁠ pull ⁠ -> ⁠ checkout -b feat/task-name ⁠
2.⁠ ⁠⁠ work ⁠ -> ⁠ commit ⁠ -> ⁠ push ⁠
3.⁠ ⁠⁠ PR ⁠ -> ⁠ merge ⁠ -> ⁠ delete branch ⁠