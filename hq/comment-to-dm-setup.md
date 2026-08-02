# Comment → DM — switching it on

Someone comments **BOOK** on the shop's Instagram post and Loop DMs them the booking link
within a second or two. This is the ManyChat feature, built into the command center.

The rules UI is live right now at **/center/** → **📩 Comment → DM**. A shop can write its
rules today; they start firing the moment its Instagram account is connected below.

---

## What Instagram requires (not optional)

Meta is the only legal path to DM a commenter. There is no scraping workaround, and an
account that tries one gets banned. Their rules:

1. The shop's Instagram must be a **Business** or **Creator** account (free to switch:
   Instagram → Settings → Account type).
2. It must be **linked to a Facebook Page** (Instagram walks you through this).
3. The DM must go out **within 7 days** of the comment, and **one DM per comment** — both
   enforced by Meta, and the second one is enforced by us too so a webhook retry can never
   double-message anyone.

Loop shows the shop these three steps itself when the account isn't connected yet.

---

## One-time setup (about 30 minutes, done once for all shops)

### 1. Create the Meta app

At <https://developers.facebook.com/apps> → **Create App** → type **Business**.
Add the **Instagram** and **Messenger** products.

Request these permissions: `instagram_basic`, `instagram_manage_comments`,
`instagram_manage_messages`, `pages_manage_metadata`, `pages_read_engagement`.

While the app is in Development mode it only works on accounts you own — fine for testing
on Nick's own Instagram. Serving real shops needs App Review for
`instagram_manage_messages` (Meta usually turns this around in a few days; record a short
screen capture of the flow for the submission).

### 2. Set the Vercel environment variables

Vercel → Project → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://qgbjiqdwzgkjkmqyjsmc.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the service_role key (server-only — never in a page) |
| `IG_VERIFY_TOKEN` | any long random string you invent |
| `IG_APP_SECRET` | Meta app → Settings → Basic → App Secret |
| `IG_WEBHOOK_KEY` | another long random string you invent |
| `IG_PAGE_TOKEN` | *(optional)* fallback Page token when a shop has none of its own |

Until `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` and `IG_VERIFY_TOKEN` all exist, the endpoint
answers `503` and does nothing. Nothing else in the command center is affected.

### 3. Point the webhook at us

Meta app → **Webhooks** → Instagram → **Subscribe to this object**:

- **Callback URL:** `https://tbsol.net/api/ig-webhook?k=<IG_WEBHOOK_KEY>`
- **Verify Token:** the `IG_VERIFY_TOKEN` you set above
- **Field:** subscribe to `comments`

Meta immediately GETs that URL to verify it. If it fails, the env vars aren't deployed yet
— redeploy and hit **Verify** again.

For Facebook Page comments too, repeat under Webhooks → Page and subscribe to `feed`.

**Why the `?k=` is on the URL.** Vercel parses the request body before our code runs, which
destroys the exact bytes Meta signed, so the `X-Hub-Signature-256` check can't always run.
The endpoint verifies that signature whenever it *can* read the raw body, and falls back to
the secret in the query string otherwise. Meta preserves the query string on every callback.
Treat `IG_WEBHOOK_KEY` as a password — anyone holding it can post fake comment events.

### 4. Connect a shop

Get a long-lived Page access token for the shop's Page
(Meta's [Access Token Tool](https://developers.facebook.com/tools/explorer/) → exchange for
a long-lived one), find the Instagram Business account id, and insert the row:

```sql
insert into public.dm_accounts (ig_user_id, client, ig_username, page_id, page_token)
values ('<INSTAGRAM_BUSINESS_ACCOUNT_ID>', '<loop client code>', '<their @handle>',
        '<FACEBOOK_PAGE_ID>', '<LONG_LIVED_PAGE_TOKEN>');
```

`client` is the shop's Loop code — the same one in their `/center/?c=` link.
The command center flips to **● Connected** on the next load.

Leave `page_token` null to fall back to the `IG_PAGE_TOKEN` env var. Tokens live only in
this table, which has RLS on and no public policies; `dm_claim` is the only function that
reads them and it is revoked from the anon key.

---

## Testing it

1. Add a rule in **/center/** → Comment → DM. Keyword `BOOK`, any message.
2. From a *different* Instagram account, comment "BOOK" on one of the shop's posts.
3. The DM should land in seconds. The rule card's counter ticks up and the comment appears
   under **Recent**.

Nothing happened? Check in this order:

- **Recent is empty** → Meta never called us. Meta app → Webhooks → **Recent Deliveries**
  shows the attempts and their responses.
- **Recent shows ⚠️ with a reason** → we called Meta and Meta refused; the reason is Meta's
  own error text, shown verbatim.
- Vercel → Project → Logs, filtered to `/api/ig-webhook`, has the full request detail.

Common Meta refusals:

| Message | What it means |
|---|---|
| *outside the allowed window* | the comment is more than 7 days old |
| *(#10) Application does not have permission* | `instagram_manage_messages` not approved yet |
| *Invalid OAuth access token* | the Page token expired — mint a new long-lived one |

---

## How it behaves

- **One DM per comment, ever.** The claim is a unique index on `comment_id`, so Meta's
  retries and duplicate deliveries can't double-message anyone.
- **The shop's own comments are ignored**, and so are replies to replies — otherwise the
  bot would answer itself in a loop.
- **First matching rule wins**, oldest first. A `match = any` rule is always tried last, so
  it works as a catch-all under the specific keywords.
- **`{name}`** in the message becomes the commenter's Instagram handle.
- **A failed public reply never fails the DM** — the DM is the point; the public "check
  your DMs 📩" is a nudge.
- Rules are capped at 25 per shop and the DM body at 900 characters (Meta's limit).

## Where the code lives

| Piece | File |
|---|---|
| Tables + RPCs | `hq/comment-to-dm.sql` (already applied to Supabase) |
| Webhook endpoint | `api/ig-webhook.js` |
| Function registration | `vercel.json` |
| Shop-facing UI | `center/index.html` → the `📩 Comment → DM` tab |
