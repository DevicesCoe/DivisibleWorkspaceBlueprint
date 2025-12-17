/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way and
Three-Way Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
Robert(Bobby) McGonigle Jr
Chase Voisin
William Mills

Version: 0.9.6 (Beta)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

import xapi from 'xapi';
import { AZM } from './DWS_AZM_Lib';
import DWS from './DWS_Config';
import SAVED_STATE from './DWS_State';
import IMAGES from './DWS_Images';

//======================//
//  REQUIRED VARIABLES  //
//======================//
let DWS_PANEL;
let DWS_TIMER = 0;
let DWS_INTERVAL = '';
let DWS_AUTOMODE_STATE = DWS.AUTOMODE_DEFAULT;
let DWS_CUR_STATE = SAVED_STATE.STATE;
let DWS_DROP_AUDIENCE = 0;
let DWS_ADV_HIGH_PRI = DWS.MICS_HIGH_PRI;
let DWS_ADV_HIGH_NODE1 = DWS.MICS_HIGH_NODE1;
let DWS_ADV_HIGH_NODE2 = DWS.MICS_HIGH_NODE2;
let DWS_ADV_PRI_DELAY = DWS.PRIMARY_DELAY;
let DWS_ADV_AUTO_DEFAULT = DWS.AUTOMODE_DEFAULT;
let DWS_ADV_DUCKING = DWS.AUTO_DUCKING;
let DWS_PRESENTER_MIC_ID;
let DWS_PRESENTER_CAM_ID;
let DWS_COMBINE_NODE1 = 'off';
let DWS_COMBINE_NODE2 = 'off';
let DWS_TEMP_MICS = [];
let DWS_TEMP_NAVS = [];
let DWS_NODE2_MICS = 0;
let DWS_HOLD_TIME;
let DWS_LAST_CAMERA;
let DWS_DUCK_STATE = 'Unducked';

let DWS_NODE1_MICS = DWS.NODE1_MICS.length;

if (DWS.NWAY == 'Three Way')
{
  let DWS_NODE2_MICS = DWS.NODE2_MICS.length;
}

let DWS_NODE1_NAVS = 1;
if (DWS.NODE1_NAV_SCHEDULER != undefined)
{
  DWS_NODE1_NAVS++;
}

let DWS_NODE2_NAVS = 1;
if (DWS.NODE2_NAV_SCHEDULER != undefined)
{
  DWS_NODE2_NAVS++;
}

