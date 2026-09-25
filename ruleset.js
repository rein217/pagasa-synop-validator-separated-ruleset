/*
 * PAGASA SYNOP VALIDATOR — METEOROLOGICAL RULES
 * ----------------------------------------------
 * This file contains parsing, decoding and validation rules only.
 * It does not control buttons, page layout or result-card formatting.
 *
 * BEGINNER REVIEW MAP
 * - ruleset-config.js: values that are most likely to change
 * - ruleset.js:        how each rule is applied
 * - app.js:            page buttons and screen output
 */

const RULES = window.SYNOP_RULESET_CONFIG;

// Batch 1 — shared helpers used by several checks.
function addIssue(list, severity, title, detail, group = "", suggestion = "") {
  list.push({ severity, title, detail, group, suggestion });
}
function pressureValue(code) {
  const raw = Number(code.slice(1)) / 10;
  return raw < 500 ? 1000 + raw : 900 + raw;
}
function signedTemperature(group) {
  if (!/^[12][01]\d{3}$/.test(group)) return null;
  return (group[1] === "1" ? -1 : 1) * Number(group.slice(2)) / 10;
}
function n(v) { return v === "" ? null : Number(v); }

function duplicateGroups(groups){
  const seen=new Set(),duplicates=new Set();
  groups.forEach(g=>{if(seen.has(g)) duplicates.add(g);else seen.add(g)});
  return [...duplicates];
}

function visibilityRangeKm(vv){
  const v=Number(vv); if(!/^\d{2}$/.test(vv)) return null;
  if(v===0) return [0,.1,"less than 0.1 km"];
  if(v<=50){const km=v/10;return [km,km,`${km.toFixed(1)} km`];}
  if(v>=51&&v<=55) return null;
  if(v>=56&&v<=80){const km=v-50;return [km,km,`${km} km`];}
  if(v>=81&&v<=88){const km=35+(v-81)*5;return [km,km,`${km} km`];}
  if(v===89) return [70,Infinity,"more than 70 km"];
  return ({90:[0,.05,"less than 0.05 km"],91:[.05,.05,"0.05 km"],92:[.2,.2,"0.2 km"],93:[.5,.5,"0.5 km"],94:[1,1,"1 km"],95:[2,2,"2 km"],96:[4,4,"4 km"],97:[10,10,"10 km"],98:[20,20,"20 km"],99:[50,Infinity,"50 km or more"]})[v]||null;
}

// Batch 2 — visibility ranges associated with precipitation intensity.
function precipitationVisibility(ww){
  const light=[50,51,56,58,60,61,66,68,70,71,80,83,85,87,89,91,93];
  const moderate=[52,53,62,63,72,73];
  const heavy=[54,55,64,65,74,75,82,97,99];
  const moderateHeavy=[57,59,67,69,81,84,86,88,90,92,94];
  if(light.includes(ww)) return {label:"light precipitation",min:9,max:Infinity,range:"9 km or more"};
  if(moderate.includes(ww)) return {label:"moderate precipitation",min:2,max:9,range:"2 km to less than 9 km"};
  if(heavy.includes(ww)) return {label:"heavy precipitation",min:0,max:2,range:"less than 2 km"};
  if(moderateHeavy.includes(ww)) return {label:"moderate or heavy precipitation",min:0,max:9,range:"less than 9 km"};
  if([95,96].includes(ww)) return {label:"slight or moderate thunderstorm precipitation",min:2,max:Infinity,range:"2 km or more"};
  return null;
}

const CLOUD_GENERA=["Cirrus","Cirrocumulus","Cirrostratus","Altocumulus","Altostratus","Nimbostratus","Stratocumulus","Stratus","Cumulus","Cumulonimbus"];
function cloudGenus(code){return CLOUD_GENERA[Number(code)]||`cloud genus code ${code}`}

function section1CloudMeaning(primaryGroup,family){
  const index={low:2,middle:3,high:4}[family],code=primaryGroup?.[index];
  const meanings={
    low:{0:"no low cloud",1:"Cumulus humilis or fractus",2:"Cumulus mediocris or congestus",3:"Cumulonimbus",4:"Stratocumulus formed by spreading Cumulus",5:"Stratocumulus",6:"Stratus",7:"Stratus fractus or Cumulus fractus",8:"Cumulus and Stratocumulus",9:"Cumulonimbus"},
    middle:{0:"no middle cloud",1:"Altostratus translucidus",2:"Altostratus opacus or Nimbostratus",3:"Altocumulus translucidus",4:"Altocumulus lenticularis",5:"Altocumulus in bands",6:"Altocumulus formed by spreading Cumulus",7:"Altocumulus with Altostratus or Nimbostratus",8:"Altocumulus castellanus or floccus",9:"chaotic Altocumulus"},
    high:{0:"no high cloud",1:"Cirrus fibratus or uncinus",2:"dense Cirrus",3:"Cirrus spissatus from Cumulonimbus",4:"Cirrus uncinus or fibratus increasing",5:"Cirrus and Cirrostratus increasing",6:"Cirrus or Cirrostratus covering most of the sky",7:"Cirrostratus covering the sky",8:"Cirrostratus not increasing",9:"Cirrocumulus"}
  };
  if(code==="/"||code===undefined) return `${family}-cloud type not reported`;
  return `${family==="middle"?"CM":family==="low"?"CL":"CH"}=${code} (${meanings[family][Number(code)]||"unrecognized type"})`;
}

function expectedCloudTypes(primaryGroup, layerCode) {
  const cl=Number(primaryGroup[2]), cm=Number(primaryGroup[3]), ch=Number(primaryGroup[4]);
  if(layerCode<=2){
    if(primaryGroup[4]==="/") return null;
    if(ch===0) return [];
    if(ch===9) return [1];
    if([6,7,8].includes(ch)) return [2];
    if([1,2,3,4].includes(ch)) return [0];
    return ch===5?[0,2]:[];
  }
  if(layerCode<=5){
    if(primaryGroup[3]==="/") return null;
    if(cm===0) return [];
    if(cm===1) return [4];
    if(cm===2) return [4,5];
    return cm>=3&&cm<=9?[3]:[];
  }
  if(primaryGroup[2]==="/") return null;
  if(cl===0) return [];
  // CL=3 or 9 confirms CB, but it does not exclude other low-cloud genera.
  if([3,9].includes(cl)) return [6,7,8,9];
  if([1,2,8].includes(cl)) return [8];
  if([4,5].includes(cl)) return [6];
  if([6,7].includes(cl)) return [7];
  return [];
}

