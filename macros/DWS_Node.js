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
import DWS_SEC from './DWS_State';

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

    if(DWS_SEC.PLATFORM == 'Codec Pro')
    {
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
      xapi.Config.Video.Input.Connector[5].PresentationSelection.set("Manual"); 
      
    }
    else if (DWS_SEC.PLATFORM == 'Codec EQ')
    {
      // SET VIDEO INPUT CONFIGS
      xapi.Config.Video.Input.Connector[1].Name.set("Audience Camera");
      xapi.Config.Video.Input.Connector[1].Visibility.set("Never");
      xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set("On");

      xapi.Config.Video.Input.Connector[2].Name.set("Presenter PTZ");
      xapi.Config.Video.Input.Connector[2].Visibility.set("Never");
      xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set("On");
      xapi.Config.Video.Input.Connector[2].PresentationSelection.set("Manual");

      xapi.Config.Video.Input.Connector[3].Name.set("First Feed from Primary");
      xapi.Config.Video.Input.Connector[3].Visibility.set("Never");
      xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set("Off");
      xapi.Config.Video.Input.Connector[3].PresentationSelection.set("Manual");      
    }
  }
  else if(DWS_SEC.SCREENS == 2)
  {
    // SET VIDEO OUTPUT ROLES
    xapi.Config.Video.Output.Connector[1].MonitorRole.set("First");
    xapi.Config.Video.Output.Connector[2].MonitorRole.set("Second");
    xapi.Config.Video.Output.Connector[3].MonitorRole.set("Third");

    if(DWS_SEC.PLATFORM == 'Codec Pro')
    {
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
      xapi.Config.Video.Input.Connector[5].PresentationSelection.set("Manual");
    }
    else if (DWS_SEC.PLATFORM == 'Codec EQ')
    {
      // SET VIDEO INPUT CONFIGS
      xapi.Config.Video.Input.Connector[1].Name.set("Audience Camera");
      xapi.Config.Video.Input.Connector[1].Visibility.set("Never");
      xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set("On");

      xapi.Config.Video.Input.Connector[2].Name.set("Presenter PTZ");
      xapi.Config.Video.Input.Connector[2].Visibility.set("Never");
      xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set("On");
      xapi.Config.Video.Input.Connector[2].PresentationSelection.set("Manual"); 

      xapi.Config.Video.Input.Connector[3].Name.set("First Feed from Primary");
      xapi.Config.Video.Input.Connector[3].Visibility.set("Never");
      xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set("Off");
      xapi.Config.Video.Input.Connector[3].PresentationSelection.set("Manual");      
    }
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
          try { xapi.Command.Conference.DoNotDisturb.Activate({ Timeout: "20000" }) } catch(error) { console.error('DWS: Error Setting DND: ' + error.message); }
          try { xapi.Command.Video.SelfView.Set({FullscreenMode: "On", Mode: "On", OnMonitorRole:"Third"}) } catch(error) { console.error('DWS: Error Setting SelfView: ' + error.message); }
          if(DWS_SEC.SCREENS == 1)
          {
            try { xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "1", SourceId: "3"}) } catch(error) { console.error('DWS: Error Setting 1S Matrix: ' + error.message); }
          }
          else if(DWS_SEC.SCREENS == 2 && DWS_SEC.PLATFORM == 'Codec Pro')
          {
            try { xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "1", SourceId: "3"}) } catch(error) { console.error('DWS: Error Setting 2S Matrix 1: ' + error.message); }
            try { xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "2", SourceId: "4"}) } catch(error) { console.error('DWS: Error Setting 2S Matrix 2: ' + error.message); }
          }
          else{
            console.error ("DWS: Misconfigured number of displays based on platform. Defaulting to Single Display.");
            try { xapi.Command.Video.Matrix.Assign({Mode: "Replace", Output: "1", SourceId: "3"}) } catch(error) { console.error('DWS: Error Setting 1S Matrix: ' + error.message); }
          }
          
          // SET ALL CONFIGURATIONS
          try { xapi.Config.Peripherals.Profile.TouchPanels.set("0") } catch(error) { console.error('DWS: Error Setting Panels: ' + error.message); } 
          try { xapi.Config.Standby.Control.set("Off") } catch(error) { console.error('DWS: Error Setting Standby Control: ' + error.message); } 
          try { xapi.Config.Standby.Halfwake.Mode.set("Manual") } catch(error) { console.error('DWS: Error Setting Halfwake: ' + error.message); } 
          try { xapi.Config.Audio.Input.HDMI[3].Mode.set("On") } catch(error) { console.error('DWS: Error Setting HDMI Audio Mode: ' + error.message); } 
          try { xapi.Config.Audio.Input.HDMI[3].VideoAssociation.MuteOnInactiveVideo.set("Off") } catch(error) { console.error('DWS: Error Setting HDMI Audio: ' + error.message); } 
          try { xapi.Config.Audio.Ultrasound.MaxVolume.set("0") } catch(error) { console.error('DWS: Error Setting Ultrasound: ' + error.message); } 

          // UPDATE STATE MACRO
          setSecondaryState("Combined");

          break;
        
        //===========================//
        //        SPLIT FUNCTION     //
        //===========================//
        case 'Split':
          console.log('DWS: Split request received. Applying split configuration.');

          try { xapi.Command.Conference.DoNotDisturb.Deactivate() } catch(error) { console.error('DWS: Error Setting DND: ' + error.message); }
          try { xapi.Command.Video.SelfView.Set({FullscreenMode: "Off", Mode: "On", OnMonitorRole:"First"}) } catch(error) { console.error('DWS: Error Setting SelfView: ' + error.message); }
          if(DWS_SEC.SCREENS == 1)
          {
            try { xapi.Command.Video.Matrix.Reset({Output: "1"}) } catch(error) { console.error('DWS: Error Setting 1S Matrix: ' + error.message); }
          }
          else if(DWS_SEC.SCREENS == 2 && DWS_SEC.PLATFORM == 'Codec Pro')
          {
            try { xapi.Command.Video.Matrix.Reset({Output: "1"}) } catch(error) { console.error('DWS: Error Setting 2S Matrix 1: ' + error.message); }
            try { xapi.Command.Video.Matrix.Reset({Output: "2"}) } catch(error) { console.error('DWS: Error Setting 2S Matrix 2: ' + error.message); }
          }
          else{
            console.error ("DWS: Misconfigured number of displays based on platform. Resetting Matrix for Single Display.");
            try { xapi.Command.Video.Matrix.Reset({Output: "1"}) } catch(error) { console.error('DWS: Error Setting 1S Matrix: ' + error.message); }
          }

          // SET ALL CONFIGURATIONS
          try { xapi.Config.Peripherals.Profile.TouchPanels.set("1") } catch(error) { console.error('DWS: Error Setting Panels: ' + error.message); }
          try { xapi.Config.Standby.Control.set("On") } catch(error) { console.error('DWS: Error Setting Standby Control: ' + error.message); }
          try { xapi.Config.Standby.Halfwake.Mode.set("Auto") } catch(error) { console.error('DWS: Error Setting Halfwake: ' + error.message); }
          try { xapi.Config.Audio.Input.HDMI[3].Mode.set("Off") } catch(error) { console.error('DWS: Error Setting HDMI Audio Mode: ' + error.message); }
          try { xapi.Config.Audio.Input.HDMI[3].VideoAssociation.MuteOnInactiveVideo.set("On") } catch(error) { console.error('DWS: Error Setting HDMI Audio: ' + error.message); }
          try { xapi.Config.Audio.Ultrasound.MaxVolume.set("70") } catch(error) { console.error('DWS: Error Setting Ultrasound: ' + error.message); } 

          // UPDATE STATE MACRO
          setSecondaryState("Split");

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
            .then(() => { console.log("DWS: Paired Control Navigator succesfully.") } )
          }, 1500);
      }
      if (device.ID === DWS_SEC.NAV_SCHEDULER) 
      {
        console.log("DWS: Re-discovered Room Navigator: " + device.SerialNumber + " / " + device.ID);
        
        // PAIR CONTROL NAVIGATOR AFTER 1500ms Delay
        setTimeout(() => { 
          xapi.Command.Peripherals.TouchPanel.Configure({ ID: DWS_SEC.NAV_SCHEDULER, Location: "OutsideRoom", Mode: "RoomScheduler"})
            .then(() => { console.log("DWS: Paired Scheduler Navigator succesfully.") } )
          }, 1500);
      }
    }
  });
}

function setSecondaryState(state)
{
  xapi.Status.SystemUnit.ProductPlatform.get()
  .then ((productPlatform) => {

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
const SCREENS = '${DWS_SEC.SCREENS}';            
const NAV_CONTROL = '${DWS_SEC.NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS_SEC.NAV_SCHEDULER}';
const PLATFORM = '${productPlatform}';

export default {
  STATE,
  SCREENS, 
  NAV_CONTROL, 
  NAV_SCHEDULER,
  PLATFORM
};`;

    // SAVE STATE MACRO
    xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr)
    .then(() => {
      console.log ('DWS: Saved state set to: '+state);
    })
    .catch (error => {
      console.error('DWS: Error saving state macro: '+error);
    })
  })
}

// START THE MACRO
init();