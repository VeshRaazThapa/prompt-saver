// Realistic sample library for store screenshots (not real user data).
export const prompts = [
  { id: 's1', title: 'Code review — security pass', description: null, tags: ['review', 'security'], updated_at: '2026-10-08', is_favorite: true,
    content: 'Review this code as a senior engineer. Focus on injection, auth bypass, secrets in logs and unsafe deserialization.\nFor each issue: severity, line, and a concrete fix.' },
  { id: 's2', title: 'Explain like I joined the team today', description: null, tags: ['onboarding'], updated_at: '2026-10-07', is_favorite: true,
    content: 'Explain how this module works to a new teammate. Start with the one-sentence purpose, then the data flow, then the gotchas.' },
  { id: 's3', title: 'Write the PR description', description: null, tags: ['git'], updated_at: '2026-10-06', is_favorite: false,
    content: 'From this diff, write a PR description: Why, What changed, How to test, Risks. Keep it under 200 words.' },
  { id: 's4', title: 'Turn notes into a weekly update', description: null, tags: ['writing'], updated_at: '2026-10-05', is_favorite: false,
    content: 'Turn these bullet notes into a calm, specific weekly update for stakeholders. Lead with outcomes, then blockers.' },
  { id: 's5', title: 'Make this SQL faster', description: null, tags: ['sql', 'perf'], updated_at: '2026-10-03', is_favorite: false,
    content: 'Here is a slow Postgres query and its EXPLAIN ANALYZE. Suggest indexes or rewrites, and explain the trade-offs.' },
  { id: 's6', title: 'Bug report → repro steps', description: null, tags: ['qa'], updated_at: '2026-10-01', is_favorite: false,
    content: 'Rewrite this bug report as numbered reproduction steps with expected vs actual results and environment.' },
];
