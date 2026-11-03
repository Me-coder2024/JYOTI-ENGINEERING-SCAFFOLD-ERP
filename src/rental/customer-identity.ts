type Customer={name?:string;mailing_name?:string;contact_person?:string;mobile?:string;gst_no?:string};
export function customerLabel(c:Customer){const legal=(c.name||'').trim(),buyer=(c.mailing_name||'').trim();return buyer&&buyer.toLowerCase()!==legal.toLowerCase()?`${legal} — ${buyer}`:legal;}
export function customerSearchText(c:Customer){return [c.name,c.mailing_name,c.contact_person,c.mobile,c.gst_no].filter(Boolean).join(' ');}
