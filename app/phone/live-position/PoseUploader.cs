using System;
using System.Collections;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

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

    private Config _cfg;
    private bool _busy;
    private float _next;
    private int _sent, _failed;
    private string _status = "upload: starting";
    private GUIStyle _style;

    private void Start()
    {
        if (_reporter == null) _reporter = FindFirstObjectByType<PoseReporter>();
        try
        {
            var path = Path.Combine(Application.streamingAssetsPath, "uploader.local.json");
            _cfg = JsonUtility.FromJson<Config>(File.ReadAllText(path));
        }
        catch (Exception e) { _status = "upload: config error " + e.Message; }
    }

    private void Update()
    {
        if (_cfg == null || _busy || Time.unscaledTime < _next) return;
        // Send a status as soon as a site is picked, not only once there is a pose (R4.1).
        string state = _reporter != null ? _reporter.Status : "none";
        bool real = state != "none";
        if (!real && !_sendFakePose) { _status = "upload: pick a site"; return; }
        // A timeout ends the attempt on the phone; NSDK keeps trying, so the server still hears "localizing"
        // and /live shows "Timed out, try again" (R3.4).
        string tracking = !real ? "valid" : state == "timeout" ? "localizing" : state;
        _next = Time.unscaledTime + (tracking == "valid" ? _intervalSeconds : _statusIntervalSeconds);
        StartCoroutine(Send(real, tracking));
    }

    private IEnumerator Send(bool real, string tracking)
    {
        _busy = true;
        // Only a valid sample has a pose. JsonUtility can't send null, so others send zeros and the server ignores them.
        bool hasPose = real && tracking == "valid" && _reporter.HasPose;
        Vector3 p = hasPose ? _reporter.Position : real ? Vector3.zero : new Vector3(0f, 0.2f, -1f);
        Quaternion r = hasPose ? _reporter.Rotation : real ? new Quaternion(0f, 0f, 0f, 0f) : Quaternion.identity;
        if (real && tracking == "valid" && !hasPose) tracking = "lost"; // pose dropped between frames
        var body = new Body
        {
            sample_id = Guid.NewGuid().ToString(),
            map_version_id = _cfg.map_version_id,
            device_id = real ? _cfg.device_id : "fake-test",
            tracking_status = tracking,
            data_origin = _cfg.data_origin, // optional: "synthetic" when testing away from the real site
            captured_at = DateTime.UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture),
            provider_pose = new ProviderPose
            {
                position = new V3 { x = p.x, y = p.y, z = p.z },
                rotation = new Q4 { x = r.x, y = r.y, z = r.z, w = r.w }
            }
        };
        using (var req = new UnityWebRequest(_cfg.base_url.TrimEnd('/') + "/api/poses", "POST"))
        {
            req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes(JsonUtility.ToJson(body)));
            req.downloadHandler = new DownloadHandlerBuffer();
            req.SetRequestHeader("Content-Type", "application/json");
            req.SetRequestHeader("x-device-token", _cfg.device_token);
            req.timeout = 5;
            yield return req.SendWebRequest();
            bool ok = req.result == UnityWebRequest.Result.Success;
            if (ok) _sent++; else _failed++;
            _status = $"upload: {tracking}  sent {_sent}  failed {_failed}" + (ok ? "" : $"  ({req.responseCode} {req.error})");
        }
        _busy = false;
    }

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
