"use client";

// IMPORTS --------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
// react memory and sice tasks

import type { RouteRequest, RouteResponse } from "@/lib/spatial/contracts";
// the api data shapes

import { ARRIVED_M, distance, pickStartNode, routePolyline, type Xz } from "@/lib/spatial/liveRoute";
// arrival distance, the meters between points, and turning a route into a line

import { formatMeters, placeNamer, placesFor } from "@/lib/spatial/places";
// place names and formatting

import { canStartFromLivePosition, getChipLook, getTrackingColor } from "@/lib/spatial/trackingStatus";
// R4.1 status chip color and R6.4 live start rule

import { checkLiveStart, findNearestSegment, type SegmentAttachment } from "@/lib/spatial/segmentAttach";
// R6.2.2 snap to the nearest path and R6.3 checking if its too far

import { listPhones, pickNavigationPhone } from "@/lib/spatial/livePhones";
// every phone and which one /live navigate with

import { getDeviceName, getDeviceType } from "@/lib/spatial/deviceTypes";
// R19 either visitor or robot proxy

import { useLivePhones } from "@/components/live/useLivePhones";
// Realtime and smoothing out lag

import LiveMap from "@/components/live/LiveMap";
// the 2d map

import TrackingChip from "@/components/live/TrackingChip";
// the status chip
import { useGraph } from "@/components/live/useGraph";
// R9 graph that refreshes every 3 s so closures reroute
import { pathStateKey } from "@/lib/spatial/pathState";
// R9 fingerprint of open/closed and robot access

import RoutePlanner from "@/components/viewer/RoutePlanner";
// the existing 3d viewer with its route, used for the 3d tab

// IMPORTS end ----------------------------------------------------------------

// SETTINGS -------------------------------------------------------------------

const MAP_VERSION_ID = "b2000000-0000-4000-8000-000000000001";
// HSS 349 map version
// hardcoded

const AUTO = "auto";
// My Current Location option on the start list

const selectClasses = "rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white";
// the style for the two dropdowns
// same white as /viewer

type RouteState = { key: string; route: RouteResponse | null; error: string | null };
// the last routw and which destination it was for

type ViewMode = "2d" | "3d";
// which tab is on

// SETTINGS end ---------------------------------------------------------------

