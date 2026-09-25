import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const element=()=>({value:"",checked:false,textContent:"",innerHTML:"",addEventListener(){},classList:{toggle(){}}});
const elements=new Map();
const context={console,document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},modelContext:null}};
context.window=context;
vm.createContext(context);
const configSource=fs.readFileSync(new URL("../ruleset-config.js",import.meta.url),"utf8");
const rulesetSource=fs.readFileSync(new URL("../ruleset.js",import.meta.url),"utf8");
vm.runInContext(`${configSource}\n${rulesetSource}\nglobalThis.runValidation=SynopRuleset.validate;`,context);

// Architecture guard: meteorological findings belong in the ruleset,
// while the page controller should not contain operational error rules.
const pageSource=fs.readFileSync(new URL("../app.js",import.meta.url),"utf8");
assert.ok(rulesetSource.includes("MSLP outside the realistic surface range"));
assert.ok(!pageSource.includes("MSLP outside the realistic surface range"));
assert.equal(context.SYNOP_RULESET_CONFIG.version,"v0.13.1-separated");

// Browser-load guard: load app.js after the ruleset as separate classic
// scripts. This catches global-name collisions that a syntax check misses.
vm.runInContext(pageSource,context,{filename:"app.js"});

const missed=`SIPH20 RPLC 212100 AAXX 21211 98327 32458 72001 10253 20238 39930 40102 55002 83108 333 56909 83820 87360=IC`;
const missedResult=context.runValidation(missed,{p3:null,p24:null,rainOccurred:false});
const missedIssue=missedResult.issues.find(issue=>issue.group==="83108 87360");
assert.ok(missedIssue,"83108 / 87360 mismatch must be detected");
assert.match(missedIssue.detail,/CM=0 \(no middle cloud\)/);
assert.match(missedIssue.detail,/C=3 \(Altocumulus\)/);
assert.match(missedIssue.suggestion,/87280/);

const named=`AAXX 01001 98327 11456 80000 10200 20100 40000 50000 8562/ 333 88359=`;
const namedResult=context.runValidation(named,{p3:null,p24:null,rainOccurred:false});
const namedIssue=namedResult.issues.find(issue=>issue.group==="8562/ 88359");
assert.ok(namedIssue,"8562/ / 88359 mismatch must be detected");
assert.match(namedIssue.detail,/Altostratus opacus or Nimbostratus/);
assert.match(namedIssue.detail,/Altocumulus/);
assert.match(namedIssue.suggestion,/C=4 \(Altostratus\).*C=5 \(Nimbostratus\)/);

const cbWithOtherLow=`AAXX 01001 98327 11456 80000 10200 20100 40000 50000 83300 333 81610 83920 94940=`;
const cbWithOtherLowResult=context.runValidation(cbWithOtherLow,{p3:null,p24:null,rainOccurred:false});
assert.ok(!cbWithOtherLowResult.issues.some(issue=>issue.title.includes("reportable low-cloud mismatch")),"CB must not exclude other low-cloud genera");
assert.ok(!cbWithOtherLowResult.issues.some(issue=>issue.title==="CB reportable-cloud group missing"),"reported CB layer must be accepted");

const missingCbLayer=`AAXX 01001 98327 11456 80000 10200 20100 40000 50000 83300 333 81610 94940=`;
const missingCbResult=context.runValidation(missingCbLayer,{p3:null,p24:null,rainOccurred:false});
assert.ok(missingCbResult.issues.some(issue=>issue.title==="CB reportable-cloud group missing"),"CL Cumulonimbus must require a reportable CB layer");

const bad135=`AAXX 01001 98327 11456 80000 10200 20100 40000 50000 88108 333 81820 82280=`;
const bad135Result=context.runValidation(bad135,{p3:null,p24:null,rainOccurred:false});
assert.ok(bad135Result.issues.some(issue=>issue.title==="Cloud layer does not meet the 1-3-5 amount rule"),"second layer below 3 oktas must be detected");

