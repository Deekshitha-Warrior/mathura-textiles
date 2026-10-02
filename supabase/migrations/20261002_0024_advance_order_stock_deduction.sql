-- ====================================================================
-- Migration: 20261002_0024_advance_order_stock_deduction.sql
-- Description: Reduce inventory stock upon Advance Order creation,
--              record inventory movements, and restore stock if cancelled or deleted.
-- ====================================================================

-- 1. Helper function to restore stock when an advance order is cancelled or deleted
CREATE OR REPLACE FUNCTION public.restore_advance_order_stock(
  p_order_id UUID,
  p_reason TEXT DEFAULT 'Advance order cancelled - stock restored'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order         public.advance_orders;
  v_items         jsonb;
  v_item          jsonb;
  v_product_id    BIGINT;
  v_variant_id    UUID;
  v_quantity      NUMERIC;
  v_current_stock NUMERIC;
  v_barcode_id    UUID;
BEGIN
  SELECT * INTO v_order FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_items := v_order.products;

  IF jsonb_typeof(v_items) = 'array' AND jsonb_array_length(v_items) > 0 THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
      v_product_id := NULL;
      v_variant_id := NULL;
      v_quantity   := GREATEST(COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1), 0);

      -- Check variant_id
      IF (v_item->>'variant_id') IS NOT NULL 
         AND BTRIM(v_item->>'variant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
        v_variant_id := (v_item->>'variant_id')::UUID;
      END IF;

      -- Check product_id
      IF (v_item->>'product_id') IS NOT NULL AND BTRIM(v_item->>'product_id') ~ '^[0-9]+$' THEN
        v_product_id := (v_item->>'product_id')::BIGINT;
      END IF;

      -- Fallback to product name if neither ID matched
      IF v_product_id IS NULL AND v_variant_id IS NULL THEN
        SELECT id INTO v_product_id
        FROM public.products
        WHERE LOWER(TRIM(name)) = LOWER(TRIM(COALESCE(NULLIF(v_item->>'name', ''), v_order.product_name)))
        LIMIT 1;
      END IF;

      IF v_quantity > 0 THEN
        IF v_variant_id IS NOT NULL THEN
          SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
          IF FOUND THEN
            IF v_product_id IS NULL THEN
              SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = v_variant_id;
            END IF;

            SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE variant_id = v_variant_id AND is_active = TRUE LIMIT 1;

            UPDATE public.product_variants
            SET stock = stock + v_quantity,
                updated_at = NOW()
            WHERE id = v_variant_id;

            IF v_product_id IS NOT NULL THEN
              UPDATE public.products
              SET stock_quantity = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE),
                  stock = FLOOR((SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE))::INTEGER,
                  updated_at = NOW()
              WHERE id = v_product_id;
            END IF;

            INSERT INTO public.inventory_movements (
              product_id, variant_id, barcode_id, movement_type,
              quantity_delta, quantity_before, quantity_after,
              reference_type, reference_id, note, created_by_name, created_at
            )
            VALUES (
              v_product_id, v_variant_id, v_barcode_id, 'RETURN',
              v_quantity, v_current_stock, v_current_stock + v_quantity,
              'advance_order', v_order.deposit_id, p_reason,
              'System', NOW()
            );
          END IF;

        ELSIF v_product_id IS NOT NULL THEN
          SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
          IF FOUND THEN
            SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE product_id = v_product_id AND variant_id IS NULL AND is_active = TRUE LIMIT 1;

            UPDATE public.products
            SET stock_quantity = stock_quantity + v_quantity,
                stock = stock + FLOOR(v_quantity)::INTEGER,
                updated_at = NOW()
            WHERE id = v_product_id;

            INSERT INTO public.inventory_movements (
              product_id, variant_id, barcode_id, movement_type,
              quantity_delta, quantity_before, quantity_after,
              reference_type, reference_id, note, created_by_name, created_at
            )
            VALUES (
              v_product_id, NULL, v_barcode_id, 'RETURN',
              v_quantity, v_current_stock, v_current_stock + v_quantity,
              'advance_order', v_order.deposit_id, p_reason,
              'System', NOW()
            );
          END IF;
        END IF;
      END IF;
    END LOOP;
  ELSE
    -- Single product fallback lookup by product_name
    SELECT id, stock_quantity INTO v_product_id, v_current_stock
    FROM public.products
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_order.product_name))
    LIMIT 1
    FOR UPDATE;

    IF v_product_id IS NOT NULL THEN
      SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE product_id = v_product_id AND variant_id IS NULL AND is_active = TRUE LIMIT 1;

      UPDATE public.products
      SET stock_quantity = stock_quantity + 1,
          stock = stock + 1,
          updated_at = NOW()
      WHERE id = v_product_id;

      INSERT INTO public.inventory_movements (
        product_id, variant_id, barcode_id, movement_type,
        quantity_delta, quantity_before, quantity_after,
        reference_type, reference_id, note, created_by_name, created_at
      )
      VALUES (
        v_product_id, NULL, v_barcode_id, 'RETURN',
        1, v_current_stock, v_current_stock + 1,
        'advance_order', v_order.deposit_id, p_reason,
        'System', NOW()
      );
    END IF;
  END IF;