function cloudFamily(code){return code<=2?"high":code<=5?"middle":"low"}

function baseRange(h){
  return ({0:[0,50],1:[50,100],2:[100,200],3:[200,300],4:[300,600],5:[600,1000],6:[1000,1500],7:[1500,2000],8:[2000,2500],9:[2500,99999]})[h]||null;
}

function layerBaseRange(hs){
  const v=Number(hs); if(!Number.isFinite(v)||v<0||v>99) return null;
  if(v===0) return [0,30,"below 30 m"];
  if(v<=50){const m=v*30;return [m,m,`${m} m`];}
  if(v>=51&&v<=55) return null;
  if(v>=56&&v<=80){const m=1800+(v-56)*300;return [m,m,`${m} m`];}
  if(v>=81&&v<=88){const m=10500+(v-81)*1500;return [m,m,`${m} m`];}
  if(v===89) return [21000,99999,"above 21,000 m"];
  return ({90:[0,50,"below 50 m"],91:[50,100,"50-100 m"],92:[100,200,"100-200 m"],93:[200,300,"200-300 m"],94:[300,600,"300-600 m"],95:[600,1000,"600-1,000 m"],96:[1000,1500,"1,000-1,500 m"],97:[1500,2000,"1,500-2,000 m"],98:[2000,2500,"2,000-2,500 m"],99:[2500,99999,"2,500 m or more"]})[v]||null;
}

function cloudLevelMatches(code,range){
  if(!range) return true;
  const [lo,hi]=range;
  const levels=RULES.cloudLevelsMetres;
  if(code<=2) return hi>levels.highLowerExclusive;
  if(code<=5) return hi>=levels.middleLowerInclusive&&lo<=levels.middleUpperInclusive;
  return lo<levels.lowUpperExclusive;
}

function precipitationCloudRule(ww){
  if(ww>=50&&ww<=59) return {label:"drizzle",genera:[7],expected:"Stratus"};
  if(ww>=60&&ww<=65) return {label:"rain",genera:[4,5,6,7],expected:"stratified cloud (Altostratus, Nimbostratus, Stratocumulus, or Stratus)"};
  if(ww>=80&&ww<=82) return {label:"rain shower",genera:[8,9],expected:"cumuliform cloud (Cumulus or Cumulonimbus)"};
  return null;
}

function parseCode(raw) {
  const clean=raw.trim().replace(/\s+/g," ");
  const beforeSig=clean.split("=")[0].trim();
  const tokens=beforeSig.split(" ").filter(Boolean);
  const ax=tokens.indexOf("AAXX");
  if(ax<0) return {clean,tokens,ax,yy:"",station:"",sec1:[],sec3:[],header:tokens};
  const yy=tokens[ax+1]||"", station=tokens[ax+2]||"";
  const data=tokens.slice(ax+3), s333=data.indexOf("333"), s555=data.indexOf("555");
  const dataEnd=s555>=0?s555:data.length;
  const sec1=s333>=0?data.slice(0,s333):data.slice(0,dataEnd);
  const sec3=s333>=0?data.slice(s333+1,dataEnd):[];
  const sec5=s555>=0?data.slice(s555+1):[];
  return {clean,tokens,ax,yy,station,header:tokens.slice(0,ax),sec1,sec3,sec5,has333:s333>=0,has555:s555>=0};
}

