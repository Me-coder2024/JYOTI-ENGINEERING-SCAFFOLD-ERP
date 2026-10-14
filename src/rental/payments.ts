import Decimal from 'decimal.js';
export const paymentRowsSql = `SELECT v.id AS voucher_id,v.voucher_no,v.date,a.invoice_id::uuid AS invoice_id,a.amount::numeric AS total
FROM rental_acc_vouchers v CROSS JOIN LATERAL jsonb_to_recordset(
CASE WHEN jsonb_array_length(COALESCE(v.details->'allocations','[]'::jsonb))>0 THEN v.details->'allocations'
WHEN COALESCE(v.details->>'receipt_invoice_id','')<>'' THEN jsonb_build_array(jsonb_build_object('invoice_id',v.details->>'receipt_invoice_id','amount',v.total))
ELSE '[]'::jsonb END) AS a(invoice_id text,amount text)
WHERE v.type='Receipt' AND NOT EXISTS(SELECT 1 FROM rental_acc_vouchers r WHERE r.reverses_id=v.id)`;
export function paymentSummary(total:string|number,payments:{total:string|number}[]){
 const paid=payments.reduce((s,p)=>s.add(p.total),new Decimal(0)),outstanding=new Decimal(total).sub(paid);
 return {paid:paid.toFixed(2),outstanding:outstanding.toFixed(2),payment_status:paid.isZero()?'Unpaid':outstanding.lte(0)?'Fully Paid':'Partially Paid'};
}
