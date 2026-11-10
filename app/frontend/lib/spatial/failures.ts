// R12.4 failure list for operator

// TYPES ----------------------------------------------------------------------

export const FAILURE_TYPES = ["timeout", "tracking_loss", "network_error", "map_mismatch", "cancelled", "other_failure"];
// the six different failure types

export const PACIFIC_OFFSET = "-08:00";
// PST for date filter
// -08:00 because daylight savings just ended

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

export function dayRange(dateText: string): { startIso: string; endIso: string } | null {
    // null when the data isn't year, month, day
    // converts 2020-10-10 into the start and end of that day in PST

    const parts = dateText.split("-");
    // 2020=10-10 turns into ["2020","10","10"]

    if (parts.length !== 3 || parts[0].length !== 4 || parts[1].length !== 2 || parts[2].length !== 2) {

        return null;
        // null if in wrong format like 10/10/2020

    }

    const year = Number(parts[0]);

    const month = Number(parts[1]);

    const day = Number(parts[2]);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {

        return null;
        // not numbers

    }

    const start = new Date(dateText + "T00:00:00" + PACIFIC_OFFSET);
    // midnight in PST

    if (Number.isNaN(start.getTime())) {

        return null;
        // Javascript can't read the date

    }

    const checkDay = new Date(start.getTime() - 8 * 60 * 60 * 1000);
    // turn back 8 hours so UTC date matches PST date

    if (checkDay.getUTCFullYear() !== year || checkDay.getUTCMonth() + 1 !== month || checkDay.getUTCDate() !== day) {

        return null;
        // Javascript bleeds November 21st into December 1st
        // catch days that do not exist

    }

    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    // midnight the next day

    return { startIso: start.toISOString(), endIso: end.toISOString() };

}

// DATE FILTER end ------------------------------------------------------------

// TRACKING STATS BEFORE ------------------------------------------------------

export function trackingStatusBefore(samples: StatusSample[], deviceId: string, failureStartedAt: string): string | null {
    // the newest status from the same phone in the minute before the failure

    const failureTime = new Date(failureStartedAt).getTime();
    // when the failed attempt started

    const earlestTime = failureTime - STATUS_LOOKBACK_SECONDS * 1000;
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

        if (sampleTime > failureTime || sampleTime < earlestTime) {

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

    return newestSample?.tracking_status;

}

// TRACKING STATS BEFORE end --------------------------------------------------




