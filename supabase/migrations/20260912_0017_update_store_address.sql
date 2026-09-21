-- Migration: 20260912_0017_update_store_address.sql
-- Update store address for Madhura Tex (Mathura Textiles)

BEGIN;

UPDATE public.store_settings
SET address = 'Malar complex, Pondy - Sellipet Main road, Kalithirampattu - Kandamangalam Junction',
    updated_at = NOW()
WHERE id = 1;

COMMIT;
