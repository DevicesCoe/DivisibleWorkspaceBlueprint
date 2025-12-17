/********************************************************
Copyright (c) 2024 Cisco and/or its affiliates.
This software is licensed to you under the terms of the Cisco Sample
Code License, Version 1.1 (the "License"). You may obtain a copy of the
License at
               https://developer.cisco.com/docs/licenses
All use of the material herein must be in accordance with the terms of
the License. All rights not expressly granted by the License are
reserved. Unless required by applicable law or agreed to separately in
writing, software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
or implied.
*********************************************************

 * Author(s):               Robert(Bobby) McGonigle Jr
 *                          Technical Marketing Engineering, Technical Leader
 *                          Cisco Systems
 * 
 * Consulting Engineer(s)   Gerardo Chaves                    William Mills
 *                          Leader, Systems Engineering       Technical Solutions Specialist
 *                          Cisco Systems                     Cisco Systems
 *
 *                          Mark Lula
 *                          Solutions Engineer
 *                          Cisco Systems
 * 
 * Description:
 *   - Audio Zone Manager (AZM)
 *   - Suite of custom Commands, Statuses and Events that have been
 *     tailored to enable Audio Based Automation
 *   - This Library is intended to be imported into a Project
 * 
 *   - Dependencies
 *     - The Device xAPI
 *     - Audio Configuration Object
 *   
 *   - Documentation
 *     - https://github.com/ctg-tme/audio-zone-manager-library-macro
*/
import xapi from 'xapi';

/*****[Configurable Options]***********************************************************/

/**
 * Set the Mode for AZM Automatic Updates
 * 
 * Periodically reaches out to github to check for updates to the AZM_Lib.
 * 
 * @value off(default): disables automatic update checks to AZM Library
 * @value monitor: If available, will log update details to the console and provides a UI element in the Control Panel notifying the user.
 * 
 * @link [Audio Zone Manager Releases](https://github.com/ctg-tme/audio-zone-manager-library-macro/releases)
 * 
 * @acceptedValues [Off, Monitor]
 * 
 * @see config_AutomaticUpdates_Schedule_Day
 * @see config_AutomaticUpdates_Schedule_Time
 */
const config_AutomaticUpdates_Mode = 'Off';

/**
 * Set the Day to check for AZM Updates
 * 
 * @acceptedValues ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
 * @see config_AutomaticUpdates_Schedule_Time
 */
const config_AutomaticUpdates_Schedule_Day = ['Sunday', 'Saturday'];

/**
 * Set the Time to check for AZM Updates
 * 
 * @acceptedValues 24hr Format String. Ex: 00:00
 * @see config_AutomaticUpdates_Schedule_Day
 */
const config_AutomaticUpdates_Schedule_Time = '03:00';

/*****[Troubleshooting Tools]***********************************************************/

/**
 * AZM Debug flags should remain `false` by default as they produce ALOT of information and could slow a browser session if left `true` for too long
 * 
 * Only set `true` only when you need to troubleshoot
 * 
 * When complete, please set all flags to `false` to improve browser performance
 * 
 * @see createDebugMethod
 * @see console.AZM
 */
const AZM_DebugFlags = {
  SetupDebug: false,                      // Enables Debugging for the AZM Setup Process
  ZonesDebug: false,                       // Enables Debugging for changes in Zones
  MonitorDebug: false,                    // Enables Debugging for Starting and Stopping the AZM Monitor
  Analog_BucketDebug: false,              // Enables Debugging for processing Analog Audio data
  Ethernet_BucketDebug: false,            // Enables Debugging for processing Ethernet/AES67 Audio data
  USB_BucketDebug: false,                 // Enables Debugging for processing USB Audio data
  ExternalVuMeter_BucketDebug: false,     // Enables Debugging for processing ExternalVuMeter Audio Data
  ExternalGate_BucketDebug: false,        // Enables Debugging for processing ExternalGate Audio Data
  MessageSendEvent_Debug: false,          // Enables Debugging for raw event data coming into the Message Send Event
  AudioInputConnectorEvent_Debug: false   // Enables Debugging for raw event data coming into the Audio Input Connector Event
};

/*****[Const, Let, Var Objects]***********************************************************/

/**
 * The Installed Version of AZM
 * 
 * Do NOT alter this value unless you choose to fork the library, as it could impact the operation fo the Macro
 */
const version = '1.0.0';

/**
 * AZM Path Object. Contains Command, Status and Event Nodes that are exported by AZM_Lib
 * 
 * @exports
 */
const AZM = {
  Command: {
    Zone: {
      /** Initializes the Audio Zone mappings assigned in the Audio Configuration Object
       * 
       * Required on script boot, but can be modified
       * @param {object} AudioZoneInfo
       * A multi-node configuration for both settings and zone information
       * 
       * @link [AZM Configuration Guide](https://github.com/ctg-tme/audio-zone-manager-library-macro/tree/main?tab=readme-ov-file#azm-audio-configuration-)
       * 
       * @xapi [xConfiguration HttpClient Mode](https://roomos.cisco.com/xapi/Configuration.HttpClient.Mode/)
       * @xapi [xConfiguration Audio Microphones VoiceActivityDetector Mode](https://roomos.cisco.com/xapi/Configuration.Audio.Microphones.VoiceActivityDetector.Mode/)
       */
      Setup: {},
      Monitor: {
        /** Starts the VU Meter on all Audio Input Connectors defined in your Audio Configuration
         * 
         * @param {string} cause
         * For logging purposes, provide a reason why this function was declared
         * 
         * @xapi [xCommand Audio VuMeter Start](https://roomos.cisco.com/xapi/Command.Audio.VuMeter.Start/)
         */
        Start: {},
        /** Stops the VU Meter on all Audio Input Connectors defined in your Audio Configuration
         * 
         * @param {string} cause
         * For logging purposes, provide a reason why this function was declared
         * 
         * @xapi [xCommand Audio VuMeter Stop](https://roomos.cisco.com/xapi/Command.Audio.VuMeter.Stop/)
         */
        Stop: {}
      },
      /** Provides a list of all available Zone Information
       */
      List: {}
    }
  },
  Status: {
    Audio: {
      /**
       * Pull information about a target zone by including the Zone ID in its path
       * 
       * Zone IDs are assigned a value +1 to their index position
       * 
       * @see ```AZM.Command.Zone.List()``` to print a list of Zones and their IDs
       * 
       * @example AZM.Status.Audio.Zone[N].State.get()
       * @example AZM.Status.Audio.Zone[N].get()
       */
      Zone: {}
    }
  },
  Event: {
    /** 
     * Serves as a universal subscriptions to audio events
     * 
     * It not only subscribes to the data requests, but it then processes and calls back a refined dataset to leverage in you projects
     * 
     * This subscription is the core to the AZM library
     * 
     * @xapi [xEvent Audio Input Connectors <Microphone, USB, Ethernet>](https://roomos.cisco.com/xapi/Event.Audio.Input.Connectors/)
     * @xapi [xEvent Message Send](https://roomos.cisco.com/xapi/Event.Message.Send/)
     * @xapi [xStatus Audio Microphones VoiceActivityDetector Activity](https://roomos.cisco.com/xapi/Status.Audio.Microphones.VoiceActivityDetector.Activity/)
    */
    TrackZones: {}
  }
};


/**
 * Panel ID for the AXM Notifications Panel
 * 
 * Panel is used for AZM Update Checks
 */
const azmnotifyPanelId = 'azm_notify';

/**
 * Object to store Audio Connector Data, later instantiated by their respective _Bucket Classes
*/
const AudioBucket = { Ethernet: {}, Analog: {}, USB: {}, ExternalVuMeter: {}, ExternalGate: {} }

/**
 * Data repository for EthernetSubId information
 * 
 * @see Normalize_Ethernet_Audio_Data()
 */
let Ethernet_SubId_Backfill = {}

/**
 * Object used to store AZM Configuration
 * 
 * @see AZM.Command.Zone.Setup(AudioConfiguration)
 */
let AudioConfiguration;

/**
 * This object tracks if the AZM.Command.Zone.Setup has been successfully run
 * 
 * This ensures those developing with AZM_Lib has passed a configuration
 * into their project prior to executing other tasks
 * 
 * @see AZM.Command.Zone.Setup(AudioConfiguration)
*/
let ZoneSetupStatus = false;

/**
 * Used to assign VoiceActivity Detection based on the provided configuration
 * 
 * @see AZM.Command.Zone.Setup(AudioConfiguration)
 * @link [xStatus Audio Microphones VoiceActivityDetector Activity](https://roomos.cisco.com/xapi/Status.Audio.Microphones.VoiceActivityDetector.Activity/)
 */
let allowVoiceActivityDetection = true;

/**
 * Used to assign the Sample Mode based on the provided configuration
 * 
 * @see AZM.Command.Zone.Setup(AudioConfiguration)
 */
let audioSamplingMode = 'Snapshot';

/**
 * Helps educate integrators which connector types are allowed in this Library on Error
 * 
 * Has no impact other than logging
 */
const allowedAudioTypes = `Analog, USB, Ethernet, AES67, ExternalVuMeter, ExternalGate`;

/**Aids in the mapping of Ethernet Connector Inputs
 * 
 * Allows for discrete zoning on a single ethernet base microphone per its SubIds
 * @see Instantiate_Audio_Zones_And_Buckets()
 */
const zoneConnectorMap = {
  Ethernet: []
};

/*****[Prototype Objects]***********************************************************/

/**
 * Checks if the array includes a specified value using the loose equality operator (`==`).
 *
 * This method works similarly to `Array.prototype.includes()`, but it uses loose equality (`==`)
 * instead of strict equality (`===`) to determine if the value is present.
 *
 * @param {*} value The value to search for in the array.
 * @returns {boolean} `true` if the value is found in the array, otherwise `false`.
 */
