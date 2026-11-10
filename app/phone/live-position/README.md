# Live position scripts (iPhone → /api/poses → /live)

These two scripts are **not** under `Assets/` on purpose: `PoseReporter` depends on `VPS2LocalizeDemo` from Niantic's VPS2 sample, which is not committed in this repo, so placing them in `Assets/` would break the Unity compile.

## Setup
1. Import the Niantic NSDK VPS2 sample, then copy `PoseReporter.cs` and `PoseUploader.cs` into `Assets/Samples/VPS2/Scripts/`.
2. Add both components to one GameObject in the VPS2 scene. Drag the `VPS2LocalizeDemo` object into PoseReporter's `Demo` field; PoseUploader finds the reporter itself.
3. Create `Assets/StreamingAssets/uploader.local.json` from `uploader.local.json.example`. **Never commit this file** (it holds the device token). Get the token from Sumit. It is gitignored in the Unity project.
4. iOS Player Settings → Other Settings → *Allow downloads over HTTP* must be **Not allowed** for the production https URL. Use *Always allowed* only for plain-http tests against a laptop on the same network.
5. Leave **Send Fake Pose** unticked for real runs. If used, delete the rows afterwards: `delete from public.pose_samples where device_id = 'fake-test';`

## What it does
- `PoseReporter`: camera pose relative to the VPS anchor (position + rotation).
- `PoseReporter`: also tracks the status (R4.1, R3.4). It starts when a site is picked: `localizing` until the first pose, `valid` while tracking, `lost` after a pose was lost, and `timeout` if there is no pose 30 s after the site was picked. On timeout the phone shows a **Retry** button that reloads the scene.
- `PoseUploader`: POSTs that pose to `<base_url>/api/poses` every 0.5 s with header `x-device-token`. The route converts Unity z to world z (`z_world = -z_unity`), computes heading, and inserts into `pose_samples`. The `/live` page shows it through Supabase Realtime.
- While localizing or lost it POSTs a status every 1 s with no position (the server ignores the zero pose Unity sends). After a timeout it keeps sending `localizing`, because NSDK keeps trying; `/live` then shows "Timed out, try again".
- Set `"data_origin": "synthetic"` in `uploader.local.json` when testing away from the real site, so test runs never count as real localizations. Leave it empty for real runs.
- Offline queue: every sample goes into a queue first and is sent in order, so nothing is lost when Wi-Fi drops. The queue is saved on the phone (`pose_queue.jsonl` in the app's data folder) and survives an app restart. Each sample keeps its own `sample_id` and `captured_at`; the server treats a resent `sample_id` as already stored. A sample the server refuses (422) is dropped; no answer, 5xx, 401, 408 and 429 are retried every 2 s. The queue holds up to 3000 samples (about 25 min), then drops the oldest.
- On-screen status line: `upload: sent N  waiting W  failed tries F  dropped D`. `waiting` above 0 means the phone is offline or catching up.
- Offline test: localize, turn on Airplane Mode for 30 s (`waiting` grows), turn it off (`waiting` goes back to 0), then check that `pose_samples` has no gap for those 30 s.