//===========================//
//  INITIALIZATION FUNCTION  //
//===========================//
function init() {

  console.log ("DWS: Starting up as Primary Node.");

  // CHECK PRESENTER TRACK SETUP
  xapi.Status.Cameras.PresenterTrack.Availability.get()
  .then(response => {
    if (response != 'Available')
    { 
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Action Required", Text: "Please configure Presenter Track to enable presenter camera automation when in combined mode."});
    }
    else if (response == 'Available')
    {
      xapi.Config.Cameras.PresenterTrack.Connector.get()
      .then (response => {
        DWS_PRESENTER_CAM_ID = response;
      });
    }
  })
  .catch(error => {
    console.error("DWS: Issue getting Presenter Track configuration: ", error);
  })

  // ENSURE NOISE REMOVAL IS ENABLED BY DEFAULT
  xapi.Config.Audio.Microphones.NoiseRemoval.Mode.set("Enabled");

  // START LINK LOCAL SWITCH REPORTING TO CONTROL HUB
  registerLinkLocal();
  xapi.Config.Peripherals.Profile.ControlSystems.set('1');

  // DETERMINE ETHERNET ID OF PRESENTER MIC
  if(DWS.PRESENTER_MIC.length == 11)
  {
    xapi.Status.Peripherals.ConnectedDevice.get()
    .then(peripherals => {
      const presenterMic = peripherals.find(item => item.Type === 'AudioMicrophone' && item.SerialNumber === DWS.PRESENTER_MIC);

      xapi.Status.Audio.Input.Connectors.Ethernet.get()
      .then (response => {
        DWS_PRESENTER_MIC_ID = response.find(item => item.StreamName === presenterMic.ID).id;

        if (DWS.DEBUG) {console.debug("DWS: Ethernet Presenter Microphone configured as ID: "+DWS_PRESENTER_MIC_ID)};
      })
      .catch(error => {
        console.error("DWS: Issue determining ethernet microphone ID: ", error);
      })
    })
    .catch(error => {
      console.error("DWS: Issue getting connected peripherals: ", error);
    })
  }

  // DRAW ADVANCED SETTINGS PANEL
  createPanels("Locked");

  //=================================//
  //  STATE RESTORATION FOR REBOOTS  //
  //=================================//
  if (SAVED_STATE.STATE == 'Combined All' || SAVED_STATE.STATE == 'Combined Node1' || SAVED_STATE.STATE == 'Combined Node2' )
  {
    console.log ('DWS: Combined state detected. Re-applying configuration.');

    // INITIALIZE AZM BASED ON SAVED STATE
    startAZM();
    
    // CHECK FOR ACTIVE CALL THEN BUILD PANELS
    xapi.Status.Call.get()
    .then (response => {
      if (response == '')
      {
        // SET TO OUT OF CALL STATE
        createPanels('Combined');

        // SHOW ROOM CONTROLS PANEL
        xapi.Command.UserInterface.Extensions.Panel.Update({ PanelId: 'dws_controls', Location: 'HomeScreen' })
          .catch(e => console.log('Error showing Room Controls panel: ' + e.message));
      }
      else
      {
        // SET TO IN CALL STATE
        createPanels('InCall');

        // HIDE ROOM CONTROLS PANEL
        xapi.Command.UserInterface.Extensions.Panel.Update({ PanelId: 'dws_controls', Location: 'Hidden' })
          .catch(e => console.log('Error hiding Room Controls panel: ' + e.message));
      }
    })
    .catch(error => {
      console.error("DWS: Issue getting active call state: ", error);
    })

    if (DWS.COMBINED_BANNER)
    {
      if (SAVED_STATE.STATE == 'Combined All')
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS + ", " + DWS.NODE2_ALIAS});
      }
      else if (SAVED_STATE.STATE == 'Combined Node1')
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS});
      }
      else if (SAVED_STATE.STATE == 'Combined Node2')
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE2_ALIAS});
      } 
    }       
  } 
  else 
  {
    // SET THE DEFAULT ROOM STATE TO SPLIT
    createPanels('Split');

    // UPDATE THE PANEL TO SHOW A STATUS OF SPLIT
    xapi.Command.UserInterface.Extensions.Widget.SetValue({WidgetId: 'dws_state', Value: 'Split'});
  }

  console.log ("DWS: Initialization complete.")

  //=======================================//
  //  EVENT LISTENER FOR IN CALL CONTROLS  //
  //=======================================//
  xapi.Event.UserInterface.Extensions.Panel.Clicked.on (event => {
    
    //==========================//
    //  AUDIO SPECIFIC TRIGGERS //
    //==========================//
    if (event.PanelId == 'dws_audience_disabled')
    {
      if (DWS.DEBUG) {console.debug("DWS: Audience mics enabled.")};

      // CHANGE BUTTON STATE      
      updatePanel({PanelId: "dws_audience_enabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_audience_disabled", Location: "Hidden"});

      // TOGGLE MUTE ON ALL ETHERNET MICROPHONES EXCEPT THE PRESENTER
      for(let i = 1; i < 9; i++)
      {
        if (i != DWS_PRESENTER_MIC_ID)
        {
          xapi.Config.Audio.Input.Ethernet[i].Mode.set("On");
        }                
      }     
    }
    else if (event.PanelId == 'dws_audience_enabled')
    {
      if (DWS.DEBUG) {console.debug("DWS: Audience mics disabled.")};

      // CHANGE BUTTON STATE
      updatePanel({PanelId: "dws_audience_disabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_audience_enabled", Location: "Hidden"});

      // TOGGLE MUTE ON ALL ETHERNET MICROPHONES EXCEPT THE PRESENTER
      for(let i = 1; i < 9; i++)
      {
        if (i != DWS_PRESENTER_MIC_ID)
        {
          xapi.Config.Audio.Input.Ethernet[i].Mode.set("Off");
        }                
      }   
    }
    else if (event.PanelId == 'dws_wireless_disabled')
    {
      if (DWS.DEBUG) {console.debug("DWS: Wireless mics enabled.")};

      // CHANGE BUTTON STATE
      updatePanel({PanelId: "dws_wireless_enabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_wireless_disabled", Location: "Hidden"});

      // TOGGLE MUTE ON WIRELESS INPUTS BASED ON CONFIG
      if (DWS.PRESENTER_USB == "on")
      {
        xapi.Config.Audio.Input.USBInterface[1].Mode.set("On");
      }
      if (DWS.PRESENTER_ANALOG == "on")
      {
        xapi.Config.Audio.Input.Microphone[1].set("On");
      }
    }
    else if (event.PanelId == 'dws_wireless_enabled')
    {
      if (DWS.DEBUG) {console.debug("DWS: Wireless mics disabled.")};

      // CHANGE BUTTON STATE
      updatePanel({PanelId: "dws_wireless_disabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_wireless_enabled", Location: "Hidden"});

      // TOGGLE MUTE ON WIRELESS INPUTS BASED ON CONFIG
      if (DWS.PRESENTER_USB == "on")
      {
        xapi.Config.Audio.Input.USBInterface[1].Mode.set("Off");
      }
      if (DWS.PRESENTER_ANALOG == "on")
      {
        xapi.Config.Audio.Input.Microphone[1].set("Off");
      }
    }

    //============================//
    //   CAMERA SELECTION EVENTS  //
    //============================//
    else if (event.PanelId == 'dws_automation_disabled')
    {
      if (DWS.DEBUG) {console.debug("DWS: Automatic mode activated.")};

      // CHANGE BUTTON STATE
      updatePanel({PanelId: "dws_automation_enabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_automation_disabled", Location: "Hidden"});

      // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
      xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

      // SET THE AUTOMODE TRIGGER TO ON
      DWS_AUTOMODE_STATE = 'On';

      // SET LOCAL SPEAKERTRACK MODE
      xapi.Command.Cameras.SpeakerTrack.Activate();
      xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();

      // ENABLE PRESENTER TRACK
      xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });

      // ACTIVATE REMOTE SPEAKERTRACK
      sendMessage(DWS.NODE1_HOST, "EnableST");
      if (DWS.NWAY == 'Three Way')
      {
        sendMessage(DWS.NODE2_HOST, "EnableST");
      }
    }
    else if (event.PanelId == 'dws_automation_enabled')
    {
      if (DWS.DEBUG) {console.debug("DWS: Automatic mode deactivated.")};

      // CHANGE BUTTON STATE
      updatePanel({PanelId: "dws_automation_disabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_automation_enabled", Location: "Hidden"});

      // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
      xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

      // SET THE AUTOMODE TRIGGER TO OFF
      DWS_AUTOMODE_STATE = 'Off';

      // DISABLE PRESENTER TRACK
      xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Off' });

      // DEACTIVE LOCAL SPEAKERTRACK
      xapi.Command.Cameras.SpeakerTrack.Deactivate();

      // DEACTIVE REMOTE SPEAKERTRACK
      sendMessage(DWS.NODE1_HOST, "DisableST");
      if (DWS.NWAY == 'Three Way')
      {
        sendMessage(DWS.NODE2_HOST, "DisableST");
      }
    }
    else if (event.PanelId == 'dws_fixed_sxs')
    {
      if (DWS.DEBUG) {console.debug("DWS: Side by Side composition selected.")};

      // SET VIDEO COMPOSITON
      if (DWS.NWAY == 'Two Way')
      {
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2], Layout: 'Equal'});
      }
      else
      {
        xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2,3], Layout: 'Equal'});
      }

      // TOGGLE AUTOMATION BUTTON
      updatePanel({PanelId: "dws_automation_disabled", Location: "CallControls"});
      updatePanel({PanelId: "dws_automation_enabled", Location: "Hidden"});

      // TURN OFF AUTOMODE
      DWS_AUTOMODE_STATE = 'Off';

      // DISABLE AUTOMATION
      xapi.Command.Cameras.PresenterTrack.Set({Mode: "Off"});

      // ACTIVATE LOCAL SPEAKERTRACK
      xapi.Command.Cameras.SpeakerTrack.Deactivate();

      // ACTIVATE REMOTE SPEAKERTRACK
      sendMessage(DWS.NODE1_HOST, "DisableST");
      if (DWS.NWAY == 'Three Way')
      {
        sendMessage(DWS.NODE2_HOST, "DisableST");
      }
    }
    else if (event.PanelId == 'dws_fixed_randp')
    {
      if (DWS.DEBUG) {console.debug("DWS: Rooms and Presenter composition selected.")};    

      // CHECK FOR PRESENTER TRACK SETUP
      xapi.Status.Cameras.PresenterTrack.Availability.get()
      .then(response => {
        if (response == 'Available')
        {
          // SET VIDEO COMPOSITON
          if (DWS.NWAY == 'Two Way')
          {
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [1,2,DWS_PRESENTER_CAM_ID], Layout: 'Equal'});
          }
          else
          {
            xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: [DWS_PRESENTER_CAM_ID,1,2,3], Layout: 'Equal'});
          }

          // TOGGLE AUTOMATION BUTTON
          updatePanel({PanelId: "dws_automation_disabled", Location: "CallControls"});
          updatePanel({PanelId: "dws_automation_enabled", Location: "Hidden"});

          // TURN OFF AUTOMODE
          DWS_AUTOMODE_STATE = 'Off'; 

          // ENABLE PRESENTER TRACK
          xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });

          // DISABLE LOCAL SPEAKERTRACK
          xapi.Command.Cameras.SpeakerTrack.Deactivate();

          // DISABLE REMOTE SPEAKERTRACK
          sendMessage(DWS.NODE1_HOST, "DisableST");
          if (DWS.NWAY == 'Three Way')
          {
            sendMessage(DWS.NODE2_HOST, "DisableST");
          }
        }
        else
        {
          xapi.Command.UserInterface.Message.Alert.Display({ Duration: '15', Title:"Configuration Required", Text: "Presenter Track has not been configured. Please contact your administrator."});
        }
      })
      .catch(error => {
        console.error("DWS: Issue getting Presenter Track configuration: ", error);
      })      
    }
  });

  //===================================//
  //  EVENT LISTENER FOR UI EXTENSION  //
  //===================================//
  xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
    if (event.Type == 'released' || event.Type == 'changed') {   
      switch(event.WidgetId)
      {
        //==================//
        //  COMBINE ACTION  //
        //==================//
        case 'dws_combine': // LISTEN FOR INITIAL COMBINE BUTTON PRESS
          if (DWS.DEBUG) {console.debug("DWS: Combine requested. Confirming with user before beginning.")};

          if(DWS.NWAY == 'Three Way' && DWS_COMBINE_NODE1 == 'off' && DWS_COMBINE_NODE2 == 'off')
          {
            xapi.Command.UserInterface.Message.Alert.Display({ Duration: '0', Title:"Selection Required", Text: "Please select one or more Workspace(s)."});
            break;
          }
          else if(DWS.NWAY == 'Three Way' && DWS_COMBINE_NODE1 == 'on' && DWS_COMBINE_NODE2 == 'on')
          {
            // PERFORM ROOM ACTIVITY CHECK
            if(checkActivity('All'))
            {
              // CONFIRM THE ACTION WITH THE END USER
              xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmCombine', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Combine Room Request' })
            }
          }
          else if (DWS.NWAY == 'Three Way' && DWS_COMBINE_NODE1 == 'on' && DWS_COMBINE_NODE2 == 'off')
          {
            // PERFORM ROOM ACTIVITY CHECK
            if(checkActivity('Node1'))
            {
              // CONFIRM THE ACTION WITH THE END USER
              xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmCombine', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Combine Room Request' })
            }
          }
          else if (DWS.NWAY == 'Three Way' && DWS_COMBINE_NODE1 == 'off' && DWS_COMBINE_NODE2 == 'on')
          {
            // PERFORM ROOM ACTIVITY CHECK
            if(checkActivity('Node2'))
            {
              // CONFIRM THE ACTION WITH THE END USER
              xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmCombine', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Combine Room Request' })
            }
          }
          else
          {
            // PERFORM ROOM ACTIVITY CHECK
            if(checkActivity('Node1'))
            {
              // CONFIRM THE ACTION WITH THE END USER
              xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmCombine', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Combine Room Request' })
            }

            // DEFAULT NODE 1 ON FOR TWO WAY TRIGGERS
            DWS_COMBINE_NODE1 == 'on';
          }          
          break;

        case 'dws_combine_node1': 
          DWS_COMBINE_NODE1 = event.Value;
          if (DWS.DEBUG) {console.debug("DWS: Toggling Node 1 for Combine: " + DWS_COMBINE_NODE1)};          
          break;
      
        case 'dws_combine_node2':
          DWS_COMBINE_NODE2 = event.Value;
          if (DWS.DEBUG) {console.debug("DWS: Toggling Node 2 for Combine: " + DWS_COMBINE_NODE2)};          
          break;

        //==================//
        //   SPLIT ACTION   //
        //==================//
        case 'dws_split': // LISTEN FOR SPLIT BUTTON PRESS 
          if (DWS.DEBUG) {console.debug("DWS: Split requested. Confirming with user before beginning.")};

          // CONFIRM THE ACTION WITH THE END USER
          xapi.Command.UserInterface.Message.Prompt.Display({ FeedbackId: 'confirmSplit', "Option.1": "Yes", "Option.2": "No", Text: 'This process takes approximately 2 minutes to complete. Do you want to proceed?', Title: 'Confirm Split Room Request' })
          break;

        //===================================//
        //   ADVANCED SETTINGS PANEL EVENTS  //
        //===================================//
        case 'dws_unlock': // LISTEN FOR ADVANCED PANEL UNLOCK  
          if (DWS.DEBUG) {console.debug("DWS: Advanced settings unlock requested.")};

          // TRIGGER PIN CHALLENGE - IF SUCCESSFUL WILL TRIGGER BASED ON FEEDBACK REGISTER FOR FEEDBACKID.
          xapi.Command.UserInterface.Message.TextInput.Display({
            Title: `Unlock Advanced Settings`,
            Text: 'Enter the Unlock PIN:',
            Placeholder: 'Enter the PIN set during installation.',
            InputType: 'PIN',
            FeedbackId: 'unlockSettings'
          })
          break;

        case 'dws_adv_edit_automode': // LISTEN FOR AUTOMATION DEFAULT EDIT BUTTON
          if (DWS.DEBUG) {console.debug("DWS: Prompting for change in Automation default.")};

          // PROMPT THE USER FOR THE NEW DEFAULT
          xapi.Command.UserInterface.Message.Prompt.Display({
            Title: `Default Automation Mode`,
            Text: 'Select your new default automation mode for combined state.',
            FeedbackId: 'changeAutomation',
            "Option.1": "On",
            "Option.2": "Off"
          });
          break;

        case 'dws_adv_edit_ducking': // LISTEN FOR AUTO DUCKING EDIT BUTTON
          if (DWS.DEBUG) {console.debug("DWS: Prompting for change in Automation default.")};

          // PROMPT THE USER FOR THE NEW DEFAULT
          xapi.Command.UserInterface.Message.Prompt.Display({
            Title: `Default Ducking Mode`,
            Text: 'Select the default mode for Automatic Microphone Ducking.',
            FeedbackId: 'changeDucking',
            "Option.1": "On",
            "Option.2": "Off"
          });
          break;

        case "dws_adv_primary_delay": // LISTEN FOR CHANGE IN GAIN/LEVEL ON AUDIENCE MICS
          if (event.Value == 'increment')
          {
            DWS_ADV_PRI_DELAY = DWS.PRIMARY_DELAY + 1;
            DWS.PRIMARY_DELAY = DWS_ADV_PRI_DELAY;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_PRI_DELAY, WidgetId: 'dws_adv_primary_delay' });          

            if (DWS.DEBUG) {console.debug("DWS: Primary delay changed to: " + DWS_ADV_PRI_DELAY)};            
          }
          else if (event.Value == 'decrement') 
          {
            if (DWS.PRIMARY_DELAY != 0)
            {
              DWS_ADV_PRI_DELAY = DWS.PRIMARY_DELAY - 1;
              DWS.PRIMARY_DELAY = DWS_ADV_PRI_DELAY;
            }

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_PRI_DELAY, WidgetId: 'dws_adv_primary_delay' });
            
            if (DWS.DEBUG) {console.debug("DWS: Primary delay changed to: " + DWS_ADV_PRI_DELAY)}; 
          }          
          break;

        case "dws_adv_primary_high": // LISTEN FOR CHANGE IN GAIN/LEVEL ON AUDIENCE MICS
          if (event.Value == 'increment')
          {
            DWS_ADV_HIGH_PRI = DWS.MICS_HIGH_PRI + 1;
            DWS.MICS_HIGH_PRI = DWS_ADV_HIGH_PRI;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_HIGH_PRI, WidgetId: 'dws_adv_primary_high' });

            if (DWS.DEBUG) {console.debug("DWS: Primary audience high trigger changed to: " + DWS_ADV_HIGH_PRI)};            
          }
          else if (event.Value == 'decrement') 
          {
            DWS_ADV_HIGH_PRI = DWS.MICS_HIGH_PRI - 1;
            DWS.MICS_HIGH_PRI = DWS_ADV_HIGH_PRI;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_HIGH_PRI, WidgetId: 'dws_adv_primary_high' });
            
            if (DWS.DEBUG) {console.debug("DWS: Primary audience high trigger changed to: " + DWS_ADV_HIGH_PRI)}; 
          }          
          break;

        case "dws_adv_node1_high": // LISTEN FOR CHANGE IN GAIN/LEVEL ON AUDIENCE MICS
          if (event.Value == 'increment')
          {
            DWS_ADV_HIGH_NODE1 = DWS.MICS_HIGH_NODE1 + 1;
            DWS.MICS_HIGH_NODE1 = DWS_ADV_HIGH_NODE1;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_HIGH_NODE1, WidgetId: 'dws_adv_node1_high' });

            if (DWS.DEBUG) {console.debug("DWS: Node 1 audience high trigger changed to: " + DWS_ADV_HIGH_NODE1)};            
          }
          else if (event.Value == 'decrement') 
          {
            DWS_ADV_HIGH_NODE1 = DWS.MICS_HIGH_NODE1 - 1;
            DWS.MICS_HIGH_NODE1 = DWS_ADV_HIGH_NODE1;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_HIGH_NODE1, WidgetId: 'dws_adv_node1_high' });
            
            if (DWS.DEBUG) {console.debug("DWS: Node 1 audience high trigger changed to: " + DWS_ADV_HIGH_NODE1)}; 
          }          
          break;

        case "dws_adv_node2_high": // LISTEN FOR CHANGE IN GAIN/LEVEL ON AUDIENCE MICS
          if (event.Value == 'increment')
          {
            DWS_ADV_HIGH_NODE2 = DWS.MICS_HIGH_NODE2 + 1;
            DWS.MICS_HIGH_NODE2 = DWS_ADV_HIGH_NODE2;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_HIGH_NODE2, WidgetId: 'dws_adv_node2_high' });

            if (DWS.DEBUG) {console.debug("DWS: Node 2 audience high trigger changed to: " + DWS_ADV_HIGH_NODE2)};            
          }
          else if (event.Value == 'decrement') 
          {
            DWS_ADV_HIGH_NODE2 = DWS.MICS_HIGH_NODE2 - 1;
            DWS.MICS_HIGH_NODE2 = DWS_ADV_HIGH_NODE2;

            xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_HIGH_NODE2, WidgetId: 'dws_adv_node2_high' });
            
            if (DWS.DEBUG) {console.debug("DWS: Node 2 audience high trigger changed to: " + DWS_ADV_HIGH_NODE2)}; 
          }          
          break;

        case "dws_adv_save": // ADVANCED PANEL SAVE FUNCTION TRIGGER
          // SAVE CONFIGURATION BASED ON CHANGES
          saveConfiguration();

          // ADJUST DELAY ON ALL AUDIO OUTPUTS
          setPrimaryDelay(DWS_ADV_PRI_DELAY);
          break;
      }
    }
  });
}