Array.prototype.includish = function (value) {
  for (let i = 0; i < this.length; i++) { if (this[i] == value) { return true; }; };
  return false;
};

/**
 * Safely clones an object in code in order to prevent changes to the original object
*/
Object.prototype.clone = Array.prototype.clone = function () {
  if (Object.prototype.toString.call(this) === '[object Array]') {
    const clone = [];
    for (let i = 0; i < this.length; i++) {
      clone[i] = this[i].clone();
    }
    return clone;
  } else if (typeof (this) == "object") {
    const clone = {};
    for (let prop in this)
      if (this.hasOwnProperty(prop)) {
        clone[prop] = this[prop].clone();
      }
    return clone;
  }
  else {
    return this;
  }
}

/*****[Class Objects]***********************************************************/

/**
 * Custom Error class for AZM Lib errors.
 * 
 * Functions like Error but clearly marks this an an error associated to AZMLib
 */
class AZM_Error extends Error {
  constructor(message) {
    super(`[AZM Error]: ${message}`);
  }
}

/**
 * This tracks the Zone State based on it's Connector States
 * 
 * This Class is instantiated in AZM.Status.Audio.Zone[N]
 * - This path allows a developer to poll the current state of a specific Zone
 * 
 * @param {number} zoneId
 * Numeric ID for the Zone, used in AZM.Status Node
 * @param {number} zoneLabel
 * The Label assigned to the Zone
 * @param {number} zoneType
 * The type of Microphones assigned to the zone
 * @param {number} assets
 * The Assets associated to the zone
*/
class Zone_Tracker {
  constructor(zoneId, zoneLabel, zoneType, assets) {
    this._ZoneId = zoneId;
    this._Label = zoneLabel;
    this._Connectors = [];
    this._State = 'Unset';
    this._ZoneType = zoneType;
    this._Assets = assets;
    console.AZM.ZonesDebug(`New [${this._ZoneType}] Zone instantiated || ZoneId: [${this._ZoneId}]`)
  }
  addConnector(connectorId, state, zoneId) {
    if (zoneId == this._ZoneId) {
      this._Connectors.push({ ConnectorId: connectorId, State: state })
      console.AZM.ZonesDebug(`ConnectorId [${connectorId}] added || ZoneId: [${this._ZoneId}]`)
    }
  }
  setConnectorState(connectorId, newState, zoneId) {
    checkZoneSetup(`Unable to set connector state on ZoneId: [${this._ZoneId}]`)
    if (zoneId == this._ZoneId) {
      const index = this._Connectors.findIndex(item => item.ConnectorId === connectorId);

      if (index != -1) {
        this._Connectors[index].State = newState;
        console.AZM.ZonesDebug(`ConnectorId [${connectorId}] State updated to [${newState}] || ZoneId: [${this._ZoneId}]`)
      }
    }
    return new Promise(resolve => resolve(`Ok`));
  }
  get State() {
    checkZoneSetup(`Unable to request Zone information from ZoneId: [${this._ZoneId}]`)
    let hasHigh = false;
    let hasLow = false;
    let hasUnset = false;

    for (const item of this._Connectors) {
      if (item.State == 'High') {
        hasHigh = true;
      } else if (item.State == 'Low') {
        hasLow = true;
      } else if (item.State == 'Unset') {
        hasUnset = true;
      }
    }

    const stateObject = {
      get: () => {
        if (hasHigh) {
          return 'High';
        } else if (hasLow && !hasUnset) {
          return 'Low';
        } else if (!hasLow && hasUnset) {
          return 'Unset';
        } else {
          return 'Low';
        }
      },
    };
    this._State = stateObject
    return stateObject;
  }

  get() {
    checkZoneSetup(`Unable to request Zone information from ZoneId: [${this._ZoneId}]`)
    this._State = this.State.get()
    return { Id: this._ZoneId, Label: this._Label, Type: this._ZoneType, Connectors: this._Connectors, State: this._State }
  }
}

/**
 * AudioBuckets are used to collect and process incoming audio data
 * 
 * The Base_AudioBucket is a template class for all other buckets to extend from
 * 
 * @param connectorId
 * The audio connector IDs associated to this Audio Bucket
 * @param zoneId
 * The Zone Id this Audio Bucket belongs too
 * @param zoneLabel
 * The Zone Label this Audio Bucket belongs too
 * @param assets
 * The Assets that are associated to this Audio Bucket
 * 
 * @method ```run``` Processes incoming audio data, updates AZM Status Branch, calls back Zone Event States
 * 
 * @see Analog_Bucket
 * @see USB_Bucket
 * @see Ethernet_Bucket
 */
class Base_AudioBucket {
  constructor(connectorId, zoneId, zoneLabel, assets) {
    this.ConnectorId = connectorId;
    this.ZoneId = zoneId;
    this.Label = zoneLabel;
    this.Assets = assets;
    this.bin = { VuMeter: [], PPMeter: [], NoiseLevel: [], LoudspeakerActivity: [] };
    this.State = 'Unset';
    this.audioConnectorType = 'Unset';
  }

  run(data, callback) {
    this.bin.VuMeter.push(data.VuMeter)
    this.bin.PPMeter.push(data.PPMeter)
    this.bin.NoiseLevel.push(data.NoiseLevel)
    this.bin.LoudspeakerActivity.push(data.LoudspeakerActivity)
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`[${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] payload pushed into bins || ZoneId: [${this.ZoneId}] || Bucketlength: [${this.bin.VuMeter.length}] || Payload: ${data}`)
    if (this.bin.VuMeter.length == AudioConfiguration.Settings.Sample.Size) {
      let process_vu_meter = '';

      switch (audioSamplingMode) {
        case 'Snapshot':
          process_vu_meter = Process_BIN_Data(this.bin.VuMeter)
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] met Snapshot Sample Size [${AudioConfiguration.Settings.Sample.Size}], processing bin || ZoneId: [${this.ZoneId}]`)

          this.bin = { VuMeter: [], PPMeter: [], NoiseLevel: [], LoudspeakerActivity: [] }
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] cleared || ZoneId: [${this.ZoneId}]`)
          break;
        case 'Rolling':
          process_vu_meter = Process_BIN_Data(this.bin.VuMeter)
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] met Rolling Sample Size [${AudioConfiguration.Settings.Sample.Size}], processing bin || ZoneId: [${this.ZoneId}]`)

          this.bin.VuMeter.shift()
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin Shifted for [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}], waiting for next value || ZoneId: [${this.ZoneId}]`)
          break;
      }

      if (process_vu_meter.Average >= this.thresholds.High) {
        if (allowVoiceActivityDetection) {
          if (AZM.Status.VoiceActivity) {
            this.State = 'High'
          } else {
            this.State = 'Low'
          }
        } else {
          this.State = 'High'
        }
      } else if (process_vu_meter.Average <= this.thresholds.Low) {
        this.State = 'Low'
      }

      console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] State set [${this.State}] || ZoneId: [${this.ZoneId}]`)

      AZM.Status.Audio.Zone[this.ZoneId].setConnectorState(this.ConnectorId, this.State, this.ZoneId).then(() => {
        const payload = {
          Zone: {
            Label: this.Label,
            State: AZM.Status.Audio.Zone[this.ZoneId].State.get(),
            Id: this.ZoneId
          }, Connector: {
            Type: this.audioConnectorType,
            State: this.State,
            Id: this.ConnectorId
          }, Assets: this.Assets,
          DataSet: { VuMeter: process_vu_meter }
        }
        console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] Callback Fired || ZoneId: [${this.ZoneId}]`)
        callback(payload);
      })
    }
  }
}

/**
 * Collects and Processes Audio data coming from Analog Input sources
 * 
 * Extends from Base_AudioBucket
 * 
 * @see Base_AudioBucket
 * @see AZM.Command.Zone.Setup()
 */
class Analog_Bucket extends Base_AudioBucket {
  constructor(connectorId, zoneId, zoneLabel, assets) {
    super(connectorId, zoneId, zoneLabel, assets);
    this.audioConnectorType = 'Analog';
    this.thresholds = setBucketAudioThresholds(this.ZoneId, AudioConfiguration, this.audioConnectorType)
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`New [${this.audioConnectorType}] Bucket instantiated for the [${this.Label}] Zone || Bucket: [Connector: ${this.ConnectorId} || ZoneId: [${this.ZoneId}]`)
  }
}

/**
 * Collects and Processes Audio data coming from USB Input sources
 * 
 * Extends from Base_AudioBucket
 * 
 * @see Base_AudioBucket
 * @see AZM.Command.Zone.Setup()
 */
class USB_Bucket extends Base_AudioBucket {
  constructor(connectorId, zoneId, zoneLabel, assets) {
    super(connectorId, zoneId, zoneLabel, assets)
    this.audioConnectorType = 'USB'
    this.thresholds = setBucketAudioThresholds(this.ZoneId, AudioConfiguration, this.audioConnectorType)
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`New [${this.audioConnectorType}] Bucket instantiated for the [${this.Label}] Zone || Bucket: [Connector: ${this.ConnectorId} || ZoneId: [${this.ZoneId}]`)
  }
}

/**
 * Collects and Processes Audio data coming from Ethernet Input sources (Cisco or AES67)
 * 
 * Extends from Base_AudioBucket
 * 
 * @see Base_AudioBucket
 * @see AZM.Command.Zone.Setup()
 * 
 * @method ```run``` Processes incoming audio data, updates AZM Status Branch, calls back Zone Event States. Modified run method, accounts for SubIds of Ethernet based microphones
 * @method ```setSubIdProperties``` instantiates bins for each SubId for independent tracking and Processing of each Ethernet SubID
 */
