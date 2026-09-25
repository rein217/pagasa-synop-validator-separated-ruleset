# Change log

## v0.13.1-separated

- Fixed a browser startup failure caused by duplicate global names in
  `ruleset.js` and `app.js`.
- Wrapped the page controller in a private scope.
- Added a regression test that loads all three scripts in browser order.

## v0.13-separated

- Separated editable rule settings into `ruleset-config.js`.
- Separated parsing and meteorological validation into `ruleset.js`.
- Reduced `app.js` to webpage controls and result rendering.
- Added beginner-oriented comments and a ruleset editing guide.
- Preserved the v0.12 validation behavior and regression examples.
