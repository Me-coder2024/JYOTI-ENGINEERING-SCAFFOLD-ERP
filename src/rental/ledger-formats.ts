import {z} from 'zod';
export const reportColumns={
 material:['Date','Vhty','Reference','Item Name','Issu Qty','Rcpt Qty','Pend.Qty'],
 party:['Date','Vhty','Reference','Particulars','Debit','Credit','Balance']
};
export const formatSchema=z.object({
 layout:z.enum(['reference','table']).default('reference'),
 heading:z.string().trim().min(1).max(100),
 title:z.string().trim().min(1).max(80),
 orientation:z.enum(['portrait','landscape']),
 font_size:z.coerce.number().int().min(7).max(12),
 footer:z.string().trim().max(160),
 columns:z.array(z.string()).min(4).max(7)
});
export type LedgerFormat=z.infer<typeof formatSchema>;
export type LedgerModule=keyof typeof reportColumns;
export function defaultFormat(module:LedgerModule):LedgerFormat{return {
 layout:'reference',
 heading:'Jyoti Engineering & Scarfolding Pvt Ltd',
 title:module==='material'?'MATERIAL LEDGER REPORT':'PARTY LEDGER REPORT',
 orientation:'portrait',font_size:8,footer:'',columns:[...reportColumns[module]]
};}
export function validateFormat(module:LedgerModule,input:unknown){
 const d=formatSchema.parse(input);
 const required=module==='material'?['Date','Item Name','Issu Qty','Rcpt Qty','Pend.Qty']:['Date','Particulars','Debit','Credit','Balance'];
 if(new Set(d.columns).size!==d.columns.length||d.columns.some(c=>!reportColumns[module].includes(c))||required.some(c=>!d.columns.includes(c)))throw new Error('Keep all required amount / quantity columns, date and description. Only type and reference can be hidden.');
 return d;
}
