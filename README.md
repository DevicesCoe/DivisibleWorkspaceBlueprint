## Two Way Divisible Workspaces

The Divisible Workspaces design blueprint provides a drastically simplified installation for two-way combinable rooms while leveraging Cisco Pro Series Microphones (Ceiling and Table). This blueprint is **not** a Cisco native offering but a **validated blueprint** that leverages the flexibility and customization capabilities within Room OS on Cisco Video Devices to achieve a predictable outcome. 

The solution leverages the following: 
- Cisco Codec EQs or Codec Pros
- Cisco Table or Ceiling Microphone Pros (up to 8)
- Cisco Catalyst 9K Series Switches  
- Custom Macros including [Audio Zone Manager Library](https://github.com/ctg-tme/audio-zone-manager-library-macro?tab=readme-ov-file)
- Certified HDMI Distrubution Amplifiers: [Certified Third Party Devices](https://help.webex.com/en-us/article/7sw4gab/Cisco-collaboration-devices-certification-program)

| Minimum RoomOS Version | Webex Cloud | Webex Edge (Hybrid Cloud) | On-Premise | Microsoft Teams Room<br>On Cisco Devices |
|:-----------------------|:------------|:--------------------------|:-----------|:-----------------------------------------|
| 11.24              | ✅ Yes      | ✅ Yes                    | ✅ Yes**     | ❌ Not Supported   | 

** Premise deployments will require manual deployment of macros and additional configuration.

### Please join this Webex messaging space for best effort and community level support: https://eurl.io/#nakTe_Vn3

---
## Table of Contents

- [Key Terminology / Files](#key-terminology--top)
- [Supported Hardware](#supported-hardware--top)
- [Installation](#installation-top)
- [User Guide](#user-guide-top)
- [Video Tutorials](#video-tutorials-)
- [Support Information](#support-information-top)
- [FAQ](#faq-)
  
---
## Key Terminology: [Top](#table-of-contents)
| **Term** | **Definition** |
|---|---|
| Primary/Primary Codec | References the codec/room that provides the main control for all Divisible state changes, actions and where the macros are installed. |
| Secondary/Secondary Codec | References the codec/room that will **not** have an active role in a combined state. |
| Audience Camera | Refers to the Quad Camera at the front of each room. |
| Presenter Camera | Refers to the Speaker Tracking enabled PTZ camera in each room. |
| DWS_AZM_Lib.js | The Audio Zone Manager Library macro. This library contains the logic needed for clean audio based events. |
| DWS_Wizard.js | The initial setup wizard functionality loaded onto the Primary Codec. |
| DWS_Setup.js | A background macro that handles the installation and base configuration. |
| DWS_Core.js | The "main" macro that handles all logic. Runs on Primary Codec. |
| DWS_Node.js | The "secondary" macro that handles tasks on the Secondary Codec. |
| DWS_State.js | This autogenerated macro handles saving state for reboots, etc. |
| ciscortr.cfg | This is the pre-configured Cisco Catalyst 9K configuration file. |
---

## Supported Hardware: [Top](#table-of-contents)

This blueprint has been validated with following Codecs:
- Codec Pro
- Codec EQ

The following Cameras have been validated:
- Cisco Quad Camera
- Cisco PTZ4K
- Cisco P60

The following Microphones have been validated:
- Cisco Table Microphone Pro
- Cisco Ceiling Microphone Pro

The following models (SKUs) of switches have been validated:
- C9200CX-8P-2X2G-E
- C9200CX-12P-2X2G-E
- C9200CX-8P-2XGH-E
- C9200CX-12P-2XGH-E
- C9200L-24P-4G-E
- C9200L-24P-4X-E
- C9300L-24P-4G-E
- C9300L-24P-4X-E

Network Advantage (-A) is also supported if you choose to deploy that tier of licensing.

## Installation: [Top](#table-of-contents)

This table provides the supported combinations of codecs and number of secondary displays. Note, all of these designs assume a Presenter PTZ Camera in each unique space (Primary and Nodes).

| **Codecs** | **Single Secondary Display** | **Dual Secondary Display** |
| --- | --- | ---|
| 2 x Codec EQs | ✅ Yes | ❌ No |
| 1 EQ & 1 Pro | ✅ Yes | ✅ Yes |
| 2 x Codec Pros | ✅ Yes | ✅ Yes |

All wire diagrams for each scenario are available here: [Wire Diagrams](https://github.com/DevicesCoe/DivisibleWorkspaceBlueprint/blob/main/WireDiagrams.pdf)

Download the switch configuration based on your design: 

| **Switch Model** | **Switch Config** |
|---|---|
| 9200CX 8 Port | [Two-Way](https://github.com/DevicesCoe/DivisibleWorkspace/blob/main/switch-configs/C9200CX-8P/ciscortr.cfg) |
| 9200CX 12 Port | [Two-Way](https://github.com/DevicesCoe/DivisibleWorkspace/blob/main/switch-configs/C9200CX-12P/ciscortr.cfg) |
| Cat 9K 24 Port | [Two-Way](https://github.com/DevicesCoe/DivisibleWorkspace/blob/main/switch-configs/C9K-24P/ciscortr.cfg) |

**Do NOT power on your Codecs or Switch until instructed to!**

### INSTALL GUIDE
Access the installation documentation for Cloud & Hybrid registrations here: [Cloud Install Guide](https://github.com/DevicesCoe/DivisibleWorkspace/blob/main/InstallationGuide.pdf)

Access the installation documentation for On premise registered devices (CUCM or Expressway) that have **internet access** to GitHub URLs: [Premise Install Guide](https://github.com/DevicesCoe/DivisibleWorkspace/blob/main/PremiseInstallationGuide.pdf)

Air Gapped / No Internet Access installation Guide will be released at a later date.
  
---
## User Guide: [Top](#table-of-contents)

Access the end user documentation here: [End User Guide](https://github.com/DevicesCoe/DivisibleWorkspace/blob/main/EndUserGuide.pdf)
  
---
## Support Information: [Top](#table-of-contents)

- All Macros are considered **Custom Code** and are **NOT** supported by Cisco through the Technical Assistance Center (TAC).
- If you're considering deploying the Divisible Workspace blueprint, we recommend you engage a Cisco AV Integration Partner, not only for installation, but for configuration and ongoing support.
- The Divisible Workspace blueprint is provided AS IS, please reference the code license included above.
- Please join this Webex messaging space for best effort and community level support: https://eurl.io/#nakTe_Vn3
  
---
## FAQ: [Top](#table-of-contents)
**Is this a Cisco TAC supported deployment?**
- No. This repository is a custom blueprint and is not supported through Cisco Technical Assistance Center. Implementation, troubleshooting and support would be the responsibility of the end customer or AV Integrator.

**How many Microphone Pros (Ceiling and Table) can I use in each room?**
- Combined mode operation can support a maximum of 8 microphones. They can be split amongst either room during split operation in any variation.

**Can I use Third Party Microphones with this blueprint?**
- No, this blueprint provides support for only Cisco Pro Series Microphones.

**Can this be used for 3-way(+) divisible spaces?**
- No, this blueprint is specifically designed to support 2-way divisible spaces.

**Does this blueprint support Voice Lift / Room re-enforcement scenarions?**
- No, this blueprint does not provide for voice lift scenarios.

**Where is the Partition Sensor?**
- This blueprint does not leverage a partition sensor. The Combine/Split operation is driven manually by the end user.

**Can you help me make this do "X"?**
- Any additional capabilities would require you or your AV Integrator to make **and** support any required modifications to the provided Macros directly.
