# Owner billing conversion

Approved active unpaid quotes and estimates expose Convert to Invoice in Billing → Details & actions. The owner action calls a service-role-only transactional RPC. A quote row lock and a unique source_quote_id prevent duplicate invoices, including concurrent requests. Repeats return the existing invoice ID. The UI opens /invoices?focus=<invoice ID>&created=1 with its actions expanded. Approved + issued + unpaid displays Waiting for Payment.

The signed source quote remains intact with a converted_invoice_id link. The invoice copies its customer/job links, approval, notes, all billing fields, down payment records, line items and adjustments; linked job equipment, parts, labor, notes and photos remain attached through the same job. New payment-provider IDs, portal token and timestamps are allocated. Original quotes leave active billing totals and retain an Open converted invoice link in Archive. Converted source quotes cannot create new customer checkout requests.

Billing Override / Document Type → Estimate renumbers the same Quote row as E-xxx, retaining its ID, portal token, job, billing and approval data. The transactional audit records both numbers. Repeated override requests do not duplicate audit events. Owner authorization is checked server-side; anon/authenticated cannot execute either RPC directly.

Validation: scripts/owner-document-conversion.sql creates synthetic data, asserts data preservation, statuses, authorization, audit and idempotency, and rolls back everything. scripts/core-workflow.test.cjs also tests owner-only server action guards and returned navigation ID. The standalone page-scroll browser test requires a locally installed browser; live workflow browser checks use the signed-in production session.
