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

  // DISABLE HDCP POLICY FOR BETTER DA COMPATIBILITY  
  try { xapi.Config.Video.Output.Connector[1].HDCPPolicy.set("off"); } catch(error) { console.error('DWS: Error setting HDCP 1: ' + error.message); }
  try { xapi.Config.Video.Output.Connector[2].HDCPPolicy.set("off"); } catch(error) { console.error('DWS: Error setting HDCP 2: ' + error.message); }

  // CODEC PRO OUTPUT CONFIGURATION
  if (DWS.PLATFORM == 'Codec Pro')
  {
    try { xapi.Config.Video.Output.Connector[1].Resolution.set("1920_1080_60");} catch(error) { console.error('DWS: Error setting HDMI 1 resolution: ' + error.message); }
    try { xapi.Config.Video.Output.Connector[2].Resolution.set("1920_1080_60");} catch(error) { console.error('DWS: Error setting HDMI 2 resolution: ' + error.message); }
  }

  // SET SPEAKER TRACK MODE TO CLOSE UP AS DEFAULT  
  try { xapi.Config.Cameras.SpeakerTrack.DefaultBehavior.set('Closeup'); } catch(error) { console.error('DWS: Error setting ST Default: ' + error.message); }

  // ENABLE AUDIO CONSOLE / MANUAL AUDIO ROUTING
  try { xapi.Config.Audio.Output.ConnectorSetup.set("Manual"); } catch(error) { console.error('DWS: Error setting ConnectorSetup: ' + error.message); }
  
  console.log("DWS: Checking for Correct Inputs and Outputs.");
  if(DWS.NWAY == 'Two Way')
  {
    const input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
    const input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();

    if (input1 && input2)
    {
      console.log("DWS: Setting Inputs/Outputs Labels and Visibility."); 

      // SET NAMES AND VISIBILITY SETTINGS      
      try { xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[1].Visibility.set('Never'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[1].PresentationSelection.set("Manual"); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].Name.set('Secondary Audience'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }
      try { xapi.Config.Video.Input.Connector[2].InputSourceType.set('camera'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].Visibility.set('Never'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].PresentationSelection.set("Manual"); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }   
    }
    else
    {
      console.error("DWS: Invalid video input connection status. Ensure camera inputs match documentation. Setup aborted.");
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Invalid Input Configuration", Text: "Please ensure camera inputs match documentation. Setup aborted."});
      return;
    }
  }
  else
  {
  	const input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
    const input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();
    const input3 = await xapi.Status.Video.Input.Connector[3].Connected.get();
    
    if (input1 && input2 && input3)
    {
      console.log("DWS: Setting Inputs/Outputs Labels and Visibility."); 

      // SET NAMES AND VISIBILITY SETTINGS
      try { xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[1].Visibility.set('Never'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[1].PresentationSelection.set("Manual"); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].Name.set(DWS.NODE1_ALIAS + ' Audience'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }
      try { xapi.Config.Video.Input.Connector[2].InputSourceType.set('camera'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }       
      try { xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].Visibility.set('Never'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[2].PresentationSelection.set("Manual"); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }   
      try { xapi.Config.Video.Input.Connector[3].Name.set(DWS.NODE2_ALIAS + ' Audience'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }
      try { xapi.Config.Video.Input.Connector[3].InputSourceType.set('camera'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }         
      try { xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set('Off'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[3].Visibility.set('Never'); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); }      
      try { xapi.Config.Video.Input.Connector[3].PresentationSelection.set("Manual"); } catch(error) { console.error('DWS: Error setting Labels and Visibility: ' + error.message); } 
    }
    else
    {
      console.error("DWS: Invalid video input connection status. Ensure camera inputs match documentation. Setup aborted.");
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Invalid Input Configuration", Text: "Please ensure camera inputs match documentation. Setup aborted."});
      return;
    }
  }

  // SAVE STATE MACRO ON BOTH CODECS
  await setPrimaryState("Split");
  await setSecondaryState("Split");

  // DELETE SETUP MACROS AND ENABLE CORE MACRO
  try { xapi.Command.UserInterface.Extensions.Panel.Remove({ PanelId: 'dws_wizard' }); } catch(error) { console.error('DWS: Error Removing Wizard Panel: ' + error.message); }
  try { 
    xapi.Command.Macros.Macro.Activate({ Name: 'DWS_Core' }); 
    setTimeout(() => {
      xapi.Command.Macros.Runtime.Restart()
        .catch(error => console.log('DWS: Error restarting Macro Engine: ' + error.message));
    }, 300);
  } 
  catch(error) { console.error('DWS: Error Starting Core Macro: ' + error.message); }
  try { xapi.Command.Macros.Macro.Remove({ Name: "DWS_Wizard" }); } catch(error) { console.error('DWS: Error Deleting Wizard Macro: ' + error.message); }
  try { xapi.Command.Macros.Macro.Remove({ Name: "DWS_Setup" }); } catch(error) { console.log('DWS: Error Deleting Setup Macro: ' + error.message); }
}

async function setPrimaryState(state)
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

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const STATE = '${state}';

export default {
  STATE 
};`;

  // SAVE STATE MACRO
  xapi.Command.Macros.Macro.Save({ Name: 'DWS_State', Overwrite: 'True' }, dataStr);
}

async function setSecondaryState(state)
{

//===========================//
//    MACRO BODY FOR NODE1   //
//===========================//
  const dataStr_NODE1 = `
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

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/
import xapi from 'xapi';

function init()
{
  let LOADED_MACROS = [];

  // SAVE THE INITIAL STATE MACRO
  saveStateMacro();

  // PERFORM PREMISE INSTALL CHECK
  xapi.Command.Macros.Macro.Get()
  .then (response => {
    response.Macro.forEach(element => {
     LOADED_MACROS.push(element.Name);
    });

    if (LOADED_MACROS.includes("DWS_Node"))
    {
      // NETWORK RESTRICTED INSTALL
      console.log("DWS: All required Macro files present. Performing local install.");

      // LOAD THE MACRO AND ENABLE IT
      xapi.Command.Macros.Macro.Activate({ Name: "DWS_Node"})
      .then (() => {
        xapi.Command.Macros.Macro.Remove({Name: "DWS_Sec_Startup"})
        .then (() => { xapi.Command.Macros.Runtime.Restart() } )
      })
    }
    else
    {
      // CLOUD INSTALL FROM GITHUB
      console.log("DWS: Performing cloud macro install.");
      getMacro();       
    }
  });  
}

async function getMacro ()
{
  try {
    const getMacro = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Node.js' })
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
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Macro Download Failed", Text: "Codec failed to download Macros. Setup Aborted."});
    }); 
  } catch (e) {
    console.warn('DWS: Unable to reach GitHub for Node Macro.' + e);
    xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Macro Unreachable", Text: "No network access to GitHub. Setup Aborted."});
  }
}

function saveStateMacro()
{
  xapi.Status.SystemUnit.ProductPlatform.get()
  .then ((productPlatform) => {

  // CREATE MACRO BODY
  const dataStr = \`
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

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const VERSION = '${DWS.VERSION}';
const STATE = '${state}';
const SCREENS = '${DWS.NODE1_DISPLAYS}';            
const NAV_CONTROL = '${DWS.NODE1_NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS.NODE1_NAV_SCHEDULER}';
const PLATFORM = '\${productPlatform}';

export default {
  VERSION,
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

// END OF EMBEDDED MACRO

  // SAVE STATE AND STARTUP MACROS ON NODE 1
  sendCommand(DWS.NODE1_HOST, `<Command><Macros><Macro><Save><Name>DWS_Sec_Startup</Name><OverWrite>True</OverWrite><body>${dataStr_NODE1}</body></Save><Activate><Name>DWS_Sec_Startup</Name></Activate></Macro><Runtime><Start></Start></Runtime></Macros></Command>`);

  // CHECK IF SECONDARY NODE IS CONFIGURED
  if (DWS.NODE2_HOST != undefined)
  {
    //===========================//
    //    MACRO BODY FOR NODE2   //
    //===========================//
    const dataStr_NODE2 = `
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

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/
import xapi from 'xapi';

function init()
{
  let LOADED_MACROS = [];

  // SAVE THE INITIAL STATE MACRO
  saveStateMacro();

  // PERFORM PREMISE INSTALL CHECK
  xapi.Command.Macros.Macro.Get()
  .then (response => {
    response.Macro.forEach(element => {
     LOADED_MACROS.push(element.Name);
    });

    if (LOADED_MACROS.includes("DWS_Node"))
    {
      // NETWORK RESTRICTED INSTALL
      console.log("DWS: All required Macro files present. Performing local install.");

      // LOAD THE MACRO AND ENABLE IT
      xapi.Command.Macros.Macro.Activate({ Name: "DWS_Node"})
      .then (() => {
        xapi.Command.Macros.Macro.Remove({Name: "DWS_Sec_Startup"})
        .then (() => { xapi.Command.Macros.Runtime.Restart() } )
      })
    }
    else
    {
      // CLOUD INSTALL FROM GITHUB
      console.log("DWS: Performing cloud macro install.");
      getMacro();       
    }
  });  
}

async function getMacro ()
{
  try {
    const getMacro = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Node.js' })
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
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Macro Download Failed", Text: "Codec failed to download Macros. Setup Aborted."});
    }); 
  } catch (e) {
    console.warn('DWS: Unable to reach GitHub for Node Macro.' + e);
    xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Macro Unreachable", Text: "No network access to GitHub. Setup Aborted."});
  }
}

function saveStateMacro()
{
  xapi.Status.SystemUnit.ProductPlatform.get()
  .then ((productPlatform) => {

  // CREATE MACRO BODY
  const dataStr = \`
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

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const VERSION = '${DWS.VERSION}';
const STATE = '${state}';
const SCREENS = '${DWS.NODE2_DISPLAYS}';            
const NAV_CONTROL = '${DWS.NODE2_NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS.NODE2_NAV_SCHEDULER}';
const PLATFORM = '\${productPlatform}';

export default {
  VERSION,
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

// END OF EMBEDDED MACRO

    // SAVE STATE AND STARTUP MACROS ON NODE 2
    sendCommand(DWS.NODE2_HOST, `<Command><Macros><Macro><Save><Name>DWS_Sec_Startup</Name><OverWrite>True</OverWrite><body>${dataStr_NODE2}</body></Save><Activate><Name>DWS_Sec_Startup</Name></Activate></Macro><Runtime><Start></Start></Runtime></Macros></Command>`);
  }
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
  Params.Url = `https://${codec}/putxml`;
  Params.Header = ['Authorization: Basic ' + DWS.MACRO_LOGIN, 'Content-Type: application/json'];

  xapi.Command.HttpClient.Post(Params, command)
  .then(() => {
    console.log(`DWS: Command sent to ${codec} successfully`);
  })
  .catch((error) => {
    console.error(`DWS: Error sending command:`, error);
  });
}

// BEGIN SETUP
firstSetup();