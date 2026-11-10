// R12.3

// IMPORTS --------------------------------------------------------------------

import type { PhoneState } from "./livePhones";
// a phone and its most recent message

import type { TrackingColor } from "./trackingStatus";
// either green, yellow, red, or gray from the status chip

// IMPORTS end ----------------------------------------------------------------

// TYPES ----------------------------------------------------------------------

export type CaptureCounts = {

    samples: number;
    // the pose and status messages received

    attempts: number;
    // the localization attempts

    failures: number;
    // the failed localization attempts

};

export type CaptureStatus = {

    isCapturing: boolean;
    // if true = show the ring on the robot dot

    label: string;
    // the words on the badge

};

export const EMPTY_COUNTS: CaptureCounts = { samples: 0, attempts: 0, failures: 0 };

// TYPES end-------------------------------------------------------------------

// CAPTURE STATUS -------------------------------------------------------------

export function getCaptureStatus(runIsActive: boolean, robotPhone: PhoneState | null, robotTrackingColor: TrackingColor): CaptureStatus {

    if (!runIsActive) {

        return { isCapturing: false, label: "Run isn't active" };
        // Start run hasn't been pressed yet

    }

    if (robotPhone === null) {

        return { isCapturing: false, label: "Waiting for the robot phone" };
        // run has started, but the robot phone hasn't sent anything yet

    }

    if (robotTrackingColor === "gray") {

        return { isCapturing: false, label: "Not receiving data" };
        // no new messages for 5 seconds, so we're not capturing

    }

    return { isCapturing: true, label: "Capturing data" };
    // the green, yellow, and red all count
    // a lost or localizing message is good data to capture for future analysis

}

// CAPTURE STATUS end ---------------------------------------------------------

// COUNTING SAMPLES -----------------------------------------------------------

export function addSampleIfNew(counts: CaptureCounts, newSampleId: string | null, lastSampleId: string | null): CaptureCounts {

    if (newSampleId === null) {

        return counts;
        // no messages yet

    }

    if (newSampleId === lastSampleId) {

        return counts;
        // the same message as last time, so don't count twice

    }

    return { 

        samples: counts.samples + 1,
        attempts: counts.attempts,
        failures: counts.failures };

    // another sample
}

// COUNTING SAMPLES end -------------------------------------------------------




