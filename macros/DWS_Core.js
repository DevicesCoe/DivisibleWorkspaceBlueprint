/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way 
Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
Robert(Bobby) McGonigle Jr
Chase Voisin
William Mills

Version: 0.9
Released: 03/31/2025

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

import xapi from 'xapi';
import { AZM } from './DWS_AZM_Lib';
import DWS from './DWS_Config';
import SAVED_STATE from './DWS_State';

//======================//
//  REQUIRED VARIABLES  //
//======================//
// PANEL VARIABLES
const DWS_PANEL_ID = 'dws_controls';
let DWS_PANEL;
let DWS_TIMER = 0;
let DWS_INTERVAL = '';
let DWS_AUTOMODE_STATE = DWS.AUTOMODE_DEFAULT;
let DWS_CUR_STATE = '';
let DWS_TEMP_MICS = [];
let DWS_ALL_SEC = [];
let DWS_SEC_PER_COUNT = DWS.SECONDARY_MICS.length;
let DWS_DROP_AUDIENCE = 0;
let DWS_PANDA_STATE = '';

if (DWS.SECONDARY_NAV_SCHEDULER != '') {
  DWS_SEC_PER_COUNT += 2;
} 
else {
  DWS_SEC_PER_COUNT += 1;
}

// AZM GLOBAL SETTINGS
const Settings = {                        
  Sample: {
    Size: 4,                              
    Rate_In_Ms: 400,                      
    Mode: 'Snapshot'                      
  },
  GlobalThreshold: {
    Mode: 'On',                           
    High: DWS.MICS_HIGH,                             
    Low: DWS.MICS_LOW                               
  },
  VoiceActivityDetection: 'On'            
}