class Ethernet_Bucket extends Base_AudioBucket {
  constructor(connectorId, connectorSubId, zoneId, zoneLabel, assets) {
    super(connectorId, zoneId, zoneLabel, assets)
    this.audioConnectorType = 'Ethernet'
    this.thresholds = setBucketAudioThresholds(this.ZoneId, AudioConfiguration, this.audioConnectorType)
    this.ConnectorSubIds = connectorSubId;
    this.SubStates = {};
    this.bin = this.setSubIdProperties();
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`New [${this.audioConnectorType}] Bucket instantiated for the [${this.Label}] Zone || Bucket: [Connector: ${this.ConnectorId} || ZoneId: [${this.ZoneId}]`)
  }
  setSubIdProperties() {
    const initialBins = {};
    let binCount = 0
    this.ConnectorSubIds.forEach(element => {
      binCount++
      //Based on configured SubIds, instantiate bins to collect audio data
      initialBins[element] = { VuMeter: [], PPMeter: [], NoiseLevel: [], LoudspeakerActivity: [] };
      //Also instantiate substates, for Connector State evaluation
      this.SubStates[element] = 'Unset';
    });
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`[${binCount}] [Ethernet] Bucket bins created || Bucket: [Connector: ${this.ConnectorId}, SubId: ${this.ConnectorSubIds}] || ZoneId: [${this.ZoneId}]`)
    return initialBins;
  }

  run(data, callback) {
    data.SubId.forEach(subElement => {
      if (this.ConnectorSubIds.includish(subElement.id)) {
        this.bin[subElement.id].VuMeter.push(subElement.VuMeter);
        this.bin[subElement.id].PPMeter.push(subElement.PPMeter);
        this.bin[subElement.id].NoiseLevel.push(subElement.NoiseLevel);
        this.bin[subElement.id].LoudspeakerActivity.push(subElement.LoudspeakerActivity);
        console.AZM[`${this.audioConnectorType}_BucketDebug`](`[${this.audioConnectorType}] SubId [${subElement.id}] payload pushed into bins || ZoneId: [${this.ZoneId}] || Bucketlength: [${this.bin[subElement.id].VuMeter.length}] || Payload: ${subElement}`)
        if (this.bin[subElement.id].VuMeter.length == AudioConfiguration.Settings.Sample.Size) {
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] SubId [${subElement.id}] met Sample Size [${AudioConfiguration.Settings.Sample.Size}], processing bin || ZoneId: [${this.ZoneId}]`)

          let process_vu_meter = '';

          switch (audioSamplingMode) {
            case 'Snapshot':
              process_vu_meter = Process_BIN_Data(this.bin[subElement.id].VuMeter)
              console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] SubId [${subElement.id}] Snapshot processed. Result [${JSON.stringify(process_vu_meter)}] || ZoneId: [${this.ZoneId}]`)

              this.bin[subElement.id] = { VuMeter: [], PPMeter: [], NoiseLevel: [], LoudspeakerActivity: [] };
              console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] SubId [${subElement.id}] cleared || ZoneId: [${this.ZoneId}]`)
              break;
            case 'Rolling':
              process_vu_meter = Process_BIN_Data(this.bin[subElement.id].VuMeter)
              console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] SubId [${subElement.id}] Rolling processed. Result [${JSON.stringify(process_vu_meter)}] || ZoneId: [${this.ZoneId}]`)

              this.bin[subElement.id].VuMeter.shift()
              console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin Shifted for [${this.audioConnectorType}] SubId [${subElement.id}], waiting for next value || ZoneId: [${this.ZoneId}]`)
              break;
          }

          //Compare Average VU against Threshold and set SubId state
          if (process_vu_meter.Average >= this.thresholds.High) {
            if (allowVoiceActivityDetection) {
              if (AZM.Status.VoiceActivity) {
                this.SubStates[subElement.id] = 'High'
              } else {
                this.SubStates[subElement.id] = 'Low'
              }
            } else {
              this.SubStates[subElement.id] = 'High'
            }
          } else if (process_vu_meter.Average <= this.thresholds.Low) {
            this.SubStates[subElement.id] = 'Low'
          } else {
            //May implement a Middle state in the future?
            //Perhaps an ExitHigh or ExitLow callback?
            //this.SubStates[subElement.id] = 'Middle'
          }
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] SubId [${subElement.id}] State set [${this.SubStates[subElement.id]}] || ZoneId: [${this.ZoneId}]`)

          //Check all SubId States, and set Connector State
          let hasHigh = false;
          let hasLow = false;
          let hasUnset = false;

          for (const item of this.ConnectorSubIds) {
            if (this.SubStates[item] == 'High') {
              hasHigh = true;
            } else if (this.SubStates[item] == 'Low') {
              hasLow = true;
            } else if (this.SubStates[item] == 'Unset') {
              hasUnset = true;
            }
          }

          if (hasHigh) {
            this.State = 'High';
          } else if (hasLow && !hasUnset) {
            this.State = 'Low';
          } else if (!hasLow && hasUnset) {
            this.State = 'Unset';
          } else {
            this.State = 'Low';
          }

          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] State set [${this.State}] || ZoneId: [${this.ZoneId}]`)

          AZM.Status.Audio.Zone[this.ZoneId].setConnectorState(this.ConnectorId, this.State, this.ZoneId).then(() => {
            const payload = {
              Zone: {
                Label: this.Label,
                State: AZM.Status.Audio.Zone[this.ZoneId].State.get(),
                Id: this.ZoneId
              }, Connector: {
                Type: this.audioConnectorType,
                State: this.State,
                Id: this.ConnectorId, SubId: subElement.id
              }, Assets: this.Assets,
              DataSet: { VuMeter: process_vu_meter }
            }
            console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] Callback Fired || ZoneId: [${this.ZoneId}]`)
            callback(payload)
          })
        }
      }
    });
  }
}

/**
 * Collects and Processes Audio data submitted by an integration external to the codec
 * 
 * ExternalVuMeter expects a payload containing VuMeter Data
 * 
 * Extends from Base_AudioBucket
 * 
 * @see Base_AudioBucket
 * @see AZM.Command.Zone.Setup()
 */
