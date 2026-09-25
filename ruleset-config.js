/*
 * PAGASA SYNOP VALIDATOR — EDITABLE RULESET SETTINGS
 * --------------------------------------------------
 * This is the first file to review when an operational rule changes.
 * Most routine changes should only require editing a value or table below.
 *
 * IMPORTANT:
 * 1. Keep commas between items.
 * 2. Keep text inside quotation marks.
 * 3. Run the regression test after every change.
 * 4. Do not rename a setting unless ruleset.js is updated too.
 */

window.SYNOP_RULESET_CONFIG = Object.freeze({
  // Displayed in the page header and successful validation message.
  version: "v0.13.1-separated",

  // Operational pressure limits in hectopascals.
  pressure: {
    minimumMslp: 870.0,
    maximumMslp: 1085.0,
    exactComparisonTenths: true
  },

  // PAGASA observation schedule in UTC.
  schedule: {
    mainHours: [0, 6, 12, 18],
    intermediateHours: [3, 9, 15, 21],
    minimumTemperatureHour: 0,
    maximumTemperatureHour: 12,
    pressure24Hours: [0, 12],
    monthlyRainDay: 1,
    monthlyRainHour: 0,

    // Expected tR by observation hour. The key is the UTC hour.
    rainfallDurationCodeByHour: {
      0: 4,
      3: 7,
      6: 1,
      9: 7,
      12: 1,
      15: 7,
      18: 1,
      21: 7
    }
  },

  // Cloud-level boundaries used for reportable-cloud checks.
  cloudLevelsMetres: {
    lowUpperExclusive: 2000,
    middleLowerInclusive: 2000,
    middleUpperInclusive: 6000,
    highLowerExclusive: 6000
  },

  // Reportable-layer selection. The first, second and third selected
  // layers require at least 1, 3 and 5 oktas respectively.
  cloudLayerMinimumOktas: [1, 3, 5],
  maximumReportableCloudGroups: 4,

  // A visibility at or below this value needs supporting weather.
  unexplainedVisibilityWarningKm: 5,

  // Cumulonimbus supplementary group 949CD.
  cbNatureCodes: {
    isolated: "4",
    numerous: "5"
  },

  // The extended monthly rainfall form 6//// RRRRR is intended when
  // the previous month's rainfall exceeds this number of millimetres.
  extendedMonthlyRainThresholdMm: 1000
});
