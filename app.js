/*
 * PAGASA SYNOP VALIDATOR — PAGE CONTROLS
 * ---------------------------------------
 * This file only connects the ruleset to the webpage.
 * Meteorological rules belong in ruleset-config.js or ruleset.js.
 */

// Keep page-only variable names inside this private wrapper. This prevents
// them from colliding with functions exported by ruleset.js in the browser.
(() => {

const $ = (id) => document.getElementById(id);
const { parseCode, validate } = window.SynopRuleset;
const sample4 = `SMPH20 RPLC 151200 AAXX 15121 98327 11462 72502 10260 20240 39924 40097 56019 69961 76098 84470 333 10342 56990 58002 84620 87360=JD/MP`;
const n = (value) => value === "" ? null : Number(value);

// Batch A — turn validator results into readable cards.
function render(result){
  const errors=result.issues.filter(x=>x.severity==="error").length;
  const warnings=result.issues.filter(x=>x.severity==="warning").length;
  const state=errors?"invalid":warnings?"warning":"valid";
  const label=errors?"Invalid":warnings?"Valid with warnings":"Valid";
  const escaped=s=>String(s).replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]);
  const decoded=Object.entries(result.decoded).map(([k,v])=>`<div class="decoded-item"><span>${escaped(k)}</span>${escaped(v)}</div>`).join("");
  const issues=result.issues.map(x=>`<article class="issue ${x.severity}"><div class="issue-top"><div class="issue-title">${escaped(x.title)}</div><span class="severity">${escaped(x.severity)}</span></div><p>${escaped(x.detail)}</p>${x.group?`<code>${escaped(x.group)}</code>`:""}${x.suggestion?`<p class="suggestion">Correction: ${escaped(x.suggestion)}</p>`:""}</article>`).join("");
  $("results").innerHTML=`<div class="results-head"><h2>Validation result</h2><span class="badge ${state}">${label}</span></div><div class="summary"><div class="metric"><strong>${errors}</strong><span>Errors</span></div><div class="metric"><strong>${warnings}</strong><span>Warnings</span></div><div class="metric"><strong>${result.p.sec1.length+result.p.sec3.length+(result.p.sec5?.length||0)}</strong><span>Data groups checked</span></div></div>${decoded?`<div class="decoded"><h3>Decoded overview</h3><div class="decoded-grid">${decoded}</div></div>`:""}<div class="issues"><h3>Findings and corrections</h3>${issues}</div>`;
}

function history(){return {p3:n($("p3").value),p24:n($("p24").value),rainOccurred:$("rainOccurred").checked}}

// Batch B — detect the report time and show the 24-hour field when needed.
function updateTime(){
  const p=parseCode($("synopCode").value),ok=/^\d{5}$/.test(p.yy),hour=ok?Number(p.yy.slice(2,4)):null;
  $("obsTimeBadge").textContent=ok?`${String(hour).padStart(2,"0")}:00 UTC detected`:"Time not detected";
  $("obsTimeBadge").classList.toggle("active",ok);
  $("p24Wrap").classList.toggle("visible",window.SYNOP_RULESET_CONFIG.schedule.pressure24Hours.includes(hour));
}
$("synopCode").addEventListener("input",updateTime);

// Batch C — button actions.
$("validate").addEventListener("click",()=>render(validate($("synopCode").value,history())));
$("loadSample").addEventListener("click",()=>{$("synopCode").value=sample4;$("rainOccurred").checked=false;["p3","p24"].forEach(id=>$(id).value="");updateTime();render(validate(sample4,history()));});
$("clear").addEventListener("click",()=>{$("synopCode").value="";$("rainOccurred").checked=false;["p3","p24"].forEach(id=>$(id).value="");updateTime();$("results").innerHTML=`<div class="empty-state"><div class="empty-icon">✓</div><h2>Ready to check</h2><p>Paste an observation and provide its pressure history.</p></div>`;});

if(document.modelContext?.registerTool){
  try{document.modelContext.registerTool({name:"validate_synop",title:"Validate SYNOP",description:"Validate one WMO FM 12 SYNOP observation using the same rules and supporting inputs as the visible checker.",inputSchema:{type:"object",properties:{code:{type:"string"},mslp_3h_ago:{type:"number"},mslp_24h_ago:{type:"number"},rainfall_occurred:{type:"boolean"}},required:["code"],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input){if(!input||typeof input.code!=="string")throw new Error("code must be a string");const h={p3:input.mslp_3h_ago??null,p24:input.mslp_24h_ago??null,rainOccurred:input.rainfall_occurred===true};$("synopCode").value=input.code;$("rainOccurred").checked=h.rainOccurred;$("p3").value=h.p3??"";$("p24").value=h.p24??"";updateTime();const r=validate(input.code,h);render(r);return {status:r.issues.some(x=>x.severity==="error")?"invalid":r.issues.some(x=>x.severity==="warning")?"warning":"valid",issues:r.issues,decoded:r.decoded};}})}catch(e){console.warn("WebMCP registration unavailable",e)}
}

})();
