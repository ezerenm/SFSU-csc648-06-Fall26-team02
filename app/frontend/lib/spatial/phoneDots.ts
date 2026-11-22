// R19, R2.2: which of the phones get a dot in the 3d view 
// dot details

// IMPORTS --------------------------------------------------------------------

import { listPhones, type PhonesByDevice } from "./livePhones";
// all the phones 

import { getDeviceType } from "./deviceTypes";
// either visitor or robot

import { getTrackingColor } from "./trackingStatus";
// either green, yellow, gray, red, or same status as the status chip

// IMPORTS end ----------------------------------------------------------------

// COLORS ---------------------------------------------------------------------

export const VISITOR_DOT_COLOR = "deepskyblue";

export const ROBOT_DOT_COLOR = "orange";

export const FADED_DOT_OPACITY = 0.4;
// transparent when the phone isn't successfully tracking

// COLORS end -----------------------------------------------------------------

// DATA -----------------------------------------------------------------------

export type PhoneDot = {
    // everything the 3d view needs to draw a phone

    deviceId: string;
    // which phone it is

    xMeters: number;

    zMeters: number;
    // where the dot is on the floor

    headingDegrees: number | null;
    // which way the phone is facing

    color: string;
    // orange for the robot
    // blue for humans

    opacity: number;
    // 1
    // faded if the chip isn't green
};

// DATA end -------------------------------------------------------------------

// DOTS -----------------------------------------------------------------------

/** R19 turns the live phones into 3D dots, one for each phone that has sent a position. */
export function phoneDotsFor(phones: PhonesByDevice, nowMs: number): PhoneDot[] {
    // one dot for each phot that had sent a position

    const dots: PhoneDot[] = [];
    // list to fill

    for (const phone of listPhones(phones)) {
        // all phones 

        const positionMessage = phone.latestPosition;
        // the newest message with a position

        if (positionMessage === null || positionMessage.world_position === null) {

            continue;
            // if there is no position, there is nothing to draw

        }

        let color = VISITOR_DOT_COLOR;
        // marked as visitor unless we know it is a robot phone

        if (getDeviceType(phone.deviceId) === "robot") {

            color = ROBOT_DOT_COLOR;

        }

        let opacity = 1;
        // 100% visible when tracking well, transparent as it gets worse
        
        if (getTrackingColor(phone.latestMessage, nowMs) !== "green") {

            opacity = FADED_DOT_OPACITY;
            // either localizing or llost
            // keeps the last spot transparently

        }

        dots.push({

            deviceId: phone.deviceId, xMeters: positionMessage.world_position.x_m,
            zMeters: positionMessage.world_position.z_m, headingDegrees: positionMessage.heading_deg,
            color: color, opacity: opacity,

        });

    }

    return dots;

}

// DOTS end -------------------------------------------------------------------



