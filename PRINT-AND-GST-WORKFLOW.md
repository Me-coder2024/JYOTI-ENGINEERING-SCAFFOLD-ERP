# Voucher, invoice and free GST workflow

- In Accounts > New voucher, choose any active Ledger account. Its current Dr/Cr balance reflects posted vouchers through today. This display is not saved in the voucher or included in its PDF.
- Open a posted voucher and choose Print / PDF voucher. The PDF includes voucher amounts, narration and saved party/dispatch details.
- In Customers, enter a GSTIN and choose GST lookup / import (free). Open the official GST search, complete its CAPTCHA, and copy the labelled result including the GSTIN. Paste and apply it, then review before saving. This code makes no paid API requests. It is assisted import, not automatic live verification. Contact details and place of supply require confirmation.
- Invoice creation now has Invoice delivery and tax details. These are saved in the invoice snapshot and preserved at finalization. Select the correct tax presentation; existing invoices without a split continue to show GST totals.
- Invoice PDFs use a bordered layout based on DGC.pdf: seller, buyer/consignee, delivery details, rental item lines, HSN/SAC tax summary, amount in words, payment details, bank details and authorised-signatory area. Saved four-decimal rental rates are retained. Tax allocations reconcile to the saved invoice total.
- Configure company name, addresses, logo and bank details in Settings. The PDF does not copy the sample's registration identifiers, bank information, signature, IRN, QR code or e-way bill. Generating government-registered e-invoices/e-way bills is outside this formatter.

Validation: 30 unit tests, isolated database/HTTP integration tests, production build, and visual inspection of the sample PDFs. Browser form inspection was unavailable because the browser tool could not initialize.
