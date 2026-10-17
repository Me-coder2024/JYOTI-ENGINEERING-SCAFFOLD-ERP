'use client';
import {useState} from 'react';
import {ArrowRight,Eye,EyeOff,LockKeyhole,ShieldCheck} from 'lucide-react';
import './shared.css';
import './login.css';
export default function LoginForm(){
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[showPassword,setShowPassword]=useState(false);
 return <main className="jyoti-login">
 <section className="jyoti-login-visual" aria-label="Jyoti Scaffold premises">
  <img className="jyoti-building" src="/branding/jyoti-building.jpg" alt="Jyoti Scaffold Private Limited building" fetchPriority="high"/>
  <div className="jyoti-photo-shade"/>
  <div className="jyoti-login-brand"><img src="/branding/jyoti-logo.png" alt="Jyoti"/><div>JYOTI<small>RENTAL & ACCOUNTS</small></div></div>
  <div className="jyoti-login-intro"><span className="jyoti-login-kicker">BUILT ON TRUST. READY FOR EVERY DAY.</span><h1>Every piece. <br/>Every day. <br/><span>Accounted for.</span></h1><p>Your materials, movements and accounts.<br/>Together in one workspace.</p></div>
  <div className="jyoti-photo-footer"><span>JYOTI SCAFFOLD PRIVATE LIMITED</span><span>Jamnagar · Ahmedabad</span></div>
 </section>
 <section className="jyoti-login-panel">
  <div className="jyoti-access-label"><span/> JYOTI BUSINESS WORKSPACE</div>
  <form className="jyoti-signin" onSubmit={async e=>{
   e.preventDefault();if(busy)return;setBusy(true);setError('');
   try{
    const response=await fetch('/api/shared/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'Unable to sign in. Please try again.');
    window.location.assign(result.redirect);
   }catch(e){setError((e as Error).message);setBusy(false);}
  }}>
   <div className="jyoti-signin-icon"><LockKeyhole size={22}/></div>
   <div className="jyoti-signin-eyebrow">WELCOME BACK</div><h2>Sign in to your desk</h2>
   <p>Everything you need for the working day.</p>
   <label htmlFor="jyoti-login-id">Login / email <span aria-hidden="true">*</span></label>
   <input id="jyoti-login-id" name="login" required autoComplete="username" placeholder="Enter your login or email" disabled={busy} spellCheck={false} autoCapitalize="none"/>
   <label htmlFor="jyoti-password">Password <span aria-hidden="true">*</span></label>
   <div className="jyoti-password"><input id="jyoti-password" name="password" type={showPassword?'text':'password'} required autoComplete="current-password" placeholder="Enter your password" disabled={busy}/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>
   {error&&<div className="jyoti-login-error" role="alert">{error}</div>}
   <button className="jyoti-signin-submit" disabled={busy}>{busy?'Signing in…':'Sign in'}<ArrowRight size={18}/></button>
   <div className="jyoti-signin-help">Need access or a password reset?<br/><strong>Contact your office administrator.</strong></div>
  </form>
  <footer className="jyoti-login-footer"><ShieldCheck size={16}/><span>Secure access for your team.<br/>Your account opens your assigned workspace.</span></footer>
 </section>
 </main>;
}
