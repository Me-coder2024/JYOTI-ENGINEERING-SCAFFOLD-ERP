type Row=Record<string,any>;
// Fill missing presentation fields only. Never replace saved financial data or
// non-empty historical company details, and never write back to the snapshot.
export function withInvoiceCompany(record:Row,current:Row):Row {
 const saved=record.snapshot?.company||{},company={...saved};
 for(const key of ['name','unit1','unit2','mobile','email','website','gst_no','logo','bank_name','bank_account','bank_ifsc','terms']) {
  if(!String(company[key]??'').trim()&&String(current[key]??'').trim())company[key]=current[key];
 }
 return {...record,snapshot:{...record.snapshot,company}};
}
