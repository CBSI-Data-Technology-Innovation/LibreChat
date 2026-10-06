# Company Customizations & Maintenance Guide

This fork of [LibreChat](https://github.com/LibreChat-AI/LibreChat) carries company-specific
changes. This file is the **single source of truth** for what we changed and how to keep the
fork up to date with upstream. Every code customization carries a `// company:` (or `# company:`)
marker comment pointing back here; search the codebase for `company:` to find them all.

Baseline (branch `company/v0.8.8`): the official **v0.8.8 release tag** (`e8f3be086`, 2026-10-01).
Upstream moved from `danny-avila/LibreChat` to https://github.com/LibreChat-AI/LibreChat.

This branch was created fresh from the v0.8.8 tag and the company changes were re-applied on
top of it (they were not merged forward from `company/v0.8.7`). The policies now sit on
upstream's shared `getViableUploadOptions` chokepoint instead of the inline v0.8.7 logic.
`dev` was replaced by this branch.

---

## 1. Customization inventory

Spec reference: internal requirements #5 (upload menu) and #6 (version control process).

| # | File | Change | Spec | Re-apply guidance on merge conflict |
|---|------|--------|------|-------------------------------------|
| 1 | `librechat.yaml` (new, committed) | The live company config, re-derived from the v0.8.8 `librechat.example.yaml`. Everything follows the sample except: (a) a selective uncomment of the `endpoints.agents` block (recursionLimit 50, maxRecursionLimit 100, disableBuilder false, titleTiming immediate, maxCitations 30, maxCitationsPerFile 7, minRelevanceScore 0.45, skills.maxCatalogSkills 20), with `capabilities` deliberately trimmed to `deferred_tools, execute_code, file_search, actions, tools`; this removes "Upload as Text" (`context`, spec 5.1) and also disables web search, artifacts, subagents, skills, chain and OCR (company decision, 2026-07-08). `memory` and `ask_user_question` first appear in v0.8.8 and are left off because the capability list was kept identical to the v0.8.7 company list (2026-10-06 port); (b) a top-level `fileConfig.legacyFileUploadUX: true`, which keeps the legacy "+" upload chooser (see Invariants). Contains the File Search kill-switch (spec 5.2). Interface settings and custom endpoints are the sample's (xAI, Claude-Compatible, groq, Mistral, OpenRouter). | 5.1, 5.2, 5.3, 5.4 | Company-owned file; upstream gitignores it. On sync, diff the new upstream example against the old one and carry over what changed; review new upstream capabilities and add them deliberately, never `context`. |
| 1b | `.gitignore` | Replaced the `librechat.yaml` ignore line with two `# company:` comment lines so the live config is committed and ships with the fork. | 5.1, 5.2 | Re-apply the one-line replacement (marked `# company:`). |
| 2 | `client/src/locales/en/translation.json` | Added company keys `com_ui_add_files` ("Add Files") and `com_ui_add_photos` ("Add Photos"). `com_error_files_unsupported` is upstream's own key since v0.8.8, not ours. | 5.3, 5.4 | Take both sides; our keys are alphabetically placed. |
| 3 | `client/src/components/Chat/Input/Files/AttachFileMenu.tsx` | (a) Upstream's provider/image items replaced by a single **"Add Photos"** item that always opens an images-only picker. (b) Code Interpreter item label is **"Add Files"** (`com_ui_add_files`). (c) In ephemeral (non-saved-agent) chats, File Search and Add Files are offered even when the per-chat tool toggles are off (upstream hides them until toggled); saved agents still gate on their actual tools. (d) The Add Photos picker keeps the images-only `accept` filter even on permissive-MIME endpoints. | 5.1, 5.3, 5.4 | Take upstream's structure, then re-apply the `// company:` marked edits. This region is upstream-active; expect conflicts here first. |
| 4 | `client/src/components/Chat/Input/Files/DragDropModal.tsx` | The option label mapper `getOptionMeta` shows **"Add Photos"** for the provider option and **"Add Files"** for the Code Interpreter option. | 5.3, 5.4 | Re-apply the `// company:` marked label edits in `getOptionMeta`. |
| 5 | `client/src/utils/files.ts` | `getViableUploadOptions`: the provider option is only viable when every file is an image, so drag-drop of non-images never offers a provider upload. | 5.1, 5.4 | Re-apply the marked condition. This is upstream's shared chokepoint for drag and paste. |
| 6 | `client/src/hooks/Input/useTextarea.ts` | Paste rule (legacy mode): when no destination is preselected, every pasted file is an image, and the provider option is viable, the paste uploads directly with no chooser (`upload()`), preserving v0.8.7 behaviour. Otherwise upstream behaviour applies (the chooser, or the `com_error_files_unsupported` toast when nothing fits). Unified mode is unaffected. | 5.4 | Re-apply the marked branch in the paste handler. |
| 7 | `client/src/components/Chat/Input/Files/__tests__/AttachFileMenu.spec.tsx` | Expectations for the single "Add Photos" item, the "Add Files" label, the ephemeral offering rule and the images-only accept. Its mock translation map keeps the upstream keys (`com_ui_upload_provider`, `com_ui_upload_image_input`, etc.), which also keeps them referenced for upstream's static i18n check (`scripts/static-checks.mts`). | tests | If upstream rewrites the suite, port our expectations. |
| 8 | `client/src/utils/__tests__/getViableUploadOptions.spec.ts` | Expectations for the images-only provider option. | tests | Same as above. |
| 9 | `client/src/hooks/Input/useTextarea.spec.tsx` | New legacy-mode describe block with 4 cases: images upload directly, a PDF opens the chooser, an image with the provider option not viable opens the chooser, and nothing fitting shows the toast. | tests | Same as above. |
| 9b | `client/src/components/Chat/Input/__tests__/ChatForm.pasteUpload.spec.tsx` | The two legacy-mode "composer focus after a pasted upload" tests now paste a non-image (PDF) instead of a PNG, because pasted images go straight to the provider without the chooser (company paste rule in `useTextarea.ts`). | tests | If upstream changes these tests, keep the non-image fixture so the chooser still opens. |
| 10 | `e2e/specs/mock/{chat,shared-links,thread-renderers,user-image-alignment,unified-upload,code-upload,file-provisioning}.spec.ts` | Chat attach-menu locators renamed: "Upload to Provider" to "Add Photos", "Upload to Code Environment" to "Add Files". Fixtures and flows unchanged. In `file-provisioning.spec.ts` only the locator changed; the upstream test title and comment that still say "Upload to Code Environment" are left as-is to keep merges clean. e2e runs with `e2e/config/librechat.e2e.yaml` (which enables `context`), not our `librechat.yaml`, so "Upload as Text" locators stay. | tests | Re-apply the label changes (marked `// company:`). Agent-builder side-panel locators keep upstream labels. |

**Invariants**
- `fileConfig.legacyFileUploadUX` must stay `true` (never `false` globally or per endpoint; a
  per-endpoint value overrides the global one). Otherwise v0.8.8's unified "Attach Files" button
  returns, the server routes files itself, and 5.1/5.3/5.4 are undone.
- `context` must never be re-added to `capabilities` in `librechat.yaml`.
- The capabilities new in v0.8.8 (`stateful_code_sessions`, `memory`, `ask_user_question`,
  `run_in_background`, `tool_intents`) are deliberately not enabled. `programmatic_tools`
  existed before v0.8.8 and stays off.
- `com_ui_add_files` / `com_ui_add_photos` are company-owned locale keys; never rename to upstream keys.
- Agent-builder side panels intentionally keep upstream labels ("Upload for File Search",
  "Upload to Code Environment"); only the chat attach surfaces are renamed.

**Known accepted side effects**
- Removing the `context` capability also hides the agent-builder "File Context" panel, and any
  imported agents with existing context files would stop injecting them (fresh deployment: none exist).
- The images-only restriction is client-side UX; a crafted API request can still upload other
  types. Server hardening was deliberately skipped to keep zero server diff.
- Add Photos is images-only through the picker's `accept` filter only: a user who switches the
  picker to "All files" can still attach a PDF directly (review finding M1, accepted).
- Drag-drop "Upload for File Search" in an ephemeral chat does not switch the File Search toggle
  on (review finding L2, accepted).
- Pasting only non-images (e.g. a PDF) opens the File Search / Add Files chooser instead of
  showing a toast.
- Mixed image + non-image sets (paste or drop, e.g. PNG + PDF) before the 5.2 flip go straight
  to Code Interpreter (Add Files) with no chooser: images are not File Search targets upstream
  and the provider option needs all images, so only one option remains and upstream
  auto-routes it. (v0.8.7 behaved differently: a mixed paste sent the image to the provider
  and toasted the PDF; a mixed drop showed the chooser.)
- After the 5.2 flip, when Add Files is the only option, a dropped or pasted PDF goes straight
  to Code Interpreter without a chooser (upstream behaviour).
- Any top-level `fileConfig` (required for `legacyFileUploadUX`) makes the server use the
  merged default file size limit (512MB) for provider pre-checks instead of the provider
  fallbacks (e.g. 5MB Anthropic / 20MB Google image, 32MB PDF) in `packages/api/src/files`
  (`encode/utils.ts` `getConfiguredFileSizeLimit`, `encode/image.ts`, `validation.ts`
  `validateImage`). Impact is small (images are resized server-side; Add Photos is
  images-only); an oversized file gets a provider error instead of LibreChat's message.
  Optional mitigation: explicit per-endpoint `fileSizeLimit` values.

## 2. Configuration

- The live config is **`librechat.yaml` at the repo root**; the server loads it by default
  (no `CONFIG_PATH` needed). Upstream gitignores this file; our fork replaced that ignore line
  so the config is committed and shared.
- Config changes need a **backend restart only**, no client rebuild.
- **File Search kill-switch (spec 5.2):** when the Code Interpreter API is deployed, delete
  `"file_search"` from the `endpoints.agents.capabilities` list in `librechat.yaml` and restart
  the backend. "Upload for File Search" disappears from the attach menu and drag/paste chooser
  (and the agent-builder File Search panel, expected). Restore and restart to bring it back.
- The capabilities list is intentionally lean (see inventory row 1): web search, artifacts,
  subagents, skills, memory, ask_user_question, chain and OCR are disabled deployment-wide in
  addition to `context`.

## 3. Upgrade notes for v0.8.8 deployments

Variable names only; values stay in each deployment's own `.env`.

- `SCHEDULES_SINGLE_PROCESS`: set `true` for a single-process deployment without Redis;
  otherwise the log shows "[schedules] scheduler NOT started" and schedule write routes are
  unavailable.
- `CREDS_KEY`, `CREDS_IV`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `MEILI_MASTER_KEY` are blank in
  the v0.8.8 `.env.example`: deployments must keep their existing persistent values (blank
  `CREDS_*` makes LibreChat generate temporary credentials).
- The `SEARCH` default changed to `false` in `.env.example`.
- New optional env groups in v0.8.8 (none required at startup): Code API / sandbox
  (`CODEAPI_*`, `LIBRECHAT_CODE_*`), security headers / CSP (`SECURITY_HEADERS`, `CSP_*`,
  `HSTS_*`), HTTP timeouts (`HTTP_*_TIMEOUT_MS`), rate limits (`RESET_PASSWORD_*`,
  `VERIFY_EMAIL_*`, `SHARE_*`, `FILE_USAGE_USER_*`), auth/tenancy, observability
  (`LANGFUSE_*`, `OTEL_*`), Redis keep-alive, file/stream tuning, deployment plugins and
  schedules.
- The config file now needs `fileConfig.legacyFileUploadUX: true` (already in `librechat.yaml`).

## 4. Version control process (spec #6)

### Remote layout
| Remote | URL | Purpose |
|--------|-----|---------|
| `origin` | `https://github.com/CBSI-Data-Technology-Innovation/LibreChat.git` | Company repo; company changes live on branch `dev` (the fork's `main` currently mirrors upstream) |
| `upstream` | `https://github.com/LibreChat-AI/LibreChat.git` | Open-source LibreChat; read-only |

One-time setup on a fresh clone of the company repo:
```bash
git clone https://github.com/CBSI-Data-Technology-Innovation/LibreChat.git
cd LibreChat
git remote add upstream https://github.com/LibreChat-AI/LibreChat.git
git fetch upstream --tags
```
Existing clones may use different remote names; check `git remote -v`.

### Branch model (to be confirmed with the shadowlab team)
- `dev`: company mainline (what UAT/prod deploys). Changes land via PR.
- `main`: currently mirrors upstream.
- `feat/*`, `fix/*`: short-lived feature branches off `dev`.
- `chore/upstream-sync-vX.Y.Z`: upstream merge branches (below).

### Merging upstream updates (per upstream release)
```bash
git fetch upstream --tags
git checkout -b chore/upstream-sync-vX.Y.Z dev
git merge vX.Y.Z            # merge the release TAG; never rebase dev onto upstream
# resolve conflicts; expected ONLY in files listed in the inventory above
npm ci
npm run frontend            # full build must pass
npm run test:client         # client suite must pass
git push origin chore/upstream-sync-vX.Y.Z
# open PR into dev; merge with a MERGE COMMIT (never squash: squashing discards the
# recorded merge base and re-conflicts every future sync)
```

Conflict resolution rules:
1. `client/src/locales/en/translation.json`: take both sides (our two keys plus upstream's changes).
2. Customized client files (`AttachFileMenu.tsx`, `DragDropModal.tsx`, `client/src/utils/files.ts`,
   `useTextarea.ts`): take upstream's structure first, then re-apply the `// company:` marked
   edits per the inventory.
3. `librechat.yaml` is not merged (upstream ignores it); compare the new `librechat.example.yaml`
   with the previous one and carry over relevant changes by hand, keeping the invariants.
4. Anything else conflicting means upstream touched an area we haven't customized; resolve
   normally, favoring upstream.
5. After any sync, run the verification checklist (section 5).

### Commit policy
- Commit messages describe the change only. **No Co-Authored-By or attribution trailers.**
- Track upstream **release tags**, not upstream `main`, for predictable, changelog-backed syncs.

## 5. Verification checklist (after any sync or upload-UX change)

1. `npm run test:client`: green.
2. The unified "Attach Files" button is absent; the legacy "+" attach menu is present.
3. The "+" menu shows exactly: **Add Photos**, **Upload for File Search** (until the 5.2 flip),
   **Add Files**. No "Upload as Text", no "Upload to Provider".
4. The "Add Photos" file picker accepts images only (input `accept="image/*,.heif,.heic"`),
   including on permissive custom endpoints.
5. Drag a PDF into the chat: the chooser offers only File Search / Add Files. Drag a PNG:
   "Add Photos" is offered.
6. Paste a PNG: it uploads directly. Paste a PDF: the File Search / Add Files chooser opens.
7. Agent builder: File Search / Code panels keep upstream labels; the File Context panel is absent.
8. Kill-switch drill (config only, no rebuild): remove `"file_search"` from the capabilities
   list, restart the backend, hard refresh, the option is gone; restore it and it returns.
