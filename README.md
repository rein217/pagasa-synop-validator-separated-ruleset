# PAGASA SYNOP Validator — separated ruleset review build

This review build keeps meteorological rules separate from the user-interface code.

## Structure

- `ruleset-config.js` — beginner-editable operational values and schedules
- `ruleset.js` — parsing, decoding and validation logic
- `app.js` — buttons and result display only
- `index.html` — webpage structure and script loading order
- `styles.css` — visual design
- `tests/ruleset-regression.test.mjs` — known-case regression tests
- `RULESET_GUIDE.md` — beginner review and editing guide

## Test

```bash
node tests/ruleset-regression.test.mjs
```

## Publish on GitHub Pages

Upload all files and the `tests` folder to the top level of a GitHub repository. Then open **Settings > Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, and save.

The load order in `index.html` is important:

1. `ruleset-config.js`
2. `ruleset.js`
3. `app.js`

Do not reverse this order because the page controls depend on the ruleset files.

This is an operational draft for review against official WMO and PAGASA documentation.
