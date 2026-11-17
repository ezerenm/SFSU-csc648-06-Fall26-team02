// R8.3 and R17.1

// COLORS ---------------------------------------------------------------------

import type { PathSegment } from "./contracts";
// the segment shape from /api/graph

export const OPEN_SEGMENT_COLOR = "lime";
// open for everybody

export const CLOSED_SEGMENT_COLOR = "red";
// closed by the operator (R8.1)

export const HUMANS_ONLY_SEGMENT_COLOR = "#f472b6";
// open for people but restricted for the simulated robot

// COLORS END -----------------------------------------------------------------

// CHOOSING COLORS ------------------------------------------------------------

export function segmentColor(segment: Pick<PathSegment, "availability" | "robot_access">): string {

    if (segment.availability !== "open") {

        return CLOSED_SEGMENT_COLOR;
        // closed wins, even if its also restricted for robots

    }

    if (segment.robot_access === "restricted") {

        return HUMANS_ONLY_SEGMENT_COLOR;
        // open, but to only humans

    }

    return OPEN_SEGMENT_COLOR;
    // open for people and the simulated robot
    
}

// CHOOSING COLORS END --------------------------------------------------------