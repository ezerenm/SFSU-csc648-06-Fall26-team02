using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

// Samples the phone's pose on a timer and uploads it to /api/poses.
// Samples go into a queue first, so nothing is lost when Wi-Fi drops: the queue is saved on the
// phone and sent in order when the server is reachable again. Each sample keeps its own sample_id
// and captured_at, and the server treats a resent sample_id as already stored.
public class PoseUploader : MonoBehaviour
{
    [Serializable] public class Config { public string base_url; public string device_token; public string map_version_id; public string device_id; public string data_origin; }
    [Serializable] public class V3 { public float x, y, z; }
    [Serializable] public class Q4 { public float x, y, z, w; }
    [Serializable] public class ProviderPose { public V3 position; public Q4 rotation; }
    [Serializable] public class Body
    {
        public string sample_id, map_version_id, device_id, tracking_status, captured_at, data_origin;
        public ProviderPose provider_pose;
    }

    [SerializeField] private PoseReporter _reporter;
    [SerializeField] private float _intervalSeconds = 0.5f;
    [SerializeField] private float _statusIntervalSeconds = 1f; // localizing / lost reports (R4.1)
    [SerializeField] private bool _sendFakePose; // tests the pipeline without localizing; delete rows after
    [SerializeField] private int _maxQueued = 3000; // about 25 minutes of valid samples at 0.5 s
    [SerializeField] private float _retrySeconds = 2f; // wait after a failed send before trying again

    private Config _cfg;
    private bool _busy;
    private float _next, _retryAt, _nextSave;
    private int _sent, _failed, _dropped;
    private string _lastError = "";
    private string _status = "upload: starting";
    private GUIStyle _style;

    // JSON bodies waiting for the server, oldest first.
    private readonly List<string> _queue = new List<string>();
    public int Waiting => _queue.Count; // AttemptRecorder sends a try only after its poses are through
    // When the last valid pose sample was taken. AttemptRecorder ends a successful try after this
    // sample, so the server can link it to the try and measure the error.
    public DateTime LastValidCapturedUtc { get; private set; } = DateTime.MinValue;
    private string _queuePath;
    private bool _queueDirty;

    private void Start()
    {
        if (_reporter == null) _reporter = FindFirstObjectByType<PoseReporter>();
        try
        {
            var path = Path.Combine(Application.streamingAssetsPath, "uploader.local.json");
            _cfg = JsonUtility.FromJson<Config>(File.ReadAllText(path));
        }
        catch (Exception e) { _status = "upload: config error " + e.Message; }
        _queuePath = Path.Combine(Application.persistentDataPath, "pose_queue.jsonl");
        LoadQueue(); // samples left from an earlier session that never reached the server
    }

    private void Update()
    {
        if (_cfg == null) return;

        // 1. Take a sample on schedule, even while an upload is still waiting.
        if (Time.unscaledTime >= _next)
        {
            // Send a status as soon as a site is picked, not only once there is a pose (R4.1).
            string state = _reporter != null ? _reporter.Status : "none";
            bool real = state != "none";
            if (!real && !_sendFakePose) { if (_queue.Count == 0) _status = "upload: pick a site"; }
            else
            {
                // A timeout ends the attempt on the phone; NSDK keeps trying, so the server still hears "localizing"
                // and /live shows "Timed out, try again" (R3.4).
                string tracking = !real ? "valid" : state == "timeout" ? "localizing" : state;
                _next = Time.unscaledTime + (tracking == "valid" ? _intervalSeconds : _statusIntervalSeconds);
                Enqueue(BuildBody(real, tracking));
            }
        }

        // 2. Send the oldest waiting sample, one at a time, in order.
        if (!_busy && _queue.Count > 0 && Time.unscaledTime >= _retryAt) StartCoroutine(SendOldest());

        // 3. Save the queue now and then, so a crash or an app restart keeps it.
        if (_queueDirty && Time.unscaledTime >= _nextSave) SaveQueue();
    }

