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
import DWS from './DWS_Config';

//==============================//
//  FIRST TIME SETUP FUNCTIONS  //
//==============================//
async function firstSetup()
{
  console.log("DWS: Starting Automatic Setup Process.");

  // ENSURE ROOM TYPE IS STANDARD
  const roomType = await xapi.Status.Provisioning.RoomType.get();
  if (roomType != 'Standard')
  {
    console.error("DWS: Only Standard Room Type Supported. Setup Aborted.");
    return;
  }

  // DISABLE HDCP Policy on the output to allow for Extron DA Duplication
  xapi.Config.Video.Output.Connector[1].HDCPPolicy.set("off");
  xapi.Config.Video.Output.Connector[2].HDCPPolicy.set("off");
  
  // CHECK FOR CONNECTED INPUTS IN CONFIGURED SPOTS
  let input1 = '';
  let input2 = '';
  let input3 = '';

  console.log("DWS: Checking for Correct Inputs and Outputs.");
  if(DWS.PLATFORM == 'Codec Pro')
  {    
    input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
    input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();
    input3 = await xapi.Status.Video.Input.Connector[5].Connected.get();
  }
  else if (DWS.PLATFORM == 'Codec EQ')
  {
    input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
    input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();
    input3 = await xapi.Status.Video.Input.Connector[3].Connected.get();
  }

  if (input1 && input2 && input3)
  {
    console.log("DWS: Setting Inputs/Outputs Labels and Visibility."); 

    if(DWS.PLATFORM == 'Codec Pro')
    {    
      // SET NAMES AND VISIBILITY SETTINGS
      xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera');
      xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On');
      xapi.Config.Video.Input.Connector[1].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[2].Name.set('Secondary Audience');
      xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off');
      xapi.Config.Video.Input.Connector[2].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[5].Name.set('Primary PTZ Camera');
      xapi.Config.Video.Input.Connector[5].CameraControl.Mode.set('On');
      xapi.Config.Video.Input.Connector[5].Visibility.set('Never');
    }
    else if (DWS.PLATFORM == 'Codec EQ')
    {
      // SET NAMES AND VISIBILITY SETTINGS
      xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera');
      xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On');
      xapi.Config.Video.Input.Connector[1].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[2].Name.set('Secondary Audience');
      xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off');
      xapi.Config.Video.Input.Connector[2].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[3].Name.set('Primary PTZ Camera');
      xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set('On');
      xapi.Config.Video.Input.Connector[3].Visibility.set('Never');
    }
  }
  else
  {
    console.error("DWS: Invalid Input Connection Status. Ensure Camera Inputs Match Documentation. Setup Aborted.");
    return;
  }

  // SAVE STATE MACRO ON BOTH CODECS
  await setPrimaryState("Split");
  await setSecondaryState("Split");

  // DELETE SETUP MACROS AND ENABLE CORE MACRO
  try { xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wizard_start' }); } catch(error) { console.error('DWS: Error Removing Confirm Panel: ' + error.message); }
  try { xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wizard_confirm' }); } catch(error) { console.error('DWS: Error Removing Wizard Panel: ' + error.message); }
  try { xapi.Command.Macros.Macro.Activate({ Name: 'DWS_Core' }); } catch(error) { console.error('DWS: Error Starting Core Macro: ' + error.message); }
  try { xapi.Command.Macros.Macro.Remove({ Name: "DWS_Wizard" }); } catch(error) { console.error('DWS: Error Deleting Wizard Macro: ' + error.message); }
  try { xapi.Command.Macros.Macro.Remove({ Name: "DWS_Setup" }); } catch(error) { console.log('DWS: Error Deleting Setup Macro: ' + error.message); }
  setTimeout(() => {
        xapi.Command.Macros.Runtime.Restart()
          .catch(error => console.log('DWS: Error restarting Macro Engine: ' + error.message));
      }, 300);

}

async function setPrimaryState(state)
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
};`;

  // SAVE STATE MACRO
  xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr);
}

async function setSecondaryState(state)
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
import xapi from 'xapi';

function init()
{
  // SAVE THE INITIAL STATE MACRO
  saveStateMacro();

  // LOAD NODE MACRO FROM GITHUB
  getMacro();  
}

async function getPlatform() {
  const productPlatform = await xapi.Status.SystemUnit.ProductPlatform.get()
  return productPlatform;
}

async function getMacro ()
{
  try {
    const getMacro = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspace/refs/heads/main/macros/DWS_Node.js' })
    .then( result => {
      console.debug("DWS: Node Macro Downloaded Successfully.");
      let setupMacro = result.Body;

      // LOAD THE MACRO AND ENABLE IT
      xapi.Command.Macros.Macro.Save({ Name: 'DWS_Node', Overwrite: 'True' }, setupMacro)
      .then (() => {
        xapi.Command.Macros.Macro.Activate({ Name: "DWS_Node"})
        .then (() => {
          xapi.Command.Macros.Macro.Remove({Name: "DWS_Sec_Startup"})
          .then (() => { xapi.Command.Macros.Runtime.Restart() } )
        })
      })      
    })
    .catch (e => {
      console.warn('DWS: Node Macro URL not found.' + e);
    }); 
  } catch (e) {
    console.warn('DWS: Unable to reach GitHub for Node Macro.' + e);
  }
}

function saveStateMacro()
{
  xapi.Status.SystemUnit.ProductPlatform.get()
  .then ((productPlatform) => {

  // CREATE MACRO BODY
  const dataStr = \`
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
const SCREENS = '${DWS.SECONDARY_SCREENS}';            
const NAV_CONTROL = '${DWS.SECONDARY_NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS.SECONDARY_NAV_SCHEDULER}';
const PLATFORM = '\${productPlatform}';

export default {
  STATE,
  SCREENS, 
  NAV_CONTROL, 
  NAV_SCHEDULER,
  PLATFORM
}\`;

    // SAVE STATE MACRO
    xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr);
  })
}

// START THE MACRO
init();`;

  // SAVE STATE MACRO
  sendCommand(DWS.SECONDARY_HOST, `<Command><Macros><Macro><Save><Name>DWS_Sec_Startup</Name><OverWrite>True</OverWrite><body>${dataStr}</body></Save><Activate><Name>DWS_Sec_Startup</Name></Activate></Macro><Runtime><Start></Start></Runtime></Macros></Command>`);
}

