// R4.1 and R19: top down 2d map with every phone;s live dot

// IMPORTS --------------------------------------------------------------------

import type { GraphNode, GraphResponse } from "@/lib/spatial/contracts";
// graph shapes from the API

import type { Xz } from "@/lib/spatial/liveRoute";
// a point on the floor
// x_m, z)m

import type { PhoneState } from "@/lib/spatial/livePhones";
// what we remember about each of the phones

import { getDeviceName, getDeviceType, type DeviceType } from "@/lib/spatial/deviceTypes";
// the visitor or robot proxy

import { getTrackingColor } from "@/lib/spatial/trackingStatus";
import { placeNamer, placesFor } from "@/lib/spatial/places";
// same names as /viewer

// IMPORTS end ----------------------------------------------------------------

// STYLING --------------------------------------------------------------------

const OPEN_PATH_COLOR = "lime";
// green like /viewer
// lime green to pop against purple SFSU background

const CLOSED_PATH_COLOR = "red";
// red like /viewer

const ROUTE_COLOR = "deepskyblue";
// blue like /viewer
// deep sky blue to pop against purple SFSU background

const NODE_COLOR = "white";
// node

const LABEL_COLOR = "#e9d5ff";
// place names = light purple
// lighter shade of purple to pop against purple SFSU background

const SFSU_GOLD = "#facc15"
// SFSU gold, same as viewers find route button

// STYLING end ----------------------------------------------------------------

// The Data -------------------------------------------------------------------

type LiveMapProps = {

    graph: GraphResponse;
    // nodes, segments, and destinations from /api/graph/

    phones: PhoneState[];
    // every phone to draw
    // from useLivePhones and listPhones

    nowMs: number;
    // current time

    routePoints?: Xz[];
    // blue route line

    destinationNode?: GraphNode | null;
    // gold ring around the destination

    attachLine?: { from: Xz; to: Xz } | null;
    // a dashed line from the phone to the point it snapped to
    // R6.2.2

    highlightedDeviceId?: string | null;
    // the phone we're navigating with made a bit larger for visuals
}

// The Data end ---------------------------------------------------------------

// Choosing the dot colors ----------------------------------------------------

function getDeviceColor(deviceType: DeviceType): string {
    // each phone gets its own dot color

    if (deviceType === "visitor") {

        return SFSU_GOLD;
        // visitor is gold

    } else if (deviceType === "robot") {

        return "orange";
        // robot proxy is orange
        // same as /viewer

    } else {

        return "white";
        // white for unknown phones
    }
} 

// Choosing the dot colors end ------------------------------------------------


// The Map --------------------------------------------------------------------

