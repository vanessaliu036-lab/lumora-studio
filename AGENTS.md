# Lumora Studio — Agent Working Notes

## Project
- Repo: `git@github.com:vanessaliu036-lab/lumora-studio.git`
- Production: `https://lumora-studiokh.vercel.app` (only public alias)
- Vercel project: `vanessas-projects-65b0e014/lumora`
- Type: single-file static portfolio (`index.html` + images + mp4)

## Mavis Permissions (project-scoped override)
Override of the default "mavis does NOT run push / vercel deploy" rule.
This override applies ONLY to this repo (`/Users/vanessaliu/Desktop/lumora`),
does NOT propagate to other projects.

Allowed without per-step confirmation:
- `git push origin main`
- `vercel deploy --prod --yes`
- `vercel domains add / rm` for `*.vercel.app` aliases on this project
- `vercel alias rm` for cleanup of this project's aliases

Still requires Vanessa's per-step authorization (out of scope):
- Adding a custom domain with external DNS (e.g. `lumora.studio`)
- Changing Vercel project settings (env vars, build command, framework)
- Touching production data or files that are not the website deliverable

## Deploy SOP
1. `git add` + `git commit` (imperative message)
2. `git push origin main` → Vercel auto-rebuilds from GitHub
3. Verify `https://lumora-studiokh.vercel.app/` returns HTTP 200

If Vercel GitHub integration is broken, fallback:
`vercel deploy --prod --yes` from local working tree

## Alias Hygiene Rule (project-scoped)
Only one public alias at a time. Default name pattern:
`lumora-studiokh.vercel.app` (kh suffix = Vanessa's stamp).
If a different name is requested, swap (add new → remove old), do not stack.

## .vercel/
Already covered by `.gitignore` — never commit.