//========================================//
//  CROSS CODEC COMMAND SENDING FUNCTION  //
//========================================//
function sendCommand(codec, command) 
{
  let Params = {};
  Params.Timeout = 5;
  Params.AllowInsecureHTTPS = 'True';
  Params.ResultBody = 'PlainText';
  Params.Url = `http://${codec}/putxml`;
  Params.Header = ['Authorization: Basic ' + btoa(`${DWS.MACRO_USERNAME}:${DWS.MACRO_PASSWORD}`), 'Content-Type: application/json']; // CONVERT TO BASE64 ENCODED

  xapi.Command.HttpClient.Post(Params, command)
  .then(() => {
    console.log(`DWS: Command sent to ${codec} successfully`);
  })
  .catch((error) => {
    console.error(`DWS: Error sending command:`, error);
  });
}

//===============================//
//  C9K CONFIGURATION FUNCTIONS  //
//===============================//
function checkSwitch() 
{
  console.log ("DWS: Checking Switch Readiness.");

  xapi.command('HttpClient Get', { 
    Url: `https://169.254.1.254/restconf/data/Cisco-IOS-XE-native:native/hostname`,
    Header: [
      'Accept: application/yang-data+json',
      `Authorization: Basic ${btoa(`${DWS.SWITCH_USERNAME}:${DWS.SWITCH_PASSWORD}`)}`
    ],
    AllowInsecureHTTPS: true
  })
  .then(async (response) => {
    const jsonResponse = JSON.parse(response.Body);
    const hostname = jsonResponse['Cisco-IOS-XE-native:hostname'];
    console.log('Switch detected! Hostname:', hostname);
    await saveSwitch();
  })
  .catch(error => {
    console.warn('DWS: Switch check failed. Retrying:', error.message);
    setTimeout(() => {checkSwitch()}, 1000);
  });
}

async function saveSwitch() 
{
  // SAVE SWITCH CONFIGURATION
  xapi.command('HttpClient Post', { 
    Url: 'https://169.254.1.254/restconf/operations/cisco-ia:save-config/', 
    Header: [
      'Content-Type: application/yang-data+json',
      'Accept: application/yang-data+json',
      `Authorization: Basic ${btoa(`${DWS.SWITCH_USERNAME}:${DWS.SWITCH_PASSWORD}`)}`
    ],
    AllowInsecureHTTPS: true
  },'')
  .then(response => {
    console.log ('DWS: Default switch configuration saved to startup-config.');

    setTimeout(() => { firstSetup(), 500});
  })
  .catch(error => {
    console.warn('DWS: Unable to save switch configuration:', error.message);
  });
}

// DOUBLE CHECK INITIAL SWITCH CONFIGURATION THEN BEGIN SETUP
checkSwitch();


