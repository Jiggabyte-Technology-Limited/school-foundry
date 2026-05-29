# SchoolFoundry Screenshots and Video Capture Guide

This guide explains exactly what to capture for the in-app User Guide, what to name each file, and where to place the files so they appear in the guide automatically.

## 1. Where the media goes

The app reads guide media from the Electron user data folder, not from the repo.

### Windows location

`%APPDATA%\SchoolFoundry\guide-media\`

If you are unsure, open the User Guide in the app and it will show the exact media root path for the current machine.

### Folder structure

Each User Guide section has its own folder:

```text
guide-media/
  app-tour/
    screenshots/
    videos/
  add-learner/
    screenshots/
    videos/
  edit-learner/
    screenshots/
    videos/
  ...
```

### Important rule

Do not put all screenshots in one shared folder. The app groups media by section ID, so the section folder name must match the User Guide section exactly.

## 2. Naming rules

Use stable, numbered filenames so the files sort in the right order.

### Screenshots

- Format: `.png`
- Pattern: `01-short-description.png`
- Example: `01-dashboard-overview.png`

### Screen recordings

- Format: `.mp4` or `.webm`
- Pattern: `01-short-description.mp4`
- Example: `01-add-learner-wizard.mp4`

### Naming style

- Keep names short and descriptive.
- Use lowercase letters, numbers, and hyphens only.
- Keep the same prefix number for related screenshot and video files so they stay aligned.

## 3. What to capture

Take the screenshots and recordings below in the same order as the User Guide sections.

| Guide section | What to capture | Screenshot filename examples | Video filename examples | Folder |
|---|---|---|---|---|
| `app-tour` | Dashboard and sidebar overview showing the main app areas. | `01-dashboard-overview.png` | `01-app-tour-sidebar.mp4` | `app-tour/screenshots` and `app-tour/videos` |
| `add-learner` | The Add Learner / Student wizard with the key fields visible. | `01-add-learner-form.png` | `01-add-learner-wizard.mp4` | `add-learner/screenshots` and `add-learner/videos` |
| `edit-learner` | A learner profile with the edit panel or edit modal open. | `01-edit-learner-profile.png` | `01-edit-learner-details.mp4` | `edit-learner/screenshots` and `edit-learner/videos` |
| `activate-deactivate` | The active/inactive control and confirmation state. | `01-learner-status-toggle.png` | `01-activate-deactivate-learner.mp4` | `activate-deactivate/screenshots` and `activate-deactivate/videos` |
| `open-account` | The learner statement or account view with balance visible. | `01-statement-overview.png` | `01-open-learner-account.mp4` | `open-account/screenshots` and `open-account/videos` |
| `record-payment` | The payment entry flow and confirmation/receipt preview. | `01-record-payment-form.png` | `01-record-payment-and-receipt.mp4` | `record-payment/screenshots` and `record-payment/videos` |
| `void-payment` | The receipt or payment detail view showing the void action. | `01-void-payment-dialog.png` | `01-void-payment-flow.mp4` | `void-payment/screenshots` and `void-payment/videos` |
| `statements-export` | Print Statement / Export Excel action on the learner or report view. | `01-statement-export-actions.png` | `01-export-statement-or-excel.mp4` | `statements-export/screenshots` and `statements-export/videos` |
| `class-list` | The class list, grade filter, or register-style table. | `01-class-list-overview.png` | `01-class-list-filtering.mp4` | `class-list/screenshots` and `class-list/videos` |
| `school-fees` | The fee matrix or fee structure editor with year and grade visible. | `01-school-fees-matrix.png` | `01-edit-school-fees.mp4` | `school-fees/screenshots` and `school-fees/videos` |
| `backup-restore` | The backup/restore page with the primary action buttons visible. | `01-backup-restore-page.png` | `01-backup-and-restore.mp4` | `backup-restore/screenshots` and `backup-restore/videos` |
| `settings-admin` | The Settings screen, especially School, Users, License, or Danger Zone tabs. | `01-settings-overview.png` | `01-settings-and-users.mp4` | `settings-admin/screenshots` and `settings-admin/videos` |
| `first-run` | The setup wizard with school name, logo, and admin setup visible. | `01-first-run-setup.png` | `01-first-run-wizard.mp4` | `first-run/screenshots` and `first-run/videos` |

## 4. Recommended capture checklist

### Screenshots to take

1. Dashboard overview with the main navigation visible.
2. Add learner form with the core fields visible.
3. Learner profile or edit panel.
4. Learner active/inactive status control.
5. Statement/account view with balances.
6. Record payment form and confirmation state.
7. Void payment dialog or receipt detail.
8. Print statement or export affordance.
9. Class list or grade-filtered table.
10. School fees matrix/editor.
11. Backup/restore screen.
12. Settings screen with School, Users, and License areas.
13. First-run setup wizard.

### Screen recordings to take

1. App tour from dashboard to a few sidebar sections.
2. Add learner flow from start to save.
3. Edit learner flow showing changes being saved.
4. Record payment flow through receipt preview.
5. Export statement or Excel flow.
6. Class list filtering and drill-down.
7. School fees editing and save action.
8. Backup creation and restore prompt.
9. Settings management, including users or license.
10. First-run setup from launch to completion.

## 5. Recording standards

- Keep each recording focused on one task only.
- Aim for 20 to 60 seconds per clip.
- Use a clean desktop with no notifications.
- Do not zoom in and out unless the UI is too small to read.
- Move slowly enough that the action is easy to follow.
- If you make a mistake during capture, re-record the clip rather than editing around the mistake.

## 6. Suggested workflow

1. Open the relevant User Guide section in the app.
2. Perform the task once with the final data you want to show.
3. Capture the screenshot when the important state is visible.
4. Record the screen once through the full flow.
5. Save both files into the correct section folder.
6. Refresh the User Guide to confirm the media appears.

## 7. Quick reference

- Screenshots go in: `guide-media/<section-id>/screenshots/`
- Recordings go in: `guide-media/<section-id>/videos/`
- File names should start with `01-`, `02-`, `03-` to preserve order.
- The folder name must match the User Guide section ID exactly.

