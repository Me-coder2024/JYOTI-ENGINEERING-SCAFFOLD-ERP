import test from 'node:test';
import assert from 'node:assert/strict';
import {customerLabel,customerSearchText} from '../src/rental/customer-identity';
test('customer lookup includes legal and buyer names without duplicate profiles',()=>{
 const c={name:'PAYAL ENTERPRISE',mailing_name:'purushotam pratap singh',contact_person:'Office',mobile:'1234567890'};
 assert.ok(customerSearchText(c).toLowerCase().includes('purushotam'));
 assert.ok(customerSearchText(c).includes('PAYAL ENTERPRISE'));
 assert.equal(customerLabel(c),'PAYAL ENTERPRISE — purushotam pratap singh');
 assert.equal(customerLabel({name:'PAYAL ENTERPRISE',mailing_name:'payal enterprise'}),'PAYAL ENTERPRISE');
});