class ExternalVuMeter_Bucket extends Base_AudioBucket {
  constructor(connectorId, zoneId, zoneLabel, assets, controllerId) {
    super(connectorId, zoneId, zoneLabel, assets)
    this.ControllerId = controllerId
    this.bin = { VuMeter: [] };
    this.audioConnectorType = 'ExternalVuMeter'
    this.thresholds = setBucketAudioThresholds(this.ZoneId, AudioConfiguration, this.audioConnectorType)
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`New [${this.audioConnectorType}] Bucket instantiated for the [${this.Label}] Zone || Bucket: [Connector: ${this.ConnectorId} || ZoneId: [${this.ZoneId}]`)
  }

  run(data, callback) {
    this.bin.VuMeter.push(data)
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`[${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] payload pushed into bins || ZoneId: [${this.ZoneId}] || Bucketlength: [${this.bin.VuMeter.length}]  || Payload: ${data}`)
    if (this.bin.VuMeter.length == AudioConfiguration.Settings.Sample.Size) {
      let process_vu_meter = '';

      switch (audioSamplingMode) {
        case 'Snapshot':
          process_vu_meter = Process_BIN_Data(this.bin.VuMeter)
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] met Snapshot Sample Size [${AudioConfiguration.Settings.Sample.Size}], processing bin || ZoneId: [${this.ZoneId}]`)

          this.bin = { VuMeter: [], PPMeter: [], NoiseLevel: [], LoudspeakerActivity: [] }
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] cleared || ZoneId: [${this.ZoneId}]`)
          break;
        case 'Rolling':
          process_vu_meter = Process_BIN_Data(this.bin.VuMeter)
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] met Rolling Sample Size [${AudioConfiguration.Settings.Sample.Size}], processing bin || ZoneId: [${this.ZoneId}]`)

          this.bin.VuMeter.shift()
          console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin Shifted for [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}], waiting for next value || ZoneId: [${this.ZoneId}]`)
          break;
      }

      if (process_vu_meter.Average >= this.thresholds.High) {
        if (allowVoiceActivityDetection) {
          if (AZM.Status.VoiceActivity) {
            this.State = 'High'
          } else {
            this.State = 'Low'
          }
        } else {
          this.State = 'High'
        }
      } else if (process_vu_meter.Average <= this.thresholds.Low) {
        this.State = 'Low'
      }

      console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] State set [${this.State}] || ZoneId: [${this.ZoneId}]`)

      AZM.Status.Audio.Zone[this.ZoneId].setConnectorState(this.ConnectorId, this.State, this.ZoneId).then(() => {
        const payload = {
          Zone: {
            Label: this.Label,
            State: AZM.Status.Audio.Zone[this.ZoneId].State.get(),
            Id: this.ZoneId
          }, Connector: {
            Type: this.audioConnectorType,
            State: this.State,
            Id: this.ConnectorId
          }, Assets: this.Assets,
          DataSet: { VuMeter: process_vu_meter }
        }
        console.AZM[`${this.audioConnectorType}_BucketDebug`](`VuMeter Bin [${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] Callback Fired || ZoneId: [${this.ZoneId}]`)
        callback(payload);
      })
    }
  }
}

/**
 * Collects and Processes Audio data submitted by an integration external to the codec
 * 
 * ExternalGate expects a payload containing Audio Gate States
 * 
 * Extends from Base_AudioBucket
 * 
 * @see Base_AudioBucket
 * @see AZM.Command.Zone.Setup()
 * 
 * @method ```run``` Processes incoming audio data, updates AZM Status Branch, calls back Zone Event States. Modified run method, expects a ```open``` or ```close``` message instead of VuMeter data
 */
class ExternalGate_Bucket extends Base_AudioBucket {
  constructor(connectorId, zoneId, zoneLabel, assets, controllerId) {
    super(connectorId, zoneId, zoneLabel, assets)
    this.ControllerId = controllerId;
    this.audioConnectorType = 'ExternalGate'
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`New [${this.audioConnectorType}] Bucket instantiated for the [${this.Label}] Zone || Bucket: [Connector: ${this.ConnectorId} || ZoneId: [${this.ZoneId}]`)
  }
  run(data, callback) {
    console.AZM[`${this.audioConnectorType}_BucketDebug`](`New Payload passed into [${this.audioConnectorType}], Payload`, data)
    switch (data.toLowerCase()) {
      case 'open': case 'opened':
        if (allowVoiceActivityDetection) {
          if (AZM.Status.VoiceActivity) {
            this.State = 'High';
          } else {
            this.State = 'Low';
          };
        } else {
          this.State = 'High';
        };
        break;
      case 'close': case 'closed':
        this.State = 'Low';
        break;
      default:
        console.AZM.error(`[${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] offered unknown Gate State [${data}]. Unable to process, setting ZoneId: [${this.ZoneId}] state Low`)
        this.State = 'Low';
        break;
    }

    console.AZM[`${this.audioConnectorType}_BucketDebug`](`[${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] State set [${this.State}] || ZoneId: [${this.ZoneId}]`);

    AZM.Status.Audio.Zone[this.ZoneId].setConnectorState(this.ConnectorId, this.State, this.ZoneId).then(() => {
      const payload = {
        Zone: {
          Label: this.Label,
          State: AZM.Status.Audio.Zone[this.ZoneId].State.get(),
          Id: this.ZoneId
        }, Connector: {
          Type: this.audioConnectorType,
          State: this.State,
          Id: this.ConnectorId
        }, Assets: this.Assets,
        DataSet: { Gate: data }
      }
      callback(payload);
      console.AZM[`${this.audioConnectorType}_BucketDebug`](`[${this.audioConnectorType}] ConnectorId [${this.ConnectorId}] Callback Fired || ZoneId: [${this.ZoneId}]`)
    })
  }
}

/*****[Non Exported Function Objects]***********************************************************/

/**
 * Instantiates AZM branch of the JS Console
 */
console.AZM = {};

/**
 * Alternate console methods for AZM_Lib
 * 
 * Provides context for AZM when imported into another projects. Helps isolate where to troubleshoot your project.
 */
console.AZM.log = function (...args) { console.log('[AZM.log]:', ...args); };
console.AZM.info = function (...args) { console.info('[AZM.info]:', ...args); };
console.AZM.warn = function (...args) { console.warn('[AZM.warn]:', ...args); };
console.AZM.error = function (...args) { console.error('[AZM.error]:', ...args); };

/**
 * Checks the OS of the device to see validate minimum requirements
 * 
 * on the device or not
 * @parameter { String } minimumOs - Numeric RoomOS Number separated by dots
 * 
 * @example ```check4_Minimum_Version_Required(11.1.1.0);```
 * 
 * @xapi [xStatus SystemUnit Software Version](https://roomos.cisco.com/xapi/Status.SystemUnit.Software.Version/)
 * 
 * @returns boolean
 */
async function check4_Minimum_Version_Required(minimumOs) {
  const reg = /^\D*(?<MAJOR>\d*)\.(?<MINOR>\d*)\.(?<EXTRAVERSION>\d*)\.(?<BUILDID>\d*).*$/i;
  const minOs = minimumOs;
  const os = await xapi.Status.SystemUnit.Software.Version.get();
  const x = (reg.exec(os)).groups;
  const y = (reg.exec(minOs)).groups;
  if (parseInt(x.MAJOR) > parseInt(y.MAJOR)) return true;
  if (parseInt(x.MAJOR) < parseInt(y.MAJOR)) return false;
  if (parseInt(x.MINOR) > parseInt(y.MINOR)) return true;
  if (parseInt(x.MINOR) < parseInt(y.MINOR)) return false;
  if (parseInt(x.EXTRAVERSION) > parseInt(y.EXTRAVERSION)) return true;
  if (parseInt(x.EXTRAVERSION) < parseInt(y.EXTRAVERSION)) return false;
  if (parseInt(x.BUILDID) > parseInt(y.BUILDID)) return true;
  if (parseInt(x.BUILDID) < parseInt(y.BUILDID)) return false;
  return false;
}

function filterEthernetZoneMap(data, connectorId) {
  const result = [];
  for (const key in data) {
    if (data[key].ConnectorId == connectorId) {
      result.push(data[key]);
    }
  }
  return result;
}

/**
 * Creates new Debug Function that respects AZM_DebugFlags
 * 
 * This is used to tailor logs, to make sure only relevant context is active in a standard deployment
 * 
 * @see AZM_DebugFlags
 */
function createDebugMethod(methodName, debugFlag) {
  return function (...args) {
    if (AZM_DebugFlags[debugFlag]) {
      console.debug(`[AZM.${methodName}]:`, ...args);
    }
  };
}

/**
 * Loops through AZM_DebugFlags to instantiate new console.AZM[X] debug nodes
 * 
 * @see AZM_DebugFlags
 */
function buildDebugFlagLogLevels() {
  let list = Object.getOwnPropertyNames(AZM_DebugFlags);
  list.forEach(element => { console.AZM[element] = createDebugMethod(element, element); });
}

/**
 * Enables a time based subscription
 * 
 * @param timeOfDay: Hour and Minute for event to fire. 24hr format. Ex: 00:00
 * @param day: Day of Week to for event to fire. Ex: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
 * @param callBack: produces a callback. This triggers the event necessary to execute other code
 */
function Schedule(timeOfDay = '00:00', day, callBack) {
  const dayToNumber = { "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5, "saturday": 6, "sunday": 7 };

  const [configuredHour, configuredMinute] = timeOfDay.replace('.', ':').split(':');

  const now = new Date();
  const thisDay = now.getDay();

  const parseNow = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  let difference = parseInt(configuredHour) * 3600 + parseInt(configuredMinute) * 60 - parseNow;
  if (difference <= 0) {
    difference += 24 * 3600
  };
  return setTimeout(function () {
    if (thisDay == dayToNumber[day.toLowerCase()]) {
      const message = { Message: `[${timeOfDay}] Scheduled event fired` }
      callBack(message)
    }
    setTimeout(function () {
      Schedule(timeOfDay, day, callBack)
    }, 1000)
  }, difference * 1000);
}

/**
 * Contains All functions associated to automatic update process, excluding UI elements
 */
const automaticUpdates = {
  /**
   * Compares current AZM version running against incoming version from update process
   * 
   * Versions contain a major, minor and build versions separated by dots.
   * 
   * @param {string} currentVersion
   * The current version of the AZM Library Running
   * 
   * @param {string} incomingVersion
   * The version of the AZM library reported by the manifest on Github
   * 
   * @example  automaticUpdates.CompareAZMVersion('1.0.0', '1.0.1');
   */
  CompareAZMVersion: function (currentVersion, incomingVersion) {
    const parseVersion = (version) => version.split('.').map(Number);

    const [currentMajor, currentMinor, currentBuild] = parseVersion(currentVersion);
    const [incomingMajor, incomingMinor, incomingBuild] = parseVersion(incomingVersion);

    if (incomingMajor > currentMajor) {
      return "Higher";
    } else if (incomingMajor < currentMajor) {
      return "Lower";
    } else if (incomingMinor > currentMinor) {
      return "Higher";
    } else if (incomingMinor < currentMinor) {
      return "Lower";
    } else if (incomingBuild > currentBuild) {
      return "Higher";
    } else if (incomingBuild < currentBuild) {
      return "Lower";
    } else {
      return "Match";
    }
  },

  /**
   * Parses headers from a request to github to discover the location URL
   * 
   * @param {object} headers
   * The headers from a 302 redirect response code from Github
   */
  GetReleaseLocationUrl: function (headers) {
    const locationHeader = headers.find(header => header.Key === 'location');

    return locationHeader ? locationHeader.Value : null;
  },
  /** Initiates the update process utilizing the github releases API
   * 
   * @see  automaticUpdates.GetReleaseLocationUrl()
   * @see automaticUpdates.CompareAZMVersion()
   * 
   * @xapi [xCommand HttpClient Get](https://roomos.cisco.com/xapi/Command.HttpClient.Get/)
   */
  StartUpdateProcess: async function () {

    if (config_AutomaticUpdates_Mode.toLowerCase() == 'off') {
      await removeAZMNotifications()
      return;
    } else {
      await buildAZMNotifications();
      await updateAZMUpdateStatusUIExtension(`Checking for AZM File Updates...`, '- - -');
    }

    let newAZMMacro = undefined;

    let manifest = {};

    let releaseFileUrl = {
      AZM_Lib: '',
      manifest: ''
    }

    // First get latest release information from github
    // Parse the information to grab the download URLs for both the AZM Lib and Manifest
    try {
      const requestRelease = await xapi.Command.HttpClient.Get({
        Url: `https://api.github.com/repos/ctg-tme/audio-zone-manager-library-macro/releases/latest`
      })

      const releaseManifest = JSON.parse(requestRelease.Body);

      releaseManifest.assets.forEach(item => {
        // Check the name of the asset and assign the URL accordingly
        switch (item.name) {
          case 'AZM_Lib.js':
            releaseFileUrl.AZM_Lib = item.browser_download_url;
            break;
          case 'manifest.json':
            releaseFileUrl.manifest = item.browser_download_url;
            break;
          default:
            break;
        }
      });
    } catch (e) {
      await updateAZMUpdateStatusUIExtension(`Uh-Oh! Unable to reach Github. Installed Version: v${version}. Check the Macro Console for more information`, '- - -');
      let err = {
        Context: `Unable to fetch intial releases URL`,
        ...e
      }
      console.AZM.warn(err)
    }

    // Then use the manifest Download Link to get the source information into a buffer
    // Parse the JSON in this file and validate the AZM Version against the Macro, the RoomOS Version against the Device and check for MTR compatibility
    try {
      let request = await xapi.Command.HttpClient.Get({ Url: releaseFileUrl.manifest });
    } catch (e) {
      if (parseInt(e.data.StatusCode) == 302) {
        const rawFileUrl = automaticUpdates.GetReleaseLocationUrl(e.data.Headers)
        const subRequest = await xapi.Command.HttpClient.Get({
          Url: rawFileUrl
        })
        manifest = JSON.parse(subRequest.Body)
      } else {
        await updateAZMUpdateStatusUIExtension(`Uh-Oh! Unable to reach Github. Installed Version: v${version}. Check the Macro Console for more information`, '- - -');
        let err = {
          Context: `Unable to fetch manifest URL`,
          ...e
        }
        console.AZM.warn(err)
      }
    }

    const isNewAZMVersionAvailable = automaticUpdates.CompareAZMVersion(version, manifest.version)
    const isRoomOSVersionCompatible = await check4_Minimum_Version_Required(manifest.roomos)

    if (!isRoomOSVersionCompatible) {
      let msg = `Unable to install new AZM Update. New AZM version [${manifest.version}] requires RoomOS version [${manifest.roomos}] or newer`
      await updateAZMUpdateStatusUIExtension(msg, manifest.description);
      return
    }

    switch (isNewAZMVersionAvailable) {
      case 'Higher':
        switch (config_AutomaticUpdates_Mode.toLowerCase()) {
          // case 'on':
          // Fun Fact :) By mimicking the process where I parse the Manifest file, you can reach out and download a copy of the new AZM Release and append it to a variable
          // Then using the following xAPI Commands
          //   - [xCommand Macros Macro Save](https://roomos.cisco.com/xapi/Command.Macros.Macro.Save/)
          //   - [xCommand Macros Macro Activate](https://roomos.cisco.com/xapi/Command.Macros.Macro.Activate/)
          //   - [xCommand Macros Runtime Restart](https://roomos.cisco.com/xapi/Command.Macros.Runtime.Restart/)
          //
          //   You can automatically install the latest release directly from Github!
          //
          //   Just be sure to parse the config that exists in the running version of AZM and merge that into the downloaded copy
          // break;
          case 'monitor':
            await buildAZMNotifications();
            let msg = `AZM Update Available. Installed Version: v${version} || New Version v${manifest.version}. Go to the AZM Github to grab a copy.`
            await updateAZMUpdateStatusUIExtension(msg, manifest.description);            
            console.AZM.info(`View AZM Releases -> https://github.com/ctg-tme/audio-zone-manager-library-macro/releases`)
            console.AZM.info(`Download the Latest AZM Release -> ${releaseFileUrl.AZM_Lib}`)
            break;
          default:
            console.AZM.warn(`config_AutomaticUpdates_Mode [${config_AutomaticUpdates_Mode}] is not defined, try changing this value to Monitor or Off`)
            break;
        }
        break;
      case 'Lower':
        updateAZMUpdateStatusUIExtension(`Installed Version [v${version}] is greater than the one available on github [v${manifest.version}]`, `No Description Available (You might be running an unreleased version or a fork)`);        
        console.AZM.info(`View AZM Releases -> https://github.com/ctg-tme/audio-zone-manager-library-macro/releases`)
        console.AZM.info(`Download the Latest AZM Release -> ${releaseFileUrl.AZM_Lib}`)
        break;
      case 'Match':
        await updateAZMUpdateStatusUIExtension(`Installed Version: v${version}. You're up to date!`, manifest.description);
        break;
    }
    console.AZM.info(`View AZM Documentation -> https://github.com/ctg-tme/audio-zone-manager-library-macro/tree/main`);
  }
}

