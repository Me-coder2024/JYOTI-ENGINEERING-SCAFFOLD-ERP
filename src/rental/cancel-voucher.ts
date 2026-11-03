import {z} from 'zod';
import {pool} from '@/lib/db';
import {AccessError,type User} from '@/shared/access';
import {postVoucher} from './accounting';
export async function cancelVoucher(user:User,input:unknown){
 if(user.role!=='OWNER')throw new AccessError('Only the owner can cancel party ledger entries.',403);
 const d=z.object({id:z.string().uuid(),submission_id:z.string().uuid(),date:z.string(),reason:z.string().trim().min(3).max(1500)}).parse(input);
 const original=(await pool.query('SELECT * FROM rental_acc_vouchers WHERE id=$1',[d.id])).rows[0];
 if(!original||original.reverses_id)throw new AccessError('Choose an original posted voucher.',409);
 return postVoucher(user,{id:d.submission_id,type:'Journal',date:d.date,narration:'Cancellation of '+original.voucher_no+': '+d.reason,reference:original.voucher_no,reverses_id:d.id,lines:original.lines.map((l:any)=>({ledger_id:l.ledger_id,debit:Number(l.credit),credit:Number(l.debit)}))});
}
