# Bozor Marketplace

A responsive marketplace starter with a product catalogue, search/category filters, listing creation, buyer/seller chat, price offers, and Supabase Realtime refresh.

## Files

- `index.html` — app layout and modals
- `styles.css` — responsive visual design
- `app.js` — catalogue, messages, offers, realtime updates
- `config.js` — Supabase project URL and publishable/anon key
- `supabase.sql` — database tables, policies and realtime publication
- `vercel.json` — Vercel single-page routing

## 1. Connect Supabase

1. Open your Supabase project dashboard.
2. Open **SQL Editor**, create a query, paste all of `supabase.sql`, and run it.
3. Open **Project Settings / API** or the **Connect** panel and copy the Project URL and publishable key (legacy anon key also works).
4. Edit `config.js`:
   - replace `https://YOUR-PROJECT.supabase.co`
   - replace `YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY`
5. Save and upload all files to GitHub, not just README.md.

The browser key must be a publishable/anon key only. Never put a `service_role` or secret key in client-side code.

## 2. Deploy to Vercel

Import the GitHub repository in Vercel and deploy. This is a static Vite site; Vercel detects `package.json` automatically. For this simple project the default build command is `npm run build` and output directory is `dist`.

## 3. Test across devices

1. Open the deployed site on device A and publish a product.
2. Open the same deployment on device B; the product should appear after the database is configured.
3. Open the product on device B and send a message / make a price offer.
4. Open the original device and check the inbox and “Мой торг”.

## Important MVP security note

This starter uses generated guest IDs stored in each browser, not authenticated accounts. Its SQL policies are intentionally broad so you can test cross-device flows. That is **not suitable for a public production marketplace**: anonymous users could read messages and change offers. Before launching publicly, add Supabase Auth, verify seller ownership server-side, restrict Row Level Security policies, and use Supabase Storage for product images. Do not collect payment card details in chat or listing descriptions.

## Local run

```bash
npm install
npm run dev
```

Open the local address Vite prints in the terminal.
