import Decimal from 'decimal.js';

export type Day = string;
export type Movement = { id: string; item_id: string; date: Day; type: 'DISPATCH' | 'RETURN'; quantity: number; lock_until?: Day | null; rental_rate?: string | null; created_at?: string; damaged_quantity?: number; damage_price?: string; note?: string };
export type Delta = { date: Day; qty: number };
export type Rate = { effective_from: Day; rate: string };
export type Segment = { start: Day; end: Day; quantity: number; days: number; formula: string; rate?: string; amount?: string };
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function day(value: string): Day {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new Error('Enter a valid calendar date.');
  return value;
}
export const addDays = (date: Day, n: number): Day => new Date(Date.parse(day(date) + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: Day, b: Day) => Math.round((Date.parse(day(b)) - Date.parse(day(a))) / 86400000);
export const money = (v: Decimal.Value) => new Decimal(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
export function damageAmount(qty: number, price: string) { return money(new Decimal(price).mul(qty)); }
export function net(deltas: Delta[]): Delta[] {
  const sums = new Map<Day, number>();
  for (const d of deltas) sums.set(d.date, (sums.get(d.date) || 0) + d.qty);
  return [...sums].sort(([a], [b]) => a.localeCompare(b)).filter(([, qty]) => qty !== 0).map(([date, qty]) => ({ date, qty }));
}
export function timelines(movements: Movement[], asOf = today()) {
  const physical: Delta[] = [], billable: Delta[] = [];
  const lots: { id: string; dispatch_date: Day; lock_until: Day; original: number; physical: number; billable: number }[] = [];
  const allocations: { return_id: string; lot_id: string; quantity: number; return_date: Day; billing_date: Day }[] = [];
  const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date) || (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id));
  for (const m of sorted) {
    day(m.date);
    if (!Number.isSafeInteger(m.quantity) || m.quantity <= 0) throw new Error('Quantity must be a positive whole number.');
    if (m.type === 'DISPATCH') {
      const lock = m.lock_until || m.date;
      lots.push({ id: m.id, dispatch_date: m.date, lock_until: lock, original: m.quantity, physical: m.quantity, billable: m.quantity });
      physical.push({ date: m.date, qty: m.quantity }); billable.push({ date: m.date, qty: m.quantity });
    } else {
      const available = lots.reduce((s, l) => s + l.physical, 0);
      if (m.quantity > available) throw new Error(`Cannot return ${m.quantity}, only ${available} currently on hire on ${m.date}.`);
      physical.push({ date: m.date, qty: -m.quantity });
      let remaining = m.quantity;
      for (const lot of lots) {
        const consumed = Math.min(remaining, lot.physical);
        if (!consumed) continue;
        lot.physical -= consumed; remaining -= consumed;
        const effective = m.date > lot.lock_until ? m.date : lot.lock_until;
        if (effective <= asOf) lot.billable -= consumed;
        billable.push({ date: effective, qty: -consumed });
        allocations.push({ return_id: m.id, lot_id: lot.id, quantity: consumed, return_date: m.date, billing_date: effective });
      }
    }
  }
  return { physical: net(physical), billable: net(billable), lots, allocations };
}
export const balanceAt = (deltas: Delta[], date: Day) => deltas.filter(d => d.date <= date).reduce((s, d) => s + d.qty, 0);
export function segments(deltas: Delta[], start: Day, end: Day, rates?: Rate[], asOf = today()): Segment[] {
  day(start); day(end);
  if (start > end) throw new Error('Period start must be on or before period end.');
  const capped = end < asOf ? end : asOf;
  if (start > capped) return [];
  const merged = net(deltas), rateRows = [...(rates || [])].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
  const boundaries = [...new Set([start, addDays(capped, 1), ...merged.map(d => d.date), ...rateRows.map(r => r.effective_from)])].filter(d => d >= start && d <= addDays(capped, 1)).sort();
  const result: Segment[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const from = boundaries[i], to = addDays(boundaries[i + 1], -1);
    const quantity = balanceAt(merged, from);
    if (quantity <= 0) continue;
    const delta = merged.find(d => d.date === from)?.qty || 0;
    const previous = quantity - delta;
    const formula = delta ? `(${previous}${delta > 0 ? '+' : ''}${delta})=${quantity}` : `${quantity} carried forward`;
    const days = daysBetween(from, to) + 1;
    const row: Segment = { start: from, end: to, quantity, days, formula };
    if (rates) {
      const rate = rateRows.filter(r => r.effective_from <= from).at(-1);
      if (!rate) throw new Error(`No rental rate is set for ${from}. Add an effective rate in Item Master.`);
      row.rate = rate.rate; row.amount = money(new Decimal(rate.rate).mul(quantity).mul(days));
    }
    result.push(row);
  }
  return result;
}
export function totals(rental: string[], damage: string[], gst: string) {
  const rentalTotal = rental.reduce((s, v) => s.add(v), new Decimal(0));
  const damageTotal = damage.reduce((s, v) => s.add(v), new Decimal(0));
  const subtotal = rentalTotal.add(damageTotal);
  const tax = new Decimal(money(subtotal.mul(gst).div(100)));
  return { rental_total: money(rentalTotal), damage_total: money(damageTotal), subtotal: money(subtotal), gst_amount: money(tax), grand_total: money(subtotal.add(tax)) };
}

/** FIFO matches returns to lots before pricing. Different agreed rates must never
 * be averaged or priced using the newest dispatch's rate. Legacy lots alone keep
 * their original catalog rate-history behavior. */
export function rentalSegments(movements: Movement[], start: Day, end: Day, rates: Rate[], asOf=today()): Segment[] {
 const timeline=timelines(movements,asOf);
 const groups=new Map<string,{deltas:Delta[];rate:string|null}>();
 const lotGroup=new Map<string,string>();
 for(const m of movements.filter(m=>m.type==='DISPATCH')) {
  const rate=m.rental_rate==null?null:new Decimal(m.rental_rate).toFixed(4);
  if(rate!==null&&new Decimal(rate).isNegative()) throw new Error('Rental rate cannot be negative.');
  const key=rate??'catalog-history';lotGroup.set(m.id,key);
  if(!groups.has(key)) groups.set(key,{deltas:[],rate});
  groups.get(key)!.deltas.push({date:m.date,qty:m.quantity});
 }
 for(const a of timeline.allocations) groups.get(lotGroup.get(a.lot_id)!)!.deltas.push({date:a.billing_date,qty:-a.quantity});
 return [...groups.values()].flatMap(g=>segments(g.deltas,start,end,g.rate===null?rates:[{effective_from:'0001-01-01',rate:g.rate}],asOf))
  .sort((a,b)=>a.start.localeCompare(b.start)||new Decimal(a.rate!).comparedTo(b.rate!));
}

