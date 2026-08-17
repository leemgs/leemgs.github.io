#!/usr/bin/env node
/**
 * Generate docs/github-projects.json — the list of published GitHub Pages
 * projects owned by `leemgs` that ship their site from a `docs/` folder
 * (the GitHub Pages "homepage folder").
 *
 * Run by .github/workflows/update-github-projects.yml twice a day so the
 * "Published Projects" page always reflects the most recently updated repos.
 *
 * Uses only Node's built-in fetch (Node >= 18). An optional GH_TOKEN raises
 * the API rate limit but is not required for public repositories.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const OWNER = 'leemgs';
const SELF = `${OWNER}.github.io`; // the site itself — never list it
const OUTPUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'github-projects.json');

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'leemgs-pages-bot',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (token) headers.Authorization = `Bearer ${token}`;

async function gh(url) {
  const res = await fetch(url, { headers });
  return res;
}

async function listRepos() {
  const repos = [];
  for (let page = 1; page <= 10; page++) {
    const res = await gh(
      `https://api.github.com/users/${OWNER}/repos?per_page=100&type=owner&sort=pushed&page=${page}`,
    );
    if (!res.ok) throw new Error(`Listing repositories failed: HTTP ${res.status}`);
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

// A repo qualifies if it has a top-level `docs/` directory on its default branch.
async function hasDocsFolder(repo) {
  const res = await gh(
    `https://api.github.com/repos/${OWNER}/${repo.name}/contents/docs?ref=${encodeURIComponent(repo.default_branch)}`,
  );
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Checking docs/ for ${repo.name} failed: HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body); // an array means `docs` is a directory
}

function projectUrl(repo) {
  if (repo.homepage && /^https?:\/\//.test(repo.homepage)) return repo.homepage;
  return `https://${OWNER}.github.io/${repo.name}/`;
}

async function main() {
  const repos = await listRepos();
  const candidates = repos.filter(
    (r) => !r.fork && !r.archived && r.name.toLowerCase() !== SELF,
  );

  const projects = [];
  for (const repo of candidates) {
    if (await hasDocsFolder(repo)) {
      projects.push({
        name: repo.name,
        url: projectUrl(repo),
        description: repo.description || '',
        repo_url: repo.html_url,
        pushed_at: repo.pushed_at,
        updated_at: repo.updated_at,
      });
    }
  }

  // Most recently updated first.
  projects.sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

  const payload = {
    generated_at: new Date().toISOString(),
    owner: OWNER,
    count: projects.length,
    projects,
  };

  writeFileSync(OUTPUT, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote ${projects.length} project(s) to ${OUTPUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