//============================//
//   ADVANCED PANEL TRIGGER   //
//============================//
xapi.Event.UserInterface.Message.TextInput.Response.on(event => {

  if (DWS.DEBUG) {console.debug("DWS: Unlock attempt. Entered PIN: " + event.Text)};

  if(event.FeedbackId == 'unlockSettings' && event.Text == DWS.UNLOCK_PIN)
  {
    if (DWS.DEBUG) {console.debug('DWS: PIN accepted. Displaying advanced panel.')};

    createPanels("Unlocked");
  }
  else
  {
    if (DWS.DEBUG) {console.warn("DWS: Entered PIN did not match configured PIN.")};
  }              
})

//===============================//
//   ADVANCED PANEL LOCK RESET   //
//===============================//
// LISTEN FOR PANEL CLOSURE THEN RELOCK THE ADVANCED PANEL
xapi.Event.UserInterface.Extensions.Event.PageClosed
.on(value => {
  if (value.PageId == 'dws_adv_unlocked')
  {
    if (DWS.DEBUG) {console.debug("DWS: Advanced panel closed. Re-locking")};
    
    createPanels("Locked");
  }
})

//===========================================//
//   SPLIT / COMBINE CONFIRMATION TRIGGERS   //
//===========================================//
xapi.Event.UserInterface.Message.Prompt.Response.on(value => {
  if (value.OptionId == "1" && value.FeedbackId == 'confirmCombine') 
  {  
    // CHECK NWAY SETTING THEN PERFORM TRIGGERS
    if(DWS.NWAY == 'Three Way')
    {
      if (DWS_COMBINE_NODE1 == 'on' && DWS_COMBINE_NODE2 == 'on')
      {
        console.log("DWS: Combining Workspaces: All Nodes");

        // UPDATE CURRENT STATE
        DWS_CUR_STATE = "Combined All";

        // UPDATE VLANS FOR ACCESSORIES
        setVLANs('Combined All');

        // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
        setPrimaryState('Combined All');

        // INITIALIZE AZM WITH A 165 DELAY
        setTimeout(() => {startAZM()}, 165000);

        if (DWS.COMBINED_BANNER)
        {
          // SET ONSCREEN TEXT BANNER 
          xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS + ", " + DWS.NODE2_ALIAS});
        }
      }
      else if (DWS_COMBINE_NODE1 == 'on' && DWS_COMBINE_NODE2 == 'off')
      {
        console.log("DWS: Combining Workspaces: Only Node 1");

        // UPDATE CURRENT STATE
        DWS_CUR_STATE = "Combined Node1";

        // UPDATE VLANS FOR ACCESSORIES
        setVLANs('Combined Node1');

        // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
        setPrimaryState('Combined Node1');

        // INITIALIZE AZM WITH A 165 DELAY
        setTimeout(() => {startAZM()}, 165000);

        if (DWS.COMBINED_BANNER)
        {
          // SET ONSCREEN TEXT BANNER 
          xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS});
        }
      }
      else if (DWS_COMBINE_NODE1 == 'off' && DWS_COMBINE_NODE2 == 'on')
      {
        console.log("DWS: Combining Workspaces: Only Node 2");

        // UPDATE CURRENT STATE
        DWS_CUR_STATE = "Combined Node2";

        // UPDATE VLANS FOR ACCESSORIES
        setVLANs('Combined Node2');

        // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
        setPrimaryState('Combined Node2');

        // INITIALIZE AZM WITH A 165 DELAY
        setTimeout(() => {startAZM()}, 165000);

        if (DWS.COMBINED_BANNER)
        {
          // SET ONSCREEN TEXT BANNER 
          xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE2_ALIAS});
        }
      }
    }
    else
    {
      if (DWS.DEBUG) {console.debug("DWS: Combining Workspaces")};

      // UPDATE CURRENT STATE
      DWS_CUR_STATE = "Combined Node1";

      // UPDATE VLANS FOR ACCESSORIES
      setVLANs('Combined Node1');

      // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
      setPrimaryState('Combined Node1');

      // INITIALIZE AZM WITH A 165 DELAY
      setTimeout(() => {startAZM()}, 165000);

      if (DWS.COMBINED_BANNER)
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS});
      }
    }

    // UPDATE STATUS ALERT
    updateStatus('Combine');
    DWS_INTERVAL = setInterval(() => {updateStatus('Combine')}, 3000);

    // CREATE COMBINED PANELS AND CLOSE CONTROL PANEL
    createPanels('Combined');
    xapi.Command.UserInterface.Extensions.Panel.Close({ Target: 'Controller' });

    // CONFIGURE DELAY FOR AUDIO OUTPUTS
    setPrimaryDelay(DWS.PRIMARY_DELAY);

    //RESET SECONDARY PERIPHERAL COUNT
    let FOUND_NAVS = 0;
    let FOUND_MICS = 0;

    // MONITOR FOR MIGRATED DEVICES AND CONFIGURE ACCORDING TO USER SETTINGS
    const REG_DEVICES = xapi.Status.Peripherals.ConnectedDevice
    .on(device => {
      if (device.Status === 'Connected') 
      {
        // MONITOR FOR TOUCH PANELS
        if (device.Type === 'TouchPanel') 
        {
          if (device.ID === DWS.NODE1_NAV_CONTROL) 
          {
            if (DWS.DEBUG) {console.debug("DWS: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
            // PAIR FOUND NAV AFTER 1500 MS  DELAY
            setTimeout(() => {pairSecondaryNav(device.ID, 'InsideRoom', 'Controller')}, 1500);
            FOUND_NAVS = DWS_TEMP_NAVS.push(device.SerialNumber);
          }
          if (device.ID === DWS.NODE1_NAV_SCHEDULER) 
          {
            if (DWS.DEBUG) {console.debug("DWS: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
            // PAIR FOUND NAV AFTER 1500 MS DELAY
            setTimeout(() => {pairSecondaryNav(device.ID, 'OutsideRoom', 'RoomScheduler')}, 1500);
          }
          if (device.ID === DWS.NODE2_NAV_CONTROL) 
          {
            if (DWS.DEBUG) {console.debug("DWS: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
            // PAIR FOUND NAV AFTER 1500 MS  DELAY
            setTimeout(() => {pairSecondaryNav(device.ID, 'InsideRoom', 'Controller')}, 1500);
            FOUND_NAVS = DWS_TEMP_NAVS.push(device.SerialNumber);
          }
          if (device.ID === DWS.NODE2_NAV_SCHEDULER) 
          {
            if (DWS.DEBUG) {console.debug("DWS: Discovered Navigator: " + device.SerialNumber + " / " + device.ID)};
            // PAIR FOUND NAV AFTER 1500 MS DELAY
            setTimeout(() => {pairSecondaryNav(device.ID, 'OutsideRoom', 'RoomScheduler')}, 1500);
            FOUND_NAVS = DWS_TEMP_NAVS.push(device.SerialNumber);
          }
        }

        // MONITOR FOR ALL SECONDARY MICS TO BE CONNECTED
        if (device.Type === 'AudioMicrophone') 
        {      
          if (DWS.NODE1_MICS.includes(device.SerialNumber) || DWS.NODE2_MICS.includes(device.SerialNumber)) 
          {
            if (DWS.DEBUG) {console.debug("DWS: Discovered Microphone: " + device.SerialNumber)};

            // STORE FOUND MIC TEMP ARRAY IN NOT ALREADY THERE
            if (!(DWS_TEMP_MICS.includes(device.SerialNumber))) 
            {                
              FOUND_MICS = DWS_TEMP_MICS.push(device.SerialNumber);
            }
          }
        }

        // CHECK IF THIS IS ALL OF THE CONFIGURED PERIPHERALS 
        if (DWS_CUR_STATE == 'Combined All')
        {
          if (FOUND_NAVS == (DWS_NODE1_NAVS + DWS_NODE2_NAVS) && FOUND_MICS == (DWS_NODE1_MICS + DWS_NODE2_MICS))
          {
            setTimeout(() => { if (DWS.DEBUG) {console.debug("DWS: All Node Peripherals Migrated.")};}, 2000);

            // UPDATE TIMER TO SET 100% COMPLETION ON STATUS BAR
            DWS_TIMER = 170000;

            // STOP LISTENING FOR DEVICE REGISTRATION EVENTS
            setTimeout(() => {REG_DEVICES()}, 5000);
          }
        }           
        else if (DWS_CUR_STATE == 'Combined Node1')
        {
          if (FOUND_NAVS == DWS_NODE1_NAVS && FOUND_MICS == DWS_NODE1_MICS)
          {
            setTimeout(() => { if (DWS.DEBUG) {console.debug("DWS: All Node Peripherals Migrated.")};}, 2000);

            // UPDATE TIMER TO SET 100% COMPLETION ON STATUS BAR
            DWS_TIMER = 170000;

            // STOP LISTENING FOR DEVICE REGISTRATION EVENTS
            setTimeout(() => {REG_DEVICES()}, 5000);
          }
        } 
        else if (DWS_CUR_STATE == 'Combined Node2')
        {
          if (FOUND_NAVS == DWS_NODE2_NAVS && FOUND_MICS == DWS_NODE2_MICS)
          {
            setTimeout(() => { if (DWS.DEBUG) {console.debug("DWS: All Node Peripherals Migrated.")};}, 2000);

            // UPDATE TIMER TO SET 100% COMPLETION ON STATUS BAR
            DWS_TIMER = 170000;

            // STOP LISTENING FOR DEVICE REGISTRATION EVENTS
            setTimeout(() => {REG_DEVICES()}, 5000);
          }
        }        
      }      
    })
  }
  else if (value.OptionId == '1' && value.FeedbackId == 'confirmSplit') 
  { 
    if (DWS.DEBUG) {console.debug("DWS: Split action confirmed. Splitting rooms.")}

    // CLOSE THE DWS CONTROL PANEL
    xapi.Command.UserInterface.Extensions.Panel.Close({ Target: 'Controller' });

    // RESET ANY COMPOSITIONS FOR MAIN VIDEO SOURCE
    xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

    // UPDATE CURRENT STATE
    DWS_CUR_STATE = "Split";

    // STOP AZM
    AZM.Command.Zone.Monitor.Stop();

    // UPDATE VLANS FOR ACCESSORIES
    setVLANs('Split');

    // UPDATE SAVED STATE IN CASE OF MACRO RESET / REBOOT
    setPrimaryState("Split");  

    // CONFIGURE DELAY FOR AUDIO OUTPUTS
    setPrimaryDelay(0);

    // UPDATE UI EXTENSION PANEL
    createPanels('Split');

    // UPDATE THE PANEL TO SHOW A STATUS OF SPLIT
    xapi.Command.UserInterface.Extensions.Widget.SetValue({WidgetId: 'dws_state', Value: 'Split'});

    // REMOVE ONSCREEN BANNER
    xapi.Command.Video.Graphics.Clear({ Target: 'LocalOutput' });

    // UPDATE STATUS ALERT
    updateStatus('Split');
    DWS_INTERVAL = setInterval(() => {updateStatus('Split')}, 3000);      
  }

  // ADVANCED PANEL - AUTOMATION MODE TRIGGERS
  else if (value.FeedbackId == 'changeAutomation') 
  {
    if (value.OptionId == '1') // ENABLE AUTOMATION BY DEFAULT
    {
      DWS_ADV_AUTO_DEFAULT = 'On';
    }    
    else if (value.OptionId == '2') // DISABLE AUTOMATION BY DEFAULT
    {
      DWS_ADV_AUTO_DEFAULT = 'Off';
    }

    // UPDATE ADV PANEL ELEMENT
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_adv_automode', Value: DWS_ADV_AUTO_DEFAULT });   
  }
  // ADVANCED PANEL - AUTOMATION MODE TRIGGERS
  else if (value.FeedbackId == 'changeDucking') 
  {
    if (value.OptionId == '1') // ENABLE AUTOMATION BY DEFAULT
    {
      DWS_ADV_DUCKING = 'On';
    }    
    else if (value.OptionId == '2') // DISABLE AUTOMATION BY DEFAULT
    {
      DWS_ADV_DUCKING = 'Off';
    }

    // UPDATE ADV PANEL ELEMENT
    xapi.Command.UserInterface.Extensions.Widget.SetValue({ WidgetId: 'dws_adv_ducking', Value: DWS_ADV_DUCKING });   
  }
})

//===========================//
//   PANEL UPDATE FUNCTION   //
//===========================//
function updatePanel(params)
{
  // UPDATE PANEL BASED ON SENT PARAMETERS
  xapi.Command.UserInterface.Extensions.Panel.Update(params);
}

//=================================//
//   NODE CODEC ACTIVITY CHECKER   //
//=================================//
async function checkActivity(selectedNodes) 
{
  if (selectedNodes === 'All') 
  {
    const READY_NODE1 = await connectNode(1, DWS.NODE1_HOST);
    const READY_NODE2 = await connectNode(2, DWS.NODE2_HOST);

    if (READY_NODE1 && READY_NODE2) 
    {
      if (DWS.DEBUG) {console.debug("DWS: Activity check passed. Nodes ready to combine.")}
      return true;
    } 
    else 
    {
      if (DWS.DEBUG) {console.warn("DWS: Activity check failed. Nodes codecs are in active use.")}
        
      // ALERT USER TO CODECS BEING IN USE AND STOP
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '15', Title:"Selected Workspace(s) in Use", Text: "One of the workspaces selected is currently in use.<br>Combine request cancelled."});

      return false;
    }
  }
  else if (selectedNodes === 'Node1') 
  {
    const READY_NODE1 = await connectNode(1, DWS.NODE1_HOST);

    if (READY_NODE1) 
    {
      if (DWS.DEBUG) {console.debug("DWS: Activity check passed. Nodes ready to combine.")}
      return true;
    } 
    else 
    {
      if (DWS.DEBUG) {console.warn("DWS: Activity check failed. Nodes codecs are in active use.")}
        
      // ALERT USER TO CODECS BEING IN USE AND STOP
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '15', Title:"Selected Workspace(s) in Use", Text: "One of the workspaces selected is currently in use.<br>Combine request cancelled."});

      return false;
    }
  }
  else if (selectedNodes === 'Node2') 
  {
    const READY_NODE2 = await connectNode(1, DWS.NODE2_HOST);

    if (READY_NODE2) 
    {
      if (DWS.DEBUG) {console.debug("DWS: Activity check passed. Nodes ready to combine.")}
      return true;
    } 
    else 
    {      
      if (DWS.DEBUG) {console.warn("DWS: Activity check failed. Nodes codecs are in active use.")}

      // ALERT USER TO CODECS BEING IN USE AND STOP
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '15', Title:"Selected Workspace(s) in Use", Text: "One of the workspaces selected is currently in use.<br>Combine request cancelled."});

      return false;
    }
  }
}