END;
$$;


-- 2. Enhanced create_advance_order with stock deduction
CREATE OR REPLACE FUNCTION public.create_advance_order(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_product_name text,
  p_category text,
  p_description text,
  p_total_amount numeric,
  p_deposit_amount numeric,
  p_expected_delivery_date date,
  p_remarks text,
  p_payment_method text,
  p_created_by_name text,
  p_products jsonb default '[]'::jsonb
)
RETURNS public.advance_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order         public.advance_orders;
  v_now           timestamptz := now();
  v_deposit_id    text;
  v_items         jsonb;
  v_item          jsonb;
  v_product_id    BIGINT;
  v_variant_id    UUID;
  v_quantity      NUMERIC;
  v_current_stock NUMERIC;
  v_barcode_id    UUID;
BEGIN
  -- Validations
  IF trim(coalesce(p_customer_name, '')) = '' THEN
    RAISE EXCEPTION 'Customer name is required';
  END IF;
  IF trim(coalesce(p_phone, '')) = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;
  IF trim(coalesce(p_product_name, '')) = '' THEN
    RAISE EXCEPTION 'Product name is required';
  END IF;
  IF coalesce(p_total_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'Total amount must be greater than zero';
  END IF;
  IF coalesce(p_deposit_amount, 0) <= 0 OR p_deposit_amount >= p_total_amount THEN
    RAISE EXCEPTION 'Deposit must be greater than zero and less than the total amount';
  END IF;
  IF lower(coalesce(p_payment_method, '')) NOT IN ('cash', 'upi', 'card') THEN
    RAISE EXCEPTION 'Select a valid deposit payment method';
  END IF;

  -- Generate human-friendly deposit reference number
  v_deposit_id := 'DEP-' || to_char(v_now at time zone 'Asia/Kolkata', 'YYYYMMDD') || '-' || lpad(nextval('public.deposit_number_seq')::text, 4, '0');

  -- Ensure products JSONB array
  v_items := CASE 
    WHEN jsonb_typeof(coalesce(p_products, '[]'::jsonb)) = 'array' AND jsonb_array_length(p_products) > 0 THEN p_products
    ELSE jsonb_build_array(jsonb_build_object(
      'name', trim(p_product_name),
      'category', trim(coalesce(p_category, '')),
      'description', trim(coalesce(p_description, '')),
      'quantity', 1,
      'base_price', round(p_total_amount, 2),
      'line_total', round(p_total_amount, 2),
      'unit', 'piece',
      'unit_type', 'unit',
      'source', 'advance_order'
    ))
  END;

  -- Insert advance order record
  INSERT INTO public.advance_orders(
    deposit_id, customer_name, phone, address, product_name, products, category,
    description, total_amount, deposit_amount, expected_delivery_date, remarks,
    created_by, created_by_name, created_at, updated_at
  )
  VALUES (
    v_deposit_id, trim(p_customer_name), trim(p_phone), trim(coalesce(p_address, '')),
    trim(p_product_name), v_items, trim(coalesce(p_category, '')),
    trim(coalesce(p_description, '')), round(p_total_amount, 2), round(p_deposit_amount, 2),
    p_expected_delivery_date, trim(coalesce(p_remarks, '')), auth.uid(),
    trim(coalesce(p_created_by_name, '')), v_now, v_now
  )
  RETURNING * INTO v_order;

  -- Record initial deposit payment
  INSERT INTO public.advance_order_payments(
    advance_order_id, payment_type, amount, payment_method, remarks, received_by, received_at
  )
  VALUES (
    v_order.id, 'deposit', v_order.deposit_amount, lower(p_payment_method),
    coalesce(p_remarks, ''), auth.uid(), v_now
  );

  -- Record initial timeline
  INSERT INTO public.advance_order_timeline(advance_order_id, event_type, label, created_by, created_at)
  VALUES
    (v_order.id, 'created', 'Created', auth.uid(), v_now),
    (v_order.id, 'deposit_received', 'Deposit Received', auth.uid(), v_now);

  -- ── DEDUCT INVENTORY STOCK ──────────────────────────────────────────────
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULL;
    v_variant_id := NULL;
    v_quantity   := GREATEST(COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1), 0);

    -- Extract variant_id if UUID
    IF (v_item->>'variant_id') IS NOT NULL 
       AND BTRIM(v_item->>'variant_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      v_variant_id := (v_item->>'variant_id')::UUID;
    END IF;

    -- Extract product_id if integer
    IF (v_item->>'product_id') IS NOT NULL AND BTRIM(v_item->>'product_id') ~ '^[0-9]+$' THEN
      v_product_id := (v_item->>'product_id')::BIGINT;
    END IF;

    -- Fallback to product name if neither was supplied
    IF v_product_id IS NULL AND v_variant_id IS NULL THEN
      SELECT id INTO v_product_id
      FROM public.products
      WHERE LOWER(TRIM(name)) = LOWER(TRIM(COALESCE(NULLIF(v_item->>'name', ''), p_product_name)))
      LIMIT 1;
    END IF;

    IF v_quantity > 0 THEN
      -- Case 1: Variant stock reduction
      IF v_variant_id IS NOT NULL THEN
        SELECT stock INTO v_current_stock FROM public.product_variants WHERE id = v_variant_id FOR UPDATE;
        IF FOUND THEN
          IF v_product_id IS NULL THEN
            SELECT product_id INTO v_product_id FROM public.product_variants WHERE id = v_variant_id;
          END IF;

          SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE variant_id = v_variant_id AND is_active = TRUE LIMIT 1;

          UPDATE public.product_variants
          SET stock = GREATEST(0, stock - v_quantity),
              updated_at = v_now
          WHERE id = v_variant_id;

          IF v_product_id IS NOT NULL THEN
            UPDATE public.products
            SET stock_quantity = (SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE),
                stock = FLOOR((SELECT COALESCE(SUM(stock), 0) FROM public.product_variants WHERE product_id = v_product_id AND is_active = TRUE))::INTEGER,
                updated_at = v_now
            WHERE id = v_product_id;
          END IF;

          INSERT INTO public.inventory_movements (
            product_id, variant_id, barcode_id, movement_type,
            quantity_delta, quantity_before, quantity_after,
            reference_type, reference_id, note, created_by_name, created_at
          )
          VALUES (
            v_product_id, v_variant_id, v_barcode_id, 'SALE',
            -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
            'advance_order', v_deposit_id, 'Advance Order deposit stock deduction',
            COALESCE(NULLIF(TRIM(p_created_by_name), ''), 'POS Staff'), v_now
          );
        END IF;

      -- Case 2: Base product stock reduction
      ELSIF v_product_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = v_product_id FOR UPDATE;
        IF FOUND THEN
          SELECT id INTO v_barcode_id FROM public.barcode_registry WHERE product_id = v_product_id AND variant_id IS NULL AND is_active = TRUE LIMIT 1;

          UPDATE public.products
          SET stock_quantity = GREATEST(0, stock_quantity - v_quantity),
              stock = GREATEST(0, stock - FLOOR(v_quantity)::INTEGER),
              updated_at = v_now
          WHERE id = v_product_id;

          INSERT INTO public.inventory_movements (
            product_id, variant_id, barcode_id, movement_type,
            quantity_delta, quantity_before, quantity_after,
            reference_type, reference_id, note, created_by_name, created_at
          )
          VALUES (
            v_product_id, NULL, v_barcode_id, 'SALE',
            -v_quantity, v_current_stock, GREATEST(0, v_current_stock - v_quantity),
            'advance_order', v_deposit_id, 'Advance Order deposit stock deduction',
            COALESCE(NULLIF(TRIM(p_created_by_name), ''), 'POS Staff'), v_now
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_order;
END;
$$;


-- 3. Update update_advance_order_status to restore stock when cancelled
CREATE OR REPLACE FUNCTION public.update_advance_order_status(
  p_order_id uuid,
  p_status   text,
  p_remarks  text DEFAULT ''
)
RETURNS SETOF public.advance_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.advance_orders;
BEGIN
  SELECT * INTO v_order FROM public.advance_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Advance order % not found', p_order_id;
  END IF;

  IF (v_order.invoice_number IS NOT NULL OR v_order.completed_order_id IS NOT NULL) AND p_status != 'completed' THEN
    RAISE EXCEPTION 'Cannot change status of an order that already has an invoice generated';
  END IF;

  -- If transitioning to 'cancelled' from an active (uncompleted, uncancelled) state, restore stock
  IF p_status = 'cancelled' AND v_order.status NOT IN ('cancelled', 'completed') THEN
    PERFORM public.restore_advance_order_stock(p_order_id, 'Advance order cancelled - stock restored');
  END IF;

  UPDATE public.advance_orders SET
    status     = p_status,
    remarks    = CASE WHEN trim(coalesce(p_remarks,'')) = '' THEN remarks ELSE p_remarks END,
    updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO public.advance_order_timeline (advance_order_id, event_type, label, remarks, created_by, created_at)
  VALUES (
    p_order_id,
    p_status,
    CASE p_status
      WHEN 'pending_deposit'       THEN 'Status: Pending Deposit'
      WHEN 'waiting_final_payment' THEN 'Status: Waiting for Final Payment'
      WHEN 'ready_for_delivery'    THEN 'Status: Ready to Collect'
      WHEN 'completed'             THEN 'Order Completed'
      WHEN 'cancelled'             THEN 'Order Cancelled'
      ELSE p_status
    END,
    coalesce(p_remarks, ''),
    auth.uid(),
    now()
  );

  RETURN QUERY SELECT * FROM public.advance_orders WHERE id = p_order_id;
END;
$$;


-- 4. Trigger to restore stock if an active advance order is deleted
CREATE OR REPLACE FUNCTION public.trg_fn_advance_orders_delete_restore_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status NOT IN ('completed', 'cancelled') THEN
    PERFORM public.restore_advance_order_stock(OLD.id, 'Advance order deleted - stock restored');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_advance_orders_delete_stock ON public.advance_orders;
CREATE TRIGGER trg_advance_orders_delete_stock
BEFORE DELETE ON public.advance_orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_advance_orders_delete_restore_stock();


-- 5. Permissions and PostgREST schema cache reload
GRANT EXECUTE ON FUNCTION public.restore_advance_order_stock(uuid, text) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_advance_order(text, text, text, text, text, text, numeric, numeric, date, text, text, text, jsonb) TO public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_advance_order_status(uuid, text, text) TO public, anon, authenticated;

NOTIFY pgrst, 'reload schema';