//===========================//
//  INITIALIZATION FUNCTION  //
//===========================//
function init() {

  console.log ("DWS: Starting up as Primary Node.");

  // START LINK LOCAL SWITCH REPORTING TO CONTROL HUB
  registerLinkLocal();
  xapi.Config.Peripherals.Profile.ControlSystems.set('1');

  // DRAW ADVANCED HIDDEN PANEL
  xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_advanced' }, PANEL_ADVANCED)
  .then (() =>  {

    // SET DEFAULTS FOR AUDIENCE MIC LEVELS
    xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.get()
    .then (response => {
      if(response == '0')
      {
        // SET THE MIC TO "DISABLED"
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'off', WidgetId: 'dws_mics_audience' });
      }
      else{
        // SET THE MIC TO "ENABLED"
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'on', WidgetId: 'dws_mics_audience' });
      }
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: response, WidgetId: 'dws_edit_level_audience' });
    })

    // SET DEFAULTS FOR PRESENTER MIC LEVELS
    xapi.Config.Audio.Input.USBInterface[1].Level.get()
    .then (response => {
      if(response == '0')
      {
        // SET THE MIC TO "DISABLED"
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'off', WidgetId: 'dws_mics_presenter' });
      }
      else {
        // SET THE MIC TO "ENABLED"
        xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'on', WidgetId: 'dws_mics_presenter' });
      }
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: response, WidgetId: 'dws_edit_level_presenter' });
    })

  })
    .catch(e => console.log('Error saving panel: ' + e.message))

  // PERFORM CHECK ON CURRENTLY SAVED STATE IN CASE OF CODEC / MACRO REBOOT DURING COMBINED STATE
  if (SAVED_STATE.STATE == 'Combined') {
    console.log ('DWS: Combined State Detected. Re-applying Configuration.');

    // SAVE CURRENT STATE
    DWS_CUR_STATE = SAVED_STATE.STATE;

    // INITIALIZE AZM BASED ON SAVED STATE
    startAZM();
    
    // SET THE ROOM STATE TO COMBINED
    createPanels('Combined');
    setTimeout (() => { xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combined' }) }, 300);
    setTimeout (() => { xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value: DWS_AUTOMODE_STATE }) }, 300);
  } 
  else {
    // SET THE DEFAULT ROOM STATE TO SPLIT
    createPanels('Split');
    setTimeout (() => { xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Split' }) }, 300);   
  }

  console.log ("DWS: Initialization Complete.")

  //===================================//
  //  EVENT LISTENER FOR UI EXTENSION  //
  //===================================//
  xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
    if (event.Type == 'released' || event.Type == 'changed') {   
      switch(event.WidgetId)
      {
        case 'dws_cam_state': // LISTEN FOR ENABLE / DISABLE OF AUTOMATIC MODE  
          // SET VIDEO COMPOSITON
          if (event.Value == 'on') 
          {
            console.log("DWS: Automatic Mode Activated.");

            // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

            // DISABLE PRESENTER TRACK
            xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Off' });

            // SET LOCAL SPEAKERTRACK MODE
            xapi.Command.Cameras.SpeakerTrack.Activate();
            xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();

            // ACTIVATE REMOTE SPEAKERTRACK
            sendMessage(DWS.SECONDARY_HOST, "EnableST");

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});
          } 
          else {
            console.log("DWS: Automatic Mode Deactived.");

            // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

            // DISABLE PRESENTER TRACK
            xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Off' });

            // DEACTIVE LOCAL SPEAKERTRACK
            xapi.Command.Cameras.SpeakerTrack.Deactivate();

            // DEACTIVE REMOTE SPEAKERTRACK
            sendMessage(DWS.SECONDARY_HOST, "DisableST");
            
            // TURN OFF PANDA IF ENABLED
            xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});
          }
          break;

        case 'dws_cam_panda': // LISTEN FOR PRESENTER AND AUDIENCE
          DWS_PANDA_STATE = event.Value;

          if (DWS_PANDA_STATE == 'on')
          {
            console.log("DWS: Presenter and Audience Enabled.");
            // SET VIEW TO PRESENTER PTZ ON INPUT 5
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 5});
            xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });

            // SET SPEAKERTRACK TO BACKGROUND MODE
            xapi.Command.Cameras.SpeakerTrack.Activate();
            xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();

            // SET REMOTE SPEAKERTRACK TO BACKGROUND MODE
            sendMessage(DWS.SECONDARY_HOST, "EnableST");

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
          }
          else{
            console.log ('DWS: Presenter and Audience Disabled.');
            // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});
            xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Off' });
          }
          break;

        case 'dws_cam_sxs': // LISTEN FOR SIDE BY SIDE COMPOSITION BUTTON PRESS  
          console.log("DWS: Side by Side Composition Selected.");
          // SET VIDEO COMPOSITON
          xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2], Layout: 'Equal'});

          // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});

          // ACTIVE LOCAL SPEAKERTRACK
          xapi.Command.Cameras.SpeakerTrack.Activate();

          // ACTIVE REMOTE SPEAKERTRACK
          sendMessage(DWS.SECONDARY_HOST, "EnableST");
          break;

        case 'dws_cam_randp': // LISTEN FOR PANDA COMPOSITION BUTTON PRESS  
          console.log("DWS: Rooms and Presenter Composition Selected.");
          // SET VIDEO COMPOSITON
          xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2,5], Layout: 'Equal'});

          // ENABLE PRESENTER TRACK
          xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });

          // ACTIVE LOCAL SPEAKERTRACK
          xapi.Command.Cameras.SpeakerTrack.Activate();

          // ACTIVE REMOTE SPEAKERTRACK
          sendMessage(DWS.SECONDARY_HOST, "EnableST");

          // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});
          break;

        case 'dws_cam_primary': // LISTEN FOR PRIMARY CAM BUTTON PRESS  
          console.log("DWS: Primary Room Camera Selected.");
          // SET VIDEO INPUT
          xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

          // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});

          // DEACTIVE LOCAL SPEAKERTRACK & PRESENTER TRACK
          xapi.Command.Cameras.SpeakerTrack.Deactivate();
          xapi.Command.Cameras.PresenterTrack.set({Mode: "Off"});

          // DEACTIVE REMOTE SPEAKERTRACK
          sendMessage(DWS.SECONDARY_HOST, "DisableST");
          break;
        case 'dws_cam_secondary': // LISTEN FOR SECONDARY CAM BUTTON PRESS  
          console.log("DWS: Secondary Room Camera Selected.");
          // SET VIDEO INPUT
          xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 2});

          // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});

          // DEACTIVE LOCAL SPEAKERTRACK & PRESENTER TRACK
          xapi.Command.Cameras.SpeakerTrack.Deactivate();
          xapi.Command.Cameras.PresenterTrack.set({Mode: "Off"});

          // DEACTIVE REMOTE SPEAKERTRACK
          sendMessage(DWS.SECONDARY_HOST, "DisableST");
          break;

        case 'dws_cam_presenter': // LISTEN FOR PANDA COMPOSITION BUTTON PRESS  
          console.log("DWS: Single Camera Presenter Selected.");
          
          // ENABLE PRESENTER TRACK
          xapi.Command.Cameras.PresenterTrack.set({Mode: "Follow"});
          
          // SET VIDEO COMPOSITON
          xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [5]});

          // DEACTIVE LOCAL SPEAKERTRACK & PRESENTER TRACK
          xapi.Command.Cameras.SpeakerTrack.Deactivate();

          // DEACTIVE REMOTE SPEAKERTRACK
          sendMessage(DWS.SECONDARY_HOST, "DisableST");

          // DISABLE AUTO MODE IF MANUALLY SELECTING AUDIENCE CAMERAS
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value:'off'});
          xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_panda', Value:'off'});

          break;

        case 'dws_combine': // LISTEN FOR INITIAL COMBINE BUTTON PRESS
          console.log ("DWS: Combine Requested. Confirming with user before beginning.");

          xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmCombine', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Combine Room Request' })
          .then(() => {
            xapi.Event.UserInterface.Message.Prompt.Response.on(value => {
              if (value.OptionId == "1" && value.FeedbackId == 'confirmCombine') 
              {                          
                console.log ("DWS: Combine action confirmed. Combining rooms.");

                // UPDATE CURRENT STATE
                DWS_CUR_STATE = "Combined";

                // UPDATE STATE ON UI PANEL
                xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combining'});

                // UPDATE VLANS FOR ACCESSORIES
                setVLANs('Combine');

                // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
                setPrimaryState('Combined');

                // UPDATE STATUS ALERT
                updateStatus('Combine');
                DWS_INTERVAL = setInterval(() => {updateStatus('Combine')}, 5000);

                //RESET SECONDARY PERIPHERAL COUNT
                let allCounter = 0;

                // MONITOR FOR MIGRATED DEVICES AND CONFIGURE ACCORDING TO USER SETTINGS
                xapi.Status.Peripherals.ConnectedDevice
                .on(device => {
                  if (device.Status === 'Connected') {
                    // MONITOR FOR TOUCH PANELS
                    if (device.Type === 'TouchPanel') {
                      if (device.ID === DWS.SECONDARY_NAV_CONTROL) {
                        if (DWS.DEBUG == 'true') {console.debug("DWS: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
                        // PAIR FOUND NAV AFTER 1500 MS  DELAY
                        setTimeout(() => {pairSecondaryNav(device.ID, 'InsideRoom', 'Controller')}, 1500);
                        allCounter = DWS_ALL_SEC.push(device.SerialNumber);
                      }
                      if (device.ID === DWS.SECONDARY_NAV_SCHEDULER) {
                        if (DWS.DEBUG == 'true') {console.debug("DWS: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
                        // PAIR FOUND NAV AFTER 1500 MS DELAY
                        setTimeout(() => {pairSecondaryNav(device.ID, 'OutsideRoom', 'RoomScheduler')}, 1500);
                        allCounter = DWS_ALL_SEC.push(device.SerialNumber);
                      }
                    }

                    // MONITOR FOR ALL SECONDARY MICS TO BE CONNECTED
                    if (device.Type === 'AudioMicrophone') {      
                      if (DWS.SECONDARY_MICS.includes(device.SerialNumber)) {
                        if (DWS.DEBUG == 'true') {console.debug("DWS: Discovered Microphone: " + device.SerialNumber)};

                        // STORE FOUND MIC TEMP ARRAY IN NOT ALREADY THERE
                        if (!(DWS_TEMP_MICS.includes(device.SerialNumber))) {                
                          let count = DWS_TEMP_MICS.push(device.SerialNumber);
                          allCounter = DWS_ALL_SEC.push(device.SerialNumber);
                          
                          if (count == DWS.SECONDARY_MICS.length) {
                            // START AZM WITH A 5 SECOND DELAY IF AUTOMATIC MODE IS DEFAULT
                            if (DWS.AUTOMODE_DEFAULT == 'on') {
                              setTimeout(() => {startAZM()}, 5000);
                            }                    
                            if (DWS.DEBUG == 'true') {console.debug("DWS: All Secondary Microphones Detected. Starting AZM.")};
                          }
                        }
                      }
                    }

                    // CHECK IF THIS IS ALL OF THE CONFIGURED PERIPHERALS            
                    if (allCounter == DWS_SEC_PER_COUNT) {
                      setTimeout(() => {if (DWS.DEBUG == 'true') {console.debug("DWS: All Secondary Peripherals Migrated.")};}, 2000);

                      // CREATE COMBINED PANELS AND SET DEFAULTS BASED ON CONFIGURATION WITH 2 SECOND DELAY
                      setTimeout(() => {createPanels('Combined')}, 2000);
                      setTimeout(() => {xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_cam_state', Value: DWS_AUTOMODE_STATE })}, 2300);

                      // UPDATE TIMER TO SET 100% COMPLETION ON STATUS BAR
                      DWS_TIMER = 160000;
                    }
                  }
                })
              }
              else if (value.FeedbackId != 'confirmSplit'){
                console.log ("DWS: Combine request dismissed. No action taken.");
              }
            })
          });

          break;
        case 'dws_split': // LISTEN FOR SPLIT BUTTON PRESS 
          console.log ("DWS: Split Requested. Confirming with user before beginning.");

          xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmSplit', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Split Room Request' })
          .then(() => {
            xapi.Event.UserInterface.Message.Prompt.Response.on(value => {
              if (value.OptionId == '1' && value.FeedbackId == 'confirmSplit') 
              { 
                console.log ("DWS: Started Splitting Rooms.");

                // RESET ANY COMPOSITIONS FOR MAIN VIDEO SOURCE
                xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

                // UPDATE CURRENT STATE
                DWS_CUR_STATE = "Split";

                // STOP AZM
                stopAZM();

                // UPDATE UI EXTENSION PANEL
                createPanels('Split');

                // UPDATE STATE ON UI PANEL
                xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Splitting'});

                // UPDATE STATUS ALERT
                updateStatus('Split');
                DWS_INTERVAL = setInterval(() => {updateStatus('Split')}, 5000);  
                
                // UPDATE VLANS FOR ACCESSORIES
                setVLANs('Split');

                // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
                setPrimaryState("Split");
              }
              else if (value.FeedbackId != 'confirmCombine')
              {
                console.log ("DWS: Split request dismissed. No action taken.");
              }
            })
          });
          break;

        // ADVANCED SETTINGS EVENTS
        case 'dws_unlock': // LISTEN FOR ADVANCED PANEL UNLOCK  
          console.log("DWS: Advanced Settings Unlock Requested.");

          // TRIGGER PIN CHALLENGE - IF SUCCESSFUL WILL TRIGGER BASED ON FEEDBACK REGISTER FOR FEEDBACKID.
          xapi.Command.UserInterface.Message.TextInput.Display({
            Title: `Unlock Advanced Settings`,
            Text: 'Enter the Unlock PIN:',
            Placeholder: 'Enter the PIN set during installation.',
            InputType: 'PIN',
            FeedbackId: 'unlockSettings'
          })
          .then(() => {
            xapi.Event.UserInterface.Message.TextInput.Response
            .on(event => {

              if (DWS.DEBUG == 'true') {console.debug("DWS: Unlock Attempt. Entered PIN: " + event.Text)};

              if(event.FeedbackId == 'unlockSettings' && event.Text == DWS.UNLOCK_PIN)
              {
                console.log('DWS: PIN Accepted. Displaying Advanced Panel.');

                // OPEN THE ADVANCED SETTINGS PANEL
                xapi.Command.UserInterface.Extensions.Panel.Open({PanelId: 'dws_advanced'});
              }
              else
              {
                if (DWS.DEBUG == 'true') {console.error("DWS: Entered PIN did not match configured PIN.")};
              }              
            })
          })
          break;
        case "dws_mics_audience":
          if (event.Value == 'on')
          {
            // GET "SAVED" LEVEL FROM PANEL AND RESET LEVEL TO MATCH
            xapi.Status.UserInterface.Extensions.Widget['39'].get()
            .then(response => {
              xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.set(response.Value); 
              if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Audience mic enabled. Setting level to: " + response.Value)};
            })
            .catch (error => { console.log(error)})
          }
          if (event.Value == 'off')
          {
            if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Audience mic disabled. Setting level to: 0")};
            xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.set(0)
            .catch (error => { console.log(error)})
          }
          break;
        case "dws_edit_level_audience": // LISTEN FOR CHANGE IN GAIN/LEVEL ON AUDIENCE MICS
          if (event.Value == 'increment'){
            //ADJUST GAIN ON ALL AUDIENCE MICS
            xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.get()
            .then(response => {
              let newlevel;
              if (response != 70)
              {
                newlevel = parseInt(response) + 1;
                xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'on', WidgetId: 'dws_mics_audience' });
              }
              else{
                newlevel = response;
              }
              xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.set(newlevel);              
              xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: newlevel, WidgetId: 'dws_edit_level_audience' });
              if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Audience mic gain/level incremented to: " + newlevel)};
            })            
          }
          else if (event.Value == 'decrement') {
            //ADJUST GAIN ON ALL AUDIENCE MICS
            xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.get()
            .then(response => {
              let newlevel;
              if (response != 0){
                newlevel = parseInt(response) - 1;
                if (newlevel == 0){
                  xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'off', WidgetId: 'dws_mics_audience' });
                }
              }
              else{
                newlevel = response;
              }                           
              xapi.Config.Audio.Input.Ethernet[1].Channel[1].Level.set(newlevel);
              xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: newlevel, WidgetId: 'dws_edit_level_audience' });
              if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Audience mic gain/level decremented to: " + newlevel)};
            })
          }          
          break;
        case "dws_mics_presenter":
          if (event.Value == 'on')
          {
            // GET "SAVED" LEVEL FROM PANEL AND RESET LEVEL TO MATCH
            xapi.Status.UserInterface.Extensions.Widget['38'].get()
            .then(response => {
              xapi.Config.Audio.Input.USBInterface[1].Level.set(response.Value); 
              if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Presenter mic enabled. Setting level to: " + response.Value)};
            })
            .catch (error => { console.log(error)})
          }
          if (event.Value == 'off')
          {
            if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Presenter mic disabled. Setting level to: 0")};
            xapi.Config.Audio.Input.USBInterface[1].Level.set(0)
            .catch (error => { console.log(error)})
          }
          break;
        case "dws_edit_level_presenter": // LISTEN FOR CHANGE IN GAIN/LEVEL ON PRESENTER USB MICS
          if (event.Value == 'increment'){
            //ADJUST GAIN ON ALL PRESENTER USB MICS
            xapi.Config.Audio.Input.USBInterface[1].Level.get()
            .then(response => {
              let newlevel;
              if (response != 70){
                newlevel = parseInt(response) + 1;
                xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'on', WidgetId: 'dws_mics_presenter' });
              }
              else{
                newlevel = response;
              }
              xapi.Config.Audio.Input.USBInterface[1].Level.set(newlevel);
              xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: newlevel, WidgetId: 'dws_edit_level_presenter' });
              if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Presenter mic gain/level incremented to: " + newlevel)};
            })            
          }
          else if (event.Value == 'decrement') {
            //ADJUST GAIN ON ALL PRESENTER USB MICS
            xapi.Config.Audio.Input.USBInterface[1].Level.get()
            .then(response => {
              let newlevel;
              if (response != 0){
                newlevel = parseInt(response) - 1;
                if (newlevel == 0){
                  xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: 'off', WidgetId: 'dws_mics_presenter' });
                }
              }
              else{
                newlevel = response;
              }             
              xapi.Config.Audio.Input.USBInterface[1].Level.set(newlevel);
              xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: newlevel, WidgetId: 'dws_edit_level_presenter' });
              if (DWS.DEBUG == 'true') {console.debug("DWS: (Advanced) Presenter mic gain/level decremented to: " + newlevel)};              
            })
          }          
          break;
      }
    }
  });

}