async function connectNode(node, host) 
{
  let Params = {
    Timeout: 5,
    AllowInsecureHTTPS: 'True',
    ResultBody: 'PlainText',
    Url: `https://${host}/getxml?location=Status`,
    Header: [`Authorization: Basic ${DWS.MACRO_LOGIN}`, 'Content-Type: application/json']
  };

  return xapi.Command.HttpClient.Get(Params)
  .then(response => {
    const isSharing = extractTagValue(response.Body, 'SendingMode');
    const inCall = extractTagValue(response.Body, 'NumberOfActiveCalls');
    return (isSharing == null && inCall == 0);
  })
  .catch(error => {
    console.error(`DWS: Error connecting to Node: ${node}`, error);
    return false;
  });
}

function extractTagValue(xml, tag) 
{
  const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

//=================================//
//   SWITCH DETAILS VIA RESTCONF   //
//=================================//
function registerLinkLocal() 
{
  const url = `https://169.254.1.254/restconf/data/Cisco-IOS-XE-device-hardware-oper:device-hardware-data/device-hardware/device-inventory/`;

  xapi.Command.HttpClient.Get({ 
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

    if (DWS.DEBUG) {console.debug("DWS: Link Local Switch Serial:", SWITCH_SERIAL)};
    if (DWS.DEBUG) {console.debug("DWS: Link Local Switch Model:", SWITCH_MODEL)};

    xapi.Command.Peripherals.Connect({ HardwareInfo: SWITCH_MODEL, ID: SWITCH_SERIAL, Name: SWITCH_MODEL, NetworkAddress: "169.254.1.254", SerialNumber: SWITCH_SERIAL, Type: 'ControlSystem' })
    .then (() => {
      if (DWS.DEBUG) {console.debug('DWS: Link Local Switch registered to Control Hub.')};

      // SET REPORTING HEART BEAT TO 5.5 MINUTES
      xapi.Command.Peripherals.HeartBeat( { ID: SWITCH_SERIAL, Timeout: 330 });

      // WAIT 5 MINUTES THEN RERUN THIS SAME FUNCTION
      setTimeout (() => { registerLinkLocal() }, 300000);
    })  
    .catch (error => {
      console.error ('Failed to register switch to Control Hub: ', error.message);

      // WAIT 5 MINUTES THEN RERUN THIS SAME FUNCTION
      setTimeout (() => { registerLinkLocal() }, 300000);
    })
  })
  .catch(error => {
    console.error('Failed to get switch details:', error.message);

    // WAIT 5 MINUTES THEN RERUN THIS SAME FUNCTION
      setTimeout (() => { registerLinkLocal() }, 300000);
  });
}

//====================================//
//   PRIMARY DELAY CHANGING FUNCTION  //
//====================================//
async function setPrimaryDelay(newDelay)
{
  // UPDATE ALL OUTPUTS WITH NEW DELAY VALUE
  try
  {
    if (DWS.PLATFORM == 'Codec Pro')
    {
      await xapi.Config.Audio.Output.ARC[1].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.HDMI[2].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.HDMI[3].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[1].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[2].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[3].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[4].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[5].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[6].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.USBInterface[1].Delay.DelayMs.set(newDelay);
    }
    else if (DWS.PLATFORM == 'Room Kit EQ')
    {
      await xapi.Config.Audio.Output.ARC[1].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.HDMI[2].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.HDMI[3].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.Line[1].Delay.DelayMs.set(newDelay);
      await xapi.Config.Audio.Output.USBInterface[1].Delay.DelayMs.set(newDelay);
    }

    if (DWS.DEBUG) {console.debug('DWS: Primary output delay modified successfully.')};
  }
  catch (error)
  {
    console.error("DWS: Failed to modify output delay: "+error);
  }
}

//==================================//
//   CONFIG MACRO SAVING FUNCTION   //
//==================================//
function saveConfiguration()
{
  // CREATE MACRO BODY
  const dataStr = `
/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way and
Three-Way Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
Robert(Bobby) McGonigle Jr
Chase Voisin
William Mills

Version: 0.9.6 (BETA)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                        **** ADMIN SETTINGS ****                         //
//=========================================================================*/

// ENABLE OR DISABLE ADDITIONAL "DEBUG" LEVEL CONSOLE OUTPUT
// TRACKING DEBUG PROVIDES MICROPHONE ACTIVITY "DEBUG" DURING COMBINED CALLS
// ACCEPTED VALUES: true, false
const DEBUG = ${DWS.DEBUG}; 
const TRACKING_DEBUG = ${DWS.TRACKING_DEBUG};

// ONLY CHANGE IF YOU ARE NOT USING THE DEFAULT U:P IN USB CONFIGURATION FILE
const SWITCH_USERNAME = ${JSON.stringify(DWS.SWITCH_USERNAME, null, 2)};
const SWITCH_PASSWORD = ${JSON.stringify(DWS.SWITCH_PASSWORD, null, 2)};

// ENABLE OR DISABLE THE COMBINED ROOM BANNER ON DISPLAYS
// ACCEPTED VALUES: true, false
const COMBINED_BANNER = ${DWS.COMBINED_BANNER};

// ENABLE OR DISABLE THE AUTOMATIC DUCKING OF ETHERNET MICS BASED ON USB / ANALOG INPUT
// ACCEPTED VALUES: 'On', 'Off'
const AUTO_DUCKING = ${JSON.stringify(DWS_ADV_DUCKING, null, 2)};

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const NWAY = ${JSON.stringify(DWS.NWAY, null, 2)};
const SWITCH_TYPE = ${JSON.stringify(DWS.SWITCH_TYPE, null, 2)};
const MACRO_LOGIN = ${JSON.stringify(DWS.MACRO_LOGIN, null, 2)};
const NODE1_HOST = ${JSON.stringify(DWS.NODE1_HOST, null, 2)};
const NODE1_ALIAS = ${JSON.stringify(DWS.NODE1_ALIAS, null, 2)};     
const NODE1_DISPLAYS = ${JSON.stringify(DWS.NODE1_DISPLAYS, null, 2)};            
const NODE1_NAV_CONTROL = ${JSON.stringify(DWS.NODE1_NAV_CONTROL, null, 2)};
const NODE1_NAV_SCHEDULER = ${JSON.stringify(DWS.NODE1_NAV_SCHEDULER, null, 2)};
const NODE2_HOST = ${JSON.stringify(DWS.NODE2_HOST, null, 2)}; 
const NODE2_ALIAS = ${JSON.stringify(DWS.NODE2_ALIAS, null, 2)};    
const NODE2_DISPLAYS = ${JSON.stringify(DWS.NODE2_DISPLAYS, null, 2)};            
const NODE2_NAV_CONTROL = ${JSON.stringify(DWS.NODE2_NAV_CONTROL, null, 2)};
const NODE2_NAV_SCHEDULER = ${JSON.stringify(DWS.NODE2_NAV_SCHEDULER, null, 2)};
const PRESENTER_MIC = ${JSON.stringify(DWS.PRESENTER_MIC, null, 2)};
const PRESENTER_USB = ${JSON.stringify(DWS.PRESENTER_USB, null, 2)};
const PRESENTER_ANALOG = ${JSON.stringify(DWS.PRESENTER_ANALOG, null, 2)};
const PRIMARY_MICS = ${JSON.stringify(DWS.PRIMARY_MICS, null, 2)};
const NODE1_MICS = ${JSON.stringify(DWS.NODE1_MICS, null, 2)};
const NODE2_MICS = ${JSON.stringify(DWS.NODE2_MICS, null, 2)};
const AUTOMODE_DEFAULT = ${JSON.stringify(DWS_ADV_AUTO_DEFAULT, null, 2)};
const UNLOCK_PIN = ${JSON.stringify(DWS.UNLOCK_PIN, null, 2)};      
const PRIMARY_VLAN = '100';
const NODE1_VLAN = '200';
const NODE2_VLAN = '300';
const PLATFORM = ${JSON.stringify(DWS.PLATFORM, null, 2)};  
const MICS_HIGH_PRI = ${DWS_ADV_HIGH_PRI};
const MICS_HIGH_NODE1 = ${DWS_ADV_HIGH_NODE1};
const MICS_HIGH_NODE2 = ${DWS_ADV_HIGH_NODE2};
const PRIMARY_DELAY = ${DWS_ADV_PRI_DELAY};

export default {
  COMBINED_BANNER,
  DEBUG,
  TRACKING_DEBUG,
  NWAY,
  SWITCH_USERNAME,
  SWITCH_PASSWORD, 
  MACRO_LOGIN,
  SWITCH_TYPE, 
  NODE1_HOST, 
  NODE1_ALIAS,
  NODE1_DISPLAYS,
  NODE1_NAV_CONTROL, 
  NODE1_NAV_SCHEDULER,
  NODE2_HOST, 
  NODE2_ALIAS,
  NODE2_DISPLAYS,
  NODE2_NAV_CONTROL, 
  NODE2_NAV_SCHEDULER,   
  PRESENTER_MIC, 
  PRESENTER_USB,
  PRESENTER_ANALOG,
  PRIMARY_MICS, 
  NODE1_MICS,
  NODE2_MICS,
  MICS_HIGH_PRI,
  MICS_HIGH_NODE1,
  MICS_HIGH_NODE2,
  PRIMARY_DELAY,
  AUTOMODE_DEFAULT,
  UNLOCK_PIN,  
  PRIMARY_VLAN, 
  NODE1_VLAN,
  NODE2_VLAN,
  PLATFORM,
  AUTO_DUCKING
};`;

  xapi.Command.Macros.Macro.Save({ Name: 'DWS_Config', Overwrite: 'True' }, dataStr)
    .then (response => {
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Saved Succesfully", Text: "Configuration changes have been saved."});
      if (DWS.DEBUG) {console.debug('DWS: Configuration updated successfully.')}
    })
    .catch(error => { console.error("DWS: Unable to save updated configuration."), error})
} 

//=================================//
//   STATE MACRO SAVING FUNCTION   //
//=================================//
function setPrimaryState(state)
{
  // CREATE MACRO BODY
  const dataStr = `
/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way and
Three-Way Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
Robert(Bobby) McGonigle Jr
Chase Voisin
William Mills

Version: 0.9.6 (BETA)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const STATE = '${state}';

export default {
  STATE, 
};`;

  // SAVE STATE MACRO
  xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr)
  .catch(error => { console.error("DWS: Unable to save state macro."), error})
}