/**
 * Builds Audio Zone Notifications Panel
 * 
 * @param manualButton: `Not Implemented` if true, spawns a Manual Update button
 * 
 * @see azmnotifyPanelId
 * @see automaticUpdates
 * 
 * @xapi [xCommand UserInterface Extensions Panel Save](https://roomos.cisco.com/xapi/Command.UserInterface.Extensions.Panel.Save/)
 */
async function buildAZMNotifications(manualButton = false) {
  const xml = `<Extensions>
  <Panel>
    <Order>99</Order>
    <Location>ControlPanel</Location>
    <Icon>Microphone</Icon>
    <Name>Audio Zone Manager Notifications</Name>
    <ActivityType>Custom</ActivityType>
    <Page>
      <Name>AZM Notifications</Name>
      <Row>
        <Name>Update Status</Name>
        <Widget>
          <WidgetId>azm_notify~notifications~UpdateStatus</WidgetId>
          <Name>Installed Version: v${version}</Name>
          <Type>Text</Type>
          <Options>size=4;fontSize=small;align=left</Options>
        </Widget>
        ${manualButton ? `<Widget>
          <WidgetId>azm_notify~notifications~ManualUpdate</WidgetId>
          <Name>Manual Update</Name>
          <Type>Button</Type>
          <Options>size=2</Options>
        </Widget>` : ''}
      </Row>
      <Row>
        <Name>Update Description</Name>
        <Widget>
          <WidgetId>azm_notify~notifications~UpdateDescription</WidgetId>
          <Name>- - -</Name>
          <Type>Text</Type>
          <Options>size=4;fontSize=small;align=left</Options>
        </Widget>
      </Row>
      <PageId>azm_notify~notifications</PageId>
      <Options/>
    </Page>
  </Panel>
</Extensions>`
  await xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: azmnotifyPanelId }, xml)
}

/**
 * Removes Audio Zone Notifications Panel
 * 
 * @see azmnotifyPanelId
 * @see automaticUpdates
 * 
 * @xapi [xCommand UserInterface Extensions Panel Remove](https://roomos.cisco.com/xapi/Command.UserInterface.Extensions.Panel.Remove/)
 */
async function removeAZMNotifications() {
  await xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: azmnotifyPanelId }).catch(e => e)
}

/**
 * Builds Audio Zone Notifications Panel
 * 
 * @param status: Sets the status under the AZM Notifications Panel, and prints to the console
 * @param description: Sets the description under the AZM Notifications Panel, and prints to the console
 * 
 * @see azmnotifyPanelId
 * @see automaticUpdates
 * 
 * @xapi [xCommand UserInterface Extensions Widget SetValue](https://roomos.cisco.com/xapi/Command.UserInterface.Extensions.Widget.SetValue/)
 */
async function updateAZMUpdateStatusUIExtension(status = '...', description) {
  console.AZM.warn({ UpdateStatus: status, Description: description });
  await xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'azm_notify~notifications~UpdateStatus', Value: status });
  await xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'azm_notify~notifications~UpdateDescription', Value: description });
}

/**
 * Sets Audio Thresholds per Audio Bucket
 * 
 * Thresholds are assigned either by Zone or Globally
 * 
 * @param zoneId: The Zone Identifier, used to pull threshold configuration information
 * @param audioConfiguration: The provided Audio Configuration
 * @param bucketType: Used for logging
 * 
 * @see AZM.Command.Zone.Setup(AudioConfiguration)
 */
function setBucketAudioThresholds(zoneId, audioConfiguration, bucketType) {
  let lowThresh;
  let highThresh;

  if (audioConfiguration.Settings.GlobalThreshold.Mode.toLowerCase() == 'on') {
    lowThresh = audioConfiguration.Settings.GlobalThreshold.Low.clone();
    highThresh = audioConfiguration.Settings.GlobalThreshold.High.clone();
    console.AZM[`${bucketType}_BucketDebug`](`Global Threshold set on ZoneId [${zoneId}] || ConnectorType [${bucketType}] || Thresholds >> High [${highThresh}] || Low [${lowThresh}]`);
    return { High: highThresh, Low: lowThresh };
  }

  if (parseInt(audioConfiguration.Zones[zoneId - 1].Independent_Threshold.Low) > 0 || parseInt(audioConfiguration.Zones[zoneId - 1].Independent_Threshold.High) > 0) {
    lowThresh = audioConfiguration.Zones[zoneId - 1].Independent_Threshold.Low.clone();
    highThresh = audioConfiguration.Zones[zoneId - 1].Independent_Threshold.High.clone();
    console.AZM[`${bucketType}_BucketDebug`](`Independent Threshold set on ZoneId [${zoneId}] || ConnectorType [${bucketType}] || Thresholds >> High [${highThresh}] || Low [${lowThresh}]`);
    return { High: highThresh, Low: lowThresh };
  }

  if (audioConfiguration.Zones[zoneId - 1].Independent_Threshold.High == undefined || audioConfiguration.Zones[zoneId - 1].Independent_Threshold.Low == undefined) {
    if (audioConfiguration.Settings.GlobalThreshold.Low != undefined || audioConfiguration.Settings.GlobalThreshold.High != undefined) {
      lowThresh = audioConfiguration.Settings.GlobalThreshold.Low.clone();
      highThresh = audioConfiguration.Settings.GlobalThreshold.High.clone();
      console.AZM[`${bucketType}_BucketDebug`](`Independent Threshold not found, reverting to Global Threshold set on ZoneId [${zoneId}] || ConnectorType [${bucketType}] || Thresholds >> High [${highThresh}] || Low [${lowThresh}]`);
      return { High: highThresh, Low: lowThresh };
    } else {
      throw new AZM_Error(JSON.stringify({ message: `High and Low Thresholds not defined on [${bucketType}] bucket`, ZoneId: zoneId }));
    }
  }

  throw new AZM_Error(JSON.stringify({ message: `Unable to set Audio Thresholds on [${bucketType}] bucket`, ZoneId: zoneId }));
}

