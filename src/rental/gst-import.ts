import {validGstin} from './gst';
// Local parsing only: no paid API, scraping or background taxpayer requests.
export function importGstText(input:string,gstin:string){
 if(!validGstin(gstin))throw Error('Enter a valid GSTIN first.');
 const found:string[]=input.toUpperCase().match(/\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g)||[];
 if(!found.includes(gstin)||found.some(v=>v!==gstin))throw Error('Copy the GSTIN together with its result. It must match the customer GSTIN.');
 const labels=['Legal Name of Business','Trade Name','Principal Place of Business','Taxpayer Type','GSTIN / UIN Status','GSTIN/UIN Status','Constitution of Business','Date of Registration','Effective Date of registration','Administrative Office','Other Office','Additional Place of Business','Nature of Business Activities','Whether Aadhaar Authenticated','Whether e-KYC Verified'];
 const escaped=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function value(label:string){const all=labels.map(escaped).join('|');const r=new RegExp('(?:^|\\n|\\t)\\s*(?:\\d+\\.?\\s*)?'+escaped(label)+'\\s*:?\\s*([\\s\\S]*?)(?=(?:\\n|\\t)\\s*(?:\\d+\\.?\\s*)?(?:'+all+')|$)','i');return (input.match(r)?.[1]||'').trim();}
 const legal=value('Legal Name of Business'),trade=value('Trade Name'),address=value('Principal Place of Business'),kind=value('Taxpayer Type');
 if(!legal||!address)throw Error('Paste the result including Legal Name of Business and Principal Place of Business labels. If the portal format differs, enter the details manually.');
 return {name:(trade&&trade!=='NA'?trade:legal).slice(0,2000),mailing_name:legal.slice(0,2000),address:address.slice(0,2000),state_code:gstin.slice(0,2),country:'India',gst_registration:['Regular','Composition'].includes(kind)?kind:'Unknown'};
}

