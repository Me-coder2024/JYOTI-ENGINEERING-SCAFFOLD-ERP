export function validGstin(value:string){
 const s=value.trim().toUpperCase(),chars='0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 if(!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(s)||Number(s.slice(0,2))<1||Number(s.slice(0,2))>38)return false;
 let sum=0,factor=2;for(let i=13;i>=0;i--){const n=chars.indexOf(s[i])*factor;sum+=Math.floor(n/36)+n%36;factor=factor===2?1:2;}
 return chars[(36-sum%36)%36]===s[14];
}
