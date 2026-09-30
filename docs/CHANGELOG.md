# Change log

## v0.14.2 site-document update

- Made the header Ruleset v0.14.2 badge clickable.
- Added an in-site ruleset viewer page.
- Added a direct PDF download option for operational review.

## v0.14.2-separated

- Fixed email feedback not opening on some browsers and hosted pages.
- Replaced direct page navigation with an actual `mailto:` link click.
- Shortened the email draft to avoid mail-handler URL-length limits.
- Added a visible confirmation and clipboard fallback when no default email
  application is configured.

## v0.14.1-separated

- Added a **Report checker issue** button for operational feedback.
- The button opens the user's default email application with a draft addressed
  to `renieragas@gmail.com`.
- The draft includes the entered SYNOP code, ruleset version, validation
  summary, findings, and choices for a missed error or a false error flag.
- The webpage does not send or store the observation automatically; the user
  reviews the draft before sending it.

## v0.14-separated

- Aligned the cloud-layer amount check with the 2023 PAGASA amended SSO
  guidelines: individual `Ns` values are estimated as if other layers did not
  exist and are no longer added to derive `Nh`.
- Added the official overlapping-layer regression example (`Nh=5`, 3 oktas
  Cumulus, 4 oktas Stratocumulus).
- Expanded combined cloud-type mappings, including `CL=8` for both Cumulus and
  Stratocumulus and `CM=7` for Ac with As/Ns.
- Added omission and vertical-visibility rules for `N=0`, `N=9`, and `N=/`.
- Limited the Section 1 `h` comparison to the lowest reported low-cloud layer.
- Restored the first site's visible layout and wording while retaining the
  separated ruleset architecture.

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