//==================================//
//  UI EXTENSION MODIFIER FUNCTION  //
//==================================//
function createPanels(panelState) 
{
  // DRAW / UPDATE PANELS BASED ON PASSED STATE
  switch(panelState)
  {
    case 'Split':
      // PERFORM NWAY CHECK TO DETERMINE ROOM CONTROLS PANEL
      if (DWS.NWAY == 'Three Way')
      {
        const DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_controls</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.CONTROLS_ICON}</Content><Id>4ba5089042ecbae6dab45ccf0e5075492e1fbc179828305ff78fd44aed5da925</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Current Room Status:</Name><Widget><WidgetId>widget_15</WidgetId><Name>Current Room Status:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_state</WidgetId><Name>Text</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Manual Control</Name><Widget><WidgetId>widget_127</WidgetId><Name>Toggle all workspaces required then click Combine Rooms.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget><Widget><WidgetId>dws_alias_node1</WidgetId><Name>${DWS.NODE1_ALIAS}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_combine_node1</WidgetId><Type>ToggleButton</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_alias_node2</WidgetId><Name>${DWS.NODE2_ALIAS}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_combine_node2</WidgetId><Type>ToggleButton</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_combine</WidgetId><Name>Combine Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_room_control</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;
        
        xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_controls' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message))
      }
      else
      {
        const DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_controls</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.CONTROLS_ICON}</Content><Id>4ba5089042ecbae6dab45ccf0e5075492e1fbc179828305ff78fd44aed5da925</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Current Room Status:</Name><Widget><WidgetId>widget_15</WidgetId><Name>Current Room Status:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_state</WidgetId><Name>Text</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Manual Control</Name><Widget><WidgetId>dws_combine</WidgetId><Name>Combine Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_room_control</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;
        
        xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_controls' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message))
      }
      break;

    case 'Combined':
      // PERFORM NWAY CHECK TO DETERMINE ROOM CONTROLS PANEL
      if (DWS.NWAY == 'Three Way' && DWS_CUR_STATE == 'Combined All')
      {
        // UPDATE ROOM CONTROLS PANEL TO COMBINED STATE
        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>17</Order><PanelId>dws_controls</PanelId><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.CONTROLS_ICON}</Content><Id>4ba5089042ecbae6dab45ccf0e5075492e1fbc179828305ff78fd44aed5da925</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Row</Name><Widget><WidgetId>widget_314</WidgetId><Name>Combined with:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_combined_details</WidgetId><Name>${DWS.NODE1_ALIAS}, ${DWS.NODE2_ALIAS}</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_split</WidgetId><Name>Split Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_roomcontrols</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;
      }
      else if (DWS.NWAY == 'Three Way' && DWS_CUR_STATE == 'Combined Node1')
      {
        // UPDATE ROOM CONTROLS PANEL TO COMBINED STATE
        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>17</Order><PanelId>dws_controls</PanelId><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.CONTROLS_ICON}</Content><Id>4ba5089042ecbae6dab45ccf0e5075492e1fbc179828305ff78fd44aed5da925</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Row</Name><Widget><WidgetId>widget_314</WidgetId><Name>Combined with:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_combined_details</WidgetId><Name>${DWS.NODE1_ALIAS}</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_split</WidgetId><Name>Split Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_roomcontrols</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;
      }
      else if (DWS.NWAY == 'Three Way' && DWS_CUR_STATE == 'Combined Node2')
      {
        // UPDATE ROOM CONTROLS PANEL TO COMBINED STATE
        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>17</Order><PanelId>dws_controls</PanelId><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.CONTROLS_ICON}</Content><Id>4ba5089042ecbae6dab45ccf0e5075492e1fbc179828305ff78fd44aed5da925</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Row</Name><Widget><WidgetId>widget_314</WidgetId><Name>Combined with:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_combined_details</WidgetId><Name>${DWS.NODE2_ALIAS}</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_split</WidgetId><Name>Split Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_roomcontrols</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;
      }
      else
      {
        // UPDATE ROOM CONTROLS PANEL TO COMBINED STATE
        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>17</Order><PanelId>dws_controls</PanelId><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Room Controls</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.CONTROLS_ICON}</Content><Id>4ba5089042ecbae6dab45ccf0e5075492e1fbc179828305ff78fd44aed5da925</Id></CustomIcon><Page><Name>Room Controls</Name><Row><Name>Row</Name><Widget><WidgetId>widget_314</WidgetId><Name>Combined with:</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_combined_details</WidgetId><Name>${DWS.NODE1_ALIAS}</Name><Type>Text</Type><Options>size=2;fontSize=normal;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_split</WidgetId><Name>Split Rooms</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>dws_roomcontrols</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`; 
      }
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_controls' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message))
      break;

    case 'Locked':
      // UPDATE ADVANCED PANEL TO LOCKED STATE
      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_advanced</PanelId><Origin>local</Origin><Location>ControlPanel</Location><Icon>Custom</Icon><Name>Adv. Room Settings</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.ADVANCED_ICON}</Content><Id>a1da32f04d333f289e8c827aafb8dd1d417923604f11c46e5b4d838f6859100d</Id></CustomIcon><Page><Name>Advanced Room Settings</Name><Row><Name>Row</Name><Widget><WidgetId>widget_272</WidgetId><Name>The advanced settings panel allows administrators to modify configurations for your Divisible Workspaces.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Row</Name><Widget><WidgetId>dws_unlock</WidgetId><Name>Unlock Advanced Settings</Name><Type>Button</Type><Options>size=3</Options></Widget></Row><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;
      
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_advanced' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message))
      break;

    case 'Unlocked':
      // UPDATE ADVANCED PANEL TO UNLOCKED STATE
      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_advanced</PanelId><Origin>local</Origin><Location>ControlPanel</Location><Icon>Custom</Icon><Name>Adv. Room Settings</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.ADVANCED_ICON}</Content><Id>a1da32f04d333f289e8c827aafb8dd1d417923604f11c46e5b4d838f6859100d</Id></CustomIcon><Page><Name>Advanced Settings</Name><Row><Name>Default Camera Automation Mode</Name><Widget><WidgetId>dws_adv_automode</WidgetId><Name>${DWS.AUTOMODE_DEFAULT}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_adv_edit_automode</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Microphone Auto Ducking</Name><Widget><WidgetId>dws_adv_ducking</WidgetId><Name>${DWS.AUTO_DUCKING}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_adv_edit_ducking</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Primary Audio Output Delay (ms)</Name><Widget><WidgetId>widget_268</WidgetId><Name>Use this setting to sync the audio output of the primary codec with the node codecs.</Name><Type>Text</Type><Options>size=2;fontSize=small;align=center</Options></Widget><Widget><WidgetId>dws_adv_primary_delay</WidgetId><Type>Spinner</Type><Options>size=2;style=plusminus</Options></Widget></Row><Row><Name>Microphone "High" Thresholds</Name><Widget><WidgetId>widget_225</WidgetId><Name>Primary Audience Mics</Name><Type>Text</Type><Options>size=2;fontSize=small;align=center</Options></Widget><Widget><WidgetId>dws_adv_primary_high</WidgetId><Type>Spinner</Type><Options>size=2;style=plusminus</Options></Widget><Widget><WidgetId>widget_226</WidgetId><Name>Node 1 Audience Mics</Name><Type>Text</Type><Options>size=2;fontSize=small;align=center</Options></Widget><Widget><WidgetId>dws_adv_node1_high</WidgetId><Type>Spinner</Type><Options>size=2;style=plusminus</Options></Widget><Widget><WidgetId>widget_230</WidgetId><Name>Node 2 Audience Mics</Name><Type>Text</Type><Options>size=2;fontSize=small;align=center</Options></Widget><Widget><WidgetId>dws_adv_node2_high</WidgetId><Type>Spinner</Type><Options>size=2;style=plusminus</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_adv_save</WidgetId><Name>Apply Configuration</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>dws_adv_unlocked</PageId><Options/></Page></Panel></Extensions>`;

      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_advanced' }, DWS_PANEL)
        .then(() => {
           // SET VALUES FOR SPINNERS
           xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS.PRIMARY_DELAY, WidgetId: 'dws_adv_primary_delay' });
           xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS.MICS_HIGH_PRI, WidgetId: 'dws_adv_primary_high' });
           xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS.MICS_HIGH_NODE1, WidgetId: 'dws_adv_node1_high' });
           xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS.MICS_HIGH_NODE2, WidgetId: 'dws_adv_node2_high' });
           xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_AUTO_DEFAULT, WidgetId: 'dws_adv_automode' });
           xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: DWS_ADV_DUCKING, WidgetId: 'dws_adv_ducking' });
        })
        .catch(e => console.log('Error saving panel: ' + e.message))
      break;

    case 'InCall': // DRAW ALL INITAL IN CALL PANELS BASED ON CONFIG
   
      if (DWS_AUTOMODE_STATE == 'Off' || DWS_AUTOMODE_STATE == 'off')
      {
        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_automation_disabled</PanelId><Origin>local</Origin><Location>CallControls</Location><Icon>Custom</Icon><Name>Automation Disabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.AUTOMATION_DISABLED}</Content><Id>d96c86c03fb4f5e0577ff8ad7011c7875aea984545a271fbf9ebb243ca4eb0e4</Id></CustomIcon></Panel></Extensions>`;

        xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_automation_disabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_automation_enabled</PanelId><Origin>local</Origin><Location>Hidden</Location><Icon>Custom</Icon><Name>Automation Enabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.AUTOMATION_ENABLED}</Content><Id>e602eeacb23516168a8ea8d193b1fee534b45d14f0a59e035cd616795f67a0e0</Id></CustomIcon></Panel></Extensions>`;

        xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_automation_enabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));
      }
      else
      {      
        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_automation_enabled</PanelId><Origin>local</Origin><Location>CallControls</Location><Icon>Custom</Icon><Name>Automation Enabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.AUTOMATION_ENABLED}</Content><Id>e602eeacb23516168a8ea8d193b1fee534b45d14f0a59e035cd616795f67a0e0</Id></CustomIcon></Panel></Extensions>`;

        xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_automation_enabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

        DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_automation_disabled</PanelId><Origin>local</Origin><Location>Hidden</Location><Icon>Custom</Icon><Name>Automation Disabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.AUTOMATION_DISABLED}</Content><Id>d96c86c03fb4f5e0577ff8ad7011c7875aea984545a271fbf9ebb243ca4eb0e4</Id></CustomIcon></Panel></Extensions>`;

        xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_automation_disabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));
      }
        
      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>3</Order><PanelId>dws_audience_enabled</PanelId><Origin>local</Origin><Location>CallControls</Location><Icon>Custom</Icon><Name>Audience Mics: Enabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.AUDIENCE_ENABLED}</Content><Id>d4cc76056723a7360328640335139480e579defcbdee2aa696001b868e885cc4</Id></CustomIcon></Panel></Extensions>`;
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_audience_enabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>4</Order><PanelId>dws_audience_disabled</PanelId><Origin>local</Origin><Location>Hidden</Location><Icon>Custom</Icon><Name>Audience Mics: Disabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.AUDIENCE_DISABLED}</Content><Id>6216bc698e2abde23818a638f7cba1e6c861dea9bc173e064cedd4f191aaa0ad</Id></CustomIcon></Panel></Extensions>`;
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_audience_disabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>5</Order><PanelId>dws_wireless_enabled</PanelId><Origin>local</Origin><Location>CallControls</Location><Icon>Custom</Icon><Name>Presenter Mics: Enabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.WIRELESS_ENABLED}</Content><Id>338d32e2efa45518d0e86b56f5f5e392a67ef42a38c6efe30ab132a0831328ad</Id></CustomIcon></Panel></Extensions>`;
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_wireless_enabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>6</Order><PanelId>dws_wireless_disabled</PanelId><Origin>local</Origin><Location>Hidden</Location><Icon>Custom</Icon><Name>Presenter Mics: Disabled</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${IMAGES.WIRELESS_DISABLED}</Content><Id>8c2ae16b6f29220701e7b35af864e2780a0d11b7e7063599a5b015877a720479</Id></CustomIcon></Panel></Extensions>`;
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_wireless_disabled' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>9</Order><PanelId>dws_fixed_randp</PanelId><Origin>local</Origin><Location>CallControls</Location><Icon>Camera</Icon><Name>Fixed View: Rooms &amp; Presenter</Name><ActivityType>Custom</ActivityType></Panel></Extensions>`;
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_fixed_randp' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

      DWS_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>10</Order><PanelId>dws_fixed_sxs</PanelId><Origin>local</Origin><Location>CallControls</Location><Icon>Camera</Icon><Name>Fixed View: All Rooms Equal</Name><ActivityType>Custom</ActivityType></Panel></Extensions>`;
      xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'dws_fixed_sxs' }, DWS_PANEL)
        .catch(e => console.log('Error saving panel: ' + e.message));

      break;

    case 'HideCall': 

      // REMOVE ALL IN CALL PANELS WHEN NOT IN CALL & COMBINED MODE
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_automation_enabled' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_automation_disabled' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_audience_enabled' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_audience_disabled' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wireless_enabled' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wireless_disabled' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_fixed_randp' })
        .catch(e => console.log('Error removing panel: ' + e.message));
      xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_fixed_sxs' })
        .catch(e => console.log('Error removing panel: ' + e.message));

      break;
  }
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

    // INCREMENT THE TIMER 3 SECONDS
    DWS_TIMER = DWS_TIMER + 3000;
  } 
  else {
    // SEND FINAL PROMPT @ 100% COMPLETION
    xapi.Command.UserInterface.Message.Prompt.Clear({FeedbackId: '65'});
    xapi.Command.UserInterface.Message.Prompt.Display({Duration: '0', FeedbackId: '65',Title: type+' Rooms', "Option.1": '100% Complete', Text:'Operation completed successfully.'});
    
    console.log("DWS: Operation completed successfully!");

    // CLEAR TIMER AND RESET INTERVAL
    clearInterval(DWS_INTERVAL);
    DWS_TIMER = 0;
  }
}

//===================================================//
//            COMMAND SENDING FUNCTIONS              //
//===================================================//
async function triggerMessage(codec, payload) {
  let Params = {};
  Params.Timeout = 5;
  Params.AllowInsecureHTTPS = 'True';
  Params.ResultBody = 'PlainText';
  Params.Url = `https://${codec}/putxml`;
  Params.Header = ['Authorization: Basic ' + DWS.MACRO_LOGIN, 'Content-Type: application/json']; // CONVERT TO BASE64 ENCODED

  // ENABLE THIS LINE TO SEE THE COMMANDS BEING SENT TO FAR END
  if (DWS.DEBUG) {console.debug('DWS: Sending:', `${payload}`)}

  xapi.Command.HttpClient.Post(Params, payload)
  .then(() => {
    if (DWS.DEBUG) {console.debug(`DWS: Command sent to ${codec} successfully`)}
  })
  .catch((error) => {
    console.error(`DWS: Error sending command:`, error);

    // WAIT 1000ms THEN RETRY WITH SAME PAYLOAD
    setTimeout(() => { 
      triggerMessage(codec, payload); 
      if (DWS.DEBUG) {console.debug('DWS: HTTP session limit. Resending Command:', `${payload}`)}
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
    if (state == 'Combined Node1') 
    {
      const payload = {
        "Cisco-IOS-XE-native:GigabitEthernet":[
          {"name":"1/0/5","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
          {"name":"1/0/6","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
          {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
        ]
      };
      await submitRESTCONF(payload)

      // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
      sendMessage(DWS.NODE1_HOST,"Combine");
    }
    else 
    {
      const payload = {
        "Cisco-IOS-XE-native:GigabitEthernet":[
          {"name":"1/0/5","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
          {"name":"1/0/6","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
          {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}}
        ]
      };
      await submitRESTCONF(payload)
      
      // SET SECONDARY STATE FOR SPLIT OPERATION      
      sendMessage(DWS.NODE1_HOST,"Split"); 
    }    
  }
  else if (DWS.SWITCH_TYPE == 'C9K-12P') 
  {
    // THREE WAY METHODS
    if (DWS.NWAY == 'Three Way')
    {
      if (state == 'Combined All')
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/5","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/6","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE1_HOST,"Combine");
        sendMessage(DWS.NODE2_HOST,"Combine");
      }
      else if (state == 'Combined Node1')
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/5","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/6","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE1_HOST,"Combine");
      } 
      else if (state == 'Combined Node2')
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE2_HOST,"Combine");
      }
      else // SPLIT
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/5","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/6","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)
        
        // SET SECONDARY STATE FOR SPLIT OPERATION      
        sendMessage(DWS.NODE1_HOST,"Split"); 
        sendMessage(DWS.NODE2_HOST,"Split"); 
      }
    }
    // TWO WAY METHODS
    else 
    {
      if (state == 'Combined Node1')
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/8","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE1_HOST,"Combine");
      }
      else // SPLIT
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/7","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/8","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)
        
        // SET SECONDARY STATE FOR SPLIT OPERATION      
        sendMessage(DWS.NODE1_HOST,"Split"); 
      }
    }   
  }
  else if (DWS.SWITCH_TYPE == 'C9K-24P') 
  {
    if (DWS.NWAY == 'Three Way')
    {
      if (state == 'Combined All') 
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/12","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/13","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/14","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/15","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},            
            {"name":"1/0/17","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/18","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/19","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/20","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/21","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/22","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/23","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE1_HOST,"Combine");
        sendMessage(DWS.NODE2_HOST,"Combine");
      }
      else if (state == 'Combined Node1') 
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/12","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/13","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/14","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/15","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE1_HOST,"Combine");
      }
      else if (state == 'Combined Node2') 
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/17","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/18","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/19","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/20","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/21","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/22","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/23","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE2_HOST,"Combine");
      }
      // SPLIT THREE WAY
      else 
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/9","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/10","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/11","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/12","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/13","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/14","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/15","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/17","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/18","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/19","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/20","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/21","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/22","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}},
            {"name":"1/0/23","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE2_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)
        
        // SET SECONDARY STATE FOR SPLIT OPERATION      
        sendMessage(DWS.NODE1_HOST,"Split");   
        sendMessage(DWS.NODE2_HOST,"Split");
      }  
    }
    // TWO WAY METHODS
    else
    {
      if (state == 'Combined Node1') 
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/13","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/14","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/15","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/16","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/17","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/18","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/19","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/20","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/21","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/22","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}},
            {"name":"1/0/23","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.PRIMARY_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)

        // SET SECONDARY STATE FOR COMBINE OPERATION AFTER LAST VLAN CHANGE
        sendMessage(DWS.NODE1_HOST,"Combine");
      }
      else 
      {
        const payload = {
          "Cisco-IOS-XE-native:GigabitEthernet":[
            {"name":"1/0/13","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/14","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/15","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/16","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/17","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/18","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/19","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/20","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/21","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/22","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}},
            {"name":"1/0/23","switchport":{"Cisco-IOS-XE-switch:access":{"vlan":{"vlan":DWS.NODE1_VLAN}}}}
          ]
        };
        await submitRESTCONF(payload)
        
        // SET SECONDARY STATE FOR SPLIT OPERATION      
        sendMessage(DWS.NODE1_HOST,"Split");   
      }  
    } 
  }    
}

