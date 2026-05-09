-- Test DB only.
-- Deletes the listed trips, their bookings, and the dependent rows that would
-- otherwise block FK-safe cleanup. Bookings are deleted before trips.

BEGIN;

CREATE TEMP TABLE target_trips (
  trip_id text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO target_trips (trip_id) VALUES
  ('NM-TRIP-DOM-GT-MEG-0004'),
  ('NM-TRIP-DOM-GT-MEG-0002'),
  ('NM-TRIP-DOM-GT-KER-0003'),
  ('NM-TRIP-DOM-GT-MAN-0001'),
  ('NM-TRIP-DOM-GT-SPT-0001'),
  ('NM-TRIP-DOM-GT-RAJ-0001'),
  ('NM-TRIP-DOM-GT-UKD-0001'),
  ('NM-TRIP-DOM-INV-HMP-0001'),
  ('NM-TRIP-DOM-INV-UKD-0001'),
  ('NM-TRIP-DOM-INV-ZIR-0001'),
  ('NM-TRIP-INT-GT-JPN-0001'),
  ('NM-TRIP-INT-GT-MAR-0001'),
  ('NM-TRIP-INT-INV-VTN-0001'),
  ('NM-TRIP-INT-GT-THA-0001'),
  ('NM-TRIP-DOM-GT-LDK-0001');

CREATE TEMP TABLE target_bookings ON COMMIT DROP AS
SELECT DISTINCT b.booking_id
FROM bookings b
WHERE b.trip_id IN (SELECT trip_id FROM target_trips);

CREATE TEMP TABLE target_lead_trips ON COMMIT DROP AS
SELECT DISTINCT lt.lead_trip_id
FROM lead_trips lt
WHERE lt.trip_id IN (SELECT trip_id FROM target_trips)

UNION

SELECT DISTINCT b.lead_trip_id
FROM bookings b
WHERE b.booking_id IN (SELECT booking_id FROM target_bookings)
  AND b.lead_trip_id IS NOT NULL

UNION

SELECT DISTINCT ctr.converted_from_lead_trip_id
FROM customized_trip_requests ctr
WHERE ctr.converted_to_trip_id IN (SELECT trip_id FROM target_trips)
  AND ctr.converted_from_lead_trip_id IS NOT NULL;

CREATE TEMP TABLE target_requests ON COMMIT DROP AS
SELECT DISTINCT t.request_id
FROM trips t
WHERE t.trip_id IN (SELECT trip_id FROM target_trips)
  AND t.request_id IS NOT NULL

UNION

SELECT DISTINCT b.request_id
FROM bookings b
WHERE b.booking_id IN (SELECT booking_id FROM target_bookings)
  AND b.request_id IS NOT NULL

UNION

SELECT DISTINCT lt.converted_to_request_id
FROM lead_trips lt
WHERE lt.lead_trip_id IN (SELECT lead_trip_id FROM target_lead_trips)
  AND lt.converted_to_request_id IS NOT NULL

UNION

SELECT DISTINCT ctr.request_id
FROM customized_trip_requests ctr
WHERE ctr.converted_to_trip_id IN (SELECT trip_id FROM target_trips);

CREATE TEMP TABLE target_trip_checklists ON COMMIT DROP AS
SELECT DISTINCT tc.trip_checklist_id
FROM trip_checklists tc
WHERE tc.trip_id IN (SELECT trip_id FROM target_trips);

CREATE TEMP TABLE target_trip_checklist_items ON COMMIT DROP AS
SELECT DISTINCT tci.checklist_item_id
FROM trip_checklist_items tci
WHERE tci.trip_checklist_id IN (SELECT trip_checklist_id FROM target_trip_checklists);

CREATE TEMP TABLE target_trip_costings ON COMMIT DROP AS
SELECT DISTINCT tc.costing_id
FROM trip_costings tc
WHERE tc.trip_id IN (SELECT trip_id FROM target_trips)
   OR tc.request_id IN (SELECT request_id FROM target_requests);

CREATE TEMP TABLE target_itinerary_drafts ON COMMIT DROP AS
SELECT DISTINCT d.draft_id
FROM itinerary_drafts d
WHERE d.request_id IN (SELECT request_id FROM target_requests)

UNION

SELECT DISTINCT t.source_draft_id
FROM trips t
WHERE t.trip_id IN (SELECT trip_id FROM target_trips)
  AND t.source_draft_id IS NOT NULL;

CREATE TEMP TABLE target_booking_services ON COMMIT DROP AS
SELECT DISTINCT bs.booking_service_id
FROM booking_services bs
WHERE bs.booking_id IN (SELECT booking_id FROM target_bookings);

CREATE TEMP TABLE target_booking_service_customers ON COMMIT DROP AS
SELECT DISTINCT bsc.booking_service_customer_id
FROM booking_service_customers bsc
WHERE bsc.booking_service_id IN (SELECT booking_service_id FROM target_booking_services);

CREATE TEMP TABLE target_booking_payments ON COMMIT DROP AS
SELECT DISTINCT bp.payment_id
FROM booking_payments bp
WHERE bp.booking_id IN (SELECT booking_id FROM target_bookings);

CREATE TEMP TABLE target_payment_orders ON COMMIT DROP AS
SELECT DISTINCT po.payment_order_id
FROM payment_orders po
WHERE po.booking_id IN (SELECT booking_id FROM target_bookings)

UNION

SELECT DISTINCT bp.payment_order_id
FROM booking_payments bp
WHERE bp.payment_id IN (SELECT payment_id FROM target_booking_payments)
  AND bp.payment_order_id IS NOT NULL;

CREATE TEMP TABLE target_pg_transactions ON COMMIT DROP AS
SELECT DISTINCT pgt.pg_transaction_id
FROM pg_transactions pgt
WHERE pgt.payment_order_id IN (SELECT payment_order_id FROM target_payment_orders)

UNION

SELECT DISTINCT bp.pg_transaction_id
FROM booking_payments bp
WHERE bp.payment_id IN (SELECT payment_id FROM target_booking_payments)
  AND bp.pg_transaction_id IS NOT NULL;

CREATE TEMP TABLE target_invoices ON COMMIT DROP AS
SELECT DISTINCT i.invoice_id
FROM invoices i
WHERE i.booking_id IN (SELECT booking_id FROM target_bookings);

CREATE TEMP TABLE target_credit_notes ON COMMIT DROP AS
SELECT DISTINCT cn.credit_note_id
FROM credit_notes cn
WHERE cn.booking_id IN (SELECT booking_id FROM target_bookings)

UNION

SELECT DISTINCT c.credit_note_id
FROM cancellations c
WHERE c.booking_id IN (SELECT booking_id FROM target_bookings)
  AND c.credit_note_id IS NOT NULL;

CREATE TEMP TABLE target_pg_refunds ON COMMIT DROP AS
SELECT DISTINCT pr.pg_refund_id
FROM pg_refunds pr
WHERE pr.payment_order_id IN (SELECT payment_order_id FROM target_payment_orders)
   OR pr.booking_payment_id IN (SELECT payment_id FROM target_booking_payments)

UNION

SELECT DISTINCT c.pg_refund_id
FROM cancellations c
WHERE c.booking_id IN (SELECT booking_id FROM target_bookings)
  AND c.pg_refund_id IS NOT NULL

UNION

SELECT DISTINCT cn.linked_refund_id
FROM credit_notes cn
WHERE cn.booking_id IN (SELECT booking_id FROM target_bookings)
  AND cn.linked_refund_id IS NOT NULL;

CREATE TEMP TABLE target_cancellations ON COMMIT DROP AS
SELECT DISTINCT c.cancellation_id
FROM cancellations c
WHERE c.booking_id IN (SELECT booking_id FROM target_bookings);

CREATE TEMP TABLE target_vendor_bookings ON COMMIT DROP AS
SELECT DISTINCT vb.vendor_booking_id
FROM vendor_bookings vb
WHERE vb.booking_id IN (SELECT booking_id FROM target_bookings)
   OR vb.trip_id IN (SELECT trip_id FROM target_trips)
   OR vb.booking_service_id IN (SELECT booking_service_id FROM target_booking_services);

CREATE TEMP TABLE target_vendor_invoices ON COMMIT DROP AS
SELECT DISTINCT vi.vendor_invoice_id
FROM vendor_invoices vi
WHERE vi.vendor_booking_id IN (SELECT vendor_booking_id FROM target_vendor_bookings)
   OR vi.trip_id IN (SELECT trip_id FROM target_trips);

CREATE TEMP TABLE target_comms ON COMMIT DROP AS
SELECT DISTINCT cl.comm_id
FROM communications_log cl
WHERE cl.booking_id IN (SELECT booking_id FROM target_bookings)
   OR (cl.entity_type = 'trip' AND cl.entity_id IN (SELECT trip_id FROM target_trips))
   OR (cl.entity_type = 'booking' AND cl.entity_id IN (SELECT booking_id FROM target_bookings))
   OR (cl.entity_type = 'lead_trip' AND cl.entity_id IN (SELECT lead_trip_id FROM target_lead_trips))
   OR (
     cl.entity_type = 'customized_trip_request'
     AND cl.entity_id IN (SELECT request_id FROM target_requests)
   );

CREATE TEMP TABLE target_tasks ON COMMIT DROP AS
SELECT DISTINCT t.task_id
FROM tasks t
WHERE (t.entity_type = 'trip' AND t.entity_id IN (SELECT trip_id FROM target_trips))
   OR (t.entity_type = 'booking' AND t.entity_id IN (SELECT booking_id FROM target_bookings))
   OR (t.entity_type = 'invoice' AND t.entity_id IN (SELECT invoice_id FROM target_invoices));

SELECT 'target_trips' AS bucket, count(*)::bigint AS rows FROM target_trips
UNION ALL
SELECT 'target_bookings', count(*)::bigint FROM target_bookings
UNION ALL
SELECT 'target_booking_services', count(*)::bigint FROM target_booking_services
UNION ALL
SELECT 'target_booking_payments', count(*)::bigint FROM target_booking_payments
UNION ALL
SELECT 'target_vendor_bookings', count(*)::bigint FROM target_vendor_bookings
UNION ALL
SELECT 'target_requests', count(*)::bigint FROM target_requests
UNION ALL
SELECT 'target_lead_trips', count(*)::bigint FROM target_lead_trips;

-- Break FK cycles so hard deletes below can proceed in one pass.
UPDATE lead_trips
SET converted_booking_id = NULL
WHERE converted_booking_id IN (SELECT booking_id FROM target_bookings);

UPDATE customized_trip_requests
SET converted_to_trip_id = NULL
WHERE converted_to_trip_id IN (SELECT trip_id FROM target_trips);

UPDATE customized_trip_requests
SET converted_from_lead_trip_id = NULL
WHERE converted_from_lead_trip_id IN (SELECT lead_trip_id FROM target_lead_trips);

DELETE FROM audit_log
WHERE (table_name = 'trips' AND record_id IN (SELECT trip_id FROM target_trips))
   OR (table_name = 'bookings' AND record_id IN (SELECT booking_id FROM target_bookings))
   OR (table_name = 'lead_trips' AND record_id IN (SELECT lead_trip_id FROM target_lead_trips))
   OR (
     table_name = 'customized_trip_requests'
     AND record_id IN (SELECT request_id FROM target_requests)
   )
   OR (
     table_name = 'trip_checklists'
     AND record_id IN (SELECT trip_checklist_id FROM target_trip_checklists)
   )
   OR (
     table_name = 'trip_checklist_items'
     AND record_id IN (SELECT checklist_item_id FROM target_trip_checklist_items)
   )
   OR (
     table_name = 'trip_costings'
     AND record_id IN (SELECT costing_id FROM target_trip_costings)
   )
   OR (
     table_name = 'booking_services'
     AND record_id IN (SELECT booking_service_id FROM target_booking_services)
   )
   OR (
     table_name = 'booking_service_customers'
     AND record_id IN (
       SELECT booking_service_customer_id FROM target_booking_service_customers
     )
   )
   OR (
     table_name = 'booking_payments'
     AND record_id IN (SELECT payment_id FROM target_booking_payments)
   )
   OR (
     table_name = 'payment_orders'
     AND record_id IN (SELECT payment_order_id FROM target_payment_orders)
   )
   OR (
     table_name = 'pg_transactions'
     AND record_id IN (SELECT pg_transaction_id FROM target_pg_transactions)
   )
   OR (
     table_name = 'pg_refunds'
     AND record_id IN (SELECT pg_refund_id FROM target_pg_refunds)
   )
   OR (
     table_name = 'invoices'
     AND record_id IN (SELECT invoice_id FROM target_invoices)
   )
   OR (
     table_name = 'credit_notes'
     AND record_id IN (SELECT credit_note_id FROM target_credit_notes)
   )
   OR (
     table_name = 'cancellations'
     AND record_id IN (SELECT cancellation_id FROM target_cancellations)
   )
   OR (
     table_name = 'vendor_bookings'
     AND record_id IN (SELECT vendor_booking_id FROM target_vendor_bookings)
   )
   OR (
     table_name = 'vendor_invoices'
     AND record_id IN (SELECT vendor_invoice_id FROM target_vendor_invoices)
   )
   OR (
     table_name = 'trip_content'
     AND record_id IN (
       SELECT content_id FROM trip_content WHERE trip_id IN (SELECT trip_id FROM target_trips)
     )
   )
   OR (
     table_name = 'trip_faqs'
     AND record_id IN (
       SELECT faq_id FROM trip_faqs WHERE trip_id IN (SELECT trip_id FROM target_trips)
     )
   )
   OR (
     table_name = 'trip_gallery'
     AND record_id IN (
       SELECT gallery_id FROM trip_gallery WHERE trip_id IN (SELECT trip_id FROM target_trips)
     )
   )
   OR (
     table_name = 'trip_inclusions'
     AND record_id IN (
       SELECT inclusion_id FROM trip_inclusions WHERE trip_id IN (SELECT trip_id FROM target_trips)
     )
   )
   OR (
     table_name = 'trip_itinerary'
     AND record_id IN (
       SELECT itinerary_id
       FROM trip_itinerary
       WHERE trip_id IN (SELECT trip_id FROM target_trips)
     )
   );

DELETE FROM attachments
WHERE (entity_type = 'trip' AND entity_id IN (SELECT trip_id FROM target_trips))
   OR (entity_type = 'booking' AND entity_id IN (SELECT booking_id FROM target_bookings))
   OR (entity_type = 'lead_trip' AND entity_id IN (SELECT lead_trip_id FROM target_lead_trips))
   OR (
     entity_type = 'customized_trip_request'
     AND entity_id IN (SELECT request_id FROM target_requests)
   )
   OR (
     entity_type = 'trip_checklist_item'
     AND entity_id IN (SELECT checklist_item_id FROM target_trip_checklist_items)
   )
   OR (
     entity_type = 'vendor_booking'
     AND entity_id IN (SELECT vendor_booking_id FROM target_vendor_bookings)
   )
   OR (
     entity_type = 'vendor_invoice'
     AND entity_id IN (SELECT vendor_invoice_id FROM target_vendor_invoices)
   )
   OR (entity_type = 'invoice' AND entity_id IN (SELECT invoice_id FROM target_invoices))
   OR (
     entity_type = 'credit_note'
     AND entity_id IN (SELECT credit_note_id FROM target_credit_notes)
   )
   OR (
     entity_type = 'cancellation'
     AND entity_id IN (SELECT cancellation_id FROM target_cancellations)
   )
   OR (
     entity_type = 'communications_log'
     AND entity_id IN (SELECT comm_id FROM target_comms)
   )
   OR (entity_type = 'task' AND entity_id IN (SELECT task_id FROM target_tasks));

DELETE FROM tasks
WHERE task_id IN (SELECT task_id FROM target_tasks);

DELETE FROM communications_log
WHERE comm_id IN (SELECT comm_id FROM target_comms);

DELETE FROM service_fulfillments
WHERE booking_service_id IN (SELECT booking_service_id FROM target_booking_services)
   OR vendor_booking_id IN (SELECT vendor_booking_id FROM target_vendor_bookings);

DELETE FROM vendor_payments
WHERE vendor_booking_id IN (SELECT vendor_booking_id FROM target_vendor_bookings);

DELETE FROM vendor_invoices
WHERE vendor_invoice_id IN (SELECT vendor_invoice_id FROM target_vendor_invoices);

DELETE FROM payment_allocations
WHERE payment_id IN (SELECT payment_id FROM target_booking_payments)
   OR booking_service_id IN (SELECT booking_service_id FROM target_booking_services)
   OR booking_service_customer_id IN (
     SELECT booking_service_customer_id FROM target_booking_service_customers
   );

DELETE FROM payment_order_targets
WHERE payment_order_id IN (SELECT payment_order_id FROM target_payment_orders)
   OR booking_service_id IN (SELECT booking_service_id FROM target_booking_services)
   OR booking_service_customer_id IN (
     SELECT booking_service_customer_id FROM target_booking_service_customers
   );

DELETE FROM cancellations
WHERE cancellation_id IN (SELECT cancellation_id FROM target_cancellations);

DELETE FROM credit_notes
WHERE credit_note_id IN (SELECT credit_note_id FROM target_credit_notes);

DELETE FROM pg_refunds
WHERE pg_refund_id IN (SELECT pg_refund_id FROM target_pg_refunds);

DELETE FROM booking_passengers
WHERE booking_id IN (SELECT booking_id FROM target_bookings);

DELETE FROM booking_service_customers
WHERE booking_service_customer_id IN (
  SELECT booking_service_customer_id FROM target_booking_service_customers
);

DELETE FROM booking_payments
WHERE payment_id IN (SELECT payment_id FROM target_booking_payments);

DELETE FROM pg_transactions
WHERE pg_transaction_id IN (SELECT pg_transaction_id FROM target_pg_transactions);

DELETE FROM payment_orders
WHERE payment_order_id IN (SELECT payment_order_id FROM target_payment_orders);

DELETE FROM vendor_bookings
WHERE vendor_booking_id IN (SELECT vendor_booking_id FROM target_vendor_bookings);

DELETE FROM booking_services
WHERE booking_service_id IN (SELECT booking_service_id FROM target_booking_services);

DELETE FROM invoices
WHERE invoice_id IN (SELECT invoice_id FROM target_invoices);

DELETE FROM bookings
WHERE booking_id IN (SELECT booking_id FROM target_bookings);

DELETE FROM costing_items
WHERE costing_id IN (SELECT costing_id FROM target_trip_costings);

DELETE FROM lead_activities
WHERE lead_trip_id IN (SELECT lead_trip_id FROM target_lead_trips)
   OR request_id IN (SELECT request_id FROM target_requests);

DELETE FROM announcements
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM reviews
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM site_gallery
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM user_wishlist
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM trip_checklist_items
WHERE checklist_item_id IN (SELECT checklist_item_id FROM target_trip_checklist_items);

DELETE FROM trip_checklists
WHERE trip_checklist_id IN (SELECT trip_checklist_id FROM target_trip_checklists);

DELETE FROM trip_content
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM trip_costings
WHERE costing_id IN (SELECT costing_id FROM target_trip_costings);

DELETE FROM trip_faqs
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM trip_gallery
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM trip_inclusions
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM trip_itinerary
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM lead_trips
WHERE lead_trip_id IN (SELECT lead_trip_id FROM target_lead_trips);

DELETE FROM trips
WHERE trip_id IN (SELECT trip_id FROM target_trips);

DELETE FROM itinerary_drafts
WHERE draft_id IN (SELECT draft_id FROM target_itinerary_drafts);

DELETE FROM customized_trip_requests
WHERE request_id IN (SELECT request_id FROM target_requests);

COMMIT;
