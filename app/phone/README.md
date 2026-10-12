# SpatialOS iPhone client (Unity)

- Unity **6000.3.14f1** exactly (NSDK 4.1.0 does not support newer), with iOS Build Support
- Xcode + an Apple ID for signing; Rosetta 2 on Apple Silicon
- Unity Hub → Add project from disk → select `app/phone`

## Your Niantic token (never commit it)
Project Settings → XR Plug-in Management → Niantic Spatial → paste **your own** access token.
It is saved in `Assets/XR/Settings/AuthBuildSettings.asset`. Before committing, run:

    grep -rn "eyJhbGci" app/phone

It must print nothing. If it does, clear the token field first.
