using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

// Records localization tries at test points and sends them to POST /api/localization-attempts
// (R12.1, R12.2, R3.4). The API is live since release #117. Live data only: the server refuses
// synthetic attempts, so recording is off when data_origin is "synthetic".
//
// One try:
//   1. Pick the test point and run on screen, stand on the mark, tap "Start try".
//   2. The phone restarts localization (PoseReporter.Retry reloads the scene).
//   3. The try starts when a site is picked again, and ends as:
//        success   the first valid pose; the try ends once the uploader has taken a valid pose
//                  sample after it (at most 3 s), so the server can link that pose and measure the error
//        timeout   no pose 30 s after the start
//        cancelled "Cancel try" was tapped
//   4. The finished try waits in a queue on the phone and is sent once every pose sample
//      is through (so the server can link the try's poses), in order, until the server accepts it.
//
// The scene reloads on every try, so the try in progress, the counters and the queue are
// kept in files in the app's data folder.
public class AttemptRecorder : MonoBehaviour
{
    [Serializable] public class Config { public string base_url; public string device_token; public string map_version_id; public string device_id; public string data_origin; }

    [Serializable] public class TestPoint { public string label; public string test_point_id; }

    // What the phone sends. Empty strings mean "none" (JsonUtility can't write null).
    [Serializable] public class Body
    {
        public string attempt_id, map_version_id, test_point_id, device_id, sdk_version, mode, data_origin;
        public string condition_label, camera_direction, started_at, ended_at, outcome, failure_reason;
        public double latency_ms = -1; // -1 when the try did not succeed
    }

    // The try in progress, kept across the scene reload.
    [Serializable] public class State
    {
        public int point, run = 1, tryNumber = 1;
        public bool pending;          // "Start try" tapped, waiting for a site to be picked
        public bool running;          // site picked, clock running
        public string attemptId, startedAt;
        public List<string> queue = new List<string>(); // finished tries, oldest first
        public int sent, dropped;
    }

    [SerializeField] private bool _recordAttempts = true; // the attempts API is live (release #117)
    [SerializeField] private PoseReporter _reporter;
    [SerializeField] private PoseUploader _uploader;
    [SerializeField] private string _sdkVersion = "NSDK 4.1.0";
    [SerializeField] private string _conditionLabel = "HSS 349 class";
    [SerializeField] private float _retrySeconds = 2f;
    private const float PoseWaitSeconds = 3f; // after a success, wait this long at most for a pose sample
    [SerializeField] private TestPoint[] _points =
    {
        new TestPoint { label = "TP1", test_point_id = "b6000000-0000-4000-8000-000000000001" },
        new TestPoint { label = "TP2", test_point_id = "b6000000-0000-4000-8000-000000000002" },
        new TestPoint { label = "TP3", test_point_id = "b6000000-0000-4000-8000-000000000003" },
        new TestPoint { label = "TP4", test_point_id = "b6000000-0000-4000-8000-000000000004" },
        new TestPoint { label = "TP5", test_point_id = "b6000000-0000-4000-8000-000000000005" },
    };

    private Config _cfg;
    private State _state = new State();
    private string _statePath;
    private bool _busy;
    private float _retryAt;
    private DateTime _startedUtc;
    private DateTime _successUtc;
    private bool _awaitingPose; // success seen, waiting for the uploader's next valid sample
    private string _lastError = "";
    private GUIStyle _style, _buttonStyle;

    private void Start()
    {
        if (!_recordAttempts) return;
        if (_reporter == null) _reporter = FindFirstObjectByType<PoseReporter>();
        if (_uploader == null) _uploader = FindFirstObjectByType<PoseUploader>();
        try
        {
            var path = Path.Combine(Application.streamingAssetsPath, "uploader.local.json");
            _cfg = JsonUtility.FromJson<Config>(File.ReadAllText(path));
        }
        catch (Exception e) { _lastError = "config error " + e.Message; }
        if (_cfg != null && _cfg.data_origin == "synthetic")
        {
            _lastError = "attempts are live only: set data_origin to \"\" to record";
            _cfg = null;
        }
        _statePath = Path.Combine(Application.persistentDataPath, "attempt_state.json");
        LoadState();
        if (_state.running) DateTime.TryParse(_state.startedAt, CultureInfo.InvariantCulture,
            DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal, out _startedUtc);
    }

