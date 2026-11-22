import {AccessError,can,canManageUsers,demand,type User,type Module,type Action} from './access';
// All routes default to denial. Lookups are supplied by the filtered state endpoint.
export function authorizeRequest(user:User,path:string,method:string,body:Record<string,any>={}){
 const read=method==='GET'||method==='HEAD';
 if(path==='/api/shared/logout')return;
 if(path.startsWith('/api/shared/')){if(!canManageUsers(user))throw new AccessError('Users & Permissions administration required.',403);return;}
 if(path==='/api/state'&&read)return;
 const p=path.split('/').filter(Boolean);
 let module:Module|undefined,action:Action=read?'view':body.id?'edit':'create';
 if(p[1]==='sites'){module='sites';action=body.action;}else if(p[1]==='customers'){
  module='customers';
  if(body.sites!==undefined && !can(user,'customers',body.id?'edit':'create')){demand(user,'sites',body.id?'edit':'create');}
 }else if(p[1]==='items')module='inventory';
 else if(p[1]==='movements')module='challans';
 else if(p[1]==='invoices'){module='invoices';action=read?'view':p[2]&&p[2]!=='preview'?'edit':'create';}
 else if(p[1]==='quotations')module='quotations';
 else if(p[1]==='company'){module='settings';action='edit';}
 else if(p[1]==='export'){module=p[2]==='ledger'?'material_ledger':p[2]==='invoices'?'invoices':'reports';}
 else if(p[1]==='rental'){
  if(p[2]==='material-ledger')module='material_ledger';
  else if(p[2]==='gst'){
   if(['customers','quotations','invoices'].some(m=>can(user,m as Module,'create')||can(user,m as Module,'edit')))return;
  }else if(p[2]==='accounting'){
   const endpoint=p[3];
   if(['challan','movement-export','movement-history','challans'].includes(endpoint)){module='challans';action=read?'view':body.action==='DELETE'?'delete':'edit';}
   else if(endpoint==='movements')throw new AccessError('Use Edit Challan or Delete Challan for the complete document.',403);
   else if(endpoint==='formats'){module='settings';action=read?'view':'edit';}
   else if(endpoint==='delete-record'){module=({invoice:'invoices',quotation:'quotations',customer:'customers',item:'inventory',ledger:'accounts'} as Record<string,Module>)[body.kind];action='delete';}
   else if(endpoint==='settings'){module='settings';action=read?'view':'edit';}
   else if(endpoint==='reconcile-invoices'){module='invoices';action='edit';}
   else if(['state','vouchers','ledgers','party-ledger','cancel-voucher'].includes(endpoint)){module='accounts';action=read?'view':endpoint==='cancel-voucher'?'delete':body.id&&endpoint==='ledgers'?'edit':'create';}
  }
 }
 if(!module)throw new AccessError('Access denied.',403);
 demand(user,module,action);
}
export function filterState(user:User,state:Record<string,any>){
 const data={...state};
 const lookup=['challans','invoices','quotations'].some(m=>can(user,m as Module,'create')||can(user,m as Module,'edit'));
 const history=can(user,'challans')||can(user,'material_ledger')||can(user,'reports');
 if(!history){data.movements=[];data.balances=[];}
 else if(!can(user,'challans'))data.movements=data.movements.map((m:any)=>({id:m.id,customer_id:m.customer_id,item_id:m.item_id,date:m.date,type:m.type,quantity:m.quantity,reference:m.reference,site_name:m.site_name,created_at:m.created_at}));
 if(!can(user,'invoices'))data.invoices=[];
 if(!can(user,'quotations'))data.quotations=[];
 if(!can(user,'accounts'))data.company_financials=[];
 if(!can(user,'customers')&&!lookup&&!history&&!can(user,'invoices')&&!can(user,'sites')&&!can(user,'sites','create'))data.customers=[];
 else if(!can(user,'customers'))data.customers=data.customers.map((c:any)=>({id:c.id,name:c.name,sites:c.sites,address:c.address,gst_no:c.gst_no,state_code:c.state_code,locking_days:c.locking_days}));
 if(!can(user,'inventory')&&!lookup&&!history){data.items=[];data.rates=[];}
 if(!can(user,'settings')){const {name,gst_percent,terms}=data.company||{};data.company={name,gst_percent,terms};}
 return data;
}