async function submitRESTCONF(payload) {
  const API_URL = `https://169.254.1.254/restconf/data/Cisco-IOS-XE-native:native/interface/GigabitEthernet`;

  try 
  {
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

    if (response.StatusCode == "204") 
    {
        if (DWS.DEBUG) {console.debug (`DWS: VLAN changed successfully.`)}
    } 
    else 
    {
      console.error (`DWS: HTTP Error: ${response.StatusCode} - ${response.StatusText}`);
    }
  } 
  catch (error) 
  {
      console.warn (`DWS: VLAN change failed - Retrying.`);
      submitRESTCONF(payload);
  }
}

//===============================//
//  NAVIGATOR PAIRING FUNCTIONS  //
//===============================//
function pairSecondaryNav(panelId, location, mode) 
{
  if (DWS.DEBUG) {console.debug (`DWS: Attempting to configure Secondary Touch Panel: ${panelId}`)}

  // Command to set the panel to control mode
  xapi.Command.Peripherals.TouchPanel.Configure({ ID: panelId, Location: location, Mode: mode})
  .then(() => {
    if (DWS.DEBUG) {console.debug (`DWS: Secondary Room Touch Panel ${panelId} configured successfully`)}
  })
  .catch((error) => {
    console.error(`DWS: Failed to pair Touch Panel ${panelId} to Primary`, error);
  });
}

