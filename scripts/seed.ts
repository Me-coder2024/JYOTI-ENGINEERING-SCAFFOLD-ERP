import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';
nextEnv.loadEnvConfig(process.cwd());
const { pool } = await import('../src/lib/db');
await pool.query(`INSERT INTO company(id,name,unit1,unit2,mobile,email,website,bank_name,bank_account,bank_ifsc,terms) VALUES(1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`, [
  'Jyoti Engineering & Jyoti Scaffold Pvt Ltd',
  'Unit 1: Industrial Plot No 7 & 8, Jamnagar Khambaliya Road, Behind Dwarkesh Minerals, Jamnagar, Gujarat 361010',
  'Unit 2: Sub Plot No.8, Ashwamegh Industrial Estate, 405 P/1, Plot 8, Changodar, Ahmedabad, Gujarat 382213',
  '8481000092 / 93 / 94 / 95','jyotiengineering1980@gmail.com, admin@jyotiscaffold.com','www.jyotiscaffolding.com',
  'Jyoti Engineering','O72605501164','ICIC0000726',
  'Transport is in the customer’s scope. Damage is charged at the saved original material value per piece. The supplier accepts no liability for site accidents. Late payment fee: 10%. Quotation validity: 2 days. Dispatch after 7 days of deposit receipt. Required documents: GST certificate, PAN, address proof and signed acceptance. Review these terms and bank details before issuing documents.'
]);
const priced: [string, string, number, number][] = [
 ['Scaffolding pipe 06 mtr','Pipes',2.4,1200],['Scaffolding pipe 04 mtr','Pipes',1.6,800],['Scaffolding pipe 03 mtr','Pipes',1.2,600],['Scaffolding pipe 02 mtr','Pipes',0.8,400],['Scaffolding pipe 1.5 mtr','Pipes',0.6,300],['Anti Skid Plank (280×2100mm)','Planks',5,1200],['Fix Clamp Forged','Clamps',0.5,98],['Swivel Clamp Forged','Clamps',0.5,108],['Brc Clamp','Clamps',0.5,65],['Beam Clamp','Clamps',0.5,165],['Base Plate','Accessories',0.5,100],['Sleeve Coupler','Couplers',0.5,100],['Sole Plate','Accessories',1.5,300],['Ladder Clamp','Clamps',1.2,165],['Aluminium Ladder 06 mtr','Ladders',20,6500],['Aluminium Ladder 03 mtr','Ladders',10,3500]
];
const unpriced = ['Waller Plate','Prop Sleeve','Prop & Jack Nut','Prop Jack','Single Clamp','Gogo Machine','Rubber Cap','Pipe End Cap','Column Plate','Spigot Pin','Castor Wheel','Coupler Forged Fix','Coupler Forged Swivel','Coupler Sheet Metal Fix','Coupler Sheet Metal Swivel','Board Retaining Coupler','Joint Pin','Ladder J Clamp','Girder Coupler','Ladder Box Clamp','Putlog Coupler','Wall Support Aluminium Ladder','T Bolt','Clet & Wedge','Top Cup','Bottom Cup','Ledger Blade','Sikanja','Tie Rod','Anchor Nut','Wing Nut','Gogo Nut','Water Stopper','Threaded Rod','Shuttering Plate','H Frame','Cuplock Ledger','Cuplock Vertical','GI Planks','MS Planks','Toe Guard','MS Jali','Aluminium Mobile Scaffolding Tower'];
for (const [name,category,rate,value] of priced) {
 const result=await pool.query('INSERT INTO items(id,name,category,material_value) VALUES($1,$2,$3,$4) ON CONFLICT(name) DO NOTHING RETURNING id',[randomUUID(),name,category,value]);
 if(result.rows[0]) await pool.query('INSERT INTO rates(id,item_id,effective_from,rate) VALUES($1,$2,$3,$4)',[randomUUID(),result.rows[0].id,'2000-01-01',rate]);
}
for (const name of unpriced) await pool.query('INSERT INTO items(id,name,material_value) VALUES($1,$2,0) ON CONFLICT(name) DO NOTHING',[randomUUID(),name]);
console.log('Company defaults and 59 catalog items seeded. Set actual rate-change dates and verify bank details in Settings. No customer transactions were invented.');
await pool.end();

