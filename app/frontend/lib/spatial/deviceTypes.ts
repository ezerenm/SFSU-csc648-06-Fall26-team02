// R19 which phone is visitor and which phone is robot proxy

// The Data -------------------------------------------------------------------

export type DeviceType = "visitor" | "robot" | "unknown";
// every phone is either a visitor, robot, or unknown

export const KNOWN_DEVICES = [
    // hardcode which phone is which for m3

    { deviceId: "iphone-sumit", deviceType: "visitor" },

    { deviceId: "iphone-daksh", deviceType: "robot" },

];

// The Data end ---------------------------------------------------------------

// Getting device type --------------------------------------------------------

/** R19 Looks up a phone's device_id and either returns visitor, robot, or unknown. */
export function getDeviceType(deviceId: string): DeviceType {
    // looks up a phones device_id in hardcoded list

    for (const knownDevice of KNOWN_DEVICES) {
        // going through all known phones

        if (knownDevice.deviceId === deviceId) {
            // found phone

            if (knownDevice.deviceType === "robot") {

                return "robot";

            } else {

                return "visitor";
            }
        }
    }

    return "unknown";
    // not in our list
}

// Getting device type end ----------------------------------------------------

// Getting device name --------------------------------------------------------

/** R19 Returns the name shown on the map and phone list for a device type. */
export function getDeviceName(deviceType: DeviceType): string {
    // the word shown on the map and phone list

    if (deviceType === "visitor") {

        return "Visitor";

    } else if (deviceType === "robot") {

        return "Simulated robot";

    } else {

        return "Unknown phone";

    }
}

// Getting device name end ----------------------------------------------------