//===========================//
//  AZM SUPPORTED FUNCTIONS  //
//===========================//
function buildAZMProfile(state) 
{
  let PRIMARY_ZONE = [];
  let NODE1_ZONE = [];
  let NODE2_ZONE = [];

  DWS.PRIMARY_MICS.forEach(element => { 
    PRIMARY_ZONE.push({Serial: element, SubId: [1]})
  });

  DWS.NODE1_MICS.forEach(element => { 
    NODE1_ZONE.push({Serial: element, SubId: [1]})
  });

  DWS.NODE2_MICS.forEach(element => { 
    NODE2_ZONE.push({Serial: element, SubId: [1]})
  });

  let DWS_AZM_PROFILE = {};

  if (state == 'Combined All')
  {
    DWS_AZM_PROFILE = {
      Settings: { 
        Sample: {
          Size: 4,                              
          Rate_In_Ms: 500,                      
          Mode: 'Snapshot'                      
        },
        GlobalThreshold: {
          Mode: 'Off'                              
        },
        VoiceActivityDetection: 'On' 
      },
      Zones: [
        {
          Label: 'PRIMARY ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_PRI,                           
            Low: 20                              
          },
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
          Label: 'NODE 1 ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_NODE1,                           
            Low: 20                              
          },
          MicrophoneAssignment: {
            Type: 'Ethernet',                   
            Connectors: [ ...NODE1_ZONE]
          },
          Assets: {                             
            Camera: {
              InputConnector: 2,
              Layout: 'Equal'
            }
          }
        },
        {
          Label: 'NODE 2 ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_NODE2,                           
            Low: 20                              
          },
          MicrophoneAssignment: {
            Type: 'Ethernet',                   
            Connectors: [ ...NODE2_ZONE]
          },
          Assets: {                             
            Camera: {
              InputConnector: 3,
              Layout: 'Equal'
            }
          }
        },
        {
          Label: 'PRESENTER USB',
          Independent_Threshold: {
            High: 20,                           
            Low: 10                              
          },
          Independent_Rate: 150,
          MicrophoneAssignment: {
            Type: 'USB',                   
            Connectors: [{Id: 1}]
          },
          Assets: {
          }
        },
        {
          Label: 'PRESENTER ANALOG',
          Independent_Threshold: {
            High: 20,                           
            Low: 10                              
          },
          Independent_Rate: 150,
          MicrophoneAssignment: {
            Type: 'Microphone',                   
            Connectors: [{Id: 1}]
          },
          Assets: {
          }
        }
      ]
    }
  }
  else if (state == 'Combined Node1')
  {
    DWS_AZM_PROFILE = {
      Settings: { 
        Sample: {
          Size: 4,                              
          Rate_In_Ms: 500,                      
          Mode: 'Snapshot'                      
        },
        GlobalThreshold: {
          Mode: 'Off'                              
        },
        VoiceActivityDetection: 'On' 
      },
      Zones: [
        {
          Label: 'PRIMARY ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_PRI,                           
            Low: 20                              
          },
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
          Label: 'NODE 1 ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_NODE1,                           
            Low: 20                              
          },
          MicrophoneAssignment: {
            Type: 'Ethernet',                   
            Connectors: [ ...NODE1_ZONE]
          },
          Assets: {                             
            Camera: {
              InputConnector: 2,
              Layout: 'Equal'
            }
          }
        },
        {
          Label: 'PRESENTER USB',
          Independent_Threshold: {
            High: 20,                           
            Low: 10                              
          },
          Independent_Rate: 150,
          MicrophoneAssignment: {
            Type: 'USB',                   
            Connectors: [{Id: 1}]
          },
          Assets: {
          }
        },
        {
          Label: 'PRESENTER ANALOG',
          Independent_Threshold: {
            High: 20,                           
            Low: 10                              
          },
          Independent_Rate: 150,
          MicrophoneAssignment: {
            Type: 'Microphone',                   
            Connectors: [{Id: 1}]
          },
          Assets: {
          }
        }
      ]
    }
  }
  else if (state == 'Combined Node2')
  {
    DWS_AZM_PROFILE = {
      Settings: { 
        Sample: {
          Size: 4,                              
          Rate_In_Ms: 500,                      
          Mode: 'Snapshot'                      
        },
        GlobalThreshold: {
          Mode: 'Off'                              
        },
        VoiceActivityDetection: 'On' 
      },
      Zones: [
        {
          Label: 'PRIMARY ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_PRI,                           
            Low: 20                              
          },
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
          Label: 'NODE 2 ROOM',
          Independent_Threshold: {
            High: DWS.MICS_HIGH_NODE2,                           
            Low: 20                              
          },
          MicrophoneAssignment: {
            Type: 'Ethernet',                   
            Connectors: [ ...NODE2_ZONE]
          },
          Assets: {                             
            Camera: {
              InputConnector: 3,
              Layout: 'Equal'
            }
          }
        },
        {
          Label: 'PRESENTER USB',
          Independent_Threshold: {
            High: 20,                           
            Low: 10                              
          },
          Independent_Rate: 150,
          MicrophoneAssignment: {
            Type: 'USB',                   
            Connectors: [{Id: 1}]
          },
          Assets: {
          }
        },
        {
          Label: 'PRESENTER ANALOG',
          Independent_Threshold: {
            High: 20,                           
            Low: 10                              
          },
          Independent_Rate: 150,
          MicrophoneAssignment: {
            Type: 'Microphone',                   
            Connectors: [{Id: 1}]
          },
          Assets: {
          }
        }
      ]
    }
  }
  else
  {
    DWS_AZM_PROFILE = {
      Settings: { 
        Sample: {
          Size: 4,                              
          Rate_In_Ms: 500,                      
          Mode: 'Snapshot'                      
        },
        GlobalThreshold: {
          Mode: 'Off'                              
        },
        VoiceActivityDetection: 'On' 
      },
      Zones: []
    }
  }
  return DWS_AZM_PROFILE;
}

function startAZMZoneListener() 
{
  AZM.Event.TrackZones.on(handleAZMZoneEvents);
  startAZMZoneListener = () => void 0;
}

function startCallListener() 
{
  if (DWS_CUR_STATE == 'Combined All' || DWS_CUR_STATE == 'Combined Node1' || DWS_CUR_STATE == 'Combined Node2')
  {
    // LISTEN TO CALL STATUS
    xapi.Status.SystemUnit.State.NumberOfActiveCalls.on(handleCallStatus)
    startCallListener = () => void 0;
  }
}

