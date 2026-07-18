# Turn on cloud sync (phone ↔ laptop) — ~3 minutes

Right now the CRM saves on whichever device you open it on. Follow these
steps once to sync everything across all your devices.

## 1. Make a free Supabase project
1. Go to **https://supabase.com** → sign up (free).
2. Click **New project**. Give it a name (e.g. `tb-command`) and a database
   password (save it somewhere). Pick the region closest to you. Create it.
3. Wait ~1 minute for it to finish setting up.

## 2. Create the table
1. In the left menu click **SQL Editor** → **New query**.
2. Open the file **`hq/supabase-setup.sql`** (in this repo), copy all of it,
   paste it in, and click **Run**. You should see "Success".

## 3. Turn on email login
1. Left menu → **Authentication** → **Providers** → make sure **Email** is on.
2. (Optional, easier while it's just you) Under Email, turn **OFF**
   "Confirm email" so you can log in instantly without a confirmation click.

## 4. Get your two keys
1. Left menu → **Project Settings** (gear) → **API**.
2. Copy the **Project URL** and the **anon public** key.

## 5. Give them to your builder (or paste them yourself)
Open **`hq/index.html`**, near the top of the `<script>` you'll see:

```js
var SUPA_URL = '';   // e.g. https://abcdxyz.supabase.co
var SUPA_KEY = '';   // your Supabase "anon public" key
```

Paste your two values between the quotes, save, and push. Then open
`tbsol.net/hq`, click **Create your account**, and log in — your data now
syncs everywhere.

> The anon key is safe to put in the page — the security is handled by the
> database rule (Row Level Security) from step 2, which only lets each
> logged-in user touch their own data.