const drizzleWithoutStratus=`AAXX 01001 98327 11456 80000 10200 20100 40000 50000 75000 88108 333 81820=`;
const drizzleResult=context.runValidation(drizzleWithoutStratus,{p3:null,p24:null,rainOccurred:false});
assert.ok(drizzleResult.issues.some(issue=>issue.title==="Precipitation and cloud type need review"&&issue.detail.includes("Stratus")),"drizzle without Stratus must warn");

const validCbAndCu=`SIPH20 RPLC 212100 AAXX 21211 98327 32458 72001 10253 20238 39930 40102 55002 84908 333 56909 81915 83820 87280 94945=IC`;
const validCbAndCuResult=context.runValidation(validCbAndCu,{p3:null,p24:null,rainOccurred:false});
assert.ok(!validCbAndCuResult.issues.some(issue=>/low-cloud (amount|mismatch)/i.test(`${issue.title} ${issue.detail}`)),"1 okta CB plus 3 oktas Cumulus must be accepted with Nh=4");
assert.ok(!validCbAndCuResult.issues.some(issue=>issue.title==="CB reportable-cloud group missing"),"81915 must satisfy the reportable CB requirement");
assert.equal(validCbAndCuResult.decoded["Low-cloud amount check"],"Nh=4; Cumulonimbus 1 + Cumulus 3 = 4 oktas");

// Pressure groups are encoded in tenths of a hectopascal. Exact matches pass;
// even a 0.1 hPa difference must be reported as an error.
const pressure3h=`AAXX 17121 98327 11460 62001 10260 20241 39934 40107 52027 60101 70262 82508 333 10332 56909 82620 86280=`;
const pressure3hExact=context.runValidation(pressure3h,{p3:1008.0,p24:null,rainOccurred:false});
assert.ok(!pressure3hExact.issues.some(issue=>issue.title==="5appp amount does not match pressure history"),"exact 3-hour pressure change must pass");
const pressure3hOffByTenth=context.runValidation(pressure3h,{p3:1008.1,p24:null,rainOccurred:false});
assert.ok(pressure3hOffByTenth.issues.some(issue=>issue.title==="5appp amount does not match pressure history"),"0.1 hPa 3-hour mismatch must be an error");

const pressure24h=`SMPH20 RPLC 151200 AAXX 15121 98327 11462 72502 10260 20240 39924 40097 56019 69961 76098 84470 333 10342 56990 58002 84620 87360=JD/MP`;
const pressure24hExact=context.runValidation(pressure24h,{p3:null,p24:1009.5,rainOccurred:false});
assert.ok(!pressure24hExact.issues.some(issue=>issue.title==="24-hour pressure change mismatch"),"exact 24-hour pressure change must pass");
const pressure24hOffByTenth=context.runValidation(pressure24h,{p3:null,p24:1009.6,rainOccurred:false});
assert.ok(pressure24hOffByTenth.issues.some(issue=>issue.title==="24-hour pressure change mismatch"),"0.1 hPa 24-hour mismatch must be an error");

const baseHead=`SMPH20 RPLC 180000 AAXX 18001 98327`;
const commonTail=`32401 10264 20240 39939 40112 53011 60164 70162 84901 333 20240 55066 56909 58014 70155 81915 83820 86080 94945 555 20002=JG/MP`;

const mainTimeIr2=context.runValidation(`${baseHead} 21465 ${commonTail}`,{p3:null,p24:null,rainOccurred:false});
assert.ok(mainTimeIr2.issues.some(issue=>issue.title==="iR=2 is invalid at a main observation time"),"iR=2 must be rejected at 00 UTC main observation");

