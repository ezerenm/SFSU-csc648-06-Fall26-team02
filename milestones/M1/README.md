# Milestone 1: User Stories and High-Level Requirements

**SpatialOS** · SW Engineering CSC 648/848 · Section 06, Team 02 · Submitted September 29, 2026

| Item | Link |
|---|---|
| **Submitted document** | [SpatialOS_M1_Section06_Team02.pdf](SpatialOS_M1_Section06_Team02.pdf) ([.docx](SpatialOS_M1_Section06_Team02.docx)) |
| **Next milestone** | [Milestone 2](../M2) |

## What M1 defined

- **Product idea:** SpatialOS, *Shared Spatial Operations and Localization Reliability*. People and a simulated robot share one scanned SFSU indoor area; phones localize with Niantic VPS; operators manage path closures and robot-restricted segments; localization health is measured at test points and explained by AI.
- **Personas, user stories and requirements:** four personas, user stories US1 to US13, functional requirements R1 to R18 and non-functional requirements N1 to N10.
- **Competitive analysis** against Niantic, Mappedin, Nav2, Formant and InOrbit.
- **Scope for the course:** one scanned area, one map version, hand-defined paths, no physical robot.

## What changed after M1

| Area | M1 (Sep 29) | Now | Why |
|---|---|---|---|
| Phone platform | Android | iPhone (Unity + Niantic Spatial SDK) | The two members who build the phone app have iPhones and Macs, and iPhone apps can only be built on a Mac, so iPhone was the platform we could build and test on |
| Requirements | R1 to R18 at feature level | Atomized items with a subject, an "Applies to" (human, robot, both) and priorities 1 to 3 | Instructor feedback (Oct 8, Oct 26) |
| Personas | Visitor, spatial developer, site operator, simulation tester | Visitor, operator, developer, administrator, each tied to an SFSU robot pilot | Instructor feedback (Oct 26) |
| Simulated robot | Server-side simulated agent | Robot proxy phone: a second iPhone walks the robot route, and the system recalculates it | Instructor feedback (Oct 26) |
| Focus | Shared navigation plus localization reliability | Localization data and accuracy, with navigation driving the data collection runs | M3 review (Nov 3) |

## Revision history

| Version | Date | Summary |
|---|---|---|
| v1.0 | Sep 29, 2026 | Initial M1 submission |
| v2.0 | With M5 | Revised M1 that includes the instructor feedback above |
