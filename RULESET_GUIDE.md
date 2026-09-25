# Beginner guide to the separated ruleset

The website is divided into three JavaScript files so that operational rules can be reviewed without touching the page controls.

## 1. `ruleset-config.js`

Start here for routine policy changes. It contains readable settings for:

- ruleset version;
- realistic MSLP limits;
- main and intermediate observation hours;
- 00/12 UTC pressure checks;
- cloud-level boundaries;
- the 1-3-5 cloud-layer thresholds;
- maximum reportable-cloud groups;
- CB nature codes; and
- the extended monthly-rainfall threshold and schedule.

Example: changing the maximum realistic MSLP from `1085.0` to `1080.0` requires changing only:

```js
maximumMslp: 1080.0
```

## 2. `ruleset.js`

This contains the meteorological logic. Each batch has a comment describing its purpose. Edit this file only when the actual logic changes—for example, when a new relationship between two coded groups must be checked.

The file exports only:

- `SynopRuleset.parseCode()`
- `SynopRuleset.validate()`
- `SynopRuleset.version`

## 3. `app.js`

This controls the visible webpage:

- buttons;
- pressure-history fields;
- rainfall checkbox;
- display of decoded information; and
- error/warning cards.

Changing an operational meteorological rule should normally not require editing this file.

## Safe editing workflow

1. Make one rule change at a time.
2. Update the version in `ruleset-config.js`.
3. Run `node tests/ruleset-regression.test.mjs`.
4. Test known correct and known incorrect observations.
5. Record the reason and example in `CHANGELOG.md`.
6. Upload the changed file to GitHub and commit it.

Keep the previous working version available so a change can be reversed if testing finds a problem.