const rainfallWithoutWeather=context.runValidation(`${baseHead} 12465 32401 10264 20240 39939 40112 53011 60164 81101 333 20240 55066 56909 58014 81820 83080 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(rainfallWithoutWeather.issues.some(issue=>issue.title==="Rainfall requires present or past weather"),"Section 5 rainfall must require a weather group");

const unexplainedLowVisibility=context.runValidation(`${baseHead} 11410 32401 10264 20240 39939 40112 53011 60164 70162 81101 333 20240 55066 56909 58014 70155 81820 83080 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(unexplainedLowVisibility.issues.some(issue=>issue.title==="Low visibility is not supported by present weather"),"visibility at or below 5 km needs supporting weather");

const cloudArithmetic=context.runValidation(`${baseHead} 11465 52401 10264 20240 39939 40112 53011 60164 70162 84901 333 20240 55066 56909 58014 70155 81915 84820 86080 94945 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(cloudArithmetic.issues.some(issue=>issue.title==="Individual cloud layer exceeds total cloud cover"),"Ns greater than N must be detected");
assert.ok(cloudArithmetic.issues.some(issue=>issue.title==="Low-cloud amounts do not add up to Nh"),"summed low-cloud Ns must equal Nh");

const duplicate=context.runValidation(`${baseHead} 11465 52401 10264 10264 20240 39939 40112 53011 60164 70162 84901 333 20240 55066 56909 58014 70155 81915 83820 86080 94945 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(duplicate.issues.some(issue=>issue.title==="Duplicate Section 1 group"&&issue.group==="10264"),"duplicate Section 1 groups must be detected");

const warmTwoGroup=context.runValidation(`${baseHead} 11465 52401 10264 20265 39939 40112 53011 60164 70162 84901 333 20240 55066 56909 58014 70155 81915 83820 86080 94945 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(warmTwoGroup.issues.some(issue=>issue.title==="2-group temperature exceeds air temperature"),"a 0.1 C warmer 2-group must be detected");

const impossibleMslp=context.runValidation(`${baseHead} 11465 52401 10264 20240 39939 41112 53011 60164 70162 84901 333 20240 55066 56909 58014 70155 81915 83820 86080 94945 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(impossibleMslp.issues.some(issue=>issue.title==="MSLP outside the realistic surface range"),"1111.2 hPa must be rejected");

const wrongTemperatureSchedule=context.runValidation(`${baseHead} 11465 52401 10264 20240 39939 40112 53011 60164 70162 84901 333 10240 55066 56909 58014 70155 81915 83820 86080 94945 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(wrongTemperatureSchedule.issues.some(issue=>issue.title==="Maximum temperature reported at 00 UTC"),"00 UTC must use the minimum-temperature 2-group");

const badCloudDirection=context.runValidation(`${baseHead} 11465 52401 10264 20240 39939 40112 53011 60164 70162 84901 333 20240 55066 56999 58014 70155 81915 83820 86080 94945 555 20002=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(badCloudDirection.issues.some(issue=>issue.title==="Middle-cloud direction conflicts with no cloud"),"56DDD must use 0 when CM=0");

const zeroH24=context.runValidation(`${baseHead} 11465 52401 10264 20240 39939 40112 53011 60164 70162 84901 333 20240 55066 56909 59000 70155 81915 83820 86080 94945 555 20002=JG/MP`,{p3:null,p24:1011.2,rainOccurred:false});
assert.ok(zeroH24.issues.some(issue=>issue.title==="Zero 24-hour pressure change must use 58"),"zero 24-hour change must use 58000");

const lateMonthlyRain=context.runValidation(`${baseHead} 11465 52401 10264 20240 39939 40112 53011 60164 70162 84901 333 20240 55066 56909 58014 70155 81915 83820 86080 94945 555 20002 61011=JG/MP`,{p3:null,p24:null,rainOccurred:false});
assert.ok(lateMonthlyRain.issues.some(issue=>issue.title==="Section 5 monthly-rainfall group at the wrong time"),"Section 5 6RRRR must be day 1 at 00 UTC");

console.log("cloud, pressure, and additional-error regression checks passed");