/**
 * Processes the incoming dataset and returns a Sum, Average, Peak and Raw Data set
 * 
 * @param {Array} dataset
 * Set of audio values to be process
 * 
 * @returns {object} Average, Peak, SampleSet
*/
function Process_BIN_Data(dataset) {
  if (dataset == undefined) {
    throw new AZM_Error(JSON.stringify({ AZM_Error: `Unable to evaluate microphone VuMeter Data`, Cause: `Undefined Dataset: [${dataset}]` }))
  }
  const sum = dataset.reduce((acc, value) => parseInt(acc) + parseInt(value), 0);
  const avg = Math.round((sum / AudioConfiguration.Settings.Sample.Size))
  const peak = Math.max(...dataset);
  return { Average: avg, Peak: peak, Sample: dataset.clone() }
}

/**
 * Searches peripherals list for microphones with matching serials
 * 
 * @param {string} serial
 * The serial address to search for
 * 
 * @returns {string} streamName or null
 * 
 * @xapi [xStatus Peripherals ConnectedDevice](https://roomos.cisco.com/xapi/search?search=Status+Peripherals+ConnectedDevice+*&Type=Status)
 */
async function discoverEthernetStreamNameBySerial(serial) {
  const peripherals = await xapi.Status.Peripherals.ConnectedDevice.get()

  // LULA EDITS FOR DWS BLUEPRINT
  const streamName = peripherals.find(item => item.Type === 'AudioMicrophone' && item.SerialNumber === serial);

  return streamName ? streamName.ID : null;
}

/**
 * Searches Available ethernet microphone streamnames and maps Ethernet Connector Id to Audio Zone Config
 * 
 * AES67 Microphones requires a StreamName to be provided in the config object on setup
 * 
 * Cisco Ethernet microphones require a Serial address or their streamname in the config object on setup
 * 
 * @see AZM.Command.Zone.Setup();
 * 
 * @xapi [xStatus Audio Input Connectors Ethernet](https://roomos.cisco.com/xapi/search?search=Status+Audio+Input+Connectors+Ethernet+*&Type=Status)
 * 
 */
async function Append_Ethernet_ConnectorId_By_StreamName() {
  const mics = await xapi.Status.Audio.Input.Connectors.Ethernet.get();

  for (let index = 0; index < AudioConfiguration.Zones.length; index++) {
    const zone = AudioConfiguration.Zones[index];

    if (zone.MicrophoneAssignment.Type.toLowerCase() == 'ethernet' || zone.MicrophoneAssignment.Type.toLowerCase() == 'aes67') {
      for (let i = 0; i < zone.MicrophoneAssignment.Connectors.length; i++) {
        const conx = zone.MicrophoneAssignment.Connectors[i];

        if ((conx?.Serial == '' && conx?.Serial != undefined) || (conx?.StreamName == '' && conx?.StreamName == undefined)) {
          checkZoneSetup(`Zone Index [${index}] has an invalid Ethernet Microphone Configuration`);
        }

        let serialMatchList = {};
        let streamNameMatchList = {};
        for (const mic of mics) {
          if (mic.StreamName == conx.StreamName) {
            console.AZM.SetupDebug(`StreamName match on Zone Index [${index}], assigning Ethernet ConnectorId [${parseInt(mic.id)}] to Audio Zone Configuration`);
            AudioConfiguration.Zones[index].MicrophoneAssignment.Connectors[i].Id = parseInt(mic.id);
            streamNameMatchList[conx.StreamName] = 'found'
          } else {
            if (streamNameMatchList[conx.StreamName] != 'found') {
              if (conx.StreamName) {
                streamNameMatchList[conx.StreamName] = 'missing'
              }
            }
            const streamName = await discoverEthernetStreamNameBySerial(conx.Serial);

            if (mic.StreamName == streamName) {
              console.AZM.SetupDebug(`StreamName match by Serial Lookup on Zone Index [${index}], assigning Ethernet ConnectorId [${parseInt(mic.id)}] to Audio Zone Configuration`);
              AudioConfiguration.Zones[index].MicrophoneAssignment.Connectors[i].Id = parseInt(mic.id);
              serialMatchList[conx.Serial] = 'found';
              streamNameMatchList[conx.StreamName] = 'found';
            } else {
              if (serialMatchList[conx.Serial] != 'found') {
                if (conx.Serial) {
                  serialMatchList[conx.Serial] = 'missing';
                }
              }
            }
          }
        }
        const micSerialList = Object.keys(serialMatchList)
        const micStreamNameList = Object.keys(streamNameMatchList)
        micSerialList.forEach(element => {
          if (serialMatchList[element] == 'missing') {
            throw new AZM_Error(`Unable to find a Serial Match for [Ethernet] Microphone [${element}, please review the config object you passed into the AZM.Command.Zone.Setup() function`)
          }
        })
        micStreamNameList.forEach(element => {
          if (streamNameMatchList[element] == 'missing') {
            throw new AZM_Error(`Unable to find a StreamName Match for [AES67] Microphone [${element}], please review the config object you passed into the AZM.Command.Zone.Setup() function`)
          }
        })
      }
    }
  }
}

/** Parses Audio Configuration and builds a list of audio input connector IDs
 * 
 * This list removes any duplicate values
 * 
 * @returns array of connector IDs by type
 * 
 * @see AZM.Command.Zone.Monitor.Start()
 * @see AZM.Command.Zone.Monitor.Stop()
*/
function discover_Audio_Connector_Info() {
  console.AZM.SetupDebug('Starting Audio Connector Info Discovery')
  let connector_Id_Arr = []
  AudioConfiguration.Zones.forEach((element) => {
    element.MicrophoneAssignment.Connectors.forEach(el => {
      connector_Id_Arr.push({ Id: el.Id, Type: element.MicrophoneAssignment.Type })
    })
  })
  connector_Id_Arr = [...new Set(connector_Id_Arr)];
  connector_Id_Arr = connector_Id_Arr.sort(function (a, b) { return a - b; });
  console.AZM.SetupDebug(`Audio Connector Discovery Id Complete. Discovered Connections > [${JSON.stringify(connector_Id_Arr)}]`)
  return connector_Id_Arr
}

/** Parses Audio Configuration and builds a list of audio input connector types
 * 
 * @returns {Array} connector types
 * 
 * @see AZM.Event.TrackZones()
 * @see AZM.Command.Zone.Setup()
*/
function discover_Audio_Connector_Types() {
  console.AZM.SetupDebug('Starting Audio Connector Type Discovery')
  let connector_Type_Arr = []
  AudioConfiguration.Zones.forEach((element) => {
    connector_Type_Arr.push(element.MicrophoneAssignment.Type.toLowerCase())
  })
  connector_Type_Arr = [...new Set(connector_Type_Arr)];
  connector_Type_Arr = connector_Type_Arr.sort(function (a, b) { return a - b; });
  console.AZM.SetupDebug(`Audio Connector Discovery Type Complete. Discovered Types > [${connector_Type_Arr.toString()}]`)
  return connector_Type_Arr
}


/** This function evaluates the ZoneSetupStatus
    If this Status is false, it will throw an error with context to point
      a developer in the right direction to resolve a conflict with the Audio Setup
*/
function checkZoneSetup(error) {
  if (!ZoneSetupStatus) {
    throw new AZM_Error(JSON.stringify({ AZM_Error: error, Cause: 'AZM Requires an Audio Configuration to be passed into the AZM.Command.Zone.Setup() function', Tip: 'Follow the AZM Guide for proper use' }))
  }
  return
}

