// turning the phones latest message into a status 

// The Data -------------------------------------------------------------------

export type TrackingColor = "green" | "gray" | "red" | "yellow";

export type LatestPhoneMessage = { tracking_status: string; received_at: string; };

// The Data end ---------------------------------------------------------------

// time setting

export const SECONDS_BEFORE_GRAY_STATUS = 5;
// if there is no message for 5 seconds, the app is either closed by the user or interrupted or offline

// Getting the colors ---------------------------------------------------------

/** R4.1 Returns the status chip color (either red, green, yellow, or gray) for the newest phone message. */
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

// Getting the labels ---------------------------------------------------------

/** R4.1 returns the word shown on the status chip for a color. */
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

/** R6.4 returns true only when the chip is green, so a live start uses an accurate position. */
export function canStartFromLivePosition(trackingColor: TrackingColor): boolean {

    return trackingColor === "green";

    // we can only start a route if the chip is green 

}

// R3.4 Timed out -------------------------------------------------------------

export const SECONDS_BEFORE_TIMED_OUT = 30;
// if the iphone has been localizing for 30 seconds, time out

export type ChipLook = { trackingColor: TrackingColor; label: string };
// what the chip should look like
// the color and words

/** R3.4 and R4.1 returns the chip's color and label. This includes red Time Out after 30 seconds of localizing.  */
export function getChipLook(latestMessage: LatestPhoneMessage | null, localizingSince: string | null, currentMs: number): ChipLook {

    const trackingColor = getTrackingColor(latestMessage, currentMs);
    // either green, yellow, red, or gray

    if (trackingColor === "yellow" && localizingSince !== null) {
        // the phone is still finding its position

        const localizingSinceMs = new Date(localizingSince).getTime();
        // when it started localizing

        const secondsLocalizing = (currentMs - localizingSinceMs) / 1000;
        // how long its been localizing

        if (!Number.isNaN(secondsLocalizing) && secondsLocalizing >= SECONDS_BEFORE_TIMED_OUT) {
            // 30 seconds or more

            return { trackingColor: "red", label: "Timed out, try again" };

        }
    }

    return { trackingColor: trackingColor, label: getTrackingLabel(trackingColor) };
    // otherwise the normal chip
}

// R3.4 Timed out end ---------------------------------------------------------


