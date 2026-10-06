import { NextRequest, NextResponse } from 'next/server';
import { sessionUser } from './shared/auth-server';
import { allowed, homeFor } from './shared/access';
export async function proxy(req:NextRequest) {
 const path=req.nextUrl.pathname;
 if(path.startsWith('/api/manufacturing'))return NextResponse.json({error:'Manufacturing has been retired.'},{status:410});
 if(path.startsWith('/manufacturing')||path==='/modules')return NextResponse.redirect(new URL('/rental',req.url));
 if(path==='/api/login')return NextResponse.json({error:'Use the shared login at /login.'},{status:403});
 if(path==='/api/logout')return NextResponse.rewrite(new URL('/api/shared/logout',req.url));
 if(path==='/api/shared/login'||path==='/api/shared/logout')return NextResponse.next();
 const user=await sessionUser(req.cookies.get('erp_session')?.value);
 if(path==='/login')return user?NextResponse.redirect(new URL(homeFor(user.role),req.url)):NextResponse.next();
 if(!user)return path.startsWith('/api/')?NextResponse.json({error:'Please sign in.'},{status:401}):NextResponse.redirect(new URL('/login',req.url));
 if(path==='/')return NextResponse.redirect(new URL(homeFor(user.role),req.url));
 if(path==='/modules'&&user.role!=='OWNER')return NextResponse.redirect(new URL(homeFor(user.role),req.url));
 const module=path.startsWith('/users')||path.startsWith('/api/shared/users')?'owner':path.startsWith('/manufacturing')||path.startsWith('/api/manufacturing')?'manufacturing':path.startsWith('/rental')||(path.startsWith('/api/')&&!path.startsWith('/api/shared/'))?'rental':null;
 if(module&&!allowed(user.role,module))return NextResponse.json({error:'You do not have access to this module.'},{status:403});
 return NextResponse.next();
}
export const config={matcher:['/','/login','/modules','/users/:path*','/rental/:path*','/manufacturing/:path*','/api/:path*']};
