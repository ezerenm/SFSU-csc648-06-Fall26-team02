

"use client";

// IMPORTS --------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
// react tools

import { createClient } from "@supabase/supabase-js";
// browser will read database and listen 

import { addPhoneMessage, type PhoneMessage, type PhonesByDevice } from "@/lib/spatial/livePhones";
// function that keeps the newest message for each phone

// IMPORTS end ----------------------------------------------------------------

// SETTINGS -------------------------------------------------------------------

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
// the public connection
// same as /live for M2

const PHONE_COLUMNS = "sample_id,device_id,world_position,heading_deg,tracking_status,captured_at,received_at,data_origin";
// the columns from pose_samples

export const POLL_AFTER_QUIET_MS = 2000;
// if Realtime is quiet for 2 seconds, we read the database
// this should stop map freeze in demo

export const SLOW_POLL_AFTER_MS = 10000;
// if nothing new comes in for 10 seconds, the phone is most likely off

export const SLOW_POLL_EVERY_MS = 5000;
// we check the database every 5 seconds

const CLOCK_TICK_MS = 500;
// how often we update "now"
// chip status timing

// SETTINGS end ---------------------------------------------------------------

// HOOK -----------------------------------------------------------------------

export function useLivePhones(mapVersionId: string) {
    // gives any page every phone's newest message

    const [phones, setPhones] = useState<PhonesByDevice>({});
    // every phone we know about
    
    const [nowMs, setNowMs] = useState(() => Date.now());
    // the current time
    // updated every half second

    const [liveError, setLiveError] = useState<string | null>(null);
    // error message if we can't read the database

    const lastHeardMs = useRef(0);
    // the last we heard from Realtime or the databse

    const lastNewMessageMs = useRef(0);
    // when we last saw a new message
    // either realtime or databse

    const newestReceivedMs = useRef(0);
    // the newest received_at so far

    useEffect(() => {
        // runs when the page opens

        let stopped = false;
        // this turns true when page closes
        // stops updating when page closes

        let isLoading = false;
        // true when reading database

        const addMessages = (messages: PhoneMessage[]) => {
            // adds messages list into phones

            for (const message of messages) {
                // checking if theres anything new

                const receivedMs = new Date(message.received_at).getTime();
                // when the server got this message

                if (receivedMs > newestReceivedMs.current) {
                    // if its newer than everything

                    newestReceivedMs.current = receivedMs;
                    // save it

                    lastNewMessageMs.current = Date.now();
                    // something new 
                }
            }

            setPhones((oldPhones) => {
                // react gives us current phones

                let newPhones = oldPhones;
                // start

                for (const message of messages) {
                    // keeping only the newest message for each phone

                    newPhones = addPhoneMessage(newPhones, message);

                }

                return newPhones;

            });
        };

        const loadFromDatabase = async () => {
            // reads the newest message straight from database

            if (isLoading) {
                // if already reading
                
                return;
                // do not read a second time

            }

            isLoading = true;
            // making it known that we're reading

            const newestMessages = await supabase.from("pose_samples")
            .select(PHONE_COLUMNS).eq("map_version_id", mapVersionId).order("captured_at", { ascending: false }).limit(50);
            // the 50 newest messages
            // for status chips

            const newestPositions = await supabase.from("pose_samples")
            .select(PHONE_COLUMNS).eq("map_version_id", mapVersionId).not("world_position", "is", null).order("captured_at", { ascending: false }).limit(20);
            // the 20 newest messages that have a position
            // for dots

            isLoading = false;
            // finished reading

            lastHeardMs.current = Date.now();
            // poll every two seconds instead of doing it constantly
            // this counts as hearing something

            if (stopped) {
                // the page was closed while reading

                return;

            }

            if (newestMessages.error) {

                setLiveError(newestMessages.error.message);

                return;

            }

            if (newestPositions.error) {
                // checking again for second read

                setLiveError(newestPositions.error.message);

                return;

            }

            setLiveError(null);
            // clear old errors 

            const positionRows = newestPositions.data as PhoneMessage[];
            // newest first

            const messageRows = newestMessages.data as PhoneMessage[];
            // newest first

            addMessages([...positionRows.reverse(), ...messageRows.reverse()]);
            // adding both lists
            // addPhoneMessage classifies which ones are newest

        };

        loadFromDatabase();
        // the first read once the page opens

        const channel = supabase.channel("live-phones-" + mapVersionId + "-" + Date.now())
        // different channel names so two maps on a single page don't collide
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "pose_samples", filter: "map_version_id=eq." + mapVersionId },
            (payload) => {

                lastHeardMs.current = Date.now();
                // realtime works

                addMessages([payload.new as PhoneMessage]);
                // add the new message

            }
        )
        .subscribe();
        // listen

        const clock = setInterval(() => {
            // run every half second

            const nowMs = Date.now();
            // the time at this moment

            setNowMs(nowMs);
            // update so the clock so the status chips turn gray after five seconds

            let waitMs = POLL_AFTER_QUIET_MS;
            // check after 2 seconds of quiet

            if (nowMs - lastNewMessageMs.current >= SLOW_POLL_AFTER_MS) {
                // nothing new for 10 seconds

                waitMs = SLOW_POLL_EVERY_MS;

            }

            if (nowMs - lastHeardMs.current >= waitMs) {
                // realtime has been quiet for two seconds

                loadFromDatabase();
                // read the database
                // stops map freeze for demo

            }
        }, CLOCK_TICK_MS);

        return () => {
            // cleanup when page closes

            stopped = true;
            // quit updating

            supabase.removeChannel(channel);
            // quit listining to realtime

            clearInterval(clock);
            // stop the clock

        };
    }, [mapVersionId]);

    return { phones, nowMs, liveError };
}

// HOOK end -------------------------------------------------------------------