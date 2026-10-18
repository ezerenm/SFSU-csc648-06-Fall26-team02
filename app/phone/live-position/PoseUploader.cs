using System;
using System.Collections;
using System.Globalization;
using System.IO;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class PoseUploader : MonoBehaviour
{
    [Serializable] public class Config { public string base_url; public string device_token; public string map_version_id; public string device_id; }
    [Serializable] public class V3 { public float x, y, z; }
    [Serializable] public class Q4 { public float x, y, z, w; }
    [Serializable] public class ProviderPose { public V3 position; public Q4 rotation; }
    [Serializable] public class Body
    {
        public string sample_id, map_version_id, device_id, tracking_status, captured_at;
        public ProviderPose provider_pose;
    }

    [SerializeField] private PoseReporter _reporter;
    [SerializeField] private float _intervalSeconds = 0.5f;
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
        bool real = _reporter != null && _reporter.HasPose;
        if (!real && !_sendFakePose) { _status = "upload: waiting for pose"; return; }
        _next = Time.unscaledTime + _intervalSeconds;
        StartCoroutine(Send(real));
    }

    private IEnumerator Send(bool real)
    {
        _busy = true;
        Vector3 p = real ? _reporter.Position : new Vector3(0f, 0.2f, -1f);
        Quaternion r = real ? _reporter.Rotation : Quaternion.identity;
        var body = new Body
        {
            sample_id = Guid.NewGuid().ToString(),
            map_version_id = _cfg.map_version_id,
            device_id = real ? _cfg.device_id : "fake-test",
            tracking_status = "valid",
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
            _status = $"upload: sent {_sent}  failed {_failed}" + (ok ? "" : $"  ({req.responseCode} {req.error})");
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
