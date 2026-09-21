-- The live chillbros_payment_method enum only ever had cash_app, venmo, zelle,
-- apple_pay, card. The app has always referenced cash, check, ach, and chime
-- too (recordFullPaymentAction, customer-payment-actions.ts, PaymentMethod
-- type) — recording any of those methods currently fails with an enum error.
alter type public.chillbros_payment_method add value if not exists 'cash';
alter type public.chillbros_payment_method add value if not exists 'check';
alter type public.chillbros_payment_method add value if not exists 'ach';
alter type public.chillbros_payment_method add value if not exists 'chime';
