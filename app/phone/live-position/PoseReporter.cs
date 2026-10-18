using UnityEngine;

public class PoseReporter : MonoBehaviour
{
    [SerializeField] private VPS2LocalizeDemo _demo;
    [SerializeField] private Camera _camera;

    public bool HasPose { get; private set; }
    public Vector3 Position { get; private set; }
    public float YawDegrees { get; private set; }
    public Quaternion Rotation { get; private set; }

    private string _label = "pose: waiting";
    private GUIStyle _style;

    private void Update()
    {
        if (_camera == null) _camera = Camera.main;
        if (_demo == null || _camera == null || !_demo.IsAnchorTracking)
        {
            HasPose = false;
            _label = "pose: no tracked anchor";
            return;
        }

        var anchor = _demo.AnchorTransform;
        Position = anchor.InverseTransformPoint(_camera.transform.position);
        var rel = Quaternion.Inverse(anchor.rotation) * _camera.transform.rotation;
        Rotation = rel;
        YawDegrees = rel.eulerAngles.y;
        HasPose = true;
        _label = $"x {Position.x:F2}  y {Position.y:F2}  z {Position.z:F2}  yaw {YawDegrees:F0}";
    }

    private void OnGUI()
    {
        if (_style == null)
            _style = new GUIStyle(GUI.skin.label) { fontSize = 36, normal = { textColor = Color.yellow } };
        GUI.Label(new Rect(20, 420, 1100, 80), _label, _style);
    }
}