// Function to get the hostname using RESTCONF
function registerLinkLocal() 
{
  const url = `https://169.254.1.254/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory/`;

  xapi.command('HttpClient Get', { 
    Url: url, 
    Header: [
      `Content-Type: application/yang-data+json`,
      'Accept: application/yang-data+json',
      `Authorization: Basic ${btoa(`${DWS.SWITCH_USERNAME}:${DWS.SWITCH_PASSWORD}`)}`
    ],
    AllowInsecureHTTPS: true
  })
  .then(response => {
    const jsonResponse = JSON.parse(response.Body);
    const hostname = jsonResponse['Cisco-IOS-XE-device-hardware-oper:device-inventory'];
    let result = [];

    for(var i in hostname)
      for(var d in hostname[i])
        result.push([hostname[i][d]])

    let SWITCH_MODEL = result[3];
    let SWITCH_SERIAL = result[4];

    if (DWS.DEBUG == 'true') {console.debug("DWS: Link Local Switch Serial:", SWITCH_SERIAL)};
    if (DWS.DEBUG == 'true') {console.debug("DWS: Link Local Switch Model:", SWITCH_MODEL)};

    xapi.Command.Peripherals.Connect({ HardwareInfo: SWITCH_MODEL, ID: SWITCH_SERIAL, Name: SWITCH_MODEL, NetworkAddress: "169.254.1.254", SerialNumber: SWITCH_SERIAL, Type: 'ControlSystem' })
    .then (() => {
      if (DWS.DEBUG == 'true') {console.debug('DWS: Link Local Switch registered to Control Hub.')};

      // SET REPORTING HEART BEAT TO 5.5 MINUTES
      xapi.Command.Peripherals.HeartBeat( { ID: SWITCH_SERIAL, Timeout: 330 });

      // WAIT 5 MINUTES THEN RERUN THIS SAME FUNCTION
      setTimeout (() => { registerLinkLocal() }, 300000);
    })  
    .catch (error => {
      console.error ('Failed to register switch to Control Hub: ', error.message);
    })
  })
  .catch(error => {
    console.error('Failed to get switch details:', error.message);
  });
}

