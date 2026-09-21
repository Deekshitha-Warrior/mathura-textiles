# Madhura Tex - Wholesale & POS Billing

Independent React, Vite, and Supabase billing administration for Madhura Tex ("Our Suit, Your Style").

## Local setup

1. Ensure `.env` is configured with your Supabase project URL, public anon key, and service role key.
2. Apply the database migrations:
   - Run `npm run migrate:db <your_db_password>` OR paste `supabase/all_migrations_consolidated.sql` in your Supabase SQL Editor.
3. Sync store branding and categories:
   - Run `npm run sync:brand`
4. Run `npm install`.
5. Run `npm run dev`.

## Brand Identity & Contact

- **Store Name:** Madhura Tex
- **Tagline:** Premium Wholesale Store ("Our Suit, Your Style")
- **Address:** Malar complex, Pondy - Sellipet Main road, Kalithirampattu - Kandamangalam Junction
- **Phone:** +91 8682037615 / +91 9626555535
- **WhatsApp:** 919626555535
- **Email:** madhuratex1@gmail.com
- **Instagram:** @maduratex (https://instagram.com/maduratex)

Brand assets are located in `public/mathura-logo.jpeg`.

