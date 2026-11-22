export type Role='OWNER'|'RENTAL_STAFF'|'MANUFACTURING_STAFF';
export const moduleActions={challans:['view','create','edit','delete'],invoices:['view','create','edit','delete'],quotations:['view','create','edit','delete'],customers:['view','create','edit','delete'],sites:['view','create','edit','delete'],inventory:['view','create','edit','delete'],material_ledger:['view'],reports:['view'],settings:['view','edit'],accounts:['view','create','edit','delete']} as const;
export type Module=keyof typeof moduleActions;
export type Action='view'|'create'|'edit'|'delete';
export type Permissions=Partial<Record<Module,Partial<Record<Action,boolean>>>>;
export type User={id:string;name:string;login:string;role:Role;is_active:boolean;role_id?:string|null;role_permissions?:Permissions;permission_overrides?:Permissions;manage_users?:boolean};
export function can(user:User|undefined,module:Module,action:Action='view'){return !!user&&user.is_active&&(moduleActions[module] as readonly string[]).includes(action)&&(user.role==='OWNER'||((user.permission_overrides?.[module]?.[action]??user.role_permissions?.[module]?.[action])===true));}
export function canManageUsers(user:User){return user.role==='OWNER'||!!user.manage_users;}
export function homeFor(_role:Role) {return '/rental';}
export function allowed(role:Role,module:'rental'|'manufacturing'|'owner') {return role==='OWNER'||(module==='rental'&&role==='RENTAL_STAFF')||(module==='manufacturing'&&role==='MANUFACTURING_STAFF');}
export class AccessError extends Error { constructor(message:string,public status=400){super(message);} }
export function demand(user:User,module:Module,action:Action='view'){if(!can(user,module,action))throw new AccessError(`Access denied: ${module.replaceAll('_',' ')} ${action}.`,403);}
