// turning the phones latest message into a status 

// The Data -------------------------------------------------------------------

export type TrackingColor = "green" | "gray" | "red" | "yellow";

export type LatestPhoneMessage = { tracking_status: string; received_at: string; };

// The Data end ---------------------------------------------------------------

// time setting

export const SECONDS_BEFORE_GRAY_STATUS = 5;
// if there is no message for 5 seconds, the app is either closed by the user or interrupted or offline

// Getting the colors ---------------------------------------------------------

export function getTrackingColor(latestMessage: LatestPhoneMessage | null, currentMs: number): TrackingColor {

    if (latestMessage === null) {

        return "gray";

    }

    const receivedAtMs = new Date(latestMessage.received_at).getTime();

    const ageInSeconds = (currentMs - receivedAtMs) / 1000;

    if (Number.isNaN(ageInSeconds)) {
        // time could not be read

        return "gray";

    }

    if (ageInSeconds >= SECONDS_BEFORE_GRAY_STATUS) {

        return "gray";

    }

    if (latestMessage.tracking_status === "valid") {

        return "green";
        
    }   else if (latestMessage.tracking_status === "localizing") {

        return "yellow";

    }   else if (latestMessage.tracking_status === "lost") {

        return "red";

    }   else {

        return "gray";
    }
}

// Getting the colors end -----------------------------------------------------

// GEtting the labels ---------------------------------------------------------

export function getTrackingLabel(trackingColor: TrackingColor): string {

    if (trackingColor === "green") {

        return "Live";

    } else if (trackingColor === "yellow") {

        return "Finding position...";

    } else if (trackingColor === "red") {

        return "Position lost";

    } else {

        return "No data"

    }
}

// Getting the labels end -----------------------------------------------------

// route

export function canStartFromLivePosition(trackingColor: TrackingColor): boolean {

    return trackingColor === "green";

    // we can only start a route if the chip is green 

}