export default function LivePage() {
  // the /live page

  // Memory ---------------------------

  const { graph, graphError, lastChange } = useGraph(MAP_VERSION_ID);
  // R9 the map from /api/graph, refreshed every 3 s
  // null while loading


  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  // 2d live map or 3d viewer

  const [destinationId, setDestinationId] = useState("");
  // the destination the user picked

  const [startChoice, setStartChoice] = useState(AUTO);
  // "auto" is the live position
  // its a node_id otherwise

  const [autoStartId, setAutoStartId] = useState<string | null>(null);
  // the node we start from when we use live position

  const [routeState, setRouteState] = useState<RouteState | null>(null);
  // the last route we received

  const { phones, nowMs, liveError } = useLivePhones(MAP_VERSION_ID);
  // each phones newest message
  // the clock

  // Memory end -----------------------

  // Loading the graph: moved to useGraph (R9)



  // The phone we navigate with -------

  const nodes = useMemo(() => graph?.nodes ?? [], [graph]);
  const segments = useMemo(() => graph?.segments ?? [], [graph]);
  const destinations = useMemo(() => (graph?.destinations ?? []).filter((destination) => destination.is_active), [graph]);
  // pieces of the graph

  const places = useMemo(() => placesFor(nodes, destinations), [nodes, destinations]);
  // one place per node
  // same names in /viewer

  const destinationPlaces = places.filter((place) => place.destination_id !== null);
  // only the places you can navigate to

  const nodeName = placeNamer(places);
  // node_id to place name

  const navigationPhone = pickNavigationPhone(phones);
  // the visitor phone
  // or the newest phone if we dont know the visitor 

  const trackingColor = getTrackingColor(navigationPhone === null ? null : navigationPhone.latestMessage, nowMs);
  // R4.1 green, yellow, red, or gray

  const chipLook = getChipLook(navigationPhone === null ? null : navigationPhone.latestMessage, navigationPhone === null ? null : navigationPhone.localizingSince, nowMs);
  // chips color and words

  let livePosition: Xz | null = null;
  // where the phone is on the floor

  if (navigationPhone !== null && navigationPhone.latestPosition !== null && navigationPhone.latestPosition.world_position !== null) {
    // we have a position for this phone

    livePosition = { x_m: navigationPhone.latestPosition.world_position.x_m, z_m: navigationPhone.latestPosition.world_position.z_m };
    // keeping only x and z

  }

  let ageInSeconds: number | null = null;
  // how old the newest message is

  if (navigationPhone !== null) {

    ageInSeconds = (nowMs - new Date(navigationPhone.latestMessage.received_at).getTime()) / 1000;
    // subtract when it was sent in seconds

  }

  // The phone we navigate with end ---

  // Live start -----------------------
  // R6.4, R6.2.2, and R6.3

  let attachment: SegmentAttachment | null = null;
  // where the phone snaps onto the nearest path
  // R6.2.2

  let liveStartProblem: string | null = null;
  
  if (startChoice === AUTO && canStartFromLivePosition(trackingColor) && livePosition !== null && segments.length > 0) {
    // R6.4: we only pick and repick the live start when the status chip is green

    attachment = findNearestSegment(segments, livePosition);
    // R6.2.2 snap onto the nearest open path

    liveStartProblem = checkLiveStart(attachment);
    // R6.3 too far from any path

    let wantedStartId: string | null = null;
    // the start node we want

    if (liveStartProblem === null && attachment !== null) {

      const segment = attachment.segment;
      // the path snapped onto

      const segmentEnds = nodes.filter((node) => node.node_id === segment.start_node_id || node.node_id === segment.end_node_id);
      // the two nodes at the end of this path

      const startNode = pickStartNode(segmentEnds, attachment.attachPoint, autoStartId);

      wantedStartId = startNode === null ? null : startNode.node_id;

    }

    if (wantedStartId !== autoStartId) {
      // the start changed

      setAutoStartId(wantedStartId);
      // saving it 

    }

  }
  // when the chip isn't green we keep the old start
  // the route wouldnt disappear if tracking is yellow

  if (startChoice === AUTO && autoStartId === null && liveStartProblem === null) {
    // using the live position but we don't have a start yet

    if (!canStartFromLivePosition(trackingColor)) {
      // R6.4 status chip isnt green

      liveStartProblem = "A live start needs an accurate position (green). The phone currently says: " + chipLook.label;

    } else if (livePosition === null) {

      liveStartProblem = "Waiting for the phone's position.";

    }
  }

  // Live start end -------------------

  // Getting the route ----------------

  let startId: string | null = null;
  // the node the route starts from

  if (startChoice === AUTO) {

    startId = autoStartId;
    // live position
     
  } else {

    startId = startChoice;
    // the node picked by the user

  }

  const routeKey = startId && destinationId ? startId + "|" + destinationId : null;
  // a key for the start to this destination

  const pathKey = graph ? pathStateKey(graph) : "";
  // R9 changes when a segment closes, reopens or gets robot restricted

  const requestKey = routeKey ? routeKey + "#" + pathKey : null;
  // R9 ask again when the start, destination or path state changes

  useEffect(() => {
    // asks /api/route everytime the start or the destination changes

    if (!requestKey) {

      return;

    }
    // nothing to ask for

    const key = requestKey.split("#")[0];
    // the start|destination part, so the old route stays on screen until the new one arrives

    const [startNodeId, routeDestinationId] = key.split("|");
    // split the key back into its two ids

    const controller = new AbortController();
    // lets us cancel if the start changes again

    const request: RouteRequest = {map_version_id: MAP_VERSION_ID, start_node_id: startNodeId, destination_id: routeDestinationId, profile: "human" };
    // what we send to the server

    fetch("/api/route", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request), signal: controller.signal,
    
    })

      .then(async (response) => {

        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error?.message ?? "Route request failed (" + response.status + ")");
    
        }
        setRouteState({ key, route: body as RouteResponse, error: null });
        // saving the route

      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setRouteState({ key, route: null, error: error.message });
        
        }
        // saving the error
      });

      return () => controller.abort();

  }, [requestKey]);

  const routeResult = routeState && routeState.key === routeKey ? routeState : null;
  // only use the answer if it is for the start or destination we have right now

  const route = routeResult?.route ?? null;
  // the route itself

  const routePoints = useMemo(() => (route ? routePolyline(segments, route.steps) : []), [route, segments]);
  // the route as a list of points

  const destination = destinations.find((item) => item.destination_id === destinationId) ?? null;
  // the destination object

  const destinationNode = destination ? nodes.find((node) => node.node_id === destination.node_id) ?? null : null;
  // the node the destination is on

  const arrived = trackingColor === "green" && livePosition !== null && destinationNode !== null && 
    distance(destinationNode.position, livePosition) <= ARRIVED_M;
    // arrive = accurate position within one meter of the destination

  const rerouteNotice = lastChange && lastChange.messages.length > 0 && nowMs - lastChange.at < 20000 ? lastChange.messages.join(", ") : null;
  // R9 banner for 20 s after a path changes, long enough to point at in a demo

  const segmentLength = (segmentId: string) => segments.find((segment) => segment.segment_id === segmentId)?.distance_m ?? 0;
  // length of just one step

  // Getting the route end ------------

  // Status chip text -----------------

  let chipText = "";
  // words after the status chip label

  if (liveError) {

    chipText = "Could not read live data: " + liveError;

  } else if (ageInSeconds !== null) {

    if (ageInSeconds < 60) {
      // if age is under a minute, show seconds

      chipText = "updated " + ageInSeconds.toFixed(1) + " seconds ago";

    } else if (ageInSeconds < 3600 ) {
      // if age is under an hour, show minutes

      chipText = "last seen " + Math.round(ageInSeconds / 60) + " minutes ago";

    } else if (ageInSeconds < 86400) {
      // if age is under a day, show hours

      chipText = "last seen " + Math.round(ageInSeconds / 3600) + " hours ago";

    } else {
      // if age is a day or more, show days

      chipText = "last seen " + Math.round(ageInSeconds / 86400 ) + " days ago";
    }

    if (navigationPhone !== null && navigationPhone.latestMessage.data_origin === "synthetic") {

      chipText = chipText + " . test data";
      // making sure test data isnt mixed up with real localization

    }
  }

  // Status chip text end -------------

  return (

    <div className="min-h-screen w-full bg-purple-950 text-white">
    {/* SFSU purple for the background */}

    <main className={"mx-auto w-full p-4 " + (viewMode === "3d" ? "max-w-6xl" : "max-w-3xl")}>
    {/* wide page so the 3d viewer has some room */}

        <h1 className="text-xl font-semibold">Live Navigation</h1>
        <p className="text-xs text-purple-200">
            {graph ? graph.site.name + " . " + graph.map_version.version_label : graphError ? "Couldn't load the map: " + graphError : "Loading map..."}

            </p>
            {/* the side and map version */}

            <div className="my-3 flex flex-wrap items-center justify-between gap-3">

                <TrackingChip trackingColor={chipLook.trackingColor} label={chipLook.label} extraText={chipText} />
                {/* R4.1 status chip */}

                <div className="inline-flex rounded-md border border-white/20 text-sm" role="group" aria-label="Map view">
                {/* 2d and 3d toggle */}

                    <button type="button" aria-pressed={viewMode === "2d"} onClick={() => setViewMode("2d")}
                        className={"rounded-l-md px-3 py-1.5 " + (viewMode === "2d" ? "bg-yellow-400 font-semibold text-gray-900" : "bg-white/10 text-white hover:bg-white/20")}>
                          2D live
                        </button>

                        <button type="button" aria-pressed={viewMode === "3d"} onClick={() => setViewMode("3d")}
                            className={"rounded-r-md px-3 py-1.5 " + (viewMode === "3d" ? "bg-yellow-400 font-semibold text-gray-900" : "bg-white/10 text-white hover:bg-white/20")}>
                              3D
                            </button>
                          </div>
                      </div>

                      {viewMode === "3d" && (
                      // 3d tab

                          <div className="h-[75vh] w-full overflow-hidden rounded">
                              <RoutePlanner />
                          </div>
                        
                      )}

                      {viewMode === "2d" && (
                        // 2d tab

                            <>

                              <div className="mb-3 flex flex-wrap gap-3">

                                  <label className="flex flex-col gap-1 text-sm">
                                      <span className="font-medium">Start</span>
                                      <select className={selectClasses} value={startChoice} onChange={(event) => setStartChoice(event.target.value)}>
                                          <option value={AUTO} className="text-gray-900"> My current location (live)</option>
                                          {places.map((place) => <option key={place.node_id} value={place.node_id} className="text-gray-900">{place.name}</option>)}
                                          
                                      </select>
                                  </label>
                                  {/*  dropdown */}

                                  <label className="flex flex-col gap-1 text-sm">
                                      <span className="font-medium">Destination</span>
                                      <select className={selectClasses} value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
                                          <option value="" className="text-gray-900">Select a destination</option>
                                          {destinationPlaces.map((place) => <option key={place.node_id} value={place.destination_id ?? ""} className="text-gray-900">{place.name}</option>)}
                                      </select>
                                    </label>
                                    {/*  destination dropdown */}

                              </div>

                              {graph && (
                                <LiveMap
                                  graph={graph}
                                  phones={listPhones(phones)}
                                  nowMs={nowMs}
                                  routePoints={routePoints}
                                  destinationNode={destinationNode}
                                  attachLine={attachment !== null && livePosition !== null ? { from: livePosition, to: attachment.attachPoint } : null}
                                  highlightedDeviceId={navigationPhone === null ? null : navigationPhone.deviceId}

                                />
                      
                              )}
                              {/* the shared 2d map */}

                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-purple-100">
                                {/* legend */}

                                <span><span className="mr-1.5 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: "lime" }} />Open path</span>

                                <span><span className="mr-1.5 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: "red" }} />Closed path</span>

                                <span><span className="mr-1.5 inline-block h-2 w-4 rounded align-middle" style={{ backgroundColor: "deepskyblue" }} />Route</span>

                                <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: "#facc15" }} />Visitor</span>

                                <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: "orange" }} />Robot (proxy phone)</span>

                                
                              </div>

                              <section className="mt-3 text-sm" aria-live="polite">
                                {/* route messages */}

                                  {startChoice === AUTO && liveStartProblem && <p className="font-medium text-yellow-300">{liveStartProblem}</p>}
                                  {/* R6.3 and R6.4 message */}

                                  {rerouteNotice && <p role="status" className="font-medium text-orange-300">Path changed: {rerouteNotice}.{destination ? " Route recalculated." : ""}</p>}
                                  {/* R9 reroute alert */}

                                  {!destination && <p className="text-purple-200">Select a destination to see the shortest route.</p>}
                                  {destination && startId && !routeResult && <p className="text-purple-200">Finding route...</p>}
                                  {routeResult?.error && <p role="alert" className="font-medium text-red-300">Could not calculate a route: {routeResult.error}</p>}

                                  {arrived && destination && <p className="font-semibold text-lime-300">You have arrived at {destination.name}.</p>}
                                  {route?.status === "unreachable" && destination && <p className="font-medium text-red-300">Unreachable: no permitted route from {nodeName(route.start_node_id)} to {destination.name}.</p>}

                                  {route?.status === "valid" && !arrived && destination && (
                                      route.steps.length === 0 ? <p className="font-medium text-yellow-300">The start and destination are the same ({destination.name}). No route needed.</p>

                                      : (

                                          <>
                                              <p className="text-3xl font-semibold text-yellow-300">{formatMeters(route.total_distance_m)}</p>
                                              {/* the distance in gold, like /viewer */}
                                              <p className="mt-1 font-medium">{nodeName(route.start_node_id)} → {destination.name}</p>
                                              <ol className="mt-1 list-decimal pl-5 text-purple-100">
                                                {route.steps.map((step) => (

                                                    <li key={step.segment_id}>
                                                        {nodeName(step.from_node_id)} → {nodeName(step.to_node_id)} ({formatMeters(segmentLength(step.segment_id))})

                                                    </li>
                                                ))}
                                              </ol>
                                          </>
                                      )
                                  )}
                              </section>

                              <section className="mt-4 text-sm">
                                {/* R19, every phone on this map with its status chip */}

                                  <h2 className="mb-1 font-medium">Phones on this map</h2>

                                  {listPhones(phones).length === 0 && <p className="text-purple-200">No phone has sent anything yet.</p>}

                                  <ul className="flex flex-col gap-1">
                                      {listPhones(phones).map((phone) => (
                                          <li key={phone.deviceId} className="flex flex-wrap items-center gap-2">
                                              <span className="w-40 font-medium">{getDeviceName(getDeviceType(phone.deviceId))}</span>
                                              <TrackingChip trackingColor={getChipLook(phone.latestMessage, phone.localizingSince, nowMs).trackingColor} label={getChipLook(phone.latestMessage, phone.localizingSince, nowMs).label} />
                                              <span className="text-xs text-purple-300">{phone.deviceId}</span>

                                          </li>
                                      ))}
                                  </ul>

                              </section>
                          </>
                    )}

                </main>
                </div>
      
  );
}