    private void Update()
    {
        if (!_recordAttempts || _cfg == null || _reporter == null) return;
        string status = _reporter.Status;

        // After the reload: the try starts when a site is picked (same moment PoseReporter's 30 s clock starts).
        if (_state.pending && status != "none")
        {
            _state.pending = false;
            _state.running = true;
            _startedUtc = DateTime.UtcNow;
            _state.startedAt = Iso(_startedUtc);
            SaveState();
        }

        if (_state.running)
        {
            if (_awaitingPose)
            {
                // The server links the first valid pose taken between the success and ended_at,
                // so end the try only after the uploader has taken one.
                bool sampled = _uploader != null && _uploader.LastValidCapturedUtc >= _successUtc;
                if (sampled) Finish("success", "", _uploader.LastValidCapturedUtc.AddMilliseconds(50));
                else if (_uploader == null || (DateTime.UtcNow - _successUtc).TotalSeconds >= PoseWaitSeconds)
                    Finish("success", "", DateTime.UtcNow);
            }
            else if (status == "valid" && _reporter.HasPose)
            {
                _successUtc = DateTime.UtcNow;
                _awaitingPose = true;
            }
            else if (status == "timeout") Finish("timeout", "No position within 30 s", DateTime.UtcNow);
        }

        // Send finished tries once every pose sample has reached the server.
        bool posesThrough = _uploader == null || _uploader.Waiting == 0;
        if (!_busy && posesThrough && _state.queue.Count > 0 && Time.unscaledTime >= _retryAt)
            StartCoroutine(SendOldest());
    }

    private void StartTry()
    {
        _state.attemptId = Guid.NewGuid().ToString();
        _state.pending = true;
        _state.running = false;
        _awaitingPose = false;
        SaveState();
        _reporter.Retry(); // reloads the scene so NSDK starts over
    }

    private void Finish(string outcome, string reason, DateTime endUtc)
    {
        var limit = _startedUtc.AddSeconds(PoseReporter.TimeoutSeconds);
        // A timeout must last at least 30 s and a success at most 30 s (server rules).
        if (outcome == "timeout" && endUtc < limit) endUtc = limit;
        if (outcome == "success" && endUtc > limit) endUtc = limit;
        double latency = outcome == "success"
            ? Math.Max(0, Math.Floor((_successUtc - _startedUtc).TotalMilliseconds))
            : -1;
        var body = new Body
        {
            attempt_id = _state.attemptId,
            map_version_id = _cfg.map_version_id,
            test_point_id = _points[_state.point].test_point_id,
            device_id = _cfg.device_id,
            sdk_version = _sdkVersion,
            mode = "live",
            data_origin = "live_sdk",
            condition_label = $"{_conditionLabel}, run {_state.run}, try {_state.tryNumber}",
            camera_direction = outcome == "success" ? $"yaw {_reporter.YawDegrees:F0} deg" : "not recorded",
            started_at = _state.startedAt,
            ended_at = Iso(endUtc),
            outcome = outcome,
            failure_reason = reason,
            latency_ms = latency,
        };
        _state.queue.Add(JsonUtility.ToJson(body));
        _state.running = false;
        _awaitingPose = false;
        _state.pending = false;
        _state.tryNumber++;
        SaveState();
    }

