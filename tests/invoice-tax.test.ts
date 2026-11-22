import {test} from 'node:test';
import assert from 'node:assert/strict';
import {invoiceTax} from '../src/rental/invoice-tax';
const base={company:{gst_no:'24ABCDE1234F1Z5'},customer:{state_code:'24'},gst_percent:18,gst_amount:'180.00'};
test('Gujarat intra-state applies exactly 9% CGST and 9% SGST',()=>assert.deepEqual(invoiceTax(base).components,[{name:'CGST',rate:'9',amount:'90.00'},{name:'SGST',rate:'9',amount:'90.00'}]));
test('inter-state supply applies only 18% IGST, ignoring a conflicting manual mode',()=>assert.deepEqual(invoiceTax({...base,document_details:{place_of_supply:'Maharashtra',tax_mode:'CGST_SGST'}}).components,[{name:'IGST',rate:'18',amount:'180.00'}]));
test('place of supply takes precedence over customer GST state',()=>assert.equal(invoiceTax({...base,customer:{state_code:'27'},document_details:{place_of_supply:'24 - Gujarat'}}).tax_mode,'CGST_SGST'));
test('split rounding preserves the total and invalid place of supply is rejected',()=>{const tax=invoiceTax({...base,gst_amount:'180.01'});assert.equal(tax.components.reduce((n,c)=>n+Number(c.amount),0),180.01);assert.throws(()=>invoiceTax({...base,document_details:{place_of_supply:'Unknown'}}));});
