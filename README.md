# PAGASA SYNOP Validator v0.14.2

Static WMO FM 12 SYNOP validator using PAGASA operational practices and the
2023 amended guidelines on surface synoptic observation.

Version 0.14.2 includes a **Report checker issue** button. It opens an editable
email draft addressed to `renieragas@gmail.com` containing the entered SYNOP
code and the validator findings. The webpage does not automatically send or
store the report. This version uses a shorter email link and copies the draft
as a fallback when the device has no default email application.

## Required website files

Keep these website files together in the repository root:

- `index.html`
- `styles.css`
- `app.js`
- `ruleset-config.js`
- `ruleset.js`
- `ruleset.html`
- `PAGASA_SYNOP_Validator_Ruleset_v0.14.2.pdf`

The documentation and `tests` folder are recommended but are not required for
the webpage to load.

## File responsibilities

- `ruleset-config.js` contains the beginner-editable operational settings.
- `ruleset.js` contains parsing and meteorological validation logic.
- `app.js` contains webpage controls and result rendering.
- `index.html` loads the files in the required order.
- `styles.css` contains the first site's visual design.
- `ruleset.html` displays the current ruleset and provides the PDF download.

## Test before publishing

With Node.js installed, run:

```bash
node tests/ruleset-regression.test.mjs
```

Expected result:

```text
cloud, pressure, and additional-error regression checks passed
```

## Update an existing GitHub repository

1. Open the repository on GitHub.
2. Select **Add file → Upload files**.
3. Upload all files and folders from this package. Keep `index.html` in the
   repository root, not inside another folder.
4. When GitHub asks about files with the same name, allow the new files to
   replace the older versions.
5. Enter a commit message such as `Update PAGASA SYNOP Validator to v0.14.2`.
6. Select **Commit directly to the main branch**. If that choice is unavailable,
   select **Create a new branch and start a pull request**, then merge the pull
   request into `main`.

## GitHub Pages settings

Under **Settings → Pages**, use:

- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/(root)**

After saving, GitHub normally needs a few minutes to publish the update.

This remains an operational review build and should continue to be checked
against official WMO and PAGASA documentation.