export default function LiveMap({ graph, phones, nowMs, routePoints, destinationNode, attachLine, highlightedDeviceId }: LiveMapProps ) {

    const nodes = graph.nodes;
    // every node on the map

    const segments = graph.segments;
    // every path between the nodes

    if (nodes.length === 0) {

        return <p className="text-sm text-purple-200">This map does not have any nodes yet.</p>

    }

    // Map Size -----------------------

    let minX = nodes[0].position.x_m;

    let maxX = nodes[0].position.x_m;

    let minZ = nodes[0].position.z_m;

    let maxZ = nodes[0].position.z_m;
    // edges at the first node

    for (const node of nodes) {
        // stretch the edges to fit each node

        if (node.position.x_m < minX) { minX = node.position.x_m; }

        if (node.position.x_m > maxX) { maxX = node.position.x_m; }

        if (node.position.z_m < minZ) { minZ = node.position.z_m; }

        if (node.position.z_m > maxZ) { maxZ = node.position.z_m; }

    }

    minX = minX - 3;

    maxX = maxX + 7;

    minZ = minZ - 3;

    maxZ = maxZ + 3;
    // 3 meters of room around the edges
    // 7 meters on the righ to fit hte labels

    const mapWidth = maxX - minX;

    const mapHeight = maxZ - minZ;
    // the map size in meters

    const toScreenX = (x: number) => x - minX;
    // world x to map x

    const toScreenY = (z: number) => maxZ - z;

    // Map Size end -------------------

    const nodeName = placeNamer(placesFor(nodes, graph.destinations));
    // translates a node_id into its place name

    return (

        <svg
            viewBox={"0 0 " + mapWidth + " " + mapHeight} className="w-full rounded-lg border border-white/20 bg-purple-900/80"
            style={{ aspectRatio: mapWidth + " / " + mapHeight }} overflow = "visible" role="img" aria-label="Top down map including live phone positions"
        >
        {/* one unit in viewBox is equal to one meter */}
        {/* purple box like /viewer */}

            {segments.map((segment) => (
                // all path segments

                <polyline
                    key={segment.segment_id}
                    points={segment.geometry.map((point) => toScreenX(point.x_m) + "," +
                    toScreenY(point.z_m)).join(" ")}
                    fill="none" stroke={segment.availability === "open" ? OPEN_PATH_COLOR : CLOSED_PATH_COLOR}
                    strokeWidth={0.12} strokeDasharray={segment.availability === "open" ? undefined : "0.3 0.2"}
                />
                // green line if its open
                // red line if it sclosed

            ))}

            {routePoints && routePoints.length > 1 && (

                <polyline
                    points={routePoints.map((point) => toScreenX(point.x_m) + "," + toScreenY(point.z_m)).join(" ")}
                    fill="none" stroke={ROUTE_COLOR} strokeWidth={0.25} strokeLinecap="round" strokeLinejoin="round"
                />
                // blue route line
                
            )}

            {nodes.map((node) => (
                // every node

                <g key={node.node_id}>

                    <circle cx={toScreenX(node.position.x_m)} cy={toScreenY(node.position.z_m)} r={0.2} fill={NODE_COLOR} />
                    {/* small white dot */}

                    <text x={toScreenX(node.position.x_m) + 0.3} y={toScreenY(node.position.z_m) - 0.3} fontSize={0.4} fill={LABEL_COLOR}>
                        {nodeName(node.node_id)}
                    </text>
                    {/* placing name next to node */}

                </g>

            ))}

            {destinationNode && (
                // only if a destination is chosen

                <circle cx={toScreenX(destinationNode.position.x_m)} cy={toScreenY(destinationNode.position.z_m)} r={0.45}
                    fill="none" stroke={SFSU_GOLD} strokeWidth={0.12} />
                    // SFSU gold ring
                
            )}

            {attachLine && (
                // only if the phone snapped onto a path

                <line

                    x1={toScreenX(attachLine.from.x_m)} y1={(toScreenY(attachLine.from.z_m))}
                    x2={toScreenX(attachLine.to.x_m)} y2={toScreenY(attachLine.to.z_m)}
                    stroke={SFSU_GOLD} strokeWidth={0.06} strokeDasharray="0.15 0.15"

                />

            )}

            {phones.map((phone) => {
                // all phones

                if (phone.latestPosition === null || phone.latestPosition.world_position === null) {
                    // we've never had a position for this phone

                    return null;
                    

                }

                const position = phone.latestPosition.world_position;
                // location to draw the dot

                const heading = phone.latestPosition.heading_deg;
                // which way it is facing

                const trackingColor = getTrackingColor(phone.latestMessage, nowMs);
                // this phone's status chip color

                const deviceType = getDeviceType(phone.deviceId);
                // either visitor, robot proxy, or unknown

                const dotColor = getDeviceColor(deviceType);
                // either gold, orange, or white

                let dotRadius = 0.25;
                // normal dot size

                if (phone.deviceId === highlightedDeviceId) {

                    dotRadius = 0.32;
                    // since we navigate whit this phone, make it a bit bigger than the others

                }

                return (

                    <g
                        key={phone.deviceId}
                        opacity={trackingColor === "green" ? 1 : 0.4}
                        style={{
                            transform: "translate(" + toScreenX(position.x_m) + "px, " + toScreenY(position.z_m) + "px)",
                            transition: "transform 0.9s linear",
                
                        }}
                    >
                    {/* moving the whole group with CSS transform for smoothe glide to new spot instead ot jumping */}
                    {/* fade a bit (o.4) when status chip isn't green */}
                        
                        {heading !== null && (
                            // only if we know the heading

                            <line

                                x1={0} y1={0}
                                x2={0.9 * Math.sin((heading * Math.PI) / 180)}
                                y2={-0.9 * Math.cos((heading * Math.PI) / 180)}
                                stroke ={dotColor} strokeWidth={0.1}

                            />
                            // short line pointing where the phone is facing

                        )}

                        <circle cx={0} cy={0} r={dotRadius} fill={dotColor} stroke="#3b0764" strokeWidth={0.06} />
                        {/* the dot at 0,0 */}

                        <text x={0} y={dotRadius + 0.45} fontSize={0.35} fill={dotColor} textAnchor="middle">
                            {getDeviceName(deviceType)}
                        </text>
                        {/* Visitor or Robot (proxy phone) under the dot */}

                    </g>
                );
            })}

        </svg>

    );

}


         


// The Map end ----------------------------------------------------------------


