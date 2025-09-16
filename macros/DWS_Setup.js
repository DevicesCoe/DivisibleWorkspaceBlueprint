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

Version: 0.9.5 (BETA)

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
  xapi.Config.Video.Output.Connector[1].HDCPPolicy.set("off");
  xapi.Config.Video.Output.Connector[2].HDCPPolicy.set("off");
  
  console.log("DWS: Checking for Correct Inputs and Outputs.");
  if(DWS.NWAY == 'Two Way')
  {
  	let input1 = false;
  	let input2 = false;

    if(DWS.PLATFORM == 'Codec Pro' || DWS.PLATFORM == 'Room Kit EQ')
    {    
      input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
      input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();
    }

    if (input1 && input2)
    {
      console.log("DWS: Setting Inputs/Outputs Labels and Visibility."); 

      // SET NAMES AND VISIBILITY SETTINGS
      xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera');
      xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On');
      xapi.Config.Video.Input.Connector[1].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[1].PresentationSelection.set("Manual");
      xapi.Config.Video.Input.Connector[2].Name.set('Secondary Audience');
      xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off');
      xapi.Config.Video.Input.Connector[2].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[2].PresentationSelection.set("Manual");      
    }
    else
    {
      console.error("DWS: Invalid video input connection status. Ensure camera inputs match documentation. Setup aborted.");
      return;
    }
  }
  else
  {
  	let input1 = false;
  	let input2 = false;
  	let input3 = false;

    if(DWS.PLATFORM == 'Codec Pro' || DWS.PLATFORM == 'Room Kit EQ')
    {    
      input1 = await xapi.Status.Video.Input.Connector[1].Connected.get();
      input2 = await xapi.Status.Video.Input.Connector[2].Connected.get();
      input3 = await xapi.Status.Video.Input.Connector[3].Connected.get();
    }

    if (input1 && input2 && input3)
    {
      console.log("DWS: Setting Inputs/Outputs Labels and Visibility."); 

      // SET NAMES AND VISIBILITY SETTINGS
      xapi.Config.Video.Input.Connector[1].Name.set('Audience Camera');
      xapi.Config.Video.Input.Connector[1].CameraControl.Mode.set('On');
      xapi.Config.Video.Input.Connector[1].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[1].PresentationSelection.set("Manual");
      xapi.Config.Video.Input.Connector[2].Name.set(DWS.NODE1_ALIAS + ' Audience');
      xapi.Config.Video.Input.Connector[2].CameraControl.Mode.set('Off');
      xapi.Config.Video.Input.Connector[2].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[2].PresentationSelection.set("Manual");
      xapi.Config.Video.Input.Connector[3].Name.set(DWS.NODE2_ALIAS + ' Audience');
      xapi.Config.Video.Input.Connector[3].CameraControl.Mode.set('Off');
      xapi.Config.Video.Input.Connector[3].Visibility.set('Never');
      xapi.Config.Video.Input.Connector[3].PresentationSelection.set("Manual");
    }
    else
    {
      console.error("DWS: Invalid video input connection status. Ensure camera inputs match documentation. Setup aborted.");
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

Version: 0.9.5 (BETA)

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

Version: 0.9.5 (BETA)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/
import xapi from 'xapi';

let LOADED_MACROS = [];

function init()
{
  // SAVE THE INITIAL STATE MACRO
  saveStateMacro();

  // PERFORM PREMISE INSTALL CHECK
  xapi.Command.Macros.Macro.Get()
  .then (response => {
    response.Macro.forEach(element => {
      LOADED_MACROS.push(element.Name);
    });
  });  

  // PERFORM PREMISE INSTALL CHECK
  if(LOADED_MACROS.includes('DWS_Node'))
  {
    console.log("DWS: All required Macro files present. Performing local install.");

    // LOAD THE MACRO AND ENABLE IT
    xapi.Command.Macros.Macro.Activate({ Name: "DWS_Node"})
    .then (() => {
      xapi.Command.Macros.Macro.Remove({Name: "DWS_Sec_Startup"})
      .then (() => { xapi.Command.Macros.Runtime.Restart() } )
    })
  }
  // OR LOAD NODE MACRO FROM GITHUB
  else
  {
    console.log("DWS: Performing cloud macro install.");
    getMacro(); 
  }  
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

Version: 0.9.5 (BETA)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const STATE = '${state}';
const SCREENS = '${DWS.NODE1_DISPLAYS}';            
const NAV_CONTROL = '${DWS.NODE1_NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS.NODE1_NAV_SCHEDULER}';
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

Version: 0.9.5 (BETA)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/
import xapi from 'xapi';

let LOADED_MACROS = [];

function init()
{
  // SAVE THE INITIAL STATE MACRO
  saveStateMacro();

  // PERFORM PREMISE INSTALL CHECK
  xapi.Command.Macros.Macro.Get()
  .then (response => {
    response.Macro.forEach(element => {
      LOADED_MACROS.push(element.Name);
    });
  });  

  // PERFORM PREMISE INSTALL CHECK
  if(LOADED_MACROS.includes('DWS_Node'))
  {
    console.log("DWS: All required Macro files present. Performing local install.");

    // LOAD THE MACRO AND ENABLE IT
    xapi.Command.Macros.Macro.Activate({ Name: "DWS_Node"})
    .then (() => {
      xapi.Command.Macros.Macro.Remove({Name: "DWS_Sec_Startup"})
      .then (() => { xapi.Command.Macros.Runtime.Restart() } )
    })
  }
  // OR LOAD NODE MACRO FROM GITHUB
  else
  {
    console.log("DWS: Performing cloud macro install.");
    getMacro(); 
  }  
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

Version: 0.9.5 (BETA)

Complete details for this macro are available on Github:
https://cs.co/divisibleworkspaceblueprint

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const STATE = '${state}';
const SCREENS = '${DWS.NODE2_DISPLAYS}';            
const NAV_CONTROL = '${DWS.NODE2_NAV_CONTROL}';
const NAV_SCHEDULER = '${DWS.NODE2_NAV_SCHEDULER}';
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