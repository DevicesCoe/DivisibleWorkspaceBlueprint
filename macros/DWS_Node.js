/*========================================================================//
This file is part of the "Divisible Workspace" blueprint for Two-Way 
Divisible Rooms leveraging Cisco IP Microphones.

Macro Author:  
Mark Lula
Cisco Systems

Contributing Engineers:
Svein Terje Steffensen
Chase Voisin
Robert(Bobby) McGonigle Jr
William Mills

Version: 0.9
Released: 03/31/2025

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

import xapi from 'xapi';
import DWS_SEC from './DWS_State'

function parse(event) {  //returns the content of the parent system when sent
  return JSON.parse(event);
}

//===========================//
//  INITIALIZATION FUNCTION  //
//===========================//

function init() {
  console.log ("DWS: Starting up as secondary node.");

  if(DWS_SEC.SCREENS == 1)
  {
    // SET VIDEO OUTPUT ROLES
    xapi.Config.Video.Output.Connector[1].MonitorRole.set("First");
    xapi.Config.Video.Output.Connector[3].MonitorRole.set("Third");

    // SET VIDEO INPUT CONFIGS
    xapi.Config.Video.Input.Connector[1].Name.set("Audience Camera");
    xapi.Config.Video.Input.Connector[1].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set("On");

    xapi.Config.Video.Input.Connector[3].Name.set("First Feed from Primary");
    xapi.Config.Video.Input.Connector[3].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set("Off");
    xapi.Config.Video.Input.Connector[3].PresentationSelection.set("Manual");

    xapi.Config.Video.Input.Connector[5].Name.set("Presenter PTZ");
    xapi.Config.Video.Input.Connector[5].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[5].CameraControl.Mode.set("On");

  }
  else if(DWS_SEC.SCREENS == 2)
  {
    // SET VIDEO OUTPUT ROLES
    xapi.Config.Video.Output.Connector[1].MonitorRole.set("First");
    xapi.Config.Video.Output.Connector[2].MonitorRole.set("Second");
    xapi.Config.Video.Output.Connector[3].MonitorRole.set("Third");

    // SET VIDEO INPUT CONFIGS
    xapi.Config.Video.Input.Connector[1].Name.set("Audience Camera");
    xapi.Config.Video.Input.Connector[1].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set("On");

    xapi.Config.Video.Input.Connector[3].Name.set("First Feed from Primary");
    xapi.Config.Video.Input.Connector[3].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set("Off");
    xapi.Config.Video.Input.Connector[3].PresentationSelection.set("Manual");

    xapi.Config.Video.Input.Connector[4].Name.set("Second Feed from Primary");
    xapi.Config.Video.Input.Connector[4].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[4].CameraControl.Mode.set("Off");
    xapi.Config.Video.Input.Connector[4].PresentationSelection.set("Manual");

    xapi.Config.Video.Input.Connector[5].Name.set("Presenter PTZ");
    xapi.Config.Video.Input.Connector[5].Visibility.set("Never");
    xapi.Config.Video.Input.Connector[5].CameraControl.Mode.set("On");
  }

  if (DWS_SEC.STATE === 'Combined') {
    console.log ('DWS: Combined State detected. Re-applying combined configuration.');
    setSecondaryState("Combined");
  }
  else
  {
    console.log ('DWS: Split State detected. Re-applying standard configuration.');
    setSecondaryState("Split");
  }

  listenForMessage();
}

function listenForMessage () {

    xapi.event.on('Message Send Text', event => {
    var captureCommand = event.replace(/'/g,'"');
    var decodeCommand = captureCommand.split(':');
    try 
    {
      switch(decodeCommand[0])
      {          
        //===========================//
        //      COMBINE FUNCTION     //
        //===========================//
        case 'Combine':
          console.log('DWS: Combine request received. Applying combined configuration.');

          // RUN ALL COMMANDS
          xapi.Command.Conference.DoNotDisturb.Activate({ Timeout: "20000" });
          xapi.Command.Video.SelfView.set({FullScreenMode: "On", Mode: "On", OnMonitorRole:"Third"});
          if(DWS_SEC.SCREENS == 1)
          {
            xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "1", SourceId: "3"});
          }
          else if(DWS_SEC.SCREENS == 2)
          {
            xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "1", SourceId: "3"});
            xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "2", SourceId: "4"});
          }
          
          // SET ALL CONFIGURATIONS
          xapi.Config.Peripherals.Profile.TouchPanels.set("0");
          xapi.Config.Standby.Control.set("Off");
          xapi.Config.Standby.Halfwake.Mode.set("Manual");
          xapi.Config.Audio.Input.HDMI[3].Mode.set("On");
          xapi.Config.Audio.Input.HDMI[3].VideoAssociation.MuteOnInactiveVideo.set("Off");
          xapi.Config.Audio.Ultrasound.MaxVolume.set("0");

          // UPDATE STATE MACRO
          setSecondaryState("Combined");

          break;
        
        //===========================//
        //        SPLIT FUNCTION     //
        //===========================//
        case 'Split':
          console.log('DWS: Split request received. Applying split configuration.');

          xapi.Command.Conference.DoNotDisturb.Deactivate();
          xapi.Command.Video.SelfView.set({FullScreenMode: "Off", Mode: "On", OnMonitorRole:"First"});
          if(DWS_SEC.SCREENS == 1)
          {
            xapi.Command.Video.Matrix.Reset({Output: "1"});
          }
          else if(DWS_SEC.SCREENS == 2)
          {
            xapi.Command.Video.Matrix.Reset({Output: "1"});
            xapi.Command.Video.Matrix.Reset({Output: "2"});
          }

          // SET ALL CONFIGURATIONS
          xapi.Config.Peripherals.Profile.TouchPanels.set("1");
          xapi.Config.Standby.Control.set("On");
          xapi.Config.Standby.Halfwake.Mode.set("Auto");
          xapi.Config.Audio.Input.HDMI[3].Mode.set("Off");
          xapi.Config.Audio.Input.HDMI[3].VideoAssociation.MuteOnInactiveVideo.set("On");
          xapi.Config.Audio.Ultrasound.MaxVolume.set("70");

          // UPDATE STATE MACRO
          setSecondaryState("Split");

          // LISTEN FOR NAV PAIRING 
          listenForNavs();

          break;

        //========================================//
        //      CAMERA POSITION PRESETS           //
        //========================================//
        case 'EnableST':
          console.log('DWS: Enabling SpeakerTrack');

          xapi.Command.Cameras.SpeakerTrack.Activate();
          xapi.Command.Cameras.SpeakerTrack.Closeup.Activate();           
          break;
        case 'DisableST':
          console.log('DWS: Deactivating SpeakerTrack');
          xapi.Command.Cameras.SpeakerTrack.Deactivate();             
          break;        
      }
    } 
    catch(error) { 
      console.error("DWS Error with message receive: " + error);
    }
  });
}

function listenForNavs() {

  let pairedControl = 0;
  let pairedScheduler;

  if(DWS_SEC.NAV_SCHEDULER != '')
  {
    pairedScheduler = 0;
  }
  else
  {
    pairedScheduler = 1;
  }

  // LISTEN FOR NAVIGATORS PAIRING
  xapi.Status.Peripherals.ConnectedDevice
  .on(device => {
    if (device.Type === 'TouchPanel' && device.Status === 'Connected') 
    {
      if (device.ID === DWS_SEC.NAV_CONTROL) 
      {
        console.log("DWS: Re-discovered Room Navigator: " + device.SerialNumber + " / " + device.ID);
        // PAIR CONTROL NAVIGATOR AFTER 1500ms Delay
        setTimeout(() => { 
          xapi.Command.Peripherals.TouchPanel.Configure({ ID: DWS_SEC.NAV_CONTROL, Location: "InsideRoom", Mode: "Controller"})
            .on(() => {
              console.log("DWS: Paired Control Navigator succesfully.");
              pairedControl = 1;
            });
          }, 1500);
      }
      if (hasScheduler)
      {
        if (device.ID === DWS_SEC.NAV_SCHEDULER) 
        {
          console.log("DWS: Re-discovered Room Navigator: " + device.SerialNumber + " / " + device.ID);
          
          // PAIR CONTROL NAVIGATOR AFTER 1500ms Delay
          setTimeout(() => { 
            xapi.Command.Peripherals.TouchPanel.Configure({ ID: DWS_SEC.NAV_SCHEDULER, Location: "OutsideRoom", Mode: "RoomScheduler"})
              .on(() => {
                console.log("DWS: Paired Scheduler Navigator succesfully.");
                pairedScheduler = 1;
              });
            }, 1500);
        }
      }
    }
  });
}

function setSecondaryState(state)
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
Chase Voisin
Robert(Bobby) McGonigle Jr
William Mills

Version: 0.9
Released: 03/31/2025

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const STATE = '${state}';
const SCREENS = '${DWS_SEC.SCREENS}';            
const NAV_CONTROL = '${DWS_SEC.NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS_SEC.NAV_SCHEDULER}';

export default {
  STATE,
  SCREENS, 
  NAV_CONTROL, 
  NAV_SCHEDULER  
};`
        ;

  // SAVE STATE MACRO
  xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr);
}

// START THE MACRO
init();