function setPrimaryState(state)
{
  // CREATE MACRO BODY
  const dataStr = `
/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way 
Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
Robert(Bobby) McGonigle Jr
Chase Voisin
William Mills

Version: 0.9
Released: 03/31/2025

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const STATE = '${state}';

export default {
  STATE, 
};`
        ;

  // SAVE STATE MACRO
  xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr);
}

//==================================//
//  UI EXTENSION MODIFIER FUNCTION  //
//==================================//
function createPanels(curState) 
{
  // CHECK FOR PRESENTER TRACK CONFIGURATION
  xapi.Status.Cameras.PresenterTrack.Availability.get()
  .then(response => {

    let PRES_CONF;

    if (response != 'Available')
    {
      PRES_CONF = `<Row>
                      <Name>Start Presenter and Audience:</Name>
                      <Widget>
                        <WidgetId>widget_61</WidgetId>
                        <Name>** Please complete the Presenter Track Setup to enable this feature. **</Name>
                        <Type>Text</Type>
                        <Options>size=4;align=center</Options>
                      </Widget>
                    </Row>`;
    }
    else
    {
      PRES_CONF = `<Row>
                    <Name>Presenter and Audience:</Name>
                    <Widget>
                      <WidgetId>dws_cam_panda</WidgetId>
                      <Type>ToggleButton</Type>
                      <Options>size=1</Options>
                    </Widget>
                    <Widget>
                      <WidgetId>widget_33</WidgetId>
                      <Name>Uses automated detection of a presenter for compositing with automatic audience cameras.</Name>
                      <Type>Text</Type>
                      <Options>size=3;fontSize=small;align=center</Options>
                    </Widget>
                  </Row>`;
    }
    
    // PANEL XMLS
    // SPLIT
    const PANEL_SPLIT = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_controls</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${controlsIcon}</Content><Id>03f5056a23ef85070954bc371a7b64e97d809899ba6fb0b1c01c4d9fdc1faad7</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Current Room Status:</Name><Widget><WidgetId>widget_15</WidgetId><Name>Current Room Status:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_state</WidgetId><Name>Text</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Manual Control</Name><Widget><WidgetId>dws_combine</WidgetId><Name>Combine Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_room_control</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;

    // COMBINED OUTOFCALL
    const PANEL_COMBINED_OOC = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_controls</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${controlsIcon}</Content><Id>03f5056a23ef85070954bc371a7b64e97d809899ba6fb0b1c01c4d9fdc1faad7</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Current Room Status:</Name><Widget><WidgetId>dws_state</WidgetId><Name>Text</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Manual Control:</Name><Widget><WidgetId>dws_split</WidgetId><Name>Split Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_room_control</PageId><Options/></Page><Page><Name>Camera Controls</Name><Row><Name>Automatic Camera Switching:</Name><Widget><WidgetId>dws_cam_state</WidgetId><Type>ToggleButton</Type><Options>size=1</Options></Widget><Widget><WidgetId>widget_31</WidgetId><Name>Automate camera switching based on active audience microphones across both workspaces.</Name><Type>Text</Type><Options>size=3;fontSize=small;align=center</Options></Widget></Row>${PRES_CONF}<Row><Name>Fixed Compositions:</Name><Widget><WidgetId>dws_cam_sxs</WidgetId><Name>Side by Side</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_cam_randp</WidgetId><Name>Rooms and Presenter</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_7</WidgetId><Name>Side by Side sends only Audience Cameras. Rooms and Presenter will send the Presenter and both Audience Cameras.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Single Camera Modes:</Name><Widget><WidgetId>dws_cam_primary</WidgetId><Name>Primary Audience</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_cam_secondary</WidgetId><Name>Secondary Audience</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_cam_presenter</WidgetId><Name>Primary Presenter</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_cam_control</PageId><Options/></Page><Page><Name>Adv. Settings</Name><Row><Name>Advanced Settings:</Name><Widget><WidgetId>dws_unlock</WidgetId><Name>Unlock Advanced Settings</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_settings_control</PageId><Options/></Page></Panel></Extensions>`;

    // COMBINED IN CALL
    const PANEL_COMBINED_CALL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_controls</PanelId><Origin>local</Origin><Location>HomeScreenAndCallControls</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${controlsIcon}</Content><Id>03f5056a23ef85070954bc371a7b64e97d809899ba6fb0b1c01c4d9fdc1faad7</Id></CustomIcon><Page><Name>Camera Controls</Name><Row><Name>Automatic Camera Switching:</Name><Widget><WidgetId>dws_cam_state</WidgetId><Type>ToggleButton</Type><Options>size=1</Options></Widget><Widget><WidgetId>widget_31</WidgetId><Name>Automate camera switching based on active audience microphones across both workspaces.</Name><Type>Text</Type><Options>size=3;fontSize=small;align=center</Options></Widget></Row>${PRES_CONF}<Row><Name>Fixed Compositions:</Name><Widget><WidgetId>dws_cam_sxs</WidgetId><Name>Side by Side</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_cam_randp</WidgetId><Name>Rooms and Presenter</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_7</WidgetId><Name>Side by Side sends only Audience Cameras. Rooms and Presenter will send the Presenter and both Audience Cameras.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Single Camera Modes:</Name><Widget><WidgetId>dws_cam_primary</WidgetId><Name>Primary Audience</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_cam_secondary</WidgetId><Name>Secondary Audience</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_cam_presenter</WidgetId><Name>Primary Presenter</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_cam_control</PageId><Options/></Page><Page><Name>Adv. Settings</Name><Row><Name>Advanced Settings:</Name><Widget><WidgetId>dws_unlock</WidgetId><Name>Unlock Advanced Settings</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_settings_control</PageId><Options/></Page></Panel></Extensions>`;

    // SET THE PANEL XML BASED ON STATE
    if(curState == 'Combined') 
    {
      DWS_PANEL = PANEL_COMBINED_OOC;
    } 
    else if(curState == 'InCall') 
    {
      DWS_PANEL = PANEL_COMBINED_CALL
    }
    else {
      DWS_PANEL = PANEL_SPLIT;
    }
  
    // DRAW PANEL BASED ON CURRENT STATE
    xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: DWS_PANEL_ID }, DWS_PANEL)
    .catch(e => console.log('Error saving panel: ' + e.message))
  })
}