async function handleAZMZoneEvents(event) 
{
  // STORE CURRENT CAMERA / COMPOSITION
  let DWS_CUR_CAMERA = await xapi.Status.Video.Input.MainVideoSource.get();

  // STORE CURRENT TIME FOR HOLD OVERS
  let DWS_CUR_TIME = Date.now();
  if (DWS_HOLD_TIME == undefined)
  {
    DWS_HOLD_TIME = DWS_CUR_TIME + (2500);
  }

  // CHECK AUTOMATIC CEILING MIC DUCKING CONFIGURATION
  if (DWS.AUTO_DUCKING == 'On')
  {
    if (event.Zone.State == 'High' && (event.Zone.Label == 'PRESENTER USB' || event.Zone.Label == 'PRESENTER ANALOG') && DWS_DUCK_STATE == 'Unducked')
    {
      if (DWS.DEBUG) {console.debug("DWS: Presenter audio detected. Ducking Audience Mics")}
      
      //DUCK MICROPHONES
      for (let MIC_INPUT = 1; MIC_INPUT < 9; MIC_INPUT++)
      {
        if (DWS.PLATFORM == 'Codec Pro')
        {
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[1].Level.set("0"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[2].Level.set("0");
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[3].Level.set("0"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[4].Level.set("0");
        }
        else
        {
          try { xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[1].Gain.set("0") } catch {e => console.log("Error setting Gain:",e)} 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[2].Gain.set("0");
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[3].Gain.set("0"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[4].Gain.set("0");
        }
      }
      // SET CURRENT DUCK STATE
      DWS_DUCK_STATE = 'Ducked';
    }
    else if (event.Zone.State == 'Low' && (event.Zone.Label == 'PRESENTER USB' || event.Zone.Label == 'PRESENTER ANALOG') && DWS_DUCK_STATE == 'Ducked')
    {
      if (DWS.DEBUG) {console.debug("DWS: Presenter audio not detected. Enabling Audience Mics")}

      //UNDUCK MICROPHONES
      for (let MIC_INPUT = 1; MIC_INPUT < 9; MIC_INPUT++)
      {
        if (DWS.PLATFORM == 'Codec Pro')
        {
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[1].Level.set("45"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[2].Level.set("45");
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[3].Level.set("45"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[4].Level.set("45");
        }
        else
        {
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[1].Gain.set("45"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[2].Gain.set("45");
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[3].Gain.set("45"); 
          xapi.Config.Audio.Input.Ethernet[MIC_INPUT].Channel[4].Gain.set("45");
        }
      }
      // SET CURRENT DUCK STATE
      DWS_DUCK_STATE = 'Unducked';
    }
  }

  // CHECK DWS CAMERA MODE & ONLY SET THE CAMERA BASED ON AZM PROFILE IF IN "AUTOMATIC"
  if ((DWS_AUTOMODE_STATE == 'on' || DWS_AUTOMODE_STATE == 'On') && event.Zone.State == 'High') 
  {
    // CHECK IF 2.5 SECONDS HAVE PASSED BEFORE TRIGGERING VIDEO CHANGES
    if ((DWS_CUR_TIME - DWS_HOLD_TIME) >= 2500)
    {
      // CHECK FOR ALREADY IN PRESENTER AND AUDIENCE PIP
      if (DWS_CUR_CAMERA == 'Composed')
      {
        if (event.Zone.Label == 'PRESENTER USB' || event.Zone.Label == 'PRESENTER ANALOG')
        {
          // CHECK FOR ALREADY IN PRESENTER AND AUDIENCE PIP
          if ((DWS_CUR_TIME - DWS_DROP_AUDIENCE) >= 6000)
          {
            if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Audience time out reached. Showing only Presenter PTZ.')};

            // DROP AUDIENCE & ACTIVATE PRESENTER MODE
            xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });
            xapi.Command.Video.Input.SetMainVideoSource({
              ConnectorId: DWS_PRESENTER_CAM_ID,
              Layout: 'Equal'
            });

            // UPDATE HOLD TIMER TO NEW TIME STAMP
            DWS_HOLD_TIME = Date.now();
          }
          else
          {
            if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Presenter microphone triggered. Showing Presenter PTZ.')};

            // ACTIVATE PRESENTER MODE
            xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });
            xapi.Command.Video.Input.SetMainVideoSource({
              ConnectorId: DWS_PRESENTER_CAM_ID,
              Layout: 'Equal'
            });

            // UPDATE HOLD TIMER TO NEW TIME STAMP
            DWS_HOLD_TIME = Date.now();
          }
        }
        else if (event.Zone.Label == 'PRIMARY ROOM' || event.Zone.Label == 'NODE 1 ROOM' || event.Zone.Label == 'NODE 2 ROOM')
        {
          if (DWS_LAST_CAMERA != event.Assets.Camera.InputConnector)
          {
            // SET PRESENTER AND AUDIENCE PIP
            if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Setting PIP with PTZ & ' + event.Zone.Label)}

            xapi.Command.Video.Input.SetMainVideoSource({
              ConnectorId: [DWS_PRESENTER_CAM_ID, event.Assets.Camera.InputConnector],
              Layout: 'PIP',
              PIPPosition: 'Lowerright',
              PIPSize: 'Large'
            });  

            // STORE LAST CAMERA 
            DWS_LAST_CAMERA = event.Assets.Camera.InputConnector;

            if (event.Zone.Label == 'PRIMARY ROOM')
            {
              // SET LOCAL SPEAKERTRACK MODE
              xapi.Command.Cameras.SpeakerTrack.Activate().then(xapi.Command.Cameras.SpeakerTrack.Closeup.Activate());
            }
            else if (event.Zone.Label == 'NODE 1 ROOM')
            {
              // ACTIVATE REMOTE SPEAKERTRACK
              sendMessage(DWS.NODE1_HOST, "EnableST");
            }
            else if (event.Zone.Label == 'NODE 2 ROOM')
            {
              // ACTIVATE REMOTE SPEAKERTRACK
              sendMessage(DWS.NODE2_HOST, "EnableST");
            }

            // RESET THE DROP AUDIENCE TIME
            DWS_DROP_AUDIENCE = DWS_CUR_TIME + (6000);

            // UPDATE HOLD TIMER TO NEW TIME STAMP
            DWS_HOLD_TIME = Date.now();
          }
        }
      }
      // TRIGGER FROM THE PRESENTER MICROPHONE WHEN NOT IN COMPOSED VIEW
      else if (event.Zone.Label == 'PRESENTER USB' || event.Zone.Label == 'PRESENTER ANALOG')
      {
        if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Presenter microphone triggered. Showing Presenter PTZ.')};

        // ACTIVATE PRESENTER MODE
        xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Persistent' });
        xapi.Command.Video.Input.SetMainVideoSource({
          ConnectorId: DWS_PRESENTER_CAM_ID,
          Layout: 'Equal'
        });

        // UPDATE HOLD TIMER TO NEW TIME STAMP
        DWS_HOLD_TIME = Date.now();
      }
      else if ((DWS_CUR_CAMERA == DWS_PRESENTER_CAM_ID) && (event.Zone.Label == 'PRIMARY ROOM' || event.Zone.Label == 'NODE 1 ROOM' || event.Zone.Label == 'NODE 2 ROOM'))
      {
        if (DWS_LAST_CAMERA != event.Assets.Camera.InputConnector)
        {
          // SET PRESENTER AND AUDIENCE PIP
          if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Setting PIP with PTZ & ' + event.Zone.Label)}

          xapi.Command.Video.Input.SetMainVideoSource({
            ConnectorId: [DWS_PRESENTER_CAM_ID, event.Assets.Camera.InputConnector],
            Layout: 'PIP',
            PIPPosition: 'Lowerright',
            PIPSize: 'Large'
          });  

          // STORE LAST CAMERA 
          DWS_LAST_CAMERA = event.Assets.Camera.InputConnector;

          if (event.Zone.Label == 'PRIMARY ROOM')
          {
            // SET LOCAL SPEAKERTRACK MODE
            xapi.Command.Cameras.SpeakerTrack.Activate().then(xapi.Command.Cameras.SpeakerTrack.Closeup.Activate());
          }
          else if (event.Zone.Label == 'NODE 1 ROOM')
          {
            // ACTIVATE REMOTE SPEAKERTRACK
            sendMessage(DWS.NODE1_HOST, "EnableST");
          }
          else if (event.Zone.Label == 'NODE 2 ROOM')
          {
            // ACTIVATE REMOTE SPEAKERTRACK
            sendMessage(DWS.NODE2_HOST, "EnableST");
          }

          // RESET THE DROP AUDIENCE TIME
          DWS_DROP_AUDIENCE = DWS_CUR_TIME + (6000);

          // UPDATE HOLD TIMER TO NEW TIME STAMP
          DWS_HOLD_TIME = Date.now();
        }
      }
      else 
      {
        // TRIGGER FOR AUDIENCE ONLY SWITCHING - NO PRESENTER DETECTED
        if (event.Zone.Label == 'PRIMARY ROOM' || event.Zone.Label == 'NODE 1 ROOM' || event.Zone.Label == 'NODE 2 ROOM')
        {
          if (DWS_CUR_CAMERA != event.Assets.Camera.InputConnector)
          {
            // SET CAMERA TO AUDIENCE BASED ON MICROPHONE
            if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Microphone activity detected. Switching to ' + event.Zone.Label)}

            xapi.Command.Video.Input.SetMainVideoSource({
              ConnectorId: event.Assets.Camera.InputConnector,
              Layout: event.Assets.Camera.Layout
            });

            if (event.Zone.Label == 'PRIMARY ROOM')
            {
              // SET LOCAL SPEAKERTRACK MODE
              xapi.Command.Cameras.SpeakerTrack.Activate().then(xapi.Command.Cameras.SpeakerTrack.Closeup.Activate());            
            }
            else if (event.Zone.Label == 'NODE 1 ROOM')
            {
              // ACTIVATE REMOTE SPEAKERTRACK
              sendMessage(DWS.NODE1_HOST, "EnableST");
            }
            else if (event.Zone.Label == 'NODE 2 ROOM')
            {
              // ACTIVATE REMOTE SPEAKERTRACK
              sendMessage(DWS.NODE2_HOST, "EnableST");
            }

            // UPDATE HOLD TIMER TO NEW TIME STAMP
            DWS_HOLD_TIME = Date.now();
          }
          else
          {
            // LOG SAME CAMERA BUT MAKE NO CHANGE
            if (DWS.TRACKING_DEBUG) {console.debug ('DWS: Triggered current camera. No change to input.')}
          }
        }
      }
    }
    else
    {
      if (DWS.TRACKING_DEBUG) {console.debug("DWS: Within Hold Timer. Maintaining existing composition.")}
    }
  }
}

async function handleCallStatus(event) 
{
  if (event > 0) 
  {
    if(DWS_CUR_STATE == 'Combined All' || DWS_CUR_STATE == 'Combined Node1' || DWS_CUR_STATE == 'Combined Node2')
    {
      if (DWS.DEBUG) {console.debug("DWS: Call started. Adding in call controls.")}

      // START ZONE MONITORING IN AZM
      AZM.Command.Zone.Monitor.Start();

      // DRAW IN CALL PANEL
      createPanels ("InCall");

      // HIDE ROOM CONTROLS PANEL
      xapi.Command.UserInterface.Extensions.Panel.Update({ PanelId: 'dws_controls', Location: 'Hidden' })
      .catch(e => console.log('Error hiding Room Controls panel: ' + e.message));

      // REMOVE ONSCREEN BANNER
      xapi.Command.Video.Graphics.Clear({ Target: 'LocalOutput' });
    }
  } 
  else 
  {
    // STOP THE VU MONITORS WHEN CALL ENDS
    AZM.Command.Zone.Monitor.Stop()

    // RESET VIEW TO PRIMARY ROOM QUAD TO CLEAR ANY COMPOSITION FROM PREVIOUS SELECTION
    xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: 1});

    // TURN OFF PERSISTENT PRESENTER TRACK
    xapi.Command.Cameras.PresenterTrack.Set({ Mode: 'Off' });

    // REMOVE IN CALL CONTROLS
    createPanels ("HideCall");

    // SHOW ROOM CONTROLS PANEL
    xapi.Command.UserInterface.Extensions.Panel.Update({ PanelId: 'dws_controls', Location: 'HomeScreen' })
      .catch(e => console.log('Error showing Room Controls panel: ' + e.message));


    if (DWS.COMBINED_BANNER)
    {
      if (DWS_CUR_STATE == 'Combined All')
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS + ", " + DWS.NODE2_ALIAS});
      }
      else if (DWS_CUR_STATE == 'Combined Node1')
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE1_ALIAS});
      }
      else if (DWS_CUR_STATE == 'Combined Node2')
      {
        // SET ONSCREEN TEXT BANNER 
        xapi.Command.Video.Graphics.Text.Display({ Duration: 0, Target: 'LocalOutput', Text: "Combined with: " + DWS.NODE2_ALIAS});
      }
    }

    if(DWS_CUR_STATE == 'Combined All' || DWS_CUR_STATE == 'Combined Node1' || DWS_CUR_STATE == 'Combined Node2')
    {
      createPanels ("Combined");      
    }
    else
    {
      createPanels ("Split");
    }
  }
}

async function startAZM() {
  let configurationProfile = buildAZMProfile(DWS_CUR_STATE);
  await AZM.Command.Zone.Setup(configurationProfile);
  startAZMZoneListener();
  startCallListener();
  await AZM.Command.Zone.Monitor.Stop();
}

// START THE MACRO
init()