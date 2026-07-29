# Supabase + Vercel setup

## 1. Create the Supabase project
1. Open the Supabase dashboard.
2. Click **New project**.
3. Choose your organization.
4. Project name: `ajedrez-openai`.
5. Set a strong database password and save it.
6. Pick a region close to your users.
7. Click **Create new project** and wait for provisioning.

## 2. Get the project API keys
1. In Supabase, open **Project Settings**.
2. Open **API**.
3. Copy:
   - **Project URL**
   - **anon public** key
4. Keep this tab open.

## 3. Run the SQL migration in Supabase
1. In Supabase, open **SQL Editor**.
2. Click **New query**.
3. Open this local file from the repo:
   - `supabase/migrations/0001_rooms.sql`
4. Paste the full SQL into the editor.
5. Click **Run**.
6. Verify success with no errors.
7. Repeat steps 2–6 for the second migration:
   - `supabase/migrations/0002_online_move_authority.sql`
   - This adds `winner` / `result_reason` columns and the `apply_room_move` /
     `finish_room` RPCs used by online play.

## 4. Enable Realtime for rooms
1. In Supabase, open **Database** → **Replication**.
2. Confirm `public.rooms` is included in realtime replication.
3. If it is not enabled, enable it for the `rooms` table.

## 5. Check the table
1. Open **Table Editor**.
2. Open the `rooms` table.
3. Confirm these columns exist:
   - `code`
   - `host_name`
   - `guest_name`
   - `host_side`
   - `clock_initial_seconds`
   - `clock_increment_seconds`
   - `theme`
   - `piece_style`
   - `status`
   - `fen`
   - `pgn`
   - `winner` (nullable 'white' | 'black')
   - `result_reason` (nullable text)

## 6. Deploy the repo to Vercel
1. Push the repo to GitHub.
2. Open Vercel.
3. Click **Add New** → **Project**.
4. Import your GitHub repo.
5. Leave the framework as **Vite** if Vercel detects it.
6. Click into the environment variable section before deployment.

## 7. Add Vercel environment variables
Add these exactly:
- `VITE_SUPABASE_URL` = your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key

Set them for:
- Production
- Preview
- Development

Then deploy.

## 8. Add your Vercel domain to Supabase
1. After deploy, copy your Vercel production URL.
2. In Supabase, open **Project Settings** → **API** or **Authentication** if needed later.
3. For this app, no login redirect setup is required yet because auth is disabled.
4. If you later add auth, add:
   - `https://your-app.vercel.app`
   - any custom domain you attach

## 9. Verify the app
1. Open the deployed Vercel URL.
2. In the lobby, use **Create Room**.
3. Confirm a room code appears in the game header.
4. Open the app in a second browser/incognito window.
5. Enter the room code and click **Join**.
6. Confirm the second player can enter the room.

## 10. If online multiplayer says env vars are missing
In Vercel:
1. Open the project.
2. Go to **Settings** → **Environment Variables**.
3. Recheck both variable names:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Redeploy after saving.

## 11. If room creation fails
Check these in order:
1. The SQL migration ran successfully.
2. The `rooms` table exists in `public`.
3. RLS policies were created.
4. Realtime replication includes `public.rooms`.
5. Vercel env vars are set correctly.

## 12. Current scope
Right now the online flow covers:
- create room
- join room by code
- persist room metadata in Supabase
- show room code in game UI

Next implementation step is live synchronized board state and moves over Supabase Realtime.