//===============================//
//  COMBINATION STATUS FUNCTION  //
//===============================//
function updateStatus(type) {
  var percent = Math.round(DWS_TIMER / 160000 * 100);

  // CHECK IF TIMER IS LESS THAN 165 SECONDS
  if (DWS_TIMER < 160000) {
    // UPDATE PROMPT WITH PERCENTAGE COMPLETE
    xapi.Command.UserInterface.Message.Prompt.Display({
      Duration: '0', 
      FeedbackId: '65', 
      Title: type + ' Rooms', 
      Text:'Please wait while this process completes.', 
      "Option.1": percent+'% Complete'
    });    
  } 
  else {
    // SEND FINAL PROMPT @ 100% COMPLETION
    xapi.Command.UserInterface.Message.Prompt.Clear({FeedbackId: '65'});
    xapi.Command.UserInterface.Message.Prompt.Display({Duration: '0', FeedbackId: '65',Title: type+' Rooms', "Option.1": '100% Complete', Text:'Operation completed successfully.'});
    
    // UPDATE PANEL TO SHOW FINISHED STATE
    if (type == 'Combine') {
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combined'});
    }
    else {
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Split'});
    }

    console.log("DWS: Operation completed successfully!");

    // CLEAR TIMER AND RESET INTERVAL
    clearInterval(DWS_INTERVAL);
    DWS_TIMER = 0;
  }

  // INCREMENT THE TIMER 5 SECONDS
  DWS_TIMER = DWS_TIMER + 5000;
}

