using UnityEngine;
using UnityEngine.SceneManagement;

// Reads the phone's pose relative to the VPS anchor and its tracking status (R3.4, R4.1).
// Status: "none" (no site picked yet), "localizing", "valid", "lost" (had a pose, lost it),
// "timeout" (no pose 30 s after the site was picked).
public class PoseReporter : MonoBehaviour
{
    public const float TimeoutSeconds = 30f;

    [SerializeField] private VPS2LocalizeDemo _demo;
    [SerializeField] private Camera _camera;

    public bool HasPose { get; private set; }
    public string Status { get; private set; } = "none";
    public Vector3 Position { get; private set; }
    public float YawDegrees { get; private set; }
    public Quaternion Rotation { get; private set; }

    private float _startedAt = -1f;
    private bool _hadPose;
    private string _label = "pose: waiting";
    private GUIStyle _style, _buttonStyle;

    private void Update()
    {
        if (_camera == null) _camera = Camera.main;
        if (_demo == null || _camera == null || _demo.AnchorTransform == null)
        {
            HasPose = false;
            Status = "none";
            _label = "pose: pick a site";
            return;
        }

        // The attempt starts when the site's anchor is set.
        if (_startedAt < 0f) _startedAt = Time.unscaledTime;

        if (_demo.IsAnchorTracking)
        {
            var anchor = _demo.AnchorTransform;
            Position = anchor.InverseTransformPoint(_camera.transform.position);
            var rel = Quaternion.Inverse(anchor.rotation) * _camera.transform.rotation;
            Rotation = rel;
            YawDegrees = rel.eulerAngles.y;
            HasPose = true;
            _hadPose = true;
            Status = "valid";
            _label = $"x {Position.x:F2}  y {Position.y:F2}  z {Position.z:F2}  yaw {YawDegrees:F0}";
            return;
        }

        HasPose = false;
        float waited = Time.unscaledTime - _startedAt;
        if (_hadPose)
        {
            Status = "lost";
            _label = "pose: lost, point the camera at the scanned area";
        }
        else if (waited >= TimeoutSeconds)
        {
            Status = "timeout";
            _label = $"pose: timed out after {TimeoutSeconds:F0} s";
        }
        else
        {
            Status = "localizing";
            _label = $"pose: localizing {waited:F0} s";
        }
    }

    // Starts a fresh attempt: reloads the scene so NSDK starts over too.
    public void Retry()
    {
        SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
    }

    private void OnGUI()
    {
        if (_style == null)
        {
            _style = new GUIStyle(GUI.skin.label) { fontSize = 36, normal = { textColor = Color.yellow } };
            _buttonStyle = new GUIStyle(GUI.skin.button) { fontSize = 40 };
        }
        GUI.Label(new Rect(20, 420, 1100, 80), _label, _style);
        if (Status == "timeout" && GUI.Button(new Rect(20, 620, 400, 120), "Retry", _buttonStyle)) Retry();
    }
}
