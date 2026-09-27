import Decimal from 'decimal.js';
type Row=Record<string,any>;
const income=new Set(['Sales Accounts']),expenses=new Set(['Purchase Accounts','Direct Expenses','Indirect Expenses']);
const assets=new Set(['Bank Accounts','Cash-in-Hand','Sundry Debtors','Current Assets']);
export function financialReports(ledgers:Row[],vouchers:Row[],from:string,to:string){
 const balances=new Map<string,Decimal>(),period=new Map<string,Decimal>();
 for(const v of vouchers){if(v.date>to)continue;for(const line of v.lines){const delta=new Decimal(line.debit).sub(line.credit);balances.set(line.ledger_id,(balances.get(line.ledger_id)||new Decimal(0)).add(delta));if(!from||v.date>=from)period.set(line.ledger_id,(period.get(line.ledger_id)||new Decimal(0)).add(delta));}}
 let periodIncome=new Decimal(0),periodExpense=new Decimal(0),accumulatedProfit=new Decimal(0);
 const assetRows:Row[]=[],liabilityRows:Row[]=[],incomeRows:Row[]=[],expenseRows:Row[]=[];
 for(const ledger of ledgers){const b=balances.get(ledger.id)||new Decimal(0),p=period.get(ledger.id)||new Decimal(0);if(income.has(ledger.group_name)){periodIncome=periodIncome.sub(p);accumulatedProfit=accumulatedProfit.sub(b);incomeRows.push({name:ledger.name,amount:p.negated().toFixed(2)});}else if(expenses.has(ledger.group_name)){periodExpense=periodExpense.add(p);accumulatedProfit=accumulatedProfit.sub(b);expenseRows.push({name:ledger.name,amount:p.toFixed(2)});}else if(assets.has(ledger.group_name)||ledger.group_name==='Duties & Taxes'&&b.gt(0)){assetRows.push({name:ledger.name,amount:b.toFixed(2)});}else liabilityRows.push({name:ledger.name,amount:b.negated().toFixed(2)});}
 liabilityRows.push({name:'Accumulated profit / (loss)',amount:accumulatedProfit.toFixed(2)});
 const sum=(rows:Row[])=>rows.reduce((s,r)=>s.add(r.amount),new Decimal(0)).toFixed(2);
 return {assetRows,liabilityRows,incomeRows,expenseRows,assets:sum(assetRows),liabilities:sum(liabilityRows),income:periodIncome.toFixed(2),expenses:periodExpense.toFixed(2),profit:periodIncome.sub(periodExpense).toFixed(2)};
}