//===================================================//
//            COMMAND SENDING FUNCTIONS              //
//===================================================//
async function triggerMessage(codec, payload) {
  let Params = {};
  Params.Timeout = 5;
  Params.AllowInsecureHTTPS = 'True';
  Params.ResultBody = 'PlainText';
  Params.Url = `http://${codec}/putxml`;
  Params.Header = ['Authorization: Basic ' + btoa(`${DWS.MACRO_USERNAME}:${DWS.MACRO_PASSWORD}`), 'Content-Type: application/json']; // CONVERT TO BASE64 ENCODED

  // ENABLE THIS LINE TO SEE THE COMMANDS BEING SENT TO FAR END
  if (DWS.DEBUG == 'true') {console.debug('DWS: Sending:', `${payload}`)}

  xapi.Command.HttpClient.Post(Params, payload)
  .then(() => {
    if (DWS.DEBUG == 'true') {console.debug(`DWS: Command sent to ${codec} successfully`)}
  })
  .catch((error) => {
    console.error(`DWS: Error sending command:`, error);

    // WAIT 1000ms THEN RETRY WITH SAME PAYLOAD
    setTimeout(() => { 
      triggerMessage(codec, payload); 
      if (DWS.DEBUG == 'true') {console.debug('DWS: HTTP session limit. Resending Command:', `${payload}`)}
    }, 1000 );
  });
}

//creates the payload for the postRequest - Author: Magnus Ohm
async function sendMessage(codec, message) {
  var payload = "<Command><Message><Send><Text>"+ message +"</Text></Send></Message></Command>";
  await triggerMessage(codec, payload);
}

