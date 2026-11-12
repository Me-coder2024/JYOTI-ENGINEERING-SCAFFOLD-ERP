type Row=Record<string,any>;
export function challanKey(m:Row):string{
 if(m.challan_id)return JSON.stringify(['batch',m.customer_id,m.challan_id]);
 if(m.reference?.trim())return JSON.stringify(['legacy',m.customer_id,m.type,m.date,m.reference.trim(),m.site_name||'']);
 return 'entry:'+m.id;
}
export function groupChallans(rows:Row[]){
 const groups=new Map<string,Row[]>();
 for(const m of rows){const key=challanKey(m);const group=groups.get(key)||[];group.push(m);groups.set(key,group);}
 return [...groups.values()];
}
