// R4.1 colored status chips
// either green, yellow, red, or gray.

// IMPORTS --------------------------------------------------------------------

import { getTrackingLabel, type TrackingColor } from "@/lib/spatial/trackingStatus";
// color types and words for each of the colors

// IMPORTS end ----------------------------------------------------------------

// The Data -------------------------------------------------------------------


type TrackingChipProps = {
    // what the chip needs from the page

    trackingColor: TrackingColor;
    // which color to display

    extraText?: string;

};

// The Data end ---------------------------------------------------------------

// Picking the chip colors ----------------------------------------------------

function getChipClasses(trackingColor: TrackingColor): string {
    // tailwind

    if (trackingColor === "green") {

        return "border-green-300 bg-green-50 text-green-800";

    } else if (trackingColor === "yellow") {

        return "border-yellow-300 bg-yellow-50 text-yellow-800";

    } else if  (trackingColor === "red") {

        return "border-red-300 bg-red-50 text-red-800";

    } else {

        return "border-gray-300 bg-gray-100 text-gray-700";

    }
}

function getDotClasses(trackingColor: TrackingColor): string {
    // tailwind class for circle inside the chip

    if (trackingColor === "green") {

        return "bg-green-500";

    } else if (trackingColor === "yellow") {

        return "bg-yellow-400";

    } else if (trackingColor === "red") {

        return "bg-red-500";

    } else {

        return "bg-gray-400";
    }
}

// Picking the chip colors end ------------------------------------------------

// The Chip -------------------------------------------------------------------

export default function TrackingChip({ trackingColor, extraText }: TrackingChipProps) {
    // making the chip

    return (

        <span
            className={"inline-flex items-center gap-2 rounded-full borderpx-3 py-1 text-sm font-medium " + getChipClasses(trackingColor)}
            role="status"
            aria-lives="polite"
            >
        
            <span className={"h-2.5 w-2.5 rounded-full " + getDotClasses(trackingColor)} aria-hodden="true" />
            {/* small colored circle */}

            {getTrackingLabel(trackingColor)}
            {/* Either Accurate, Finding Position..., Position lost, or There is no data */}

            {extraText && <span className="font-normal opacity-80">· {extraText}</span>}

            </span>
    );
}

// The Chip end ---------------------------------------------------------------