//========================================//
//  VLAN CHANGING OVER RESTCONF FUNCTION  //
//========================================//
async function setVLANs(state) {  
  // CHECK SWITCH TYPE THEN SET BASED ON STATE
  if (DWS.SWITCH_TYPE == 'C9K-8P') {
    if (state == 'Combine') {
      for (let p = 5; p < 8; p++)
      {
        const payload = {"Cisco-IOS-XE-native:GigabitEthernet":[{"name":"1/0/"+p,"switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}]};

        await submitRESTCONF(payload);

        if (p == 7)
        {
          // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
          sendMessage(DWS.SECONDARY_HOST,"Combine");
        }
      }
    }
    else {
      for (let p = 5; p < 8; p++)
      {
        const payload = {"Cisco-IOS-XE-native:GigabitEthernet":[{"name":"1/0/"+p,"switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.SECONDARY_VLAN}}}}]};

        await submitRESTCONF(payload);       

        if (p == 7)
        {
          // SET SECONDARY STATE FOR SPLIT OPERATION
          sendMessage(DWS.SECONDARY_HOST,"Split");
        }
      }
    }    
  }
  else if (DWS.SWITCH_TYPE == 'C9K-12P') {
    if (state == 'Combine') {
      for (let p = 7; p <= 11; p++)
      {
        const payload = {"Cisco-IOS-XE-native:GigabitEthernet":[{"name":"1/0/"+p,"switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}]};

        await submitRESTCONF(payload);

        if (p == 11)
        {
          // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
          sendMessage(DWS.SECONDARY_HOST,"Combine");
        }      
      }
    }
    else {
      for (let p = 7; p <= 11; p++)
      {
        const payload = {"Cisco-IOS-XE-native:GigabitEthernet":[{"name":"1/0/"+p,"switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.SECONDARY_VLAN}}}}]};

        await submitRESTCONF(payload); 

        if (p == 11)
        {
          // SET SECONDARY STATE FOR SPLIT OPERATION
          sendMessage(DWS.SECONDARY_HOST,"Split");
        }
      }
    }   
  }    
}

async function submitRESTCONF(payload) {
  const API_URL = `https://169.254.1.254/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet`;

  try {
    const response = await xapi.Command.HttpClient.Patch({
        Header: [
            'Content-Type: application/yang-data+json',
            'Accept: application/yang-data+json',
            `Authorization: Basic ${btoa(`${DWS.SWITCH_USERNAME}:${DWS.SWITCH_PASSWORD}`)}`
        ],
        Url: API_URL,
        AllowInsecureHTTPS: true,
        ResultBody: 'PlainText'
    },JSON.stringify(payload));

    if (response.StatusCode == "204") {
        if (DWS.DEBUG == 'true') {console.debug (`DWS: VLAN changed successfully.`)}
    } else {
	console.error (`DWS: VLAN change failed: ${error.message}`);
        throw new Error(`HTTP Error: ${response.StatusCode} - ${response.StatusText}`);
    }
  } catch (error) {
      console.error (`DWS: VLAN change failed: ${error.message}`);
  }
}

//===============================//
//  NAVIGATOR PAIRING FUNCTIONS  //
//===============================//
function pairSecondaryNav(panelId, location, mode) {
  if (DWS.DEBUG == 'true') {console.debug (`DWS: Attempting to configure Secondary Touch Panel: ${panelId}`)}

  // Command to set the panel to control mode
  xapi.Command.Peripherals.TouchPanel.Configure({ ID: panelId, Location: location, Mode: mode})
  .then(() => {
    if (DWS.DEBUG == 'true') {console.debug (`DWS: Secondary Room Touch Panel ${panelId} configured successfully`)}
  })
  .catch((error) => {
    console.error(`DWS: Failed to pair Touch Panel ${panelId} to Primary`, error);
  });
}

//===========================//
//  AZM SUPPORTED FUNCTIONS  //
//===========================//
function buildEmptyAZM() {
  let DWS_EMPTY_AZM = {
    Settings: { ...Settings },
    Zones: []
  }
  return DWS_EMPTY_AZM;
}

function buildAZMProfile() {
  let PRIMARY_ZONE = [];
  let SECONDARY_ZONE = [];

  DWS.PRIMARY_MICS.forEach(element => { 
    PRIMARY_ZONE.push({Serial: element, SubId: [1]})
  });

  DWS.SECONDARY_MICS.forEach(element => { 
    SECONDARY_ZONE.push({Serial: element, SubId: [1]})
  });

  let DWS_AZM_PROFILE = {
    Settings: { ...Settings },
    Zones: [
      {
        Label: 'PRIMARY ROOM',
        MicrophoneAssignment: {
          Type: 'Ethernet',
          Connectors: [...PRIMARY_ZONE]
        },
        Assets: {                             
          Camera: {
            InputConnector: 1,
            Layout: 'Equal'
          }
        }
      },
      {
        Label: 'SECONDARY ROOM',
        MicrophoneAssignment: {
          Type: 'Ethernet',                   
          Connectors: [ ...SECONDARY_ZONE]
        },
        Assets: {                             
          Camera: {
            InputConnector: 2,
            Layout: 'Equal'
          }
        }
      }
    ]
  }
  return DWS_AZM_PROFILE;
}

function startAZMZoneListener() {
  AZM.Event.TrackZones.on(handleAZMZoneEvents);
  startAZMZoneListener = () => void 0;
}

function startCallListener() {
  // LISTEN TO CALL STATUS
  xapi.Status.SystemUnit.State.NumberOfActiveCalls.on(handleCallStatus)
  startCallListener = () => void 0;
}

async function handleAZMZoneEvents(event) {
  // CHECK DWS CAMERA MODE & ONLY SET THE CAMERA BASED ON AZM PROFILE IF IN "AUTOMATIC"
  if (DWS_AUTOMODE_STATE == 'on') 
  {
    if (DWS_PANDA_STATE == 'on') // CHECK FOR PRESENTER AND AUDIENCE TOGGLED ON
    {
      const IN_PRESENTER = await xapi.Status.Cameras.PresenterTrack.Status.get()
      const ACTIVE_PRESENTER = await xapi.Status.Cameras.PresenterTrack.PresenterDetected.get();

      if (DWS.DEBUG == 'true') {
        console.debug ("DWS: In Presenter Mode: "+IN_PRESENTER);
        console.debug ("DWS: Active Presenter?: "+ACTIVE_PRESENTER);
      }
    
      if (ACTIVE_PRESENTER == 'True' && IN_PRESENTER == 'Persistent')
      {
        // SET COMPOSITION TO INCLUDE PRESENTER TRACK PTZ AS LARGE PIP
        if (event.Zone.State == 'High') 
        {
          if (DWS.DEBUG == 'true') {console.debug ('DWS: Presenter Detected. Setting PIP with PTZ & ' + event.Zone.Label)};

          await xapi.Command.Video.Input.SetMainVideoSource({
            ConnectorId: [5, event.Assets.Camera.InputConnector],
            Layout: 'PIP',
            PIPPosition: 'Lowerright',
            PIPSize: 'Large'
          });

          if (event.Zone.Label == 'PRIMARY ROOM')
          {
            // SET LOCAL SPEAKERTRACK MODE
            xapi.Command.Cameras.SpeakerTrack.Activate();
            xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();
          }
          else if (event.Zone.Label == 'SECONDARY ROOM')
          {
            // ACTIVATE REMOTE SPEAKERTRACK
            sendMessage(DWS.SECONDARY_HOST, "EnableST");
          }

          // RESET THE DROP AUDIENCE COUNTER
          DWS_DROP_AUDIENCE = 0;
        }
        else if (DWS_DROP_AUDIENCE > 4) {
          await xapi.Command.Video.Input.SetMainVideoSource({
            ConnectorId: 5,
            Layout: 'Equal'
          });
          // RESET THE DROP AUDIENCE COUNTER
          DWS_DROP_AUDIENCE = 0;
        }
        else{
          // INCREMENT THE DROP AUDIENCE COUNTER
          DWS_DROP_AUDIENCE++;
        }
      }
    }
    else 
    {
      if (event.Zone.State == 'High') {
        if (DWS.DEBUG == 'true') {console.debug ('DWS: Microphone activity detected. Switching to ' + event.Zone.Label)};

        await xapi.Command.Video.Input.SetMainVideoSource({
          ConnectorId: event.Assets.Camera.InputConnector,
          Layout: event.Assets.Camera.Layout
        });

        if (event.Zone.Label == 'PRIMARY ROOM')
        {
          // SET LOCAL SPEAKERTRACK MODE
          xapi.Command.Cameras.SpeakerTrack.Activate();
          xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();
        }
        else if (event.Zone.Label == 'SECONDARY ROOM')
        {
          // ACTIVATE REMOTE SPEAKERTRACK
          sendMessage(DWS.SECONDARY_HOST, "EnableST");
        }
      }
    }
  } 
}

async function handleCallStatus(event) {
  if (event > 0) {
    // START MONITORING ZONES AT CALL START
    AZM.Command.Zone.Monitor.Start()

    if(DWS_CUR_STATE == 'Combined'){
      // DRAW IN CALL PANEL
      createPanels ("InCall");
      
      if (DWS.DEBUG == 'true') { console.debug("DWS: Setting default camera mode to match configuration.")}
      setTimeout (() => { 
        xapi.Command.UserInterface.Extensions.Widget.Action({Type: 'changed', WidgetId: 'dws_cam_state', Value: DWS.AUTOMODE_DEFAULT })
        .catch (error => console.error("DWS: Error setting default Auto mode state: ",error))
        }, 300);
    }
  } 
  else {
    //S STOP THE VU MONITORS WHEN CALL ENDS
    AZM.Command.Zone.Monitor.Stop()

    // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
    xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

    if(DWS_CUR_STATE == 'Combined'){
      createPanels ("Combined");
      setTimeout (() => { xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Combined' }) }, 300);
    }
    else{
      createPanels ("Split");
      setTimeout (() => { xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_state', Value:'Split' }) }, 300);
    }
  }
}

async function startAZM() {
  let configurationProfile = buildAZMProfile();
  await AZM.Command.Zone.Setup(configurationProfile);
  startAZMZoneListener();
  startCallListener();
  await AZM.Command.Zone.Monitor.Stop();
}

async function stopAZM() {
  let configurationProfile = buildEmptyAZM();
  await AZM.Command.Zone.Setup(configurationProfile);
}

// LONG VARIABLE STORAGE
const controlsIcon = 'iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAAgAElEQVR4nOzdB5xcVdk/8N+5bdrWZJNsSW+0JAQEQihSREBABRSl/AXsiKiI7aX5vooooIhgeVXQiIiI+NJ7TSAJJIRUUklIIZUkW6fPvff8P+fObBIEJNmdszuz+/vmswohmbn9PPec5zwHRERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERHtBFPsgxds73vP3HUcABgCZ/1Y/l4OQPkzTRMqMwrNseJ4LCAOeZ8CygLABdMgsMjKLAUYFMhLwAYQLW50FYBZ2wgOC/+64gGUCWUN9nQ8DOah/MmEHf9bwM7CQE0L6hucLywd8Q0r1h+AKC74tYEDAy3nwpQ/LMuALG1nhwPWAiAmYvgfD95A1bLiGCH5fSiBkAkYO8K3gK2FCwpUeYkJ9uwi2V31RK4CYOiZqHyQgBGAjv29qP3wfSLtApQ1YkEgLgWg6BzPnQarfsbKAnYGQEjnEYFohCCHR7AOGC1RYQFYI+IXPDat9KxwvdfjVfqltM6WAC4mQYSJdOE9qG7IuEFXHzwCEzCIs0/ljFxxpgR25GHxTBAfflvn98IzCuQHQkQOEBTi+D0MCrmUgqw6QAKTrB5eBYZmwJGB4fnAAXFMExyQFIOkDIc9H2DIgfQ9qr4VhwJcCKSEwQCbgSBcwTUCK4OCrPUqLMKSUaDXy22QVtlh9j5fxYVoCwpTBMcgKAx2Z/LVTFwKk78J2U+qb3nHdqmvUN22krEiwf1bhT0QgkFLXo0Bw3caEgCwcx5A6z+rvCYmwbyKjrk0j//uW+hQ/q44+fMNGzs9fA9WmH5yLnC8QFj4sdYaEQCI4pz5ClkTGMIPzmXIlfA8YaKVg+i5c3+jSvar2zTWd4Ef9874w1DmT+W2PWCI47r4w4avTrA6wl4VhmpC+GVx0luXBEz4ynh9ss7QiUF9pCwMhQ13HueB+NRFCCiI4Lo6QUJdZFiLYb7HHPdMO9XeBAYV7JgUfOekh7lmoMIGqXBLC94NjuGt/obbRQMaKwnJz8Ewz+FGn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';

// ADVANCED PANEL
const PANEL_ADVANCED = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_advanced</PanelId><Origin>local</Origin><Location>Hidden</Location><Icon>Sliders</Icon><Name>Advanced Controls</Name><ActivityType>Custom</ActivityType><Page><Name>Advanced Settings</Name><Row><Name>Microphone Settings:</Name><Widget><WidgetId>widget_51</WidgetId><Name>Audience Mics:</Name><Type>Text</Type><Options>size=1;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_mics_audience</WidgetId><Type>ToggleButton</Type><Options>size=1</Options></Widget><Widget><WidgetId>widget_53</WidgetId><Name>Presenter Mics </Name><Type>Text</Type><Options>size=1;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_mics_presenter</WidgetId><Type>ToggleButton</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_edit_level_audience</WidgetId><Type>Spinner</Type><Options>size=2;style=plusminus</Options></Widget><Widget><WidgetId>dws_edit_level_presenter</WidgetId><Type>Spinner</Type><Options>size=2;style=plusminus</Options></Widget><Widget><WidgetId>widget_65</WidgetId><Name>Use the controls above to raise or lower the level/gain on the microphones. Default value for Audience is 45 and 5 for Presenter.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Primary Microphones</Name><Widget><WidgetId>widget_56</WidgetId><Name>${DWS.PRIMARY_MICS.join(", ")}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_pri_mics</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Secondary Microphones</Name><Widget><WidgetId>widget_57</WidgetId><Name>${DWS.SECONDARY_MICS.join(", ")}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_sec_mics</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Secondary Navigators</Name><Widget><WidgetId>widget_62</WidgetId><Name>Control:</Name><Type>Text</Type><Options>size=1;fontSize=small;align=center</Options></Widget><Widget><WidgetId>widget_59</WidgetId><Name>${DWS.SECONDARY_NAV_CONTROL}</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_sec_control</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>widget_63</WidgetId><Name>Scheduler:</Name><Type>Text</Type><Options>size=1;fontSize=small;align=center</Options></Widget><Widget><WidgetId>widget_64</WidgetId><Name>${DWS.SECONDARY_NAV_SCHEDULER}</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_sec_scheduler</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Options/></Page></Panel></Extensions>`;

// START THE MACRO
init();