/** This function evaluates the Audio Configuration and
    instantiates all classes needed to track our audio data cleanly
  
    Both the Zone_Tracker and [Type]_Bucket classes are instantiates here
    into their appropriate objects for later use
  
    This if called when AZM.Audio.Zone.Setup(AudioConfiguration) is run
*/
function Instantiate_Audio_Zones_And_Buckets() {
  AudioConfiguration.Zones.forEach((element, index) => {
    if (AudioConfiguration.Zones[index].Label == undefined || AudioConfiguration.Zones[index].Label == '') {
      AudioConfiguration.Zones[index].Label = `ZoneIndex_${index}`
    }
    AudioConfiguration.Zones[index]['id'] = index + 1;
    console.AZM.SetupDebug(`Appending Zone Id [${index + 1}] to [${AudioConfiguration.Zones[index].Label}] || ZoneIndex: ${index}`)
    AZM.Status.Audio.Zone[element.id] = new Zone_Tracker(element.id, element.Label, element.MicrophoneAssignment.Type, element.Assets)
    switch (element.MicrophoneAssignment.Type.toLowerCase()) {
      case 'ethernet': case 'aes67':
        element.MicrophoneAssignment.Connectors.forEach(eth => {
          let ethZoneMapId = `${element.id}:${eth.Id}`;
          zoneConnectorMap.Ethernet.push(ethZoneMapId);
          AudioBucket.Ethernet[ethZoneMapId] = new Ethernet_Bucket(eth.Id, eth.SubId, element.id, element.Label, element.Assets);
          console.AZM.SetupDebug(`Zone [${element.id}] Instantiated; Type [${AudioBucket.Ethernet[ethZoneMapId].audioConnectorType}]: `, AudioBucket.Ethernet[ethZoneMapId])
          AZM.Status.Audio.Zone[element.id].addConnector(eth.Id, AudioBucket.Ethernet[ethZoneMapId].State, element.id);
        })
        break;
      case 'microphone': case 'analog':
        element.MicrophoneAssignment.Connectors.forEach(ano => {
          AudioBucket.Analog[ano.Id] = new Analog_Bucket(ano.Id, element.id, element.Label, element.Assets);
          console.AZM.SetupDebug(`Zone [${element.id}] Instantiated; Type [${AudioBucket.Analog[ano.Id].audioConnectorType}]: `, AudioBucket.Analog[ano.Id])
          AZM.Status.Audio.Zone[element.id].addConnector(ano.Id, AudioBucket.Analog[ano.Id].State, element.id);
        })
        break;
      case 'usb':
        element.MicrophoneAssignment.Connectors.forEach(usb => {
          AudioBucket.USB[usb.Id] = new USB_Bucket(usb.Id, element.id, element.Label, element.Assets);
          console.AZM.SetupDebug(`Zone [${element.id}] Instantiated; Type [${AudioBucket.USB[usb.Id].audioConnectorType}]: `, AudioBucket.USB[usb.Id])
          AZM.Status.Audio.Zone[element.id].addConnector(usb.Id, AudioBucket.USB[usb.Id].State, element.id);
        })
        break;
      case 'externalvumeter':
        element.MicrophoneAssignment.Connectors.forEach(extV => {
          AudioBucket.ExternalVuMeter[extV.Id] = new ExternalVuMeter_Bucket(extV.Id, element.id, element.Label, element.Assets, element.ControllerId);
          console.AZM.SetupDebug(`Zone [${element.id}] Instantiated; Type [${AudioBucket.ExternalVuMeter[extV.Id].audioConnectorType}]: `, AudioBucket.ExternalVuMeter[extV.Id])
          AZM.Status.Audio.Zone[element.id].addConnector(extV.Id, AudioBucket.ExternalVuMeter[extV.Id].State, element.id);
        })
        break;
      case 'externalgate':
        element.MicrophoneAssignment.Connectors.forEach(extG => {
          AudioBucket.ExternalGate[extG.Id] = new ExternalGate_Bucket(extG.Id, element.id, element.Label, element.Assets, element.ControllerId);
          console.AZM.SetupDebug(`Zone [${element.id}] Instantiated; Type [${AudioBucket.ExternalGate[extG.Id].audioConnectorType}]: `, AudioBucket.ExternalGate[extG.Id])
          AZM.Status.Audio.Zone[element.id].addConnector(extG.Id, AudioBucket.ExternalGate[extG.Id].State, element.id);
        })
        break;
      default:
        //Throw Error on unknown Microphone Assignment Type
        throw new AZM_Error(JSON.stringify({ message: `Audio Connector Type [${element.MicrophoneAssignment.Type}] not accepted`, AllowedTypes: allowedAudioTypes }))
    }
  })
}

/**
 * Will collect and store the previous value for Ethernet SubId events
 * 
 * Then fill missing SubId information with 0
 * 
 * This ensures SubID processing on Ethernet Input connectors say in sync
 * 
 * @see AZM.Event.TrackZones.on(callback)
 * @link [xEvent Audio Input Connectors Ethernet](https://roomos.cisco.com/xapi/Event.Audio.Input.Connectors/)
*/
function Normalize_Ethernet_Audio_Data(payload) {
  const { SubId, id } = payload;
  if (!Ethernet_SubId_Backfill[id]) {
    Ethernet_SubId_Backfill[id] = {};
  }

  for (let i = 1; i <= 8; i++) {
    const subId = i.toString();

    const idExists = SubId.some(item => item.id === subId);

    if (!idExists) {
      const previousSample = Ethernet_SubId_Backfill[id][subId];

      if (previousSample) {
        SubId.push({ ...previousSample, id: subId });
      } else {
        SubId.push({ LoudspeakerActivity: '0', NoiseLevel: '0', PPMeter: '0', VuMeter: '0', id: subId, });
      };
    };
  };

  SubId.sort((a, b) => parseInt(a.id, 10) - parseInt(b.id, 10));

  Ethernet_SubId_Backfill[id] = SubId.reduce((acc, item) => {
    acc[item.id] = { ...item };
    delete acc[item.id].id;
    return acc;
  }, {});

  return { SubId, id, };
}

/**
 * Safely subscribes to external data events
 * 
 * This ensures only 1 message send event is subscribed to, if using multiple types in a scope
 * 
 * @see ExternalVuMeter_Bucket
 * @see ExternalGate_Bucket
 * @xapi [xEvent Message Send](https://roomos.cisco.com/xapi/Event.Message.Send/)
 */
function startExternalSubscription(callBack) {
  startExternalSubscription = function () {
    console.AZM.SetupDebug('Stopped Duplicate External subscription from activating')
  }
  xapi.Event.Message.Send.on(extEvent => {
    console.AZM.MessageSendEvent_Debug('Raw Message Send Text:', extEvent.Text)
    if (extEvent.Text.includes(`"Service":"AudioZoneManager"`)) {

      let payload = '';
      try {
        payload = JSON.parse(extEvent.Text)
        if (payload.Service == 'AudioZoneManager') {
          console.AZM.MessageSendEvent_Debug(`Passing Message Send payload into [${payload.SourceType}], Payload:`, payload);
          try {
            switch (payload.SourceType.toLowerCase()) {
              case 'externalvumeter':
                if (AudioBucket.ExternalVuMeter[payload.MicrophoneId].ControllerId == payload.ControllerId) {
                  AudioBucket.ExternalVuMeter[payload.MicrophoneId].run(payload.VuMeter, callBack);
                } else {
                  console.AZM.MessageSendEvent_Debug(`Unknown External ControllerId [${payload.ControllerId}] sent payload:`, JSON.stringify(payload))
                }
                break;
              case 'externalgate':
                if (AudioBucket.ExternalGate[payload.MicrophoneId].ControllerId == payload.ControllerId) {
                  AudioBucket.ExternalGate[payload.MicrophoneId].run(payload.Gate, callBack);
                } else {
                  console.AZM.MessageSendEvent_Debug(`Unknown External ControllerId [${payload.ControllerId}] sent payload:`, JSON.stringify(payload))
                }
                break;
            }
          } catch (e) {
            if (e != `TypeError: cannot read property 'ControllerId' of undefined`) {
              console.AZM.error(e)
            } else {
              console.AZM.MessageSendEvent_Debug(`Unknown External MicrophoneId [${payload.MicrophoneId}] sent in payload:`, JSON.stringify(payload))
            }
          }
        }
      } catch (e) {
        let err = {
          Context: `AZM service detected in External Payload but failed to parse`,
          Tip: 'Make sure to prepare your external payload as a Stringified JSON Object',
          IncomingPayload: extEvent,
          ...e
        }
        console.AZM.errror(err)
      }
    }
  });
  console.AZM.info(`Subscription started for [xapi.Event.Message.Send] => Used for External Audio Data`);
};

/*****[Exported Function Objects]***********************************************************/

AZM.Command.Zone.Setup = async function (AudioZoneInfo) {
  buildDebugFlagLogLevels();
  console.AZM.info('Initializing Audio Zone Manager (AZM_Lib)...')
  if (AudioZoneInfo.Settings == undefined || AudioZoneInfo.Zones == undefined) {
    checkZoneSetup('Audio Configuration Object not Provided or Formatted Properly')
  }

  //Checks to see if the Voice Activity Detection object is available in the Audio Settings
  if ('VoiceActivityDetection' in AudioZoneInfo.Settings) {
    switch (AudioZoneInfo.Settings.VoiceActivityDetection.toString().toLowerCase()) {
      case 'true': case 'on':
        allowVoiceActivityDetection = true;
        AZM.Status.VoiceActivity = false;
        break;
      case 'false': case 'off':
        allowVoiceActivityDetection = false;
        break;
      default:
        break;
    }
  }

  // Verify that RoomOS is up to date to allow for voice activity detection
  if (allowVoiceActivityDetection) {
    const voiceDetectOSminimum = await check4_Minimum_Version_Required('11.16.1.1');

    if (!voiceDetectOSminimum) {
      console.AZM.warn({ Message: `Unable to start VoiceActivityDetection.`, Cause: 'Path Not Found', Action: 'Disabling VoiceActivityDetection', MinimumRoomOS: '11.16.1.X', xApiDoc: 'https://roomos.cisco.com/xapi/Status.Audio.Microphones.VoiceActivityDetector.Activity/' })
      allowVoiceActivityDetection = false;
    } else {      
      console.AZM.info(`AudioZoneInfo.Settings.VoiceActivityDetection is [${voiceDetectOSminimum ? 'Enabled' : 'Disabled'}], setting xConfig Audio Microphones VoiceActivityDetector Mode to 'On'`)
      await xapi.Config.Audio.Microphones.VoiceActivityDetector.Mode.set('On');
    }
  }

  if ('Mode' in AudioZoneInfo.Settings.Sample) {
    switch (AudioZoneInfo.Settings.Sample.Mode.toLowerCase()) {
      case 'snapshot': case 'segment': case 'segmented':
        audioSamplingMode = 'Snapshot'
        break;
      case 'rolling': case 'roll':
        audioSamplingMode = 'Rolling'
        break;
      default:
        console.AZM.warn(`Unidentified Processing Profile detected in script [${AudioZoneInfo.Settings.Sample.Mode}]. Setting Default: Snapshot`);
        break;
    }
  }

  console.AZM.info(`Audio Sample Mode [${audioSamplingMode}]`)

  //Clone the Audio Configuration Object passed to us
  AudioConfiguration = AudioZoneInfo.clone();

  //Assign ConnectorIds to any ethernet microphones within scope
  const micTypes = discover_Audio_Connector_Types();

  if (micTypes.includish('ethernet') || micTypes.includish('aes67')) {
    await Append_Ethernet_ConnectorId_By_StreamName();
  }

  //Instantiate Audio Zone and Bucket Classes
  Instantiate_Audio_Zones_And_Buckets();

  //Set ZoneSetupStatus true, to allow developer access to the libraries tools
  ZoneSetupStatus = true;

  if (config_AutomaticUpdates_Mode.toLocaleLowerCase() != 'off') {

    console.AZM.info(`AZM Update Checks set to [${config_AutomaticUpdates_Mode}] and will commence every [${config_AutomaticUpdates_Schedule_Day}] at [${config_AutomaticUpdates_Schedule_Time}].`)

    const httpClient = await xapi.Config.HttpClient.get()

    if (httpClient.Mode.toLowerCase() == 'off') {
      console.AZM.warn(`Enabling HTTPClient Mode for AZM Automatic Updates in order to reach out to Github`);
      await xapi.Config.HttpClient.Mode.set('On');
    }

    const dayList = [...new Set(config_AutomaticUpdates_Schedule_Day)];

    dayList.forEach(element => {
      Schedule(config_AutomaticUpdates_Schedule_Time, element, async () => {
        await automaticUpdates.StartUpdateProcess();
      })
      console.AZM.SetupDebug(`AZM Update Checks scheduled for [${element}] at [${config_AutomaticUpdates_Schedule_Time}]`);
    })
  }
  console.AZM.info(`AZM Ready! Version: [${version}]`);
};

