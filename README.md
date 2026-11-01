# AIMSETTING YANZX77 — Supabase + Vercel starter

Dark blue/black digital gaming store starter with catalogue, cart, Supabase Auth, order history, manual payment proof uploads, admin product/stock management and order status review.

## 1. Create Supabase project
1. Create a project at https://supabase.com/dashboard.
2. Open SQL Editor and run `supabase.sql` once.
3. Go to Project Settings → API (or Connect) and copy the Project URL and publishable/anon key.
4. Copy `config.example.js` to `config.js`, then fill in your URL and publishable/anon key. Never put a `service_role` key in browser code.
5. In Authentication → URL Configuration, add your local test URL and the deployed Vercel URL. If email confirmation is enabled, users must confirm email before signing in.

## 2. Make yourself admin
1. Register your own account through `account.html` after configuring the site.
2. In Supabase → Authentication → Users, copy your user's UUID.
3. In SQL Editor run (replace the UUID):
   `update public.profiles set role='admin' where id='YOUR_USER_UUID';`
4. Reload the site and open `admin.html`. Never let users choose their own role.

## 3. Run locally
These files are plain HTML/CSS/JS and can be served by any static server. For example, in VS Code use Live Server. Avoid opening `index.html` as a `file://` URL because browser auth redirects may not work as expected.

## 4. Deploy on Vercel
1. Push all project files to a GitHub repository.
2. Import the repository in Vercel.
3. Add `config.js` to the repo only if the values are your Supabase URL and public publishable/anon key; alternatively replace the config loading with a build-time environment setup. The public key is expected to be visible in a browser, protected by RLS.
4. Deploy. Add the Vercel domain to Supabase Authentication URL Configuration.

## 5. Important current MVP limitations
- This starter is not a finished payment processor. Manual payment instructions must be sent by the store owner; do not mark orders paid until you have verified the payment independently.
- Checkout reserves stock at order creation. Cancelling an order returns the reserved stock.
- Before selling, test signup, login, stock race conditions, proof uploads, order cancellation and admin access with separate customer accounts.
- Paid-order file downloads use short-lived signed URLs generated only after the authenticated user is confirmed to own an eligible paid order. The `digital-files` bucket remains private.
- Admin order list currently shows customer UUID prefix, not email; do not expose all customer emails to browser clients.
- Product image URLs should be trusted HTTPS URLs. Avoid uploading copyrighted or game-rule-breaking material.
- This is a starter scaffold; perform a security review and full test before taking real payments.

## Files
- `index.html`, `style.css`, `app.js`: storefront
- `account.html`, `account.js`: auth and customer orders
- `admin.html`, `admin.js`: admin catalogue and order management
- `config.example.js`: copy to `config.js`
- `supabase.sql`: schema, RLS, checkout RPC, storage policies and sample products