// Batch 3 — main validator. It calls the individual rule blocks below.
function validate(raw, history={}) {
  const p=parseCode(raw), issues=[], decoded={};
  if(!raw.trim()){addIssue(issues,"error","No observation entered","Paste one complete SYNOP observation.");return {issues,decoded,p};}
  if(p.ax<0){addIssue(issues,"error","AAXX identifier missing","A fixed-land-station SYNOP must be identified by AAXX.","","Add AAXX before YYGGiw.");return {issues,decoded,p};}
  if(!raw.includes("=")) addIssue(issues,"warning","End marker missing","The observation does not contain the '=' end marker.","","Add '=' before the observer initials.");
  if(p.header.length>=3){
    if(!/^[A-Z]{4}\d{2}$/.test(p.header[0])) addIssue(issues,"warning","Bulletin heading format","The abbreviated heading should normally be TTAAii.",p.header[0]);
    if(!/^[A-Z]{4}$/.test(p.header[1])) addIssue(issues,"warning","Originator format","CCCC should contain four letters.",p.header[1]);
    if(!/^\d{6}$/.test(p.header[2])) addIssue(issues,"warning","Bulletin date-time format","YYGGgg should contain six digits.",p.header[2]);
  }
  if(!/^\d{5}$/.test(p.yy)) addIssue(issues,"error","Invalid YYGGiw","Expected five digits: day, hour and wind indicator.",p.yy);
  else{
    const day=Number(p.yy.slice(0,2)),hour=Number(p.yy.slice(2,4)),iw=Number(p.yy[4]);
    decoded["Observation time"]=`Day ${String(day).padStart(2,"0")} at ${String(hour).padStart(2,"0")}:00 UTC`;
    decoded["Wind units"]=({0:"m/s, estimated",1:"m/s, anemometer",3:"knots, estimated",4:"knots, anemometer"})[iw]||`code ${iw}`;
    if(day<1||day>31) addIssue(issues,"error","Invalid observation day","YY must be from 01 to 31.",p.yy);
    if(hour<0||hour>23) addIssue(issues,"error","Invalid observation hour","GG must be from 00 to 23.",p.yy);
    if(![0,1,3,4].includes(iw)) addIssue(issues,"error","Invalid wind indicator","iw must be 0, 1, 3 or 4 for the FM 12 wind-unit and measurement combinations.",p.yy);
    if(p.header[2]&&/^\d{6}$/.test(p.header[2])&&(p.header[2].slice(0,4)!==p.yy.slice(0,4))) addIssue(issues,"error","Date-time mismatch","The bulletin YYGG does not match the AAXX YYGGiw group.",`${p.header[2]} / ${p.yy}`);
  }
  if(!/^\d{5}$/.test(p.station)) addIssue(issues,"error","Invalid station identifier","IIiii must contain five digits.",p.station);
  else decoded["Station"] = p.station;
  if(p.sec1.length<2){addIssue(issues,"error","Mandatory Section 1 groups missing","iRixhVV and Nddff must follow the station identifier.");}
  else{
    const g1=p.sec1[0],g2=p.sec1[1];
    if(!/^[0-4][1-7][0-9\/][0-9\/]{2}$/.test(g1)) addIssue(issues,"error","Invalid iRixhVV group","Check precipitation indicator, station type, cloud-base code and visibility.",g1);
    else if(/^\d{2}$/.test(g1.slice(3))&&!visibilityRangeKm(g1.slice(3))) addIssue(issues,"error","Invalid horizontal-visibility code",`VV=${g1.slice(3)} is not assigned in WMO Code table 4377.`,g1);
    if(!/^[0-9\/][0-9\/]{4}$/.test(g2)) addIssue(issues,"error","Invalid Nddff group","Expected total cloud, wind direction and speed.",g2);
    else{
      const N=g2[0],dd=g2.slice(1,3),ff=g2.slice(3);
      if(N!=="/"&&Number(N)>9) addIssue(issues,"error","Invalid cloud amount","N must be 0–9 or '/'.",g2);
      if(dd!=="//"&&Number(dd)>36&&dd!=="99") addIssue(issues,"error","Invalid wind direction","dd must be 00–36 or 99 for variable direction.",g2);
      decoded["Total cloud"] = N==="/"?"not observable":`${N} okta code`;
      decoded["Wind"] = `${dd} / ${ff}`;
    }
  }
  p.sec1.forEach(g=>{if(g.length!==5||!/^[0-9\/]{5}$/.test(g)) addIssue(issues,"error","Invalid Section 1 group format","Each data group must contain five figures or solidi.",g);});
  duplicateGroups(p.sec1).forEach(g=>addIssue(issues,"error","Duplicate Section 1 group",`${g} is reported more than once in Section 1.`,g,"Remove the duplicate after confirming which entry is correct."));
  const section1Data=p.sec1.slice(2);
  const tGroup=section1Data.find(g=>/^1[01]\d{3}$/.test(g));
  const tdGroup=section1Data.find(g=>/^2[01]\d{3}$/.test(g));
  const temp=tGroup?signedTemperature(tGroup):null, dew=tdGroup?signedTemperature(tdGroup):null;
  if(temp!==null) decoded["Air temperature"]=`${temp.toFixed(1)} °C`;
  if(dew!==null) decoded["Dew point"]=`${dew.toFixed(1)} °C`;
  if(!tGroup) addIssue(issues,"error","Air-temperature group missing","No valid 1snTTT group was found.","","Include the air-temperature 1-group or verify a mistyped 2-group.");
  if(!tdGroup) addIssue(issues,"error","Dew-point group missing","No valid 2snTdTdTd group was found.","","Include the dew-point 2-group.");
  if(temp!==null&&dew!==null&&Math.round(dew*10)>Math.round(temp*10)) addIssue(issues,"error","2-group temperature exceeds air temperature",`The 2-group reports ${dew.toFixed(1)} °C, which is higher than the air temperature ${temp.toFixed(1)} °C.`,`${tGroup} ${tdGroup}`,"Verify the dry-bulb temperature and the dew-point/wet-bulb value.");
  const currentGroup=section1Data.find(g=>/^4\d{4}$/.test(g));
  const current=currentGroup?pressureValue(currentGroup):null;
  if(current!==null){
    decoded["Current MSLP"]=`${current.toFixed(1)} hPa`;
    if(current<RULES.pressure.minimumMslp||current>RULES.pressure.maximumMslp) addIssue(issues,"error","MSLP outside the realistic surface range",`${currentGroup} decodes to ${current.toFixed(1)} hPa, outside the operational plausibility range ${RULES.pressure.minimumMslp.toFixed(1)}-${RULES.pressure.maximumMslp.toFixed(1)} hPa.`,currentGroup,"Check the 4PPPP figures and confirm that this is the mean sea-level pressure group.");
  }
  else addIssue(issues,"warning","MSLP group not found","A 4PPPP group is needed for pressure consistency checks.");
  const tend=section1Data.find(g=>/^5[0-8]\d{3}$/.test(g));
  if(tend){
    const a=Number(tend[1]),codedTenths=Number(tend.slice(2)),amount=codedTenths/10;
    decoded["3-hour tendency"]=`a=${a}, ppp=${amount.toFixed(1)} hPa`;
    if(current!==null&&history.p3!==null){
      // Compare integer tenths so a difference of exactly 0.1 hPa is never hidden by floating-point rounding.
      const deltaTenths=Math.round((current-history.p3)*10), delta=deltaTenths/10, expectedTenths=Math.abs(deltaTenths);
      const positive=deltaTenths>0, negative=deltaTenths<0, unchanged=deltaTenths===0;
      const allowedA=positive?[0,1,2,3]:negative?[5,6,7,8]:[0,4,5];
      const signOk=allowedA.includes(a);
      if(codedTenths!==expectedTenths) addIssue(issues,"error","5appp amount does not match pressure history",`Current MSLP minus the 3-hour-earlier MSLP is ${delta>=0?"+":""}${delta.toFixed(1)} hPa, but ppp reports ${amount.toFixed(1)} hPa. The values must match exactly to 0.1 hPa.`,tend,`Use ppp=${String(expectedTenths).padStart(3,"0")}, after confirming the observations.`);
      if(!signOk) addIssue(issues,"error","Pressure-tendency sign conflicts with a",`The pressure change is ${positive?"positive":negative?"negative":"zero"} (${delta>=0?"+":""}${delta.toFixed(1)} hPa). Code a=${a} is inconsistent with this category.`,tend,`Use an a value from ${allowedA.join(", ")}, selected from the observed pressure trace.`);
    }else addIssue(issues,"warning","Previous 3-hour MSLP required","Enter the MSLP from three hours before to validate 5appp.",tend);
  }else addIssue(issues,"warning","5appp group not detected","The pressure-tendency group should be included whenever the three-hour tendency is available.");
  const ir=p.sec1[0]?.[0], ix=p.sec1[0]?.[1], rain1=section1Data.filter(g=>/^6[0-9\/]{4}$/.test(g)), rain3=p.sec3.filter(g=>/^6[0-9\/]{4}$/.test(g));
  const hour=/^\d{5}$/.test(p.yy)?Number(p.yy.slice(2,4)):null;
  // Batch 4 — rainfall location, iR and observation-time checks.
  const mainHours=RULES.schedule.mainHours,intermediateHours=RULES.schedule.intermediateHours;
  if(mainHours.includes(hour)&&ir==="2") addIssue(issues,"error","iR=2 is invalid at a main observation time",`The observation is at ${String(hour).padStart(2,"0")} UTC. Under the PAGASA schedule, iR=2 is for an intermediate observation, not a main observation.`,p.sec1[0],"Use the iR value and rainfall-group location required for the main observation after checking the reporting schedule.");
  if(intermediateHours.includes(hour)&&ir==="1") addIssue(issues,"error","iR=1 is invalid at an intermediate observation time",`The observation is at ${String(hour).padStart(2,"0")} UTC. Under the PAGASA schedule, iR=1 is for a main observation, not an intermediate observation.`,p.sec1[0],"Use the iR value and rainfall-group location required for the intermediate observation.");
  if(ir==="0"&&(rain1.length===0||rain3.length===0)) addIssue(issues,"error","Rainfall value missing","iR=0 requires a 6RRRtR rainfall group in both Sections 1 and 3.",p.sec1[0]);
  if(ir==="1"&&rain1.length===0) addIssue(issues,"error","No rainfall value found","iR=1 requires 6RRRtR in Section 1.",p.sec1[0]);
  if(ir==="1"&&rain3.length>0) addIssue(issues,"error","Rainfall group in the wrong section","iR=1 requires the rainfall value in Section 1, not Section 3.",`${p.sec1[0]} ${rain3.join(" ")}`);
  if(ir==="2"&&rain3.length===0) addIssue(issues,"error","No rainfall value found","iR=2 requires 6RRRtR in Section 3.",p.sec1[0]);
  if(ir==="2"&&rain1.length>0) addIssue(issues,"error","Rainfall group in the wrong section","iR=2 requires the rainfall value in Section 3, not Section 1.",`${p.sec1[0]} ${rain1.join(" ")}`);
  if(ir&&["3","4"].includes(ir)&&(rain1.length>0||rain3.length>0)) addIssue(issues,"error","Precipitation group conflicts with iR","iR indicates omission from both Sections 1 and 3.",`${p.sec1[0]} ${[...rain1,...rain3].join(" ")}`);
  if(history.rainOccurred===true){
    const reported=[...rain1,...rain3].some(g=>!/^6(?:000|\/{3})[0-9\/]$/.test(g));
    if(!reported) addIssue(issues,"error","Rainfall occurrence is not represented","Rainfall was marked as having occurred during the accumulation period, but no 6RRRtR group reports a measurable or trace amount.",p.sec1[0],"Check iR and include the rainfall group in the required section with the correct RRR and tR values.");
  }

  const weather7=section1Data.find(g=>/^7[0-9\/]{4}$/.test(g));
  const nationalRain=p.sec5.find(g=>/^2\d{4}$/.test(g));
  if(nationalRain&&Number(nationalRain.slice(1))>0&&!weather7) addIssue(issues,"error","Rainfall requires present or past weather",`${nationalRain} reports rainfall during the preceding six hours, but no 7wwW1W2 group is available for the present/past weather cross-check.`,`${p.sec1[0]} 555 ${nationalRain}`,"Correct ix and include 7wwW1W2 with the observed present and past weather.");
  if(["1","4","7"].includes(ix)&&!weather7) addIssue(issues,"error","No significant-weather 7-group","ix indicates that present and past weather are being reported, but no 7wwW1W2 group was found.",p.sec1[0],"Include the required 7-group, or correct ix if no significant weather occurred.");
  if(["2","5"].includes(ix)&&weather7) addIssue(issues,"warning","Check ix against the weather group","ix indicates no significant weather, but a 7-group is present.",`${p.sec1[0]} ${weather7}`);
  if(history.rainOccurred===true&&weather7){
    const ww=Number(weather7.slice(1,3)),w1=Number(weather7[3]),w2=Number(weather7[4]);
    const presentSupportsRain=(ww>=20&&ww<=29)||(ww>=50&&ww<=99);
    const pastSupportsRain=[w1,w2].some(w=>w>=5&&w<=9);
    if(!presentSupportsRain&&!pastSupportsRain) addIssue(issues,"warning","Rainfall is not supported by present or past weather",`Rainfall was marked as having occurred, but ${weather7} does not show precipitation in ww or W1/W2.`,weather7,"Review the rainfall checkbox and the 7wwW1W2 group against the observation.");
  }
  if(history.rainOccurred===true&&!weather7) addIssue(issues,"warning","Rainfall weather cross-check unavailable","Rainfall was marked as having occurred, but no 7wwW1W2 group is available to support it with present or past weather.",p.sec1[0],"Review ix and include the 7-group when required by the observation.");
  if(weather7&&/^\d{5}$/.test(p.sec1[0]||"")){
    const vvCode=p.sec1[0].slice(3), visibility=visibilityRangeKm(vvCode), ww=Number(weather7.slice(1,3));
    if(visibility){
      decoded["Horizontal visibility"]=`VV=${vvCode}: ${visibility[2]}`;
      const expected=precipitationVisibility(ww);
      if(expected&&visibility[1]<expected.min) addIssue(issues,"warning","Visibility lower than the suggested precipitation range",`ww=${ww} indicates ${expected.label}, for which the suggested visibility is ${expected.range}; VV=${vvCode} reports ${visibility[2]}.`,`${p.sec1[0]} ${weather7}`,"Review the reported precipitation intensity and visibility for consistency.");
      if(expected&&Number.isFinite(expected.max)&&visibility[0]>=expected.max) addIssue(issues,"error","Visibility higher than the permitted precipitation range",`ww=${ww} indicates ${expected.label}, for which the suggested visibility is ${expected.range}; VV=${vvCode} reports ${visibility[2]}.`,`${p.sec1[0]} ${weather7}`,"Correct VV or the present-weather intensity after checking the observation.");
      if([4,5,6].includes(ww)&&visibility[0]>=10) addIssue(issues,"error","Visibility too high for smoke, haze, or dust",`ww=${String(ww).padStart(2,"0")} normally corresponds to horizontal visibility below 10 km, but VV=${vvCode} reports ${visibility[2]}.`,`${p.sec1[0]} ${weather7}`);
      if(ww>=41&&ww<=49&&visibility[0]>=1) addIssue(issues,"error","Visibility too high for fog at the station",`ww=${ww} reports fog or ice fog at the station, for which visibility should be below 1 km; VV=${vvCode} reports ${visibility[2]}.`,`${p.sec1[0]} ${weather7}`);
      const visibilityReducingWeather=(ww>=4&&ww<=12)||(ww>=20&&ww<=99);
      if(visibility[1]<=RULES.unexplainedVisibilityWarningKm&&!visibilityReducingWeather) addIssue(issues,"warning","Low visibility is not supported by present weather",`VV=${vvCode} reports ${visibility[2]}, but ww=${String(ww).padStart(2,"0")} does not identify precipitation, mist, haze, fog, or another weather phenomenon that explains visibility of ${RULES.unexplainedVisibilityWarningKm} km or less.`,`${p.sec1[0]} ${weather7}`,"Review VV and report the observed visibility-reducing weather when applicable.");
    }
  }

  const expectedTR=RULES.schedule.rainfallDurationCodeByHour[hour] ?? null;
  [...rain1,...rain3].forEach(g=>{
    if(expectedTR!==null&&/^6\d{3}\d$/.test(g)&&Number(g[4])!==expectedTR) addIssue(issues,"error","Incorrect rainfall-duration indicator",`At ${String(hour).padStart(2,"0")} UTC, tR should be ${expectedTR} for the PAGASA reporting period, but ${g} uses tR=${g[4]}.`,g,`Change the final digit to ${expectedTR} after confirming the accumulated rainfall period.`);
  });

  if(!p.has333) addIssue(issues,"info","Section 3 not included","No 333 regional section was detected.");
  p.sec3.forEach(g=>{if(g.length!==5||!/^[0-9\/]{5}$/.test(g)) addIssue(issues,"error","Invalid Section 3 group format","Each group after 333 must contain five figures or solidi.",g);});
  p.sec5.forEach(g=>{if(g.length!==5||!/^[0-9\/]{5}$/.test(g)) addIssue(issues,"error","Invalid Section 5 group format","Each national group after 555 must contain five figures or solidi.",g);});
  duplicateGroups(p.sec3).forEach(g=>addIssue(issues,"error","Duplicate Section 3 group",`${g} is reported more than once in Section 3.`,g,"Remove the duplicate after confirming the observation."));
  duplicateGroups(p.sec5).forEach(g=>addIssue(issues,"error","Duplicate Section 5 group",`${g} is reported more than once in Section 5.`,g,"Remove the duplicate after confirming the observation."));
  const primaryCloud=section1Data.find(g=>/^8[0-9\/]{4}$/.test(g));
  p.sec3.filter(g=>/^3\d{4}$/.test(g)).forEach(g=>{
    const candidate=`8${g.slice(1)}`, c=Number(candidate[2]), layerRange=layerBaseRange(candidate.slice(3));
    const allowed=primaryCloud?expectedCloudTypes(primaryCloud,c):null;
    const plausible=layerRange&&cloudLevelMatches(c,layerRange)&&(!primaryCloud||allowed===null||allowed.includes(c));
    addIssue(issues,"error","Reportable-cloud group has the wrong indicator",`${g} appears where PAGASA practice expects an 8NsChshs reportable-cloud group.${plausible?` Its cloud amount, genus, and height are consistent with ${candidate}.`:""}`,g,plausible?`Change ${g} to ${candidate}. Verify the observed cloud before retransmission.`:"Check whether the first figure should be 8 and verify Ns, C, and hshs.");
  });
  const orderedSource=p.sec3.filter(g=>!/^3\d{4}$/.test(g));
  const standardSection3=orderedSource.slice(0,orderedSource.indexOf("80000")<0?orderedSource.length:orderedSource.indexOf("80000"));
  for(let i=1;i<standardSection3.length;i++){
    const prior=Number(standardSection3[i-1][0]), currentIndicator=Number(standardSection3[i][0]);
    if(Number.isFinite(prior)&&Number.isFinite(currentIndicator)&&currentIndicator<prior){
      const misplaced=standardSection3[i];
      addIssue(issues,"error","Section 3 groups are out of order",`${misplaced} begins with indicator ${currentIndicator} but follows a group beginning with ${prior}. Standard Section 3 groups must be arranged in indicator order.`,standardSection3.join(" "),`Move ${misplaced} before the first Section 3 group whose indicator is greater than ${currentIndicator}.`);
      break;
    }
  }
  const layerClouds=p.sec3.filter(g=>/^8[0-9\/]{4}$/.test(g));
  const totalCloud=p.sec1[1]?.[0];

  // PAGASA 1-3-5 rule: first layer >=1 okta, second >=3, third >=5;
  // CB is always reportable as an additional layer, with four groups maximum.
  if(totalCloud==="0"&&layerClouds.length) addIssue(issues,"error","Reportable clouds conflict with clear sky",`N=0 means the sky is clear, but ${layerClouds.length} reportable-cloud group${layerClouds.length===1?" is":"s are"} present.`,`${p.sec1[1]} ${layerClouds.join(" ")}`,"Remove the 8-groups if the sky is clear, or correct N after checking the observation.");
  if(layerClouds.length>RULES.maximumReportableCloudGroups) addIssue(issues,"error","Too many reportable-cloud groups",`PAGASA practice permits at most ${RULES.maximumReportableCloudGroups} 8NsChshs groups, including an additional CB group.`,layerClouds.join(" "),"Report the layers selected by the 1-3-5 rule and include CB when observed.");

  const cloudLayers=layerClouds.map(g=>({g,ns:Number(g[1]),c:Number(g[2]),range:layerBaseRange(g.slice(3))}));
  if(/^\d$/.test(totalCloud||"")&&totalCloud!=="9"){
    const nTotal=Number(totalCloud);
    cloudLayers.filter(layer=>Number.isFinite(layer.ns)&&layer.ns!==9&&layer.ns>nTotal).forEach(layer=>addIssue(issues,"error","Individual cloud layer exceeds total cloud cover",`${layer.g} reports Ns=${layer.ns}, greater than total cloud cover N=${nTotal}.`,`${p.sec1[1]} ${layer.g}`,"Correct N or the individual layer amount Ns after checking the sky."));
  }
  const numericLowLayers=cloudLayers.filter(layer=>layer.c>=6&&layer.c<=9&&Number.isFinite(layer.ns)&&layer.ns!==9);
  if(primaryCloud&&/^\d$/.test(primaryCloud[1])&&numericLowLayers.length){
    const nh=Number(primaryCloud[1]),tooLarge=numericLowLayers.find(layer=>layer.ns>nh);
    const layerSummary=numericLowLayers.map(layer=>`${cloudGenus(layer.c)} ${layer.ns}`).join(" + ");
    const amountSum=numericLowLayers.reduce((sum,layer)=>sum+layer.ns,0);
    decoded["Low-cloud amount check"]=`Nh=${nh}; ${layerSummary} = ${amountSum} oktas`;
    if(tooLarge) addIssue(issues,"error","Individual low-cloud amount exceeds Nh",`${tooLarge.g} reports Ns=${tooLarge.ns}, which is greater than the total low-cloud amount Nh=${nh}.`,`${primaryCloud} ${tooLarge.g}`,"Check Nh and the individual layer amount Ns. Do not require every low-cloud Ns to equal Nh.");
    if(amountSum!==nh) addIssue(issues,"error","Low-cloud amounts do not add up to Nh",`The reportable low-cloud layers total ${amountSum} oktas (${layerSummary}), but Section 1 reports Nh=${nh}. Under the supplied PAGASA practice, these low-cloud amounts are added without overlap.`,`${primaryCloud} ${numericLowLayers.map(layer=>layer.g).join(" ")}`,`Use Nh=${amountSum}, or correct the individual low-cloud amounts after checking the observation.`);
  }
  for(let i=1;i<cloudLayers.length;i++){
    const lower=cloudLayers[i-1],higher=cloudLayers[i];
    if(lower.range&&higher.range&&higher.range[0]<lower.range[0]){
      addIssue(issues,"error","Reportable-cloud layers are out of height order",`${higher.g} is coded lower than the preceding layer ${lower.g}. Reportable layers must be ordered from lower to higher levels.`,layerClouds.join(" "),`Move ${higher.g} before ${lower.g}, after confirming both cloud-base heights.`);
      break;
    }
  }

  let selectedLayerCount=0;
  cloudLayers.forEach(({g,ns,c})=>{
    if(!Number.isFinite(ns)||ns===9) return;
    const threshold=RULES.cloudLayerMinimumOktas[selectedLayerCount];
    if(threshold===undefined){
      if(c!==9) addIssue(issues,"error","Extra cloud layer does not qualify for reporting",`${g} is beyond the three layers selected by the 1-3-5 rule and is not Cumulonimbus.`,g,"Keep only the three qualifying layers plus CB when observed.");
      return;
    }
    if(ns>=threshold) selectedLayerCount+=1;
    else if(c!==9||selectedLayerCount===0){
      const position=["first","second","third"][selectedLayerCount];
      addIssue(issues,"error","Cloud layer does not meet the 1-3-5 amount rule",`${g} reports Ns=${ns}. The ${position} selected layer requires at least ${threshold} okta${threshold===1?"":"s"}.`,g,"Remove this layer from the reportable groups or correct Ns after checking the observation.");
    }
  });

  if(primaryCloud){
    const hCode=p.sec1[0]?.[2], range=/\d/.test(hCode||"")?baseRange(Number(hCode)):null;
    layerClouds.forEach(g=>{
      if(!/^8\d\d\d{2}$/.test(g)) return;
      const ns=g[1], c=Number(g[2]), family=cloudFamily(c), allowed=expectedCloudTypes(primaryCloud,c);
      if(allowed!==null&&!allowed.includes(c)){
        const expected=section1CloudMeaning(primaryCloud,family),actual=`C=${c} (${cloudGenus(c)})`;
        let correction=allowed.length?`${expected}; use ${allowed.map(code=>`C=${code} (${cloudGenus(code)})`).join(" or ")} as observed, or correct the Section 1 ${family}-cloud code.`:`${expected}, but ${g} reports ${actual}. Remove or correct the reportable ${family}-cloud layer after checking the observation.`;
        if(primaryCloud==="83108"&&g==="87360") correction="CM=0 means no middle cloud, while C=3 means Altocumulus. CH=8 indicates Cirrostratus; if its observed base is 9,000 m (hshs=80), change 87360 to 87280.";
        addIssue(issues,"error",`Section 1 and reportable ${family}-cloud mismatch`,`${expected}, but ${g} reports ${actual}.`,`${primaryCloud} ${g}`,correction);
      }
      // Ns is the amount of this individual layer, so it need not equal Nh.
      // This matters when CB and other low-cloud layers coexist.
      const layerRange=layerBaseRange(g.slice(3));
      if(layerRange&&!cloudLevelMatches(c,layerRange)) addIssue(issues,"error","Cloud type and base-height level conflict",`${cloudFamily(c)[0].toUpperCase()+cloudFamily(c).slice(1)} cloud C=${c} is reported with hshs=${g.slice(3)} (${layerRange[2]}), outside its expected level: low below 2,000 m; middle 2,000-6,000 m; high above 6,000 m.`,g,"Check both cloud genus C and the coded base height hshs.");
      if(c>=6&&range&&layerRange&&(layerRange[1]<range[0]||layerRange[0]>range[1])) addIssue(issues,"warning","Cloud-base height needs review",`The lowest-cloud h code ${hCode} and layer base ${g.slice(3)} (${layerRange[2]}) are not in the same height range.`,`${p.sec1[0]} ${g}`);
    });
  }

  const directionGroup=p.sec3.find(g=>/^56\d{3}$/.test(g));
  if(primaryCloud&&directionGroup){
    const labels=["low","middle","high"],typeCodes=[primaryCloud[2],primaryCloud[3],primaryCloud[4]],directions=directionGroup.slice(2).split("");
    labels.forEach((label,i)=>{
      if(typeCodes[i]==="0"&&directions[i]!=="0") addIssue(issues,"error",`${label[0].toUpperCase()+label.slice(1)}-cloud direction conflicts with no cloud`,`${section1CloudMeaning(primaryCloud,label)}; therefore ${directionGroup} should use direction indicator 0 for ${label} cloud, not ${directions[i]}.`,`${primaryCloud} ${directionGroup}`,`Use 0 in the ${label}-cloud direction position, or correct the Section 1 cloud type.`);
      if(typeCodes[i]==="/"&&directions[i]!=="9") addIssue(issues,"error",`${label[0].toUpperCase()+label.slice(1)}-cloud direction should be unknown`,`${section1CloudMeaning(primaryCloud,label)}; use direction indicator 9 because the cloud cannot be observed.`,`${primaryCloud} ${directionGroup}`,`Use 9 in the ${label}-cloud direction position.`);
    });
    if(primaryCloud[4]==="/"&&!['7','8'].includes(primaryCloud[3])) addIssue(issues,"warning","High-cloud obscuration needs review",`CH=/ means high cloud cannot be observed, but CM=${primaryCloud[3]} is not 7 or 8 in the supplied PAGASA practice.`,`${primaryCloud} ${directionGroup}`,"Confirm the middle-cloud type obscuring the high cloud and use high-cloud direction indicator 9.");
  }

  // Cross-check present precipitation against the cloud forms in the supplied PAGASA table.
  if(weather7&&totalCloud!=="9"){
    const ww=Number(weather7.slice(1,3)),rule=precipitationCloudRule(ww);
    if(rule){
      const genera=new Set(layerClouds.map(g=>Number(g[2])));
      const cl=Number(primaryCloud?.[2]),cm=Number(primaryCloud?.[3]);
      const supported=rule.genera.some(c=>genera.has(c))
        ||(rule.label==="rain shower"&&[1,2,3,8,9].includes(cl))
        ||(rule.label==="rain"&&([4,5,6,7].includes(cl)||[1,2,7].includes(cm)))
        ||(rule.label==="drizzle"&&[6,7].includes(cl));
      if(!supported) addIssue(issues,"warning","Precipitation and cloud type need review",`ww=${String(ww).padStart(2,"0")} reports ${rule.label}, but the cloud groups do not show ${rule.expected}.`,`${weather7} ${primaryCloud||""} ${layerClouds.join(" ")}`.trim(),`Check the precipitation type and report the observed ${rule.expected}.`);
    }
  }

  const cbInClouds=(primaryCloud&&[3,9].includes(Number(primaryCloud[2])))||layerClouds.some(g=>g[2]==="9");
  const cbGroups=p.sec3.filter(g=>/^949\d{2}$/.test(g));
  const cbDirections=["overhead/stationary","NE","E","SE","S","SW","W","NW","N","unknown"];
  cbGroups.forEach(g=>{
    const cbCodes=Object.values(RULES.cbNatureCodes);
    if(!cbCodes.includes(g[3])) addIssue(issues,"error","Invalid CB nature in 949 group",`${g} must use C=${RULES.cbNatureCodes.isolated} for isolated cumulonimbus or C=${RULES.cbNatureCodes.numerous} for numerous cumulonimbus.`,g);
    else decoded[`CB ${g}`]=`${g[3]===RULES.cbNatureCodes.isolated?"isolated":"numerous"} CB, ${cbDirections[Number(g[4])]}`;
  });
  if(cbInClouds&&!cbGroups.some(g=>g.startsWith("949")&&Object.values(RULES.cbNatureCodes).includes(g[3])&&/\d/.test(g[4]))) addIssue(issues,"error","CB direction group missing","Cumulonimbus is reported in the cloud groups, but no valid 949CD group gives its nature and direction.",primaryCloud||layerClouds.find(g=>g[2]==="9"),`Add one or more 949CD groups: C=${RULES.cbNatureCodes.isolated} isolated or C=${RULES.cbNatureCodes.numerous} numerous; D=0-9 direction.`);
  if(primaryCloud&&[3,9].includes(Number(primaryCloud[2]))&&!layerClouds.some(g=>g[2]==="9")) addIssue(issues,"error","CB reportable-cloud group missing","CL reports Cumulonimbus, but no 8Ns9hshs group reports the CB layer. Under the 1-3-5 practice, CB is always reported when observed.",primaryCloud,"Add the observed CB as an 8Ns9hshs group. Other low-cloud layers may also be reported when they qualify; CB does not exclude them.");
  if(!cbInClouds&&cbGroups.length) addIssue(issues,"warning","949 CB group conflicts with cloud report","A 949CD group is present, but cumulonimbus was not found in the Section 1 or reportable Section 3 cloud groups.",cbGroups.join(" "));

  const gustStarts=p.sec3.map((g,i)=>({g,i})).filter(x=>/^90[47]\d{2}$/.test(x.g));
  gustStarts.forEach(({g,i})=>{
    const speed=p.sec3[i+1],direction=p.sec3[i+2];
    if(!/^911\d{2}$/.test(speed||"")||!/^915\d{2}$/.test(direction||"")) addIssue(issues,"error","Incomplete gustiness sequence",`${g} must be followed immediately by 911ff and 915dd.`,[g,speed,direction].filter(Boolean).join(" "),`Use ${g} 911ff 915dd with the observed gust speed and direction.`);
    else{
      const dd=Number(direction.slice(3));
      decoded[`Gust ${g}`]=`ff=${speed.slice(3)} m/s, dd=${direction.slice(3)}`;
      if(dd>36&&dd!==99) addIssue(issues,"error","Invalid gust direction",`The dd value in ${direction} must be 00-36 or 99.`,direction);
    }
  });
  p.sec3.forEach((g,i)=>{
    if(/^911\d{2}$/.test(g)&&!(i>0&&/^90[47]\d{2}$/.test(p.sec3[i-1]))) addIssue(issues,"error","Orphan gust-speed group",`${g} must immediately follow 904tt or 907tt.`,g);
    if(/^915\d{2}$/.test(g)&&!(i>1&&/^90[47]\d{2}$/.test(p.sec3[i-2])&&/^911\d{2}$/.test(p.sec3[i-1]))) addIssue(issues,"error","Orphan gust-direction group",`${g} must follow a 904tt/907tt and 911ff pair.`,g);
  });

  const obsDay=/^\d{5}$/.test(p.yy)?Number(p.yy.slice(0,2)):null;
  const nationalSixHour=nationalRain;
  if(nationalSixHour&&obsDay===RULES.schedule.monthlyRainDay&&hour===RULES.schedule.monthlyRainHour) decoded["Section 5 six-hour rainfall"]=`${(Number(nationalSixHour.slice(1))/10).toFixed(1)} mm (18-24 UTC)`;
  const monthlyIndex=p.sec5.indexOf("6////");
  if(monthlyIndex>=0){
    const monthlyTotal=p.sec5[monthlyIndex+1];
    if(obsDay!==RULES.schedule.monthlyRainDay||hour!==RULES.schedule.monthlyRainHour) addIssue(issues,"error","Monthly-rainfall group at the wrong reporting time",`The extended previous-month rainfall group 6//// RRRRR is reported at ${String(RULES.schedule.monthlyRainHour).padStart(2,"0")} UTC on day ${RULES.schedule.monthlyRainDay} of the month.`,`6//// ${monthlyTotal||""}`.trim());
    if(!/^\d{5}$/.test(monthlyTotal||"")) addIssue(issues,"error","Monthly-rainfall total missing","6//// must be followed immediately by a five-digit RRRRR monthly total.","6////","Add the five-digit rainfall total in tenths of a millimetre.");
    else{
      const mm=Number(monthlyTotal)/10;
      decoded["Previous-month rainfall"]=`${mm.toFixed(1)} mm`;
      if(mm<=RULES.extendedMonthlyRainThresholdMm) addIssue(issues,"warning","Check extended monthly-rainfall format",`6//// RRRRR is intended for a monthly total exceeding ${RULES.extendedMonthlyRainThresholdMm} mm, but ${monthlyTotal} decodes to ${mm.toFixed(1)} mm.`,`6//// ${monthlyTotal}`);
    }
  }
  p.sec5.filter(g=>/^6\d{4}$/.test(g)).forEach(g=>{
    if(obsDay!==RULES.schedule.monthlyRainDay||hour!==RULES.schedule.monthlyRainHour) addIssue(issues,"error","Section 5 monthly-rainfall group at the wrong time",`${g} is a monthly-rainfall report and is permitted only at ${String(RULES.schedule.monthlyRainHour).padStart(2,"0")} UTC on day ${RULES.schedule.monthlyRainDay} of the month.`,g,"Remove the group, or report it at the required monthly reporting time.");
  });

  const section3Temps=p.sec3.filter(g=>/^[12][01]\d{3}$/.test(g));
  if(hour===RULES.schedule.minimumTemperatureHour){
    const minimum=section3Temps.find(g=>g[0]==="2"),wrong=section3Temps.find(g=>g[0]==="1");
    if(!minimum) addIssue(issues,"error",`Minimum-temperature group missing at ${String(hour).padStart(2,"0")} UTC`,`PAGASA practice requires a Section 3 2snTnTnTn minimum-temperature group at ${String(hour).padStart(2,"0")} UTC.`,"333","Include the observed minimum temperature in a 2-group.");
    if(wrong) addIssue(issues,"error",`Maximum temperature reported at ${String(hour).padStart(2,"0")} UTC`,`PAGASA practice requires the minimum-temperature 2-group at ${String(hour).padStart(2,"0")} UTC, but ${wrong} is a maximum-temperature 1-group.`,wrong,"Use 2snTnTnTn with the observed minimum temperature.");
    if(minimum&&temp!==null){const value=signedTemperature(minimum);if(Math.round(value*10)>Math.round(temp*10)) addIssue(issues,"error","Minimum temperature exceeds current air temperature",`${minimum} reports ${value.toFixed(1)} °C, higher than the current air temperature ${temp.toFixed(1)} °C.`,`${tGroup} ${minimum}`,"Correct the minimum or current air temperature after checking the observation.");}
  }
  if(hour===RULES.schedule.maximumTemperatureHour){
    const maximum=section3Temps.find(g=>g[0]==="1"),wrong=section3Temps.find(g=>g[0]==="2");
    if(!maximum) addIssue(issues,"error",`Maximum-temperature group missing at ${String(hour).padStart(2,"0")} UTC`,`PAGASA practice requires a Section 3 1snTxTxTx maximum-temperature group at ${String(hour).padStart(2,"0")} UTC.`,"333","Include the observed maximum temperature in a 1-group.");
    if(wrong) addIssue(issues,"error",`Minimum temperature reported at ${String(hour).padStart(2,"0")} UTC`,`PAGASA practice requires the maximum-temperature 1-group at ${String(hour).padStart(2,"0")} UTC, but ${wrong} is a minimum-temperature 2-group.`,wrong,"Use 1snTxTxTx with the observed maximum temperature.");
    if(maximum&&temp!==null){const value=signedTemperature(maximum);if(Math.round(value*10)<Math.round(temp*10)) addIssue(issues,"error","Maximum temperature is below current air temperature",`${maximum} reports ${value.toFixed(1)} °C, lower than the current air temperature ${temp.toFixed(1)} °C.`,`${tGroup} ${maximum}`,"Correct the maximum or current air temperature after checking the observation.");}
  }

  const h24=p.sec3.find(g=>/^5[89]\d{3}$/.test(g));
  if(h24==="59000") addIssue(issues,"error","Zero 24-hour pressure change must use 58",`59000 uses the negative-change indicator for a zero change. Zero belongs in the 58 group.`,h24,"Change 59000 to 58000 after confirming the two MSLP values are equal.");
  if(RULES.schedule.pressure24Hours.includes(hour)){
    if(history.p24===null) addIssue(issues,"warning","24-hour MSLP required",`Enter the MSLP from 24 hours before to check the ${h24?h24:"58/59"} pressure-change group.` ,h24||"");
    else if(current!==null&&h24){
      // The 58/59 group is coded in tenths; require an exact signed match at that precision.
      const deltaTenths=Math.round((current-history.p24)*10), encodedTenths=(h24[1]==="8"?1:-1)*Number(h24.slice(2));
      const delta=deltaTenths/10, encoded=encodedTenths/10;
      if(deltaTenths!==encodedTenths) addIssue(issues,"error","24-hour pressure change mismatch",`Current MSLP minus the 24-hour-earlier value is ${delta>=0?"+":""}${delta.toFixed(1)} hPa, but ${h24} reports ${encoded>=0?"+":""}${encoded.toFixed(1)} hPa. The values must match exactly to 0.1 hPa.`,h24,`Use ${deltaTenths>=0?"58":"59"}${String(Math.abs(deltaTenths)).padStart(3,"0")}, after confirming both pressures.`);
    }else if(!h24) addIssue(issues,"warning","24-hour pressure-change group not found","A 58p24p24p24 or 59p24p24p24 group was not detected in Section 3.");
  }

  if(!issues.some(x=>x.severity==="error"||x.severity==="warning")) addIssue(issues,"ok","No coded errors detected",`The observation passed the checks currently implemented in ruleset ${RULES.version}.`);
  return {issues,decoded,p};
}

// Only these public functions are exposed to the page.
window.SynopRuleset = Object.freeze({
  version: RULES.version,
  parseCode,
  validate
});
