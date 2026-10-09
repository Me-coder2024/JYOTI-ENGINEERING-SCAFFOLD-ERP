# Voucher, invoice and free GST workflow

- In Accounts > New voucher, choose an Account group (such as Bank Accounts), then select an active Ledger account in that group. Choose All account groups to search across groups. Its current Dr/Cr balance reflects posted vouchers through today. This display is not saved in the voucher or included in its PDF.
- Open a posted voucher and choose Print / PDF voucher. The PDF includes voucher amounts, narration and saved party/dispatch details.
- In Customers or party accounts, enter a GSTIN and choose Fetch GST details. Enter the official portal CAPTCHA displayed in the form, then choose Verify CAPTCHA & fill details. Review the fetched name, address and registration details before saving. There is no paid lookup provider or API key. Availability depends on the official GST portal accepting requests from the hosting server; if unavailable, open the official search and paste its labelled result using the import fallback. Contact details and place of supply require confirmation. CAPTCHA sessions expire after five minutes and are bound to the signed-in user and GSTIN.
- Invoice creation now has Invoice delivery and tax details. These are saved in the invoice snapshot and preserved at finalization. Select the correct tax presentation; existing invoices without a split continue to show GST totals.
- Invoice PDFs use a bordered layout based on DGC.pdf: seller, buyer/consignee, delivery details, rental item lines, HSN/SAC tax summary, amount in words, payment details, bank details and authorised-signatory area. Saved four-decimal rental rates are retained. Tax allocations reconcile to the saved invoice total.
- Invoice letterhead and warehouse-footer artwork use the original Jyoti branding extracted from DGC.pdf; the extracted images contain no customer, QR, IRN or signature content. Configure seller name, address, GSTIN and bank details in Settings for the invoice detail boxes. Voucher branding continues to use company settings. The PDF does not copy the sample's registration identifiers, bank information, signature, IRN, QR code or e-way bill. Generating government-registered e-invoices/e-way bills is outside this formatter.

Validation: 33 unit tests, isolated database/HTTP integration tests, production build, and visual inspection of the sample PDFs. Browser form inspection was unavailable because the browser tool could not initialize.

Item recovery: restored 73 historical item-master entries and 33 historical rate entries in both local and production databases, preserving existing records. No customer or transaction history was restored.

GST verification: official search and CAPTCHA endpoints responded successfully from the local server; session security and response mapping are tested with mocked responses. A successful live taxpayer lookup still requires a user-entered CAPTCHA.