    private string BuildBody(bool real, string tracking)
    {
        // Only a valid sample has a pose. JsonUtility can't send null, so others send zeros and the server ignores them.
        bool hasPose = real && tracking == "valid" && _reporter.HasPose;
        Vector3 p = hasPose ? _reporter.Position : real ? Vector3.zero : new Vector3(0f, 0.2f, -1f);
        Quaternion r = hasPose ? _reporter.Rotation : real ? new Quaternion(0f, 0f, 0f, 0f) : Quaternion.identity;
        if (real && tracking == "valid" && !hasPose) tracking = "lost"; // pose dropped between frames
        DateTime captured = DateTime.UtcNow;
        if (hasPose) LastValidCapturedUtc = captured;
        var body = new Body
        {
            sample_id = Guid.NewGuid().ToString(),
            map_version_id = _cfg.map_version_id,
            device_id = real ? _cfg.device_id : "fake-test",
            tracking_status = tracking,
            data_origin = _cfg.data_origin, // optional: "synthetic" when testing away from the real site
            captured_at = captured.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture),
            provider_pose = new ProviderPose
            {
                position = new V3 { x = p.x, y = p.y, z = p.z },
                rotation = new Q4 { x = r.x, y = r.y, z = r.z, w = r.w }
            }
        };
        return JsonUtility.ToJson(body);
    }

    private void Enqueue(string json)
    {
        if (_queue.Count >= _maxQueued)
        {
            _queue.RemoveAt(0); // full: drop the oldest so the live map catches up
            _dropped++;
        }
        _queue.Add(json);
        _queueDirty = true;
        UpdateStatus();
    }

    private IEnumerator SendOldest()
    {
        _busy = true;
        string json = _queue[0];
        using (var req = new UnityWebRequest(_cfg.base_url.TrimEnd('/') + "/api/poses", "POST"))
        {
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("x-device-token", _cfg.device_token);
            req.timeout = 5;
            yield return req.SendWebRequest();

            long code = req.responseCode;
            bool ok = req.result == UnityWebRequest.Result.Success;
            // 422 and similar: the server refused this sample's data, so resending it can't help.
            // No answer, 5xx, 401 (token), 408 and 429: keep it and try again later.
            bool refused = !ok && code >= 400 && code < 500 && code != 401 && code != 408 && code != 429;

            if (ok || refused)
            {
                // The queue only grows at the end, so the sample just sent is still first.
                if (_queue.Count > 0 && _queue[0] == json) _queue.RemoveAt(0);
                _queueDirty = true;
                if (ok) _sent++; else { _dropped++; _lastError = $"refused {code}"; }
                if (ok) _lastError = "";
            }
            else
            {
                _failed++;
                _lastError = $"{code} {req.error}";
                _retryAt = Time.unscaledTime + _retrySeconds;
            }
        }
        UpdateStatus();
        _busy = false;
    }

    private void UpdateStatus()
    {
        _status = $"upload: sent {_sent}  waiting {_queue.Count}  failed tries {_failed}  dropped {_dropped}"
            + (_lastError.Length > 0 ? $"  ({_lastError})" : "");
    }

    private void LoadQueue()
    {
        try
        {
            if (!File.Exists(_queuePath)) return;
            foreach (var line in File.ReadAllLines(_queuePath))
                if (!string.IsNullOrWhiteSpace(line)) _queue.Add(line);
            while (_queue.Count > _maxQueued) { _queue.RemoveAt(0); _dropped++; }
            UpdateStatus();
        }
        catch (Exception e) { _lastError = "queue load: " + e.Message; }
    }

    private void SaveQueue()
    {
        _nextSave = Time.unscaledTime + 2f;
        _queueDirty = false;
        try { File.WriteAllLines(_queuePath, _queue); }
        catch (Exception e) { _lastError = "queue save: " + e.Message; }
    }

    // iOS can kill a paused app without calling OnApplicationQuit, so save on pause too.
    private void OnApplicationPause(bool paused) { if (paused && _queuePath != null) SaveQueue(); }
    private void OnApplicationQuit() { if (_queuePath != null) SaveQueue(); }
    // PoseReporter.Retry reloads the scene, which destroys this object: save first.
    private void OnDestroy() { if (_queuePath != null) SaveQueue(); }

    private void OnGUI()
    {
        if (_style == null)
            _style = new GUIStyle(GUI.skin.label) { fontSize = 30, wordWrap = true, normal = { textColor = Color.cyan } };
        var r = new Rect(20, 480, 1100, 130);
        GUI.color = Color.black;
        GUI.DrawTexture(r, Texture2D.whiteTexture);
        GUI.color = Color.white;
        GUI.Label(r, _status, _style);
    }
}