    private IEnumerator SendOldest()
    {
        _busy = true;
        string json = _state.queue[0];
        using (var req = new UnityWebRequest(_cfg.base_url.TrimEnd('/') + "/api/localization-attempts", "POST"))
        {
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(json));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("x-device-token", _cfg.device_token);
            req.timeout = 10;
            yield return req.SendWebRequest();

            long code = req.responseCode;
            bool ok = req.result == UnityWebRequest.Result.Success;
            // A refused try (422 and similar) can't be fixed by resending. Keep it on no answer, 5xx, 401, 408, 429.
            bool refused = !ok && code >= 400 && code < 500 && code != 401 && code != 408 && code != 429;
            if (ok || refused)
            {
                _state.queue.RemoveAt(0);
                if (ok) { _state.sent++; _lastError = ""; }
                else { _state.dropped++; _lastError = $"refused {code}: {req.downloadHandler.text}"; }
                SaveState();
            }
            else
            {
                _lastError = $"{code} {req.error}";
                _retryAt = Time.unscaledTime + _retrySeconds;
            }
        }
        _busy = false;
    }

    private static string Iso(DateTime utc) =>
        utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture);

    private void LoadState()
    {
        try { if (File.Exists(_statePath)) _state = JsonUtility.FromJson<State>(File.ReadAllText(_statePath)) ?? new State(); }
        catch (Exception e) { _lastError = "state load: " + e.Message; _state = new State(); }
        if (_state.queue == null) _state.queue = new List<string>();
        _state.point = Mathf.Clamp(_state.point, 0, _points.Length - 1);
        if (_state.run < 1) _state.run = 1;
        if (_state.tryNumber < 1) _state.tryNumber = 1;
    }

    private void SaveState()
    {
        try { File.WriteAllText(_statePath, JsonUtility.ToJson(_state)); }
        catch (Exception e) { _lastError = "state save: " + e.Message; }
    }

    private void OnGUI()
    {
        if (!_recordAttempts) return;
        if (_style == null)
        {
            _style = new GUIStyle(GUI.skin.label) { fontSize = 34, wordWrap = true, normal = { textColor = Color.green } };
            _buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = 36 };
        }
        string point = _points[_state.point].label;
        string line;
        if (_state.running) line = $"try: {point}  run {_state.run}  try {_state.tryNumber}  running {(DateTime.UtcNow - _startedUtc).TotalSeconds:F0} s";
        else if (_state.pending) line = $"try: {point}  run {_state.run}  try {_state.tryNumber}  pick the site to start";
        else line = $"try: {point}  run {_state.run}  next try {_state.tryNumber}";
        line += $"\nsent {_state.sent}  waiting {_state.queue.Count}  dropped {_state.dropped}"
            + (_lastError.Length > 0 ? $"  ({_lastError})" : "");
        GUI.Label(new Rect(20, 780, 1100, 120), line, _style);
        if (_cfg == null) return; // config missing or synthetic: show the reason, no buttons

        bool busyTry = _state.running || _state.pending;
        GUI.enabled = !busyTry;
        if (GUI.Button(new Rect(20, 910, 200, 110), "< TP", _buttonStyle)) ChangePoint(-1);
        if (GUI.Button(new Rect(230, 910, 200, 110), "TP >", _buttonStyle)) ChangePoint(1);
        if (GUI.Button(new Rect(440, 910, 200, 110), "Run -", _buttonStyle)) ChangeRun(-1);
        if (GUI.Button(new Rect(650, 910, 200, 110), "Run +", _buttonStyle)) ChangeRun(1);
        if (GUI.Button(new Rect(20, 1030, 400, 120), "Start try", _buttonStyle)) StartTry();
        GUI.enabled = busyTry;
        if (GUI.Button(new Rect(440, 1030, 400, 120), "Cancel try", _buttonStyle))
        {
            if (_state.running) Finish("cancelled", "Cancelled on the phone", DateTime.UtcNow);
            else { _state.pending = false; SaveState(); } // site never picked: nothing to save
        }
        GUI.enabled = true;
    }

    private void ChangePoint(int step)
    {
        _state.point = (_state.point + step + _points.Length) % _points.Length;
        _state.tryNumber = 1;
        SaveState();
    }

    private void ChangeRun(int step)
    {
        _state.run = Math.Max(1, _state.run + step);
        _state.tryNumber = 1;
        SaveState();
    }
}
