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

This is an operational draft for review against official WMO and PAGASA documentation.
