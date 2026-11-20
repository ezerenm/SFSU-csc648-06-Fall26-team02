// R12.4 failure list for operator

import { OUTCOMES } from "./contracts";
// every localization outcome

// TYPES ----------------------------------------------------------------------

export const FAILURE_TYPES: string[] = [];
// the six different failure types

for (const outcome of OUTCOMES) {

    if (outcome !== "success" && outcome !== "in_progress") {

        FAILURE_TYPES.push(outcome);
        // every outcome that isn't a success or is still running = failures
    }
}

export const PACIFIC_TIME_ZONE = "America/Los_Angeles";
// SFSU time zone

export const STATUS_LOOKBACK_SECONDS = 60;

export type FailureFilters = { map_version_id: string; failure_type?: string; test_point_id?: string;
    device_id?: string; date?: string; limit: number; offset: number;

 };

 export type FailureRow = { attempt_id: string; failure_type: string; failure_reason: string | null;
    test_point_id: string; test_point_label: string; device_id: string; started_at: string;
    ended_at: string | null; mode: string; data_origin: string; tracking_status_before: string | null;

    // if there is no post sample from the last minute, its null

 };

 export type StatusSample = { device_id: string; tracking_status: string; captured_at: string;

 };

// TYPES end ------------------------------------------------------------------

// FAILURE TYPE ---------------------------------------------------------------

export function isFailureType(value: string): boolean {

    for (const failureType of FAILURE_TYPES) {

        if (failureType === value) {

            return true;
            // found inside the list
        }
    }

    return false;
    // return false if it is not one of the 6 failure types

}

// FAILURE TYPE end -----------------------------------------------------------

// DATE FILTER ----------------------------------------------------------------

export function pacificOffset(dateText: string): string {

    const midnightCheck = new Date(dateText + "T08:00:00Z");

    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: PACIFIC_TIME_ZONE, timeZoneName: "shortOffset"});

    const parts = formatter.formatToParts(midnightCheck);
    // splits the formatted date into pieces

    let offsetName = "";

    for (const part of parts) {

        if (part.type === "timeZoneName") {

            offsetName = part.value;

        }
    }

    if (offsetName === "GMT-7") {

        return "-07:00";
        // daylight time

    }

    return "-08:00";
    // standard time

}

function nextDay(year: number, month: number, day: number): string {
    // the date after this one as year month date format

    const tomorrow = new Date(Date.UTC(year, month -1, day + 1));

    return tomorrow.toISOString().slice(0, 10);
    // keeping only the date format

}

export function dayRange(dateText: string): { startIso: string; endIso: string } | null {
    // turns 2026-10-10 into the start and end of that day in PST
    // null when the text isnt in date format

    const parts = dateText.split("-");
    // turning 2026-10-10 into ["2026", "10",10 ]

    if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {

        return null;
        // if its wrong format

    }
    
    const year = Number(parts[0]);

    const month = Number(parts[1]);

    const day = Number(parts[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {

        return null;
        // not numbers

    }

    const checkDay = new Date(Date.UTC(year, month - 1, day));
    // if the day doesn't exist, roll over

    if (checkDay.getUTCFullYear() !== year || checkDay.getUTCMonth() + 1 !== month || checkDay.getUTCDate() !== day) {

        return null;
        // rolled over since the day doe not exist

    }

    const start = new Date(dateText + "T00:00:00" + pacificOffset(dateText));
    // midniight in California

    const tomorrowText = nextDay(year, month, day);

    const end = new Date(tomorrowText + "T00:00:00" + pacificOffset(tomorrowText));
    // midnight the next day, with its offset

    return { startIso: start.toISOString(), endIso: end.toISOString() };

}



// DATE FILTER end ------------------------------------------------------------

// TRACKING STATUS BEFORE ------------------------------------------------------

export function trackingStatusBefore(samples: StatusSample[], deviceId: string, failureStartedAt: string): string | null {
    // the newest status from the same phone in the minute before the failure

    const failureTime = new Date(failureStartedAt).getTime();
    // when the failed attempt started

    const earliestTime = failureTime - STATUS_LOOKBACK_SECONDS * 1000;
    // one minute before

    let newestSample: StatusSample | null = null;

    let newestTime = 0;
    // the best match so far

    for (const sample of samples) {

        if (sample.device_id !== deviceId) {

            continue;
            // different phone

        }

        const sampleTime = new Date(sample.captured_at).getTime();

        if (sampleTime > failureTime || sampleTime < earliestTime) {

            continue;
            // after the failure or long before it

        }

        if (newestSample === null || sampleTime > newestTime) {

            newestSample = sample;

            newestTime = sampleTime;
            // the newest wins

        }
    }

    if (newestSample === null) {

        return null;
        // no status in the last minute

    }

    return newestSample.tracking_status;

}

// TRACKING STATUS BEFORE end --------------------------------------------------




