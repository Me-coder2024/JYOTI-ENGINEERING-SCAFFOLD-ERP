import Decimal from 'decimal.js';
const states:Record<string,string>={'jammu and kashmir':'01','himachal pradesh':'02','punjab':'03','chandigarh':'04','uttarakhand':'05','haryana':'06','delhi':'07','rajasthan':'08','uttar pradesh':'09','bihar':'10','sikkim':'11','arunachal pradesh':'12','nagaland':'13','manipur':'14','mizoram':'15','tripura':'16','meghalaya':'17','assam':'18','west bengal':'19','jharkhand':'20','odisha':'21','chhattisgarh':'22','madhya pradesh':'23','gujarat':'24','dadra and nagar haveli and daman and diu':'26','maharashtra':'27','karnataka':'29','goa':'30','lakshadweep':'31','kerala':'32','tamil nadu':'33','puducherry':'34','andaman and nicobar islands':'35','telangana':'36','andhra pradesh':'37','ladakh':'38'};
export function stateCode(value:unknown):string|undefined{const s=String(value||'').trim().toLowerCase();const numeric=s.match(/^(\d{1,2})(?:\s*[-–:]|\s|$)/)?.[1];if(numeric&&Object.values(states).includes(numeric.padStart(2,'0')))return numeric.padStart(2,'0');return states[s];}
export function invoiceTax(s:Record<string,any>){
 const supplier=stateCode(s.company?.state_code)||stateCode(String(s.company?.gst_no||'').slice(0,2))||'24';
 const explicit=String(s.document_details?.place_of_supply||s.customer?.place_of_supply||'').trim();
 const supply=explicit?stateCode(explicit):stateCode(s.customer?.state_code)||stateCode(String(s.customer?.gst_no||'').slice(0,2));
 if(!supply)throw new Error('Enter the place of supply as an Indian state name or GST state code.');
 const amount=new Decimal(s.gst_amount||0),rate=new Decimal(s.gst_percent||0),local=supplier===supply,half=amount.div(2).toDecimalPlaces(2);
 return {supplier_state:supplier,place_of_supply_state:supply,tax_mode:local?'CGST_SGST':'IGST',components:local?[{name:'CGST',rate:rate.div(2).toString(),amount:half.toFixed(2)},{name:'SGST',rate:rate.div(2).toString(),amount:amount.sub(half).toFixed(2)}]:[{name:'IGST',rate:rate.toString(),amount:amount.toFixed(2)}]};
}
