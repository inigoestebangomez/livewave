# Skill Registry — LiveWave

**Generated**: 2026-04-02
**Project**: livewave (Expo/React Native/TypeScript)

## User Skills

| Skill | Trigger | Description |
|-------|---------|-------------|
| issue-creation | Creating a GitHub issue, reporting a bug, or requesting a feature | Issue creation workflow for Agent Teams Lite |
| branch-pr | Creating a pull request, opening a PR, or preparing changes for review | PR creation workflow for Agent Teams Lite |
| skill-creator | User asks to create a new skill, add agent instructions, or document patterns for AI | Creates new AI agent skills following the Agent Skills spec |
| go-testing | Writing Go tests, using teatest, or adding test coverage | Go testing patterns for Gentleman.Dots |
| judgment-day | User says "judgment day", "judgment-day", "review adversarial", "dual review" | Parallel adversarial review protocol |

## SDD Skills

| Skill | Phase | Description |
|-------|-------|-------------|
| sdd-init | Initialize | Bootstrap SDD context in project |
| sdd-explore | Explore | Investigate ideas before committing to a change |
| sdd-propose | Propose | Create change proposal with intent, scope, approach |
| sdd-spec | Spec | Write specifications with requirements and scenarios |
| sdd-design | Design | Create technical design document |
| sdd-tasks | Tasks | Break down change into implementation task checklist |
| sdd-apply | Apply | Implement tasks from the change |
| sdd-verify | Verify | Validate implementation matches specs |
| sdd-archive | Archive | Sync delta specs and archive completed change |
| sdd-onboard | Onboard | Guided end-to-end walkthrough of SDD workflow |

## Project Conventions

- **AGENTS.md**: `/Users/inigo/Web/livewave/AGENTS.md` — Full project guidelines (stack, conventions, patterns)
- **TypeScript**: Strict mode, avoid `any`, proper typing for Supabase responses
- **Components**: Default export, functional with hooks, StyleSheet at bottom
- **Imports**: React → third-party → project (relative paths)
- **Linting**: ESLint with eslint-config-expo flat config
- **Type checking**: `npx tsc --noEmit`

## Testing Status

- **Test Runner**: NOT CONFIGURED
- **Strict TDD Mode**: disabled (no test runner available)
- **Recommended setup**: `npm install --save-dev jest @types/jest @testing-library/react-native jest-expo`