AZM.Command.Zone.Monitor.Start = async function (cause = undefined) {
  checkZoneSetup('Failed to Start Zone Monitor')

  // LULA EDITS FOR DWS BLUEPRINT
  if (AudioConfiguration.Settings?.GlobalSampleMode)
  {
    const inputConnectors = discover_Audio_Connector_Info();
    for (let i = 0; i < inputConnectors.length; i++) {
      try {
        console.AZM.MonitorDebug(`Starting Audio Monitor on connector: Type: [${inputConnectors[i].Type}], Id: [${inputConnectors[i].Id}]`)
        let typeFix = ''
        switch (inputConnectors[i].Type.toLowerCase()) {
          case 'ethernet': case 'aes67':
            typeFix = 'Ethernet';
            break;
          case 'analog': case 'microphone':
            typeFix = 'Microphone';
            break;
          case 'usb': case 'usbmicrophone':
            typeFix = 'USBMicrophone'
            break;
          case 'externalvumeter': case 'externalgate':
            typeFix = 'ignore';
            break;
          default:
            break;
        }
        if (typeFix != 'ignore') {
          await xapi.Command.Audio.VuMeter.Start({ ConnectorId: inputConnectors[i].Id, ConnectorType: typeFix, IntervalMs: AudioConfiguration.Settings.Sample.Rate_In_Ms, Source: 'AfterAEC' });
        }
      } catch (e) {
        let err = {
          Context: `Failed to start VuMeter on [${inputConnectors[i].Type}] ConnectorId [${inputConnectors[i].Id}]`,
          ...e
        }
        throw new AZM_Error(err)
      }
    };
  }
  else{
    for (let zone of AudioConfiguration.Zones)
    {
      let typeFix = '';
      switch (zone.MicrophoneAssignment.Type.toLowerCase()) {
        case 'ethernet': case 'aes67':
          typeFix = 'Ethernet';
          break;
        case 'analog': case 'microphone':
          typeFix = 'Microphone';
          break;
        case 'usb': case 'usbmicrophone':
          typeFix = 'USBMicrophone'
          break;
        case 'externalvumeter': case 'externalgate':
          typeFix = 'ignore';
          break;
        default:
          break;
      }

      for(let connector of zone.MicrophoneAssignment.Connectors)
      {
        if (zone?.Independent_Rate)
        {
          console.debug ("AZM: Assigning unique rate",zone.Independent_Rate,"ms to Zone",zone.Label);
          if (typeFix != 'ignore') {
            await xapi.Command.Audio.VuMeter.Start({ ConnectorId: connector.Id, ConnectorType: typeFix, IntervalMs: zone.Independent_Rate, Source: 'AfterAEC' });
          }        
        }
        else{
          // Use Global Rates
          await xapi.Command.Audio.VuMeter.Start({ ConnectorId: connector.Id, ConnectorType: typeFix, IntervalMs: AudioConfiguration.Settings.Sample.Rate_In_Ms, Source: 'AfterAEC' });

          console.debug("AZM: Assigning global rate",AudioConfiguration.Settings.Sample.Rate_In_Ms,"ms to zone",zone.Label);
        }
      }      
    }    
  }
  console.AZM.log(`AZM Monitoring Started${cause ? `. Cause: [${cause}]` : ''}`);
};

AZM.Command.Zone.Monitor.Stop = async function (cause = undefined) {
  checkZoneSetup('Failed to Stop Zone Monitor')
  const inputConnectors = discover_Audio_Connector_Info()
  for (let i = 0; i < inputConnectors.length; i++) {
    console.AZM.MonitorDebug(`Stopping VuMeter on connector: Type: [${inputConnectors[i].Type}], Id: [${inputConnectors[i].Id}]`)
    let typeFix = ''
    switch (inputConnectors[i].Type.toLowerCase()) {
      case 'ethernet': case 'aes67':
        typeFix = 'Ethernet';
        break;
      case 'analog': case 'microphone':
        typeFix = 'Microphone';
        break;
      case 'usb': case 'usbmicrophone':
        typeFix = 'USBMicrophone'
        break;
      case 'externalvumeter': case 'externalgate':
        typeFix = 'externalData';
        break;
      default:
        break;
    }
    if (typeFix != 'externalData') {
      await xapi.Command.Audio.VuMeter.Stop({ ConnectorId: inputConnectors[i].Id, ConnectorType: typeFix });
    }
  };
  console.AZM.log(`AZM Monitoring Started${cause ? `. Cause: [${cause}]` : ''}`);
};

AZM.Command.Zone.List = function () {
  checkZoneSetup(`Unable to list Zones`)
  const zoneList = [];

  for (let i = 0; i < AudioConfiguration.Zones.length; i++) {
    zoneList.push(AZM.Status.Audio.Zone[i + 1].get());
  };

  return zoneList;
};

AZM.Event.TrackZones.on = function (callBack) {
  checkZoneSetup('Unable to subscribe to AZM.Event.TrackZones')
  const types = discover_Audio_Connector_Types()

  types.forEach(element => {
    switch (element.toLowerCase()) {
      case 'ethernet': case 'aes67':
        xapi.Event.Audio.Input.Connectors.Ethernet.on(ethernet_input_event => {
          console.AZM.AudioInputConnectorEvent_Debug(`Raw Audio Ethernet Input Connector Payload:`, ethernet_input_event)
          try {
            const zonesToProcess = filterEthernetZoneMap(AudioBucket.Ethernet, ethernet_input_event.id)

            zonesToProcess.forEach(mappedEthZone => {
              AudioBucket.Ethernet[`${mappedEthZone.ZoneId}:${ethernet_input_event.id}`].run(Normalize_Ethernet_Audio_Data(ethernet_input_event), callBack)
            })
          } catch (e) {
            if (e != `TypeError: cannot read property 'run' of undefined`) {
              console.AZM.error(e)
            }
          }
        })        
        console.AZM.info(`Subscription started for [xapi.Event.Audio.Input.Connectors.Ethernet]`)

        xapi.Status.Audio.Input.Connectors.Ethernet['*'].StreamName.on(async () => {
          if (!AudioConfiguration) {
            return;
          }
          await AZM.Command.Zone.Setup(AudioConfiguration);
        });        
        console.AZM.info(`Subscription started for [xapi.Status.Audio.Input.Connectors.Ethernet['*'].StreamName]`)
        break;
      case 'microphone': case 'analog':
        xapi.Event.Audio.Input.Connectors.Microphone.on(analog_input_event => {
          console.AZM.AudioInputConnectorEvent_Debug(`Raw Audio Analog Input Connector Payload:`, analog_input_event)
          try {
            AudioBucket.Analog[analog_input_event.id].run(analog_input_event, callBack)
          } catch (e) {
            if (e != `TypeError: cannot read property 'run' of undefined`) {
              console.AZM.error(e)
            }
          }
        })        
        console.AZM.info(`Subscription started for [xapi.Event.Audio.Input.Connectors.Microphone]`)
        break
      case 'usb':
        xapi.Event.Audio.Input.Connectors.USBMicrophone.on(usb_input_event => {
          console.AZM.AudioInputConnectorEvent_Debug(`Raw Audio USB Input Connector Payload:`, usb_input_event)
          try {
            AudioBucket.USB[usb_input_event.id].run(usb_input_event, callBack)
          } catch (e) {
            if (e != `TypeError: cannot read property 'run' of undefined`) {
              console.AZM.error(e)
            }
          }
        })        
        console.AZM.info(`Subscription started for [xapi.Event.Audio.Input.Connectors.USBMicrophone]`)
        break;
      case 'externalvumeter': case 'externalgate':
        startExternalSubscription(callBack);
        break;
      default:
        throw new AZM_Error(JSON.stringify({
          AZM_Error: `Unknown Microphone Input Type: [${element}]`,
          AllowedTypes: allowedAudioTypes
        }))
    }
  })

  if (allowVoiceActivityDetection) {
    xapi.Status.Audio.Microphones.VoiceActivityDetector.Activity.on(voiceEvent => {
      AZM.Status.VoiceActivity = voiceEvent.toString().toLowerCase() == 'true' ? true : false;
    });    
  console.AZM.info(`Subscription started for [xapi.Status.Audio.Microphones.VoiceActivityDetector.Activity]`);
  }
};

  console.AZM.info(`Audio Zone Manager Library (AZM_Lib) Documentation -> https://github.com/ctg-tme/audio-zone-manager-library-macro/tree/main`);
  console.AZM.info(`Audio Zone Manager Library (AZM_Lib) Releases -> https://github.com/ctg-tme/audio-zone-manager-library-macro/releases`);

export { AZM };
