# M3 UML (Appendix I, item 3)

Diagram sources for the M3 UML: one use case diagram, two class diagrams (I.2 domain classes, I.10 implementation classes), six sequence diagrams and one implementation component diagram (I.9). Updated Nov 4, 2026 to match main (PR #57, #62, #64, #65, #67, #69) and the frozen Priority 1 list. After the M3 review the main point is data and localization accuracy, so Flow 5 is the data collection run and navigation items moved to Priority 2 are marked P2.

| Figure | Source | Tool |
|---|---|---|
| I.1 Use cases | `fig1_use_cases.dot` (uses the `stick_*.png` actor icons) | Graphviz |
| I.2 Classes | `fig2_classes.puml` | PlantUML |
| I.3 to I.8 Sequences | `fig3_...mmd` to `fig8_...mmd` | Mermaid (rendered below) |
| I.9 Implementation components | `fig9_implementation_components.dot` | Graphviz |
| I.10 Implementation classes | `fig10_implementation_classes.dot` | Graphviz |

Colors: blue = built and deployed, yellow = partly built, gray = planned (P1 for M4, or P2 / P3 as marked). Actors: visitor green, simulated robot orange, operator purple, developer blue, administrator red-orange, external systems gray. The outlined "Platform" band is our pages, server and database.

## Re-render

```bash
cd milestones/M3/uml
dot -Tpng -Gdpi=200 fig1_use_cases.dot -o fig1_use_cases.png
plantuml -tpng -Sdpi=192 fig2_classes.puml
dot -Tpng -Gdpi=220 fig9_implementation_components.dot -o fig9_implementation_components.png
dot -Tpng -Gdpi=200 fig10_implementation_classes.dot -o fig10_implementation_classes.png
for f in fig[3-8]_*.mmd; do npx -y @mermaid-js/mermaid-cli -c mermaid.json -s 2 -b white -i "$f" -o "${f%.mmd}.png"; done
```

## Use case and domain class diagrams

![Use cases](fig1_use_cases.png)

![Classes](fig2_classes.png)

## Implementation components and classes

![Implementation components](fig9_implementation_components.png)

![Implementation classes](fig10_implementation_classes.png)

## Sequence diagrams

### Flow 1: Localize the phone and show the live position

```mermaid
%% Fig I.3 Flow 1: Visitor localizes and the live map shows position + status (R3.1, R3.2, R3.4, R4.1)
sequenceDiagram
    box rgba(0,158,115,0.13) Visitor
    actor V as Visitor
    participant P as iPhone app<br/>(Unity + NSDK)
    end
    box rgba(120,120,120,0.10) External
    participant N as Niantic VPS
    end
    box transparent Platform
    participant API as POST /api/poses
    participant DB as Supabase<br/>pose_samples
    participant L as /live page<br/>(browser)
    end

    L->>DB: read latest 50 poses for the map, subscribe to INSERTs (Realtime)
    V->>P: open app, point camera around
    P->>N: localize against "SFSU HSS 349 v2"
    N-->>P: pose in the VPS map frame (PRECISE + TRACKING)
    P->>P: PoseReporter status: localizing until the first pose,<br/>valid while tracking, lost after losing it,<br/>timeout (Retry button) if no pose 30 s after picking the site
    loop every 0.5 s when valid, every 1 s when localizing or lost
        P->>API: sample_id, map_version_id, device_id,<br/>tracking_status, captured_at + x-device-token,<br/>provider_pose only when valid
        alt bad token / bad body / unpublished map
            API-->>P: 401 or 400 (pose not stored)
        else valid
            API->>API: poseFields: valid keeps the position,<br/>world_position = (x, y, −z). Localizing / lost<br/>store no position. data_origin = poseOrigin(device_id)
            API->>DB: insert (repeated sample_id is not stored twice)
            API-->>P: 200
            DB-->>L: Realtime INSERT event
            L->>L: getChipLook(): green valid, yellow localizing,<br/>red lost, gray when received_at is 5 s old<br/>(server time, not the phone clock),<br/>"Timed out" after 30 s localizing
            L->>L: move the dot only if the message has a position,<br/>otherwise keep the last real spot<br/>(label from deviceTypes: visitor / robot)
        end
    end
    opt Realtime quiet for 2 s (fallback so the dot never freezes)
        loop every 2 s, every 5 s after 10 s with no new messages
            L->>DB: read the newest poses for the map
            DB-->>L: rows, handled the same way as Realtime events
        end
    end
```

### Flow 2: Choose a destination and follow the route

```mermaid
%% Fig I.4 Flow 2: Visitor picks a destination and follows the route (R5.1-R5.5, R6.2-R6.4, R20)
sequenceDiagram
    box rgba(0,158,115,0.13) Visitor
    actor V as Visitor
    participant L as /live page
    end
    box transparent Platform
    participant API as POST /api/route
    participant DB as Supabase<br/>m2_get_graph()
    participant R as RoutingEngine<br/>findRoute (Dijkstra)
    end

    V->>L: choose a destination
    L->>L: findNearestSegment(live position, human)
    alt chip not green, or more than 2 m from any path
        L-->>V: keep the previous start (or no route yet:<br/>"Can't start here")
    else
        L->>L: pickStartNode: nearer end of the segment<br/>(draw the gold attach line)
        L->>API: map_version_id, start_node_id,<br/>destination_id, profile = human
        API->>API: check the body (400)
        API->>DB: load graph (nodes, segments, destinations)
        DB-->>API: graph + revisions (404 if map not visible)
        API->>API: start node + active destination exist (404)
        API->>R: findRoute(nodes, segments, start, end, profile)
        R-->>API: steps over open segments only<br/>(robot profile also skips restricted)
        API->>API: validateRoutingResult: connected, open, allowed,<br/>no repeated node (502 if wrong)
        alt no permitted path
            API-->>L: status = unreachable
            L-->>V: "Unreachable: no open path"
        else
            API-->>L: status = valid, steps, distance_m,<br/>graph_revision, path_state_revision
            L-->>V: route line + distance (one decimal)
        end
    end
    loop each new live pose
        L->>L: switch start node only if 0.75 m closer (anti-flicker)
        L-->>V: "Arrived" when the chip is green<br/>and within 1.0 m of the destination
    end
    rect rgb(238,238,238)
        Note over V,L: Priority 2, if time allows (R20): the same route and arrival on the visitor's iPhone, not only on /live
    end
```

### Flow 3: Wet floor: report, close, and reroute everyone

```mermaid
%% Fig I.5 Flow 3: Wet floor - report, operator confirms and closes, everyone reroutes (R18.7, R18.4, R18.5, R8.1-R8.3, R9.1-R9.3)
sequenceDiagram
    box rgba(0,158,115,0.13) Visitor
    actor V as Visitor (phone)
    end
    box rgba(142,68,173,0.12) Operator
    actor O as Operator<br/>(/operator page)
    end
    box transparent Platform
    participant API as Server API
    participant DB as Supabase
    participant L as /live page
    end

    rect rgb(238,238,238)
        Note over V,DB: Priority 2: report and confirm (R18.7, R18.4, R18.5)
        V->>API: POST /api/reports (segment, kind = wet_floor, session_id)
        API->>DB: insert path_report (status = pending)
        DB-->>O: Realtime alert "Wet floor reported on S2"
        O->>O: check the report (camera, staff on site)
    end
    Note over O,DB: Built (PR #35;67, #35;69): operator panel on /operator. No accounts yet, so a shared operator token
    O->>API: PATCH /api/segments<br/>segment_id, action = close (or reopen,<br/>humans_only, allow_robots) + x-operator-token
    alt wrong token
        API-->>O: 401 (nothing changes)
    else token ok
        API->>DB: read the segment (404 if unknown)
        API->>DB: bump current_path_state_revision<br/>only if nobody changed it meanwhile
        alt another change landed first
            API-->>O: 409 "try again"
        else
            API->>DB: update availability / robot_access<br/>+ last_state_revision
            API->>API: log the change on the server<br/>(path_event table planned)
            API-->>O: 200 changed
        end
    end
    Note over API,L: Built (PR #35;62, #35;64): rerouting by polling, for the visitor and the simulated robot
    loop every 3 s while the tab is visible
        L->>API: GET /api/graph
        API-->>L: graph
        L->>L: pathStateKey(graph)
        opt pathStateKey changed
            L->>API: POST /api/route again: visitor (human)<br/>and simulated robot (robot profile)
            alt another open path exists
                API-->>L: valid, new steps
                L->>L: new route + banner "Path changed: S2 closed.<br/>Route recalculated." (20 s)
            else
                API-->>L: unreachable
                L->>L: "Unreachable: no open path"
            end
        end
    end
    rect rgb(238,238,238)
        Note over V,L: Priority 2 (R20): the visitor's phone shows the new route too. Today only /live does
    end
    Note over O,L: Reopen (R8.2) is the same flow with action = reopen. Humans only (R17.1) changes only the robot route
```

### Flow 4: Run the simulated robot with the robot proxy phone

```mermaid
%% Fig I.6 Flow 4: Simulated robot with the robot proxy phone (R9.2, R10.2, R10.3, R17.1, R19; R5.6, R10.1 planned)
sequenceDiagram
    box rgba(230,159,0,0.16) Simulated robot
    actor T as Tester with<br/>robot proxy phone
    participant P as iPhone app<br/>(iphone-daksh)
    end
    box rgba(142,68,173,0.12) Operator
    actor O as Operator
    end
    box transparent Platform
    participant L as /live page
    participant API as Server API
    participant DB as Supabase
    end

    loop every 0.5 s (same pose upload as Flow 1)
        P->>API: POST /api/poses (device_id = iphone-daksh)
        API->>DB: insert pose_sample
        DB-->>L: Realtime INSERT (or the polling fallback)
        L->>L: deviceTypes: iphone-daksh is the robot,<br/>orange dot labeled "Simulated robot" (R10.2, R19)
    end
    O->>L: pick a "Simulated robot destination"
    L->>L: robotRoute: robot start needs a green chip within 2 m<br/>of a robot-allowed path, nearer end, 0.75 m anti-flicker
    L->>API: POST /api/route (profile = robot)
    alt a robot-allowed path exists
        API-->>L: steps over open, robot-allowed segments
        L->>L: orange dashed robot route,<br/>"humans only" segments drawn pink (R17.1)
    else
        API-->>L: unreachable
        L->>L: no permitted robot route message
    end
    T->>T: walks the robot along the orange route
    opt path state changes (operator close or humans only, Flow 3)
        L->>API: POST /api/route again, profile = robot (R9.2, R10.3)
        API-->>L: new robot route, the visitor route is unchanged
    end
    L->>L: robot arrived: green chip and within 1.0 m
    rect rgb(238,238,238)
        Note over T,DB: Planned M4: robot sessions and commands (tables in PR #35;57, no API yet). Pause and reset are Priority 2
        P->>API: POST /api/sessions (agent_type = robot_proxy)
        O->>API: POST /api/robot-commands: set_destination (R5.6),<br/>start (R10.1), pause / reset (R10.4, R10.5, P2)
        API->>DB: robot_command applied, or rejected with a reason
        P->>API: GET /api/robot-state, next step shown on the robot phone
    end
```

### Flow 5: Data collection run: capture, failures and accuracy

```mermaid
%% Fig I.7 Flow 5: Data collection run: capture, failures and accuracy (R11.1, R12.1-R12.4, R13.1, R13.2, R14)
sequenceDiagram
    box rgba(230,159,0,0.16) Simulated robot
    actor T as Tester with<br/>robot proxy phone
    participant P as iPhone app
    end
    box rgba(120,120,120,0.10) External
    participant N as Niantic VPS
    end
    box rgba(142,68,173,0.12) Operator
    actor O as Operator
    end
    box transparent Platform
    participant L as /live and<br/>/operator pages
    participant H as /health page
    participant API as Server API
    participant DB as Supabase
    end

    Note over P,DB: Built: every pose and tracking status is already saved (pose_samples, PR #35;65)
    rect rgb(238,238,238)
        Note over T,DB: Planned M4 (P1): data collection run. Schema in PR #35;57, write API not built yet
        T->>P: start a collection run (R11.1)
        P->>API: POST /api/sessions (one session = one run)
        loop at each test point on the route (TP1 to TP5)
            P->>N: localize (30 s limit)
            alt pose within 30 s
                P->>API: POST /api/localization-attempts<br/>outcome = success, latency_ms, valid pose (R12.1)
                API->>DB: save attempt, horizontal error vs the<br/>verified reference (error_is_valid trigger, PR #35;57)
            else timeout / tracking loss / network error / map mismatch
                P->>API: POST outcome + failure reason, no pose (R12.2)
                API->>DB: save the failure
            end
            DB-->>L: Realtime: live capture marker on the robot +<br/>run counts (samples, attempts, failures) (R12.3)
        end
        T->>P: stop the run: counts stay as the run summary
        O->>L: failure list: type, reason, test point, device, time,<br/>tracking status before the failure, filters (R12.4)
        O->>H: charts per test point by day:<br/>success rate, horizontal error (R13.1, R13.2)
    end
    O->>H: open /health (built, PR #35;58, #35;61)
    H->>API: GET /api/health?map_version_id=...&mode=live
    API->>DB: test points + completed attempts for this map (RLS)
    DB-->>API: attempts
    API->>API: computeAllHealth: per test point + device,<br/>rules in order, first match wins
    Note right of API: gray < 10 attempts · red success < 60% ·<br/>red ≥ 5 verified errors and median > 1.5 m ·<br/>gray < 5 verified errors · green ≥ 80% and ≤ 1 m · else yellow
    API-->>H: one result per test point with its reason (no attempts = gray)
    H-->>O: color, reason, successes / attempts, median seconds
```

### Flow 6: Explain localization health with AI

```mermaid
%% Fig I.8 Flow 6: Explain health with AI (R16.1, core AI)
sequenceDiagram
    box rgba(142,68,173,0.12) Operator
    actor O as Operator
    participant H as /health page<br/>(HealthPanel)
    end
    box transparent Platform
    participant API as POST /api/health/summary
    participant S as healthSummary.ts
    end
    box rgba(120,120,120,0.10) External
    participant G as Gemini API<br/>(gemini-flash-lite-latest)
    end

    O->>H: click "Explain with AI"
    H->>API: map_version_id, mode (POST, so previews never trigger a paid call)
    API->>API: same health as Flow 5 (400 / 404)
    API->>S: buildHealthFacts(points, mode)
    S-->>API: rounded facts per point, untested points as gray, color totals
    alt no GEMINI_API_KEY
        API-->>H: 200 status = unavailable + facts
    else key configured
        API->>S: buildSummaryPrompt(facts) (prompt v2: only use numbers from FACTS)
        loop up to 3 tries on 429 / 500 / 503, inside one 15 s deadline
            API->>G: generateContent (key in header, JSON reply, temperature 0.2)
            G-->>API: JSON text, or 429 / 5xx
        end
        alt timed out or error
            API->>API: log status + reason on the server only
            API-->>H: 200 status = timed_out or failed + facts
        else reply received
            API->>S: parseSummary(reply, facts)
            S->>S: drop any sentence with a number or test point<br/>that is not in the facts (rejected_count)
            S-->>API: ≤ 6 observations, ≤ 3 suggestions
            API-->>H: 200 status = completed (failed if nothing passed),<br/>model_version, prompt_version, facts
        end
    end
    H-->>O: observations + "Suggested next steps",<br/>footer: model, every number was checked<br/>(or a clear message for the other statuses)
```
