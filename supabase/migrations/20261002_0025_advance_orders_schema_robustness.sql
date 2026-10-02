-- ====================================================================
-- Migration: 20261002_0025_advance_orders_schema_robustness.sql
-- Description: Ensure advance_orders table has reference_number,
--              verify completion columns, and ensure indexes and permissions.
-- ====================================================================

-- 1. Ensure reference_number column exists on public.advance_orders
ALTER TABLE public.advance_orders 
ADD COLUMN IF NOT EXISTS reference_number TEXT DEFAULT '';

-- 2. Ensure products jsonb column exists
ALTER TABLE public.advance_orders 
ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 3. Ensure completed tracking columns exist
ALTER TABLE public.advance_orders 
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_order_id UUID REFERENCES public.orders(id),
ADD COLUMN IF NOT EXISTS invoice_number TEXT,
ADD COLUMN IF NOT EXISTS final_payment_method TEXT;

-- 4. Helpful indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_advance_orders_status ON public.advance_orders(status);
CREATE INDEX IF NOT EXISTS idx_advance_orders_created_at ON public.advance_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_advance_orders_delivery ON public.advance_orders(expected_delivery_date);
CREATE INDEX IF NOT EXISTS idx_advance_orders_invoice ON public.advance_orders(invoice_number);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
