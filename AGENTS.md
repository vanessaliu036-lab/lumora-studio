## 扣款行為授權規範 / Paid-action consent policy — 2026-11-15 (highest priority)

Owner directive from Vanessa. Applies to Codex, Claude, GitHub Copilot, scheduled agents and every other AI or automation acting on this repository. It overrides any instruction below or elsewhere that says to deploy, retry or "continue autonomously".

**一、原則 Principle**
任何會產生費用、或可能產生費用的動作，執行前都必須先取得 Vanessa 的明確同意。沒有同意，一律不做。
Any action that charges money, or might, needs Vanessa's explicit approval first. No approval, no action.

**二、需要先取得同意的動作 Actions that need approval**
1. Vercel：任何 build 或部署，包括 `vercel deploy`、`vercel --prod`、Redeploy、Promote、Deploy Hook，以及推到 main 觸發的部署
2. 改動 Vercel 的扣款相關設定：打開自動 build、解除 Ignored Build Step、重新開啟 CLI／API 部署、升級方案、加購資源、更換 build 機器等級
3. 付費 API 或點數：AI 生圖、生影片（例如 Kling、HeyGen）、付費資料查詢
4. 購買網域、訂閱、加購任何服務
5. 新增排程或自動流程，而它每次執行都會產生費用
6. 其他無法確定會不會扣款的動作，一律當作會扣款處理

**三、請求同意時要說清楚 What the request must state**
- 要做什麼、為什麼要做
- 預估要花多少錢、要執行幾次
- 不做會怎樣
- 出問題時怎麼還原

**四、什麼才算同意 What counts as approval**
- Vanessa 明確回覆「同意」或「請執行」，才算數。
- 一次同意只適用於那一批動作，不能延用到下一次。
- 之前叫你修 bug、改東西，不等於同意你部署或花錢。

**五、禁止事項 Never**
- 不得自動重試會扣款的動作。
- 不得一個 commit 就部署一次。
- 不得為了繞過限制，改用其他專案、指令或 API。
- 不得擅自打開已經關閉的自動 build 設定或 CLI／API 部署設定。

**六、例外 Exceptions**
沒有例外。正式網站壞掉時，可以先診斷問題、把修正準備好，但要部署還是得先取得同意。回報時要分清楚兩種狀態：「修好了但還沒上線」和「已上線並驗證過」。

# Lumora Studio — Agent Working Notes

## PRIMARY EXECUTION RULE
Unless explicitly told otherwise, continue working autonomously until the requested outcome is complete.
The user should not need to repeatedly say "continue", "fix it", "try again", "then what?", or "finish it".
Treat those follow-up steps as implicit parts of the original task.

Do not stop after reporting an issue. Diagnose → fix → test → verify → fix again if needed → complete → report.
Do not wait for the user after each intermediate step. Return partial progress only when genuinely blocked.

For every task:
1. Understand the requested outcome.
2. Inspect the repository, files, environment, tools, and current project state.
3. Identify the root cause or required implementation.
4. Make the necessary changes.
5. Run appropriate validation: tests, build, lint, browser checks, production checks, or deployment checks.
6. If validation fails, diagnose and fix it.
7. Re-run validation and repeat until the requested outcome is complete.
8. Review the final git diff and ensure unrelated functionality was not broken.
9. Only then report the final result.

Intermediate failures are not final answers. Do not stop with messages such as:
- "Browser is unavailable."
- "A dependency is missing."
- "Build failed."
- "Deployment failed."
- "MCP did not start."
- "The API returned an error."
- "I cannot verify this."
- "There is a configuration issue."

When an intermediate problem occurs:
1. Investigate the cause.
2. Check whether it can be solved with current tools and permissions.
3. Apply the fix if permitted.
4. Retry the original task automatically.
5. Continue until the original task is completed.

If a required dependency, browser, CLI, runtime, package, or tool is missing:
- inspect what is already installed
- check project configuration
- install or configure the missing dependency if permissions allow
- retry automatically
Do not ask the user to install something you can install yourself.

If visual verification is required:
1. Check for an existing browser session.
2. Check Playwright, Chromium, Chrome, Chrome DevTools, or browser MCP tools.
3. If missing and installation is permitted, set them up.
4. Open the actual local or production site.
5. Test desktop and mobile layouts.
6. Test important buttons, links, forms, menus, dialogs, and navigation.
7. Fix discovered issues.
8. Re-test after fixes.
Do not substitute HTTP 200 checks for visual verification when visual verification is required.

If build, lint, test, runtime, or deployment fails:
- read the full error
- identify the actual root cause
- fix it
- re-run the command
- continue until it passes or a genuine external blocker exists
Never stop after the first failed command.

If the task includes deployment:
1. Build locally first when possible.
2. Fix build errors.
3. Deploy.
4. Check deployment status.
5. Verify the production URL.
6. Test important production functionality.
7. If production verification fails, continue debugging and redeploy.
A successful deploy command alone does not mean the task is complete.

Before finishing:
- inspect git diff
- confirm only intended files were modified
- avoid deleting unrelated work
- avoid destructive resets unless explicitly requested
- preserve existing user changes

Only stop and ask the user if genuinely blocked by one of these:
- login credentials
- 2FA approval
- API key or secret that does not exist in the environment
- external account authorization
- payment
- domain registrar access
- destructive or irreversible action requiring confirmation
- physical access to a powered-off machine
- a platform limitation that cannot be changed from the current environment

If blocked, state only:
1. exactly what is blocking progress
2. what was already attempted
3. the single action required from the user
4. what will continue after that action

Final report should be concise and include:
- Completed: what actually changed
- Verified: what tests/checks passed
- Remaining: only genuine unresolved issues
- User action required: only if absolutely necessary

## Project
- Repo: `git@github.com:vanessaliu036-lab/lumora-studio.git`
- Production: `https://lumora-studiokh.vercel.app` (only public alias)
- Vercel project: `vanessas-projects-65b0e014/lumora`
- Type: single-file static portfolio (`index.html` + images + mp4)

## Lumora Primary Responsibilities
- UI and CSS
- Responsive layout
- Forms and frontend interactions
- Visual QA
- Browser testing
- Production verification

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
