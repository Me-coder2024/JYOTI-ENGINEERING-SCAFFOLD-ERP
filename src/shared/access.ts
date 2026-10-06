export type Role='OWNER'|'RENTAL_STAFF'|'MANUFACTURING_STAFF';
export type User={id:string;name:string;login:string;role:Role;is_active:boolean};
export function homeFor(role:Role) {return '/rental';}
export function allowed(role:Role,module:'rental'|'manufacturing'|'owner') {return role==='OWNER'||(module==='rental'&&role==='RENTAL_STAFF')||(module==='manufacturing'&&role==='MANUFACTURING_STAFF');}
export class AccessError extends Error { constructor(message:string,public status=400){super(message);} }
