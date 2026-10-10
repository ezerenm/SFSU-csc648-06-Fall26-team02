// THIS IS TEMPORARY DATA FOR TESTING
// FIELD NAMES MATCH DATA DEFINTIIONS SO SWAPPING API LATER IS EASY

export type Position = { x_m: number; y_m: number; z_m: number};
// point in 3d space, recorded in meters (Y is facing up)

export type GraphNode = {

    // a walkable spot

    node_id: string;

    label: string;
    
    position: Position;
    // where the node is in 3d space

};

export type PathSegment = {
    // a walkable connecgtion between two different nodes

    segment_id: string;

    label: string;

    start_node_id: string;
    // the node_id of the node where this segment starts
    
    end_node_id: string;
    // the node_id of the node where this segment ends

    direction: 'bidirectional' | 'start_to_end';
    // can walk both ways

    distance_m: number;
    // length in meters

    geometry: Position[];
    // point to connect line through

    availability: 'open' | 'closed';
    // is the hallway open or closed

    robot_access: 'allowed' | 'restricted';

};

export type Destination = {
    // a place to go

    destination_id: string;

    node_id: string;

    name: string;
    // label on the map

};

const positions: Record<string, Position> = {
    // where each node is on the temporary map

    N1: { x_m: 0, y_m: 0, z_m: 6 },
    // the enterance

     N2: { x_m: 0, y_m: 0, z_m: -2 },
    // the corner of the hallway
    
     N3: { x_m: 6, y_m: 0, z_m: -2 },
    // the Room 103

     N4: { x_m: 0, y_m: 0, z_m: -7 },
    // the side hallway

     N5: { x_m: 4, y_m: 0, z_m: -7 },
    // the lobby
};

export const temporaryGraphNodes: GraphNode[] = [
    { node_id: 'N1', label: 'Enterance', position: positions.N1 },
    { node_id: 'N2', label: 'Corner of Hallway', position: positions.N2 },
    { node_id: 'N3', label: 'Room 103', position: positions.N3 },
    { node_id: 'N4', label: 'Side Hallway', position: positions.N4 },
    { node_id: 'N5', label: 'Lobby', position: positions.N5 },
];

function makeSegment(segmentId: string, startID: string, endId: string, distanceM: number, robotAccess: 'allowed' | 'restricted'): PathSegment {
    // helper function to make a segment with the right geometry and direction
    
    return {
        // building the segment object

        segment_id: segmentId,

        label: `${startID} to ${endId}`,

        start_node_id: startID,
        end_node_id: endId,

        direction: 'bidirectional',

        distance_m: distanceM,

        geometry: [positions[startID], positions[endId]],

        availability: 'open',

        robot_access: robotAccess,
    };
}

export const temporaryGraphSegments: PathSegment[] = [
    makeSegment('S1', 'N1', 'N2', 8, 'allowed'),
    makeSegment('S2', 'N2', 'N3', 6, 'restricted'),
    makeSegment('S3', 'N2', 'N4', 5, 'allowed'),
    makeSegment('S4', 'N4', 'N3', 7, 'allowed'),
    makeSegment('S5', 'N4', 'N5', 4, 'allowed'),
    makeSegment('S6', 'N5', 'N3', 5, 'allowed'),

];

export const temporaryGraphDestinations: Destination[] = [
    { destination_id: 'D1', node_id: 'N3', name: 'Room 103' },
    { destination_id: 'D2', node_id: 'N5', name: 'Lobby' },
    { destination_id: 'D3', node_id: 'N1', name: 'Entrance' }
];