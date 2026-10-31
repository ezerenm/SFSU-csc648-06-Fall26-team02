// R4.1 and R19: remembering the newest message from each phone on the map

import type { Position } from "./contracts";
// the x, y, and z position shape from contracts file

import { getDeviceType } from "./deviceTypes";
// tells us if a phone is a visitor or a robot proxy

// The Data -------------------------------------------------------------------

export type PhoneMessage = {
    // one row from the pose_samples table

    sample_id: string;
    // the unique id of this message

    device_id: string;
    // which phone sent this message

    world_position: Position | null;
    // where the phone is
    // null when its localizing or lost

    heading_deg: number | null;
    // which way the phone is facing

    tracking_status: string;
    // valid
    // localizing...
    // lost

    captured_at: string;
    // when the phone sent this message

    received_at: string;
    // when our server received it

    data_origin: string;
    // real data or test data

};

export type PhoneState = {
    // everything we remember about a phone

    deviceId: string;
    // which phone this one is

    latestMessage: PhoneMessage;
    // the newest message ever

    latestPosition: PhoneMessage | null;
    // the newest massage that has a position

    localizingSince: string | null;
    // when this phone started localizing

};

export type PhonesByDevice = Record<string, PhoneState>;
// all of the phones
// look up by device_id

// The Data end ---------------------------------------------------------------


// Comparing the two messages -------------------------------------------------

export function isNewerMessage(message: PhoneMessage, oldMessage: PhoneMessage | null): boolean {
    // true if this message is newer than oldMessage
    // the same message 2x isnt newer

    if (oldMessage === null) {
        // no old message

        return true;
        // anything is newer

    }

    const messageMs = new Date(message.captured_at).getTime();
    // time

    const oldMessageMs = new Date(oldMessage.captured_at).getTime();

    return messageMs > oldMessageMs;
    // later time = newer

}

// Comparing the two messages end ---------------------------------------------


// Adding message -------------------------------------------------------------

export function addPhoneMessage(phones: PhonesByDevice, message: PhoneMessage): PhonesByDevice {
    // returns new obect

    const oldState = phones[message.device_id];
    // what we knew about this phone

    let latestMessage = message;
    // guess if the new message is the newest ever

    let latestPosition: PhoneMessage | null = null;
    // finding the newest message with a position

    if (message.world_position !== null) {

        latestPosition = message;

    }
    
    if (oldState !== undefined) {
        // if we already know this phone

        if(!isNewerMessage(message, oldState.latestMessage)) {
            // the new message is older

            latestMessage = oldState.latestMessage;
            // keep olde one

        }

        if (latestPosition === null || !isNewerMessage(latestPosition, oldState.latestPosition)) {
            // no new position or the position is actually older than the one we have

            latestPosition = oldState.latestPosition;
            // keeping the old one

        }

        if (latestMessage === oldState.latestMessage && latestPosition === oldState.latestPosition) {
            // no changes

            return phones;
            // return the same object
        }
    
    }

let localizingSince: string | null = null;

if (latestMessage.tracking_status === "localizing") {
    // phone is localizing

    if (oldState !== undefined && oldState.latestMessage.tracking_status === "localizing" && oldState.localizingSince !== null) {
        // if phone was already localizing

        localizingSince = oldState.localizingSince;
        // keep original start time

    } else {

        localizingSince = latestMessage.received_at;
    }
}

const newPhones: PhonesByDevice = { ...phones };
// copying every phone into a new object

newPhones[message.device_id] = { deviceId: message.device_id, latestMessage: latestMessage, latestPosition: latestPosition, localizingSince: localizingSince };

return newPhones;

}

// Adding message end ---------------------------------------------------------


// Listing the phones ---------------------------------------------------------

export function listPhones(phones: PhonesByDevice): PhoneState[] {
    // turns the lookup object into a list
    // the list is sorted by device_id

    const phoneList: PhoneState[] = [];
    // empty list

    for (const deviceId of Object.keys(phones).sort()) {
        // every device_id in alphabetical order

        phoneList.push(phones[deviceId]);

    }

    return phoneList;

}

// Listing the phones end -----------------------------------------------------


// Choosing the phone to navigate with ----------------------------------------

export function pickNavigationPhone(phones: PhonesByDevice): PhoneState | null {
    // /live navigates for one phone
    // should be the visitor phone if it is a known phone

    let newestVisitor: PhoneState | null = null;
    // newest visitor phone so far

    let newestUnknownPhone: PhoneState | null = null;
    // newest unknown phone ever so far

    for (const phone of listPhones(phones)) {
        // checking each phone

        const deviceType = getDeviceType(phone.deviceId);
        // either visitor, robot, or unknown

        if (deviceType === "robot") {

            continue;
            // skip

        }

        if (deviceType === "visitor") {

            if (newestVisitor === null || isNewerMessage(phone.latestMessage, newestVisitor.latestMessage)) {

                newestVisitor = phone;
                // saving the visitor phone

            }

        } else {

            if (newestUnknownPhone === null || isNewerMessage(phone.latestMessage, newestUnknownPhone.latestMessage)) {

                newestUnknownPhone = phone;
                // saving the unknown phone

            }
        }
    }

    if (newestVisitor !== null) {

        return newestVisitor;
        // visitor wins

    }

    return newestUnknownPhone;

}

// Choosing the phone to navigate with end ------------------------------------






