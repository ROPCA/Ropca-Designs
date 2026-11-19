# Ropca Designs

A responsive electric dirt bike graphics storefront built with Next.js App Router and Supabase. It includes a filterable catalog, product pages, persistent cart, customer accounts and order tracking, custom design briefs, and a private administrator dashboard. Checkout submits an order request; Ropca Designs reviews it and sends the customer an invoice separately. No payment is collected on the site.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without credentials, the site runs in **store preview** mode with an explicitly labeled sample catalog. Preview items are not connected to inventory and cannot be ordered. Connect Supabase and add products through the admin dashboard to publish live inventory.

## Supabase setup

1. Create a Supabase project and copy its project URL, anon/publishable key, and service-role key into `.env.local`.
2. Apply the migrations in `supabase/migrations/` in filename order. For a new project, apply both the initial schema and invoice-order migration. If the original schema has already been applied, run the newer invoice-order migration to update it.
3. In **Authentication → URL Configuration**, set the site URL and add your local and production URLs to the redirect allow list. Configure email confirmation and SMTP for your store.
4. Register your account at `/account`. In the Supabase SQL Editor, grant the first administrator role:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'you@example.com';
   ```

   Only use the SQL Editor (or another trusted server-side admin tool) to grant the first administrator. The application does not allow users to promote themselves.
5. Sign in at `/account`, open **Store admin**, and add active products, images, prices, stock quantities, bike compatibility, color variations, and collections. No sample stock is seeded into your database.

The service-role key is used only in server routes for invoice-order creation and private custom-reference handling. Keep it out of browser code and never use a `NEXT_PUBLIC_` prefix. Order creation validates current prices, product options, and stock inside a database transaction, reserves inventory, and stores the customer and shipping details with the order. Cancelling an order in the admin dashboard returns its reserved stock.

## Invoice order workflow

1. Customers add live catalog items to the cart, provide contact and shipping details, and submit an order request. Submission does not charge a payment method.
2. Each request appears under **Store admin → Orders** with the customer email and phone, shipping address, item/variant quantities, price snapshot, shipping estimate, notes, and any attached custom brief.
3. Review the request and contact the customer to send an invoice using your chosen invoicing method. Record your invoice reference and mark the order **invoice sent**. Update the order as payment and shipping progress.
4. Customers who checked out while signed in can see order status and tracking under `/account`. Guests receive an on-screen order reference after submission.

The storefront does not send invoices, collect payment, calculate tax, or automatically email order confirmations. The invoice you send is the payment request; enter any final tax or shipping adjustments on it before sending.

## Environment variables

| Variable | Required for | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Catalog, auth, settings, and order storage | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser/server client | Browser-safe; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Secure order creation and private custom brief handling | **Server only** |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical URL for production metadata | Public origin |

Copy `.env.example` to `.env.local`; never commit `.env.local` or real credentials.

## Store capabilities

- **Storefront:** responsive home, shop filters, category and collection sorting/search, product detail pages with bike compatibility, color variations and image galleries, and SEO metadata.
- **Cart and invoice checkout:** browser-persisted cart, quantity changes, live shipping estimates and free-shipping threshold, server-verified prices and stock, customer contact/shipping details, idempotent order requests, and a confirmation reference. Customers can check out as guests or while signed in.
- **Customer accounts:** email/password registration and sign-in, editable profile name, RLS-protected order history and tracking, plus reviews restricted to completed purchases and published only after admin moderation.
- **Custom design briefs:** bike/model, style, color, rider name/number, notes, optional private reference image, reference code, admin review/status updates, and optional attachment to an order using the matching brief code and email. Custom design pricing is quoted separately.
- **Private admin:** product CRUD, image uploads, inventory and collection management, full order/customer/shipping details, invoice-number and status tracking, customer listing, custom brief review, review moderation, and configurable shipping/contact settings. Admin routes verify the signed-in Supabase profile role; RLS independently enforces access.

## Validation and deployment

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Deploy to a Node-compatible host such as Vercel. Configure the environment variables in the host's secret manager, apply all database migrations in order, and set Supabase Auth production URLs. Test invoice-order creation, stock reservation/cancellation, custom-brief attachment, and admin permissions before launching.
