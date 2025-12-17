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

let WIZARD_QUESTIONS = [];
let SETUP_VARIABLES = [];
let LOADED_MACROS = [];
let THIS_PLATFORM;

function init()
{
  // PERFORM INITIAL PLATFORM SANITY CHECKS BEFORE ALLOWING THE WIZARD TO DEPLOY

  // CHECK PLATFORM COMPATIBILITY
  THIS_PLATFORM = xapi.Status.SystemUnit.ProductPlatform.get()
  .then (platform => {    
    if(platform != 'Codec Pro' && platform != 'Room Kit EQ')
    {    
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '0', Title:"Unsupported Product Platform", Text: "The Divisible Workspace Blueprint is only supported on Codec Pro and Codec EQ."}); 

      console.error("DWS: Platform not compatible with Divisble Workspace Blueprint. Stopping installation.");

      // TURN OFF MACRO
      try { xapi.Command.Macros.Macro.Deactivate({ Name: 'DWS_Wizard' }); } catch(error) { console.error('DWS: Error disabling Wizard Macro: ' + error.message); }
      return;
    }

    if(THIS_PLATFORM == 'Room Kit EQ')
    {
      xapi.Command.SystemUnit.OptionKey.List()
      .then (response => {
        if (response.OptionKey[3].Active != 'True' && response.OptionKey[3].Installed != 'True')
        {
          console.error ("DWS: No AV Integrator option key installed. Stopping installation.");

          xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Error: Missing AV Integrator Option Key", Text: "The Divisible Workspace Blueprint requires the AV Integrator option key for the primary Codec EQ."}); 
        }   
      });

      // TURN OFF MACRO
      try { xapi.Command.Macros.Macro.Deactivate({ Name: 'DWS_Wizard' }); } catch(error) { console.error('DWS: Error disabling Wizard Macro: ' + error.message); }
      return;
    }
  });

  // ENSURE ROOM TYPE IS STANDARD
  xapi.Status.Provisioning.RoomType.get()
  .then (roomType => {
    if (roomType != 'Standard')
    {
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '0', Title:"Unsupported Room Type", Text: "The Divisible Workspace Blueprint is only supported using the Standard Room Type."}); 

      console.error("DWS: Divisble Workspace Blueprint only operates in Standard Room Type. Stopping installation.");

      // TURN OFF MACRO
      try { xapi.Command.Macros.Macro.Deactivate({ Name: 'DWS_Wizard' }); } catch(error) { console.error('DWS: Error disabling Wizard Macro: ' + error.message); }
      return;
    }
  })

  // GET AND STORE PRIMARY MICROPHONES
  xapi.Command.Peripherals.List({ Connected: 'True', Type: 'AudioMicrophone' })
  .then(response => {

    const devicesArray = [];
    const serialArray = [];

    if(response == '{"status":"OK"}')
    {
      xapi.Command.UserInterface.Message.Alert.Display({ Duration: '0', Title:"No Microphones Detected", Text: "The Divisible Workspace Blueprint is requires Cisco Pro Series microphones."}); 

      console.error("DWS: No Microphones Detected. Blueprint is requires Cisco Pro Series microphones. Stopping installation.");

      // TURN OFF MACRO
      try { xapi.Command.Macros.Macro.Deactivate({ Name: 'DWS_Wizard' }); } catch(error) { console.error('DWS: Error disabling Wizard Macro: ' + error.message); }
      return;
    }

    let filteredDevices = JSON.parse(response);

    filteredDevices.Device.forEach(device => {
        devicesArray.push({
            SerialNumber: device.SerialNumber || null,
            ID: device.ID || null,
            Name: device.Name || null
        });

        serialArray.push(device.SerialNumber);
    });
    
    for (let i = 0; i < 4; i++)
    {
      if (devicesArray[i] != undefined)
      {
        SETUP_VARIABLES['dws_setup_primary_mic' + (i + 1)] = "Microphone " + (i + 1) + ": " + devicesArray[i].SerialNumber;              
        console.debug("DWS: Found Primary Mic: " + SETUP_VARIABLES['dws_setup_primary_mic' + (i + 1)]);
      }
      else
      {
        SETUP_VARIABLES['dws_setup_primary_mic' + (i + 1)] = "Microphone " + (i + 1) + ": Not Connected";
      }            
    }

    // SAVE MICROPHONES TO SETUP VARIABLE
    SETUP_VARIABLES['dws_setup_primary_mics'] = serialArray;
  });

  // STORED LOADED MACROS FOR CHECK DURING NETWORK RESTRICTED INSTALL
  xapi.Command.Macros.Macro.Get()
  .then (response => {
    response.Macro.forEach(element => {
      LOADED_MACROS.push(element.Name);
    });
  });

  console.log ("DWS: Initializing Divisible Workspace Wizard.");

  // WIZARD QUESTION AND RESPONSES
  WIZARD_QUESTIONS["dws_edit_nway"] = { feedbackId: "dws_setup_nway", text: "What type of Divisible Room are you deploying?", options: { "Option.1": "Two Way", "Option.2": "Three Way"} };
  WIZARD_QUESTIONS["dws_edit_switchtype"] = { feedbackId: "dws_setup_switchtype", text: "What Model Switch are you using?", options: { "Option.1": "Catalyst 9200CX 8 Port", "Option.2": "Catalyst 9200CX 12 Port", "Option.3": "Catalyst 9200/9300 24 Port" } };
  WIZARD_QUESTIONS["dws_edit_username"] = { feedbackId: "dws_setup_username", text: "Enter the Username for the user created on the Node Codecs:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Enter the username..."};
  WIZARD_QUESTIONS["dws_edit_password"] = { feedbackId: "dws_setup_password", text: "Enter the Password for the user created on the Node Codecs:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Enter the password..."};
  WIZARD_QUESTIONS["dws_edit_advpin"] = { feedbackId: "dws_setup_advpin", text: "Please enter an Advanced Settings lock PIN", inputType: "Numeric", keyboardState: "Open", placeholder: "Enter your Numerical PIN" };
  WIZARD_QUESTIONS["dws_edit_automode"] = { feedbackId: "dws_setup_automode", text: "Please select the default automated camera mode:", options: { "Option.1": "On", "Option.2": "Off" } };
  WIZARD_QUESTIONS["dws_edit_ducking"] = { feedbackId: "dws_setup_ducking", text: "Please select the default setting for automatic microphone ducking:", options: { "Option.1": "On", "Option.2": "Off" } };
  WIZARD_QUESTIONS["dws_edit_node1_host"] = { feedbackId: "dws_setup_node1_host", text: "Enter the IP or FQDN of the Node 1 Codec:", inputType: "Numeric", keyboardState: "Open", placeholder: "Ex. 192.168.1.10 or secondary.domain.com" };
  WIZARD_QUESTIONS["dws_edit_node1_alias"] = { feedbackId: "dws_setup_node1_alias", text: "Enter a user friendly alias for Node 1:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. Training A" };
  WIZARD_QUESTIONS["dws_edit_node1_configuration"] = { feedbackId: "dws_setup_node1_configuration", text: "Please select the configuration that matches Node 1:", options: { "Option.1": "Codec Pro with One Screen", "Option.2": "Codec Pro with Two Screens", "Option.3": "Codec EQ with One Screen", "Option.4": "Codec EQ with Two Screens"} };
  WIZARD_QUESTIONS["dws_edit_node1_presenter"] = { feedbackId: "dws_setup_node1_presenter", text: "What connection type is the Presenter PTZ for Node 1?:", options: { "Option.1": "IP", "Option.2": "HDMI", "Option.3": "None"} };
  WIZARD_QUESTIONS["dws_edit_node2_host"] = { feedbackId: "dws_setup_node2_host", text: "Enter the IP or FQDN of the Node 2 Codec:", inputType: "Numeric", keyboardState: "Open", placeholder: "Ex. 192.168.1.10 or secondary.domain.com" };
  WIZARD_QUESTIONS["dws_edit_node2_alias"] = { feedbackId: "dws_setup_node2_alias", text: "Enter a user friendly alias for Node 2:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. Training C" },
  WIZARD_QUESTIONS["dws_edit_node2_configuration"] = { feedbackId: "dws_setup_node2_configuration", text: "Please select the configuration that matches Node 2:", options: { "Option.1": "Codec Pro with One Screen", "Option.2": "Codec Pro with Two Screens", "Option.3": "Codec EQ with One Screen", "Option.4": "Codec EQ with Two Screens"} };
  WIZARD_QUESTIONS["dws_edit_node2_presenter"] = { feedbackId: "dws_setup_node2_presenter", text: "What connection type is the Presenter PTZ for Node 2?:", options: { "Option.1": "IP", "Option.2": "HDMI", "Option.3": "None"} };

  // DRAW SETUP WIZARD PANEL & BUTTON
  xapi.Command.UserInterface.Extensions.Panel.Save({PanelId: 'dws_wizard'}, PANEL_START)
  .then(() =>{ console.log ("DWS: Panel created successfully.")})
  .catch(e => console.log('Error saving panel: ' + e.message))

  // HANDLE TEXT INPUT RESPONSES FROM EDIT BUTTON TRIGGERS BELOW
  xapi.Event.UserInterface.Message.TextInput.Response.on(event => {

    // USERNAME ENTRY CHECK
    if (event.FeedbackId == 'dws_setup_username') 
    {
      if (event.Text.length == 0) // CHECK USERNAME WAS ENTERED AND REPEAT IF EMPTY
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "Username cannot be blank. Please try again."});  
      }
      else{
        // UPDATE PANEL DETAILS TO SHOW NEW VALUE
        updateWidget(event.FeedbackId, event.Text);
      }
    }
    // PASSWORD ENTRY CHECK
    else if (event.FeedbackId == 'dws_setup_password')
    {
      if (event.Text.length < 8)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "Password entered was too short (Min 8 characters). Please try again."});
      }
      else{
        // UPDATE PANEL DETAILS TO SHOW NEW VALUE
        updateWidget(event.FeedbackId, event.Text);
      }
    }
    // ENSURE YOU DONT CONNECT TO THE SAME CODEC TWICE OR YOURSELF
    else if (event.FeedbackId == 'dws_setup_node1_host' || event.FeedbackId == 'dws_setup_node2_host')
    {   
      // GET SYSTEM IP ADDRESS
      xapi.Status.Network[1].IPv4.Address.get()
      .then(PRIMARY_IP => {
        // COMPARE SUBMITTED ADDRESS AGAINST LOCAL IP
        if (PRIMARY_IP == event.Text)
        {
          xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "Please enter the IP or FQDN of your Node Codec."});
        }
        // CHECK TO MAKE SURE BOTH CODECS ARENT THE SAME IP
        else if (event.FeedbackId == 'dws_setup_node2_host' && event.Text == SETUP_VARIABLES['dws_setup_node1_host'])
        {
          xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "Both Node Codecs must have unique IP or FQDNs."});
        }
        else
        {
          // UPDATE PANEL DETAILS TO SHOW NEW VALUE
          updateWidget(event.FeedbackId, event.Text);
        }
      })
    }
    else
    {
      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, event.Text);
    }
  });

  // HANDLE MULTIPLE CHOICE SWITCH TYPE RESPONSE
  xapi.Event.UserInterface.Message.Prompt.Response.on(event => {
    const selectedOption = event.OptionId;
    let optionText;

    if (event.FeedbackId == 'dws_setup_nway')
    {
      optionText = WIZARD_QUESTIONS['dws_edit_nway'].options[`Option.${selectedOption}`];
 
      SETUP_VARIABLES['dws_setup_nway'] = optionText;

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_switchtype')
    {
      optionText = WIZARD_QUESTIONS['dws_edit_switchtype'].options[`Option.${selectedOption}`];

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_automode')
    {
      optionText = WIZARD_QUESTIONS['dws_edit_automode'].options[`Option.${selectedOption}`];

      // STORE THE AUTO MODE DEFAULT SETTING IN ARRAY
      SETUP_VARIABLES['dws_setup_automode'] = optionText;

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_ducking')
    {
      optionText = WIZARD_QUESTIONS['dws_edit_ducking'].options[`Option.${selectedOption}`];

      // STORE THE AUTO MODE DEFAULT SETTING IN ARRAY
      SETUP_VARIABLES['dws_setup_ducking'] = optionText;

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_node1_configuration')
    {
      // STORE FOR DISPLAYS
      if (selectedOption == '1' || selectedOption == '3')
      {
        SETUP_VARIABLES['dws_setup_node1_displays'] = '1';
        SETUP_VARIABLES['dws_setup_node1_configuration'] == optionText;
      }
      // STORE FOR DUAL DISPLAYS
      else
      {
        SETUP_VARIABLES['dws_setup_node1_displays'] = '2';
      }

      optionText = WIZARD_QUESTIONS['dws_edit_node1_configuration'].options[`Option.${selectedOption}`];
      SETUP_VARIABLES['dws_setup_node1_configuration'] == optionText;

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_node1_presenter')
    {
      optionText = WIZARD_QUESTIONS['dws_edit_node1_presenter'].options[`Option.${selectedOption}`];

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_node2_configuration')
    {
      // STORE FOR DISPLAYS
      if (selectedOption == '1' || selectedOption == '3')
      {
        SETUP_VARIABLES['dws_setup_node2_displays'] = '1';
        SETUP_VARIABLES['dws_setup_node2_configuration'] == optionText;
      }
      // STORE FOR DUAL DISPLAYS
      else
      {
        SETUP_VARIABLES['dws_setup_node2_displays'] = '2';
      }

      optionText = WIZARD_QUESTIONS['dws_edit_node2_configuration'].options[`Option.${selectedOption}`];

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }
    else if (event.FeedbackId == 'dws_setup_node2_presenter')
    {
      optionText = WIZARD_QUESTIONS['dws_edit_node2_presenter'].options[`Option.${selectedOption}`];

      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, optionText);
    }

  })

  // LISTEN FOR TOGGLE CHANGES, BACK / NEXT, EDIT BUTTON PRESSES
  xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
    // MULTI CHOICE TOGGLE CHANGES
    if (event.Type == 'released' && event.WidgetId == 'dws_setup_presenter_mic')
    {
      if (event.Value == 'USB')
      {
        SETUP_VARIABLES['dws_setup_mics_usb'] = 'on';
        SETUP_VARIABLES['dws_setup_presenter_mic'] = 'USB';
        SETUP_VARIABLES['dws_setup_mics_analog'] = 'off';
      }
      else if (event.Value == 'Analog')
      {
        SETUP_VARIABLES['dws_setup_mics_analog'] = 'on';
        SETUP_VARIABLES['dws_setup_presenter_mic'] = 'Analog';
        SETUP_VARIABLES['dws_setup_mics_usb'] = 'off';
      }
      else
      {
        // STORE TOGGLED VALUE
        SETUP_VARIABLES['dws_setup_presenter_mic'] = event.Value;

        // REMOVE PRESENTER MIC FROM PRIMARY MIC ARRAY
        const index = SETUP_VARIABLES['dws_setup_primary_mics'].indexOf(event.Value);
        SETUP_VARIABLES['dws_setup_primary_mics'].splice(index, 1);

        SETUP_VARIABLES['dws_setup_mics_usb'] = 'off';
        SETUP_VARIABLES['dws_setup_mics_analog'] = 'off';
      }

      console.debug("DWS: Primary presenter microphone set to " + event.Value);
    }

    // EDIT BUTTONS FOR TEXT INPUTS
    else if (event.Type == 'released' && event.WidgetId.startsWith('dws_edit_') && event.WidgetId != 'dws_edit_nway' && event.WidgetId != 'dws_edit_switchtype' && event.WidgetId != 'dws_edit_automode' && event.WidgetId != 'dws_edit_ducking'  && event.WidgetId != 'dws_edit_node1_presenter' && event.WidgetId != 'dws_edit_node1_configuration' && event.WidgetId != 'dws_edit_node2_presenter' && event.WidgetId != 'dws_edit_node2_configuration') 
    {
      editDetails(event.WidgetId);
    }
    // EDIT BUTTONS FOR MULTIPLE CHOICE
    else if (event.Type == 'released' && ( event.WidgetId == 'dws_edit_nway' || event.WidgetId == 'dws_edit_switchtype' || event.WidgetId == 'dws_edit_automode' || event.WidgetId == 'dws_edit_ducking' || event.WidgetId == 'dws_edit_node1_presenter' || event.WidgetId == 'dws_edit_node1_configuration' || event.WidgetId == 'dws_edit_node2_presenter' || event.WidgetId == 'dws_edit_node2_configuration' ))
    {
      xapi.Command.UserInterface.Message.Prompt.Display({
        Title: `Select an Option`,
        Text: WIZARD_QUESTIONS[event.WidgetId].text,
        FeedbackId: WIZARD_QUESTIONS[event.WidgetId].feedbackId,
        ...WIZARD_QUESTIONS[event.WidgetId].options
      });
    }

    // NEXT BUTTONS
    else if( event.Type == 'released' && event.WidgetId == 'dws_next_start' )
    {
      // REDRAW PANEL TO NEXT PAGE
      drawPanel(PANEL_COMMON);
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_next_common' )
    {
      // CHECK SETUP IS SUFFICIENTLY COMPLETED BY PAGE
      if ( SETUP_VARIABLES['dws_setup_nway'] == undefined || SETUP_VARIABLES['dws_setup_switchtype'] == undefined || SETUP_VARIABLES['dws_setup_automode'] == undefined || SETUP_VARIABLES['dws_setup_username'] == undefined || SETUP_VARIABLES['dws_setup_password'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Missing Configuration", Text: "Please ensure all values are configured."});
      }
      // CHECK FOR CORRECT SWITCH CHOICE
      else if (SETUP_VARIABLES['dws_setup_nway'] == 'Three Way' && (SETUP_VARIABLES['dws_setup_switchtype'] == 'Catalyst 9200CX 8 Port' || SETUP_VARIABLES['dws_setup_switchtype'] == 'C9K-8P'))
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Configuration Error", Text: "Three Way Divisible Workspaces are only compatible with 12 and 24 port switches."});
      }
      else
      {
        PANEL_PRIMARY = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Select Presenter Microphone</Name><Row><Name/><Widget><WidgetId>widget_273</WidgetId><Name>Please select the Presenter Microphone in the primary workspace.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Available Microphones</Name><Widget><WidgetId>dws_setup_presenter_mic</WidgetId><Type>GroupButton</Type><Options>size=4;columns=2</Options><ValueSpace>`;

        // AUTOMATE THE CREATION OF OPTIONS BASED ON MICROPHONE COUNT
        let COUNTER = 0;
        SETUP_VARIABLES['dws_setup_primary_mics'].forEach(() => {
          PANEL_PRIMARY += "<Value><Key>" + SETUP_VARIABLES['dws_setup_primary_mics'][COUNTER] + "</Key><Name>Eth " + (COUNTER+1) + ": " + SETUP_VARIABLES['dws_setup_primary_mics'][COUNTER] + "</Name></Value>";
          COUNTER++;
        });

        PANEL_PRIMARY += `<Value><Key>USB</Key><Name>USB</Name></Value><Value><Key>Analog</Key><Name>Analog (All)</Name></Value></ValueSpace></Widget></Row><Row><Name/><Widget><WidgetId>widget_314</WidgetId><Name>Automatic Ducking allows third party microphones to be enabled for In Room Speaker Reinforcement. Only available for USB &amp; Analog inputs.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Automatic Microphone Ducking</Name><Widget><WidgetId>dws_setup_ducking</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_ducking</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_primary</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_next_primary</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_primary</PageId><Options/></Page></Panel></Extensions>`;

        drawPanel(PANEL_PRIMARY);
      }
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_next_primary' )
    {
      // PRIMARY PRESENTER MICROPHONE CHECK
      if(SETUP_VARIABLES['dws_setup_presenter_mic'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Configuration", Text: "Please select a Presenter Microphone option."});
      }
      else if (SETUP_VARIABLES['dws_setup_ducking'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Configuration", Text: "Please select a default mode for microphone ducking."});
      }
      else if (SETUP_VARIABLES['dws_setup_ducking'] == 'On' && SETUP_VARIABLES['dws_setup_presenter_mic'] != 'USB' && SETUP_VARIABLES['dws_setup_presenter_mic'] != 'Analog')
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Configuration", Text: "Automatic ducking is only supported with USB and Analog presenter microphones."});
      }
      else
      {
        // REDRAW PANEL TO NEXT PAGE
        drawPanel(PANEL_NODE1);
      }
      
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_connect_node1' )
    {

      if (SETUP_VARIABLES['dws_setup_node1_host'] == undefined || SETUP_VARIABLES['dws_setup_node1_alias'] == undefined || SETUP_VARIABLES['dws_setup_node1_configuration'] == undefined || SETUP_VARIABLES['dws_setup_node1_presenter'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Missing Configuration", Text: "Please set the host, alias, configuration and presenter camera option."});
      }
      else if ((SETUP_VARIABLES['dws_setup_node1_configuration'] == 'Codec Pro with One Screen' || SETUP_VARIABLES['dws_setup_node1_configuration'] == 'Codec Pro with Two Screens') && SETUP_VARIABLES['dws_setup_node1_presenter'] == 'IP')
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Invalid Configuration", Text: "The Codec Pro does not support Video over IP for Presenter PTZ."});
      }
      else if (SETUP_VARIABLES['dws_setup_node1_configuration'] == 'Codec EQ with Two Screens' && SETUP_VARIABLES['dws_setup_node1_presenter'] == 'HDMI')
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Invalid Configuration", Text: "The Codec EQ does not have sufficient inputs for dual display and HDMI presenter PTZ configuration."});
      }
      else
      {
        // CONNECT TO NODE FOR DETAILS
        connectNode('1',SETUP_VARIABLES['dws_setup_node1_host'])

        // REDRAW PANEL TO NEXT PAGE
        drawPanel(PANEL_NODE1_DETAILS);
      }
      
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_next_node1_details' )
    {
      // N-WAY TYPE CHECK
      if (SETUP_VARIABLES['dws_setup_nway'] == 'Two Way')
      {
        PANEL_SETUP = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Final Step</Name><Row><Name>Adv. Settings Lock PIN:</Name><Widget><WidgetId>dws_setup_advpin</WidgetId><Name>${SETUP_VARIABLES['dws_setup_advpin']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_advpin</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row></Row><Row><Name/><Widget><WidgetId>setup_text</WidgetId><Name>Click Begin Setup to finalize the installation of the Primary and Node codecs based on the details provided. </Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_begin</WidgetId><Name>Begin Setup</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><Row></Row><Row><Name/><Widget><WidgetId>dws_back_setup</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>widget_310</WidgetId><Type>Spacer</Type><Options>size=2</Options></Widget></Row><PageId>setup_finish</PageId><Options>hideRowNames=0</Options></Page></Panel></Extensions>`;

        // REDRAW PANEL TO NEXT PAGE
        drawPanel(PANEL_SETUP);
      }
      else
      {
        // REDRAW PANEL TO NEXT PAGE
        drawPanel(PANEL_NODE2);
      }
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_connect_node2' )
    {
      if (SETUP_VARIABLES['dws_setup_node2_host'] == undefined || SETUP_VARIABLES['dws_setup_node2_alias'] == undefined || SETUP_VARIABLES['dws_setup_node2_configuration'] == undefined || SETUP_VARIABLES['dws_setup_node2_presenter'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Missing Configuration", Text: "Please set the host, alias, configuration and presenter camera option."});
      }
      else if ((SETUP_VARIABLES['dws_setup_node2_configuration'] == 'Codec Pro with One Screen' || SETUP_VARIABLES['dws_setup_node2_configuration'] == 'Codec Pro with Two Screens') && SETUP_VARIABLES['dws_setup_node2_presenter'] == 'IP')
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Invalid Configuration", Text: "The Codec Pro does not support Video over IP for Presenter PTZ."});
      }
      else if (SETUP_VARIABLES['dws_setup_node2_configuration'] == 'Codec EQ with Two Screens' && SETUP_VARIABLES['dws_setup_node2_presenter'] == 'HDMI')
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Invalid Configuration", Text: "The Codec EQ does not have sufficient inputs for dual display and HDMI presenter PTZ configuration."});
      }
      else
      {
        // CONNECT TO NODE FOR DETAILS
        connectNode('2',SETUP_VARIABLES['dws_setup_node2_host'])

        // REDRAW PANEL TO NEXT PAGE
        drawPanel(PANEL_NODE2_DETAILS);
      }      
    }
     else if( event.Type == 'released' && event.WidgetId == 'dws_next_node2_details' )
    {
      PANEL_SETUP = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Final Step</Name><Row><Name>Adv. Settings Lock PIN:</Name><Widget><WidgetId>dws_setup_advpin</WidgetId><Name>${SETUP_VARIABLES['dws_setup_advpin']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_advpin</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row></Row><Row><Name/><Widget><WidgetId>setup_text</WidgetId><Name>Click Begin Setup to finalize the installation of the Primary and Node codecs based on the details provided. </Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_begin</WidgetId><Name>Begin Setup</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><Row></Row><Row><Name/><Widget><WidgetId>dws_back_setup</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>widget_310</WidgetId><Type>Spacer</Type><Options>size=2</Options></Widget></Row><PageId>setup_finish</PageId><Options>hideRowNames=0</Options></Page></Panel></Extensions>`;

      // REDRAW PANEL TO NEXT PAGE
      drawPanel(PANEL_SETUP);
    }

    // BACK BUTTONS
    else if( event.Type == 'released' && event.WidgetId == 'dws_back_primary' )
    {
      PANEL_COMMON = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Common Settings</Name><Row><Name>Divisible Room Type</Name><Widget><WidgetId>dws_setup_nway</WidgetId><Name>${SETUP_VARIABLES['dws_setup_nway']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_nway</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Switch Type</Name><Widget><WidgetId>dws_setup_switchtype</WidgetId><Name>${SETUP_VARIABLES['dws_setup_switchtype']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_switchtype</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Default Camera Automation</Name><Widget><WidgetId>dws_setup_automode</WidgetId><Name>${SETUP_VARIABLES['dws_setup_automode']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_automode</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Common Node Username</Name><Widget><WidgetId>dws_setup_username</WidgetId><Name>${SETUP_VARIABLES['dws_setup_username']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_username</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Common Node Password</Name><Widget><WidgetId>dws_setup_password</WidgetId><Name>${SETUP_VARIABLES['dws_setup_password']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_password</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_next_common</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_common</PageId><Options>hideRowNames=0</Options></Page></Panel></Extensions>`;

      // REDRAW PANEL TO PREVIOUS PAGE
      drawPanel(PANEL_COMMON);
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_back_node1' )
    {
      PANEL_PRIMARY = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Select Presenter Microphone</Name><Row><Name/><Widget><WidgetId>widget_273</WidgetId><Name>Please select the Presenter Microphone in the primary workspace.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Available Microphones</Name><Widget><WidgetId>dws_setup_presenter_mic</WidgetId><Type>GroupButton</Type><Options>size=4;columns=2</Options><ValueSpace>`;

      // AUTOMATE THE CREATION OF OPTIONS BASED ON MICROPHONE COUNT
      let COUNTER = 0;
      SETUP_VARIABLES['dws_setup_primary_mics'].forEach(() => {
        PANEL_PRIMARY += "<Value><Key>" + SETUP_VARIABLES['dws_setup_primary_mics'][COUNTER] + "</Key><Name>Eth " + (COUNTER+1) + ": " + SETUP_VARIABLES['dws_setup_primary_mics'][COUNTER] + "</Name></Value>";
        COUNTER++;
      });

      PANEL_PRIMARY += `<Value><Key>USB</Key><Name>USB</Name></Value><Value><Key>Analog</Key><Name>Analog (All)</Name></Value></ValueSpace></Widget></Row><Row><Name/><Widget><WidgetId>widget_314</WidgetId><Name>Automatic Ducking allows third party microphones to be enabled for In Room Speaker Reinforcement. Only available for USB &amp; Analog inputs.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Automatic Microphone Ducking</Name><Widget><WidgetId>dws_setup_ducking</WidgetId><Name>${SETUP_VARIABLES['dws_setup_ducking']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_ducking</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_primary</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_next_primary</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_primary</PageId><Options/></Page></Panel></Extensions>`;

      drawPanel(PANEL_PRIMARY);           
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_back_node1_details' )
    {
      PANEL_NODE1 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 1 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 1. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 1 IP or FQDN</Name><Widget><WidgetId>dws_setup_node1_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_host']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 1 Alias</Name><Widget><WidgetId>dws_setup_node1_alias</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_alias']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node1_configuration</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_configuration']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node1_presenter</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_presenter']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node1</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node1</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node1</PageId><Options/></Page></Panel></Extensions>`;

      // REDRAW PANEL TO PREVIOUS PAGE
      drawPanel(PANEL_NODE1);
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_back_node2' )
    {
      PANEL_NODE1 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 1 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 1. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 1 IP or FQDN</Name><Widget><WidgetId>dws_setup_node1_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_host']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 1 Alias</Name><Widget><WidgetId>dws_setup_node1_alias</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_alias']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node1_configuration</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_configuration']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node1_presenter</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_presenter']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node1</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node1</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node1</PageId><Options/></Page></Panel></Extensions>`;

      // REDRAW PANEL TO PREVIOUS PAGE
      drawPanel(PANEL_NODE1);
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_back_node2_details' )
    {
      PANEL_NODE2 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 2 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 2. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 2 IP or FQDN</Name><Widget><WidgetId>dws_setup_node2_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_host']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 2 Alias</Name><Widget><WidgetId>dws_setup_node2_alias</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_alias']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node2_configuration</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_configuration']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node2_presenter</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_presenter']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node2</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node2</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node2</PageId><Options/></Page></Panel></Extensions>`;

      // REDRAW PANEL TO PREVIOUS PAGE
      drawPanel(PANEL_NODE2);
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_back_setup' )
    {
      // N-WAY TYPE CHECK
      if (SETUP_VARIABLES['dws_setup_nway'] == 'Two Way')
      {
        PANEL_NODE1 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 1 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 1. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 1 IP or FQDN</Name><Widget><WidgetId>dws_setup_node1_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_host']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 1 Alias</Name><Widget><WidgetId>dws_setup_node1_alias</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_alias']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node1_configuration</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_configuration']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node1_presenter</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_presenter']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node1</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node1</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node1</PageId><Options/></Page></Panel></Extensions>`;

        // REDRAW PANEL TO PREVIOUS PAGE
        drawPanel(PANEL_NODE1);
      }
      else
      {
        PANEL_NODE2 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 2 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 2. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 2 IP or FQDN</Name><Widget><WidgetId>dws_setup_node2_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_host']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 2 Alias</Name><Widget><WidgetId>dws_setup_node2_alias</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_alias']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node2_configuration</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_configuration']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node2_presenter</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_presenter']}</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node2</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node2</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node2</PageId><Options/></Page></Panel></Extensions>`;

        // REDRAW PANEL TO PREVIOUS PAGE
        drawPanel(PANEL_NODE2);
      }
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_begin' )
    {
      if(SETUP_VARIABLES['dws_setup_advpin'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Configuration", Text: "Please configure the Advanced Settings Lock PIN."});
        return;
      }

      console.log ('DWS: Beginning Divisible Workspace Initilization.');

      // ONLY STORE THE BASE64 USERNAME:PASSWORD
      SETUP_VARIABLES['dws_setup_login'] = btoa(`${SETUP_VARIABLES['dws_setup_username']}:${SETUP_VARIABLES['dws_setup_password']}`);

      // GET PRODUCT PLATFORM THEN CONTINUE
      xapi.Status.SystemUnit.ProductPlatform.get()
      .then ((productPlatform) => {
 
        // LOAD SETUP MACROS
        loadMacros()
        .then (result => {

          if (result)
          {
            // ALERT USER OF SETUP STARTING
            xapi.Command.UserInterface.Message.Alert.Display({ Duration: '45', Title:"Installation Started", Text: "Please wait while the installation process completes."});

            // CREATE CONFIG MACRO BODY
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
const DEBUG = false; 
const TRACKING_DEBUG = false;

// ONLY CHANGE IF YOU ARE NOT USING THE DEFAULT U:P IN USB CONFIGURATION FILE
const SWITCH_USERNAME = 'dwsadmin';
const SWITCH_PASSWORD = 'D!vi$ible1';

// ENABLE OR DISABLE THE COMBINED ROOM BANNER ON DISPLAYS
// ACCEPTED VALUES: true, false
const COMBINED_BANNER = true;

// ENABLE OR DISABLE THE AUTOMATIC DUCKING OF ETHERNET MICS BASED ON USB / ANALOG INPUT
// ACCEPTED VALUES: 'On', 'Off'
const AUTO_DUCKING = ${JSON.stringify(SETUP_VARIABLES['dws_setup_ducking'], null, 2)};;

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const NWAY = ${JSON.stringify(SETUP_VARIABLES['dws_setup_nway'], null, 2)};
const SWITCH_TYPE = ${JSON.stringify(SETUP_VARIABLES['dws_setup_switchtype'], null, 2)};
const MACRO_LOGIN = ${JSON.stringify(SETUP_VARIABLES['dws_setup_login'], null, 2)};
const NODE1_HOST = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node1_host'], null, 2)};
const NODE1_ALIAS = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node1_alias'], null, 2)};     
const NODE1_DISPLAYS = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node1_displays'], null, 2)};
const NODE1_PRESENTER = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node1_presenter'], null, 2)};               
const NODE1_NAV_CONTROL = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node1_control'], null, 2)};
const NODE1_NAV_SCHEDULER = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node1_scheduler'], null, 2)};
const NODE2_HOST = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node2_host'], null, 2)}; 
const NODE2_ALIAS = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node2_alias'], null, 2)};    
const NODE2_DISPLAYS = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node2_displays'], null, 2)}; 
const NODE2_PRESENTER = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node2_presenter'], null, 2)};           
const NODE2_NAV_CONTROL = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node2_control'], null, 2)};
const NODE2_NAV_SCHEDULER = ${JSON.stringify(SETUP_VARIABLES['dws_setup_node2_scheduler'], null, 2)};
const PRESENTER_MIC = ${JSON.stringify(SETUP_VARIABLES['dws_setup_presenter_mic'], null, 2)};
const PRESENTER_USB = ${JSON.stringify(SETUP_VARIABLES['dws_setup_mics_usb'], null, 2)};
const PRESENTER_ANALOG = ${JSON.stringify(SETUP_VARIABLES['dws_setup_mics_analog'], null, 2)};
const PRIMARY_MICS = ${JSON.stringify(SETUP_VARIABLES['dws_setup_primary_mics'], null, 2)};
const NODE1_MICS = [${SETUP_VARIABLES['dws_setup_node1_mics']}];
const NODE2_MICS = [${SETUP_VARIABLES['dws_setup_node2_mics']}];
const AUTOMODE_DEFAULT = ${JSON.stringify(SETUP_VARIABLES['dws_setup_automode'], null, 2)};
const UNLOCK_PIN = ${JSON.stringify(SETUP_VARIABLES['dws_setup_advpin'], null, 2)};
const PRIMARY_VLAN = '100';
const NODE1_VLAN = '200';
const NODE2_VLAN = '300';
const PLATFORM = '${productPlatform}';
const MICS_HIGH_PRI = 30;
const MICS_HIGH_NODE1 = 30;
const MICS_HIGH_NODE2 = 30;
const PRIMARY_DELAY = 0;

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
  NODE1_PRESENTER,
  NODE1_NAV_CONTROL, 
  NODE1_NAV_SCHEDULER,
  NODE2_HOST, 
  NODE2_ALIAS,
  NODE2_DISPLAYS,
  NODE2_PRESENTER,
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
            // SAVE CONFIG MACRO
            xapi.Command.Macros.Macro.Save({ Name: 'DWS_Config', Overwrite: 'True' }, dataStr); 

            // INITILIAZE SETUP MACRO
            xapi.Command.Macros.Macro.Activate({ Name: "DWS_Setup" });        
            xapi.Command.Macros.Runtime.Restart();
          }
          else
          {
            xapi.Command.UserInterface.Message.Alert.Display({ Duration: '60', Title:"Installation Error", Text: "GitHub URLs not reachable or local macro files not present. Please review installation guides."}); 

            console.error("DWS: Divisible Workspace Initilization Stopped due to Macro URL or loading error.");
          }
        })
      })    
    }
  });
}

function editDetails(widgetId)
{
  // PROMPT USER FOR INPUT BASED ON WIDGET
  xapi.Command.UserInterface.Message.TextInput.Display({
    Title: 'Edit Details',
    Text: WIZARD_QUESTIONS[widgetId].text,
    Placeholder: WIZARD_QUESTIONS[widgetId].placeholder,
    InputType: WIZARD_QUESTIONS[widgetId].inputType,
    KeyboardState: WIZARD_QUESTIONS[widgetId].keyboardState,
    SubmitText: 'OK',
    FeedbackId: WIZARD_QUESTIONS[widgetId].feedbackId
  })
  .catch (error => console.error(error))
}

async function updateWidget(widgetId, value)
{
  // UPDATE THE PANEL WITH THE VALIDATED DATA
  xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: value, WidgetId: widgetId })
  .then (() => {
    console.debug("DWS: Widget " + widgetId + " set to " + value);
  })
  .then(() => {    
    // SANITIZE THE SWITCH INPUT BEFORE SAVING
    if (value == 'Catalyst 9200CX 8 Port')
    {
      SETUP_VARIABLES[widgetId] = 'C9K-8P';
    } 
    else if (value == 'Catalyst 9200CX 12 Port')
    {
      SETUP_VARIABLES[widgetId] ='C9K-12P';
    }
    else if (value == 'Catalyst 9200/9300 24 Port')
    {
      SETUP_VARIABLES[widgetId] = 'C9K-24P';
    }
    else if (value == 'Dual Screen')
    {
      SETUP_VARIABLES[widgetId] = '2';
    }
    else if (value == 'One Screen')
    {
      SETUP_VARIABLES[widgetId] = '1';
    }
    // STORE ALL OTHER ENTERED DATA INTO THE SETUP ARRAY
    else
    {
      SETUP_VARIABLES[widgetId] = value;
    }
    
  })
  .catch (error => console.error("DWS: Error updating "+widgetId, error));
}

// ASYNC FUNCTION TO DOWNLOAD AND SAVE MACRO FROM GITHUB
async function loadMacros()
{
  let setupLoaded = false;
  let setupMacro = '';
  let coreLoaded = false;
  let coreMacro = '';
  let azmLoaded = false;
  let azmMacro = '';
  let imagesLoaded = false;
  let imagesMacro = '';

  if(LOADED_MACROS.includes('DWS_Setup') && LOADED_MACROS.includes('DWS_Core') && LOADED_MACROS.includes('DWS_AZM_Lib') && LOADED_MACROS.includes('DWS_Images'))
  {
    console.log("DWS: All required Macro files present. Performing local install.")
    return true;
  }
  else
  {
    console.log("DWS: Performing cloud based macro install.");

    // LOAD SETUP MACRO FROM GITHUB
    const getSetup = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Setup.js' })
    .then( result => {
      console.debug("DWS: Setup Macro Downloaded Successfully.");
      setupMacro = result.Body;
      setupLoaded = true;
    })
    .catch (e => {
      console.warn('DWS: Setup Macro URL not found.');
    });

    // LOAD IMAGES MACRO FROM GITHUB
    const getImages = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Images.js' })
    .then( result => {
      console.debug("DWS: Images Macro Downloaded Successfully.");
      imagesMacro = result.Body;
      imagesLoaded = true;
    })
    .catch (e => {
      console.warn('DWS: Images Macro URL not found.');
    });

    // LOAD CORE MACRO FROM GITHUB
    const getCore = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Core.js' })
    .then( result => {
      console.debug("DWS: Core Macro Downloaded Successfully.");
      coreMacro = result.Body;
      coreLoaded = true;
    })
    .catch (e => {
      console.warn('DWS: Core Macro URL not found.');
    });

    // LOAD AZM MACRO FROM GITHUB
    const getAZM = await xapi.Command.HttpClient.Get({ Url: 'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_AZM_Lib.js' })
    .then( result => {
      console.debug("DWS: AZM Macro Downloaded Successfully.");
      azmMacro = result.Body;
      azmLoaded = true;
    })
    .catch (e => {
      console.warn('DWS: AZM Macro URL not found.');
    });

    if (setupLoaded && coreLoaded && azmLoaded && imagesLoaded)
    {
      console.log("DWS: All Macros Downloaded Successfully from GitHub.");

      // LOAD THE SETUP MACRO
      xapi.Command.Macros.Macro.Save({ Name: 'DWS_Setup', Overwrite: 'True' }, setupMacro)
      .then (() => {
        console.debug ("DWS: Setup Macro saved to Primary successfully.");
      })

      // LOAD THE SETUP MACRO
      xapi.Command.Macros.Macro.Save({ Name: 'DWS_Images', Overwrite: 'True' }, imagesMacro)
      .then (() => {
        console.debug ("DWS: Images Macro saved to Primary successfully.");
      })

      // LOAD THE CORE MACRO
      xapi.Command.Macros.Macro.Save({ Name: 'DWS_Core', Overwrite: 'True' }, coreMacro)
      .then (() => {
        console.debug ("DWS: Core Macro saved to Primary successfully.");
      })

      // LOAD THE AZM LIB MACRO
      xapi.Command.Macros.Macro.Save({ Name: 'DWS_AZM_Lib', Overwrite: 'True' }, azmMacro)
      .then (() => {
        console.debug ("DWS: AZM Lib Macro saved to Primary successfully.");
      })

      return true;
    }
    else
    {
      return false;
    }
  }
}

function drawPanel(panelname)
{
  xapi.Command.UserInterface.Extensions.Panel.Save({PanelId: 'dws_wizard'}, panelname)
  .catch(e => console.log('Error saving panel: ' + e.message))
}

function connectNode(node,host)
{
  let Params = {};
  Params.Timeout = 5;
  Params.AllowInsecureHTTPS = 'True';
  Params.ResultBody = 'PlainText';
  Params.Url = `https://${host}/getxml?location=Status/Peripherals/ConnectedDevice`;
  Params.Header = ['Authorization: Basic ' + btoa(`${SETUP_VARIABLES['dws_setup_username']}:${SETUP_VARIABLES['dws_setup_password']}`), 'Content-Type: application/json']; 

  xapi.Command.HttpClient.Get(Params)
  .then(response => {

    const NODE1_MICS = [];
    const NODE2_MICS = [];

    console.log(`DWS: Connected to ${host} successfully`);
  
    const devicesArray = extractDevices(response.Body);

    // Extract only the desired fields
    const filteredDevices = devicesArray.map(device => ({
      ID: device.ID || null,
      Type: device.Type || null,
      SerialNumber: device.SerialNumber || null,
      Role: device.Role || null
    }));

    if (node == '1')
    {
      filteredDevices.forEach(device => {       

        // AGGREGATE MICROPHONE SERIALS
        if (device.Type == 'AudioMicrophone')
        {
          NODE1_MICS.push(JSON.stringify(device.SerialNumber,null,2));
        }
        // STORE CONTROL MAC ADDRESS
        else if (device.Type == 'TouchPanel' && device.Role == 'Controller')
        {
          SETUP_VARIABLES['dws_setup_node1_control'] = device.ID;

          // UPDATE PANEL DETAILS TO SHOW NEW VALUE
          updateWidget('dws_setup_node1_control', device.ID);
        }
        // STORE SCHEDULER MAC ADDRESS
        else if (device.Type == 'RoomScheduler' && device.Role == 'Scheduler')
        {
          SETUP_VARIABLES['dws_setup_node1_scheduler'] = device.ID;

          // UPDATE PANEL DETAILS TO SHOW NEW VALUE
          updateWidget('dws_setup_node1_scheduler', device.ID);
        }
      });
      
      SETUP_VARIABLES['dws_setup_node1_mics'] = NODE1_MICS;

      // UPDATE PANEL DETAILS TO SHOW NEW VALUES
      updateWidget('dws_setup_node1_host', host);
      updateWidget('dws_setup_node1_mics', NODE1_MICS.toString());
    }
    else if (node == '2')
    {
      filteredDevices.forEach(device => {

        // AGGREGATE MICROPHONE SERIALS
        if (device.Type == 'AudioMicrophone')
        {
          NODE2_MICS.push(JSON.stringify(device.SerialNumber,null,2));
        }
        // STORE CONTROL MAC ADDRESS
        else if (device.Type == 'TouchPanel' && device.Role == 'Controller')
        {
          SETUP_VARIABLES['dws_setup_node2_control'] = device.ID;

          // UPDATE PANEL DETAILS TO SHOW NEW VALUE
          updateWidget('dws_setup_node2_control', device.ID);
        }
        // STORE SCHEDULER MAC ADDRESS
        else if (device.Type == 'RoomScheduler' && device.Role == 'Scheduler')
        {
          SETUP_VARIABLES['dws_setup_node2_scheduler'] = device.ID;

          // UPDATE PANEL DETAILS TO SHOW NEW VALUE
          updateWidget('dws_setup_node2_scheduler', device.ID);
        } 
      });

      SETUP_VARIABLES['dws_setup_node2_mics'] = NODE2_MICS;

      // UPDATE PANEL DETAILS TO SHOW NEW VALUES
      updateWidget('dws_setup_node2_host', host);
      updateWidget('dws_setup_node2_mics', NODE2_MICS.toString());
    }
  })
  .catch((error) => {
    console.error('DWS: Error connecting to Node Codec:', error);

    // ALERT THE USER AND RETURN THEM TO THE CONNECT PAGE
    xapi.Command.UserInterface.Message.Alert.Display({ Duration: '10', Title:"Connect Error", Text: "Please confirm your Node codec details."});
    
    if(node == '1')
    {
      drawPanel(PANEL_NODE1);
    }
    else
    {
      drawPanel(PANEL_NODE2);
    }
  });

}

function extractDevices(xml) {
  xml = xml.replace(/<\?xml.*\?>/, '');

  const deviceRegex = /<ConnectedDevice [^>]*>([\s\S]*?)<\/ConnectedDevice>/g;
  let match;
  const devices = [];

  while ((match = deviceRegex.exec(xml)) !== null) {
    const deviceXml = match[1];
    const device = {};

    // Match all simple tags inside ConnectedDevice
    const tagRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(deviceXml)) !== null) {
      const tag = tagMatch[1];
      let value = tagMatch[2].trim();

      // Parse numbers if applicable
      if (!isNaN(value) && value !== '') {
        value = Number(value);
      }
      device[tag] = value;
    }

    // Extract item attribute
    const itemMatch = /item="(\d+)"/.exec(match[0]);
    if (itemMatch) device.item = itemMatch[1];

    devices.push(device);
  }

  return devices;
}

// LONG VARIABLE STORAGE
const WIZARD_ICON = 'iVBORw0KGgoAAAANSUhEUgAABAAAAAQACAYAAAB/HSuDAAAAAXNSR0IArs4c6QAAIABJREFUeF7s3W2MnWd9P/h75jgPjpNxZjhOS7dK9F/yl1oErwKJ4xjLL4pnBkWNxMZO0jeNlPgBP2ZKqaBdbaNula0UREqKQwNEgLoqFEdZ/myFE15laUpS1K602wLaStVCVYEU3JAHSACfOWf3Nj7mODO25+G+7nM9fCz5BeGc6/79Pr/L9pzvuc91Jiq/CBAgQIAAAQIECBAgQIAAgewFJrLvUIMECBAgQIAAAQIECBAgQIBAJQCwCQgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBAgQIAAAQIECBAgIACwBwgQIECAAAECBAgQIECAQAECAoAChqxFAgQIECBAgAABAgQIECAgALAHCBAgQIAAAQIECBAgQIBAAQICgAKGrEUCBAgQIECAAAECBAgQICAAsAcIECBAgAABAgQIECBAgEABAgKAAoasRQIECBBISqD+t7n+3U+q6qXF1j0MEu9B+QQIECBAICsBAUBW49QMAQIECCQsUP+bPFlV1WLCPby59M7ZIEMQkNFQtUKAAAEC6QoIANKdncoJECBAIH2B4bv99QvkMy+Sf/VXf3XLb/zGb/x3zz777P+V8DvodV9XVFX107MjWtJn+qPTAQECBAgQSE9AAJDezFRMgAABAukLLHm3f2ZmZurw4cP/w8LCwv947bXXfvb/fwH9v3zyk5+c+tKXvvTas88+20uk5TO3/f/Kr/zKpn/4h3848Vd/9Vf/+8c//vH/9dSpU6+N1O+ugESGqUwCBAgQyE9AAJDfTHVEgAABAvEK1Lf417+HL+g3zs3NveOBBx44eOutt+6cmpr69aqqNrz88ssfnJ6e/tiDDz549dvf/vbOW9/61sknnnjijc997nM/i/yugOHn/q94/fXX/5+NGzfe8Morr/y/L7zwwv/x53/+5489/fTT/1JV1Rtnx7Ph7McDUj/rIN7dpjICBAgQIPAmAQGALUGAAAECBMIKLLn9fcuWLVcfPnz4noMHD+7vdrs3VFXVrUs4ffr04oYNGyZ//OMf/8HU1NRHzx4GONi3b99lb3vb2668/fbbL3v22Wd/fujQoZ9EGgScCwBefvnlf960adONGzZsGP6scerUqVPfe+yxxx7/xCc+8YUf/vCHPz7LPrwbog4CnBUQdi9anQABAgQKFxAAFL4BtE+AAAECwQSW3OY/Pz+/dfv27bft27dvT7fbvbm+8mAwqPr9fn9ycrJ+/OLExMSG11577UNnA4D6dvnRQwEnjh8/vuk973nPZU899dTi97///Tc+9alPnQ7WweoXPhcAvPLKK/8yNTX1trq3wWAwMVk3OPGLHztOnTr1zU996lNfeu655/7+5MmTL4xcxscDVm/uGQQIECBAYMUCAoAVU3kgAQIECBBYkcCS2/xnZ2ffubCw8IHZ2dk7qqqarlfp9XqDTqdTnX1RfObf48FgUAcAnYsEAMMCJu69994r7r777qs6nc7ipz71qTdOnDjx8xVVF/ZBbw4AbhwMBv2J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AoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQCC/t9gAABoJJREFUQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BCgA6JVvokUAAQQQQAABBBBAAAEEENBUgAKApoknbAQQQAABBBBAAAEEEEAAAb0EKADolW+iRQABBBBAAAEEEEAAAQQQ0FSAAoCmiSdsBBBAAAEEEEAAAQQQQAABvQQoAOiVb6JFAAEEEEAAAQQQQAABBBDQVIACgKaJJ2wEEEAAAQQQQAABBBBAAAG9BP43beJ8RF5sidIAAAAASUVORK5CYII=';

// PANEL XMLS
let PANEL_START = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Setup Wizard</Name><Row><Name/><Widget><WidgetId>widget_302</WidgetId><Name>Welcome to the Divisible Room Blueprint Setup Wizard!</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Row</Name><Widget><WidgetId>widget_304</WidgetId><Name>All required documentation is available at: http://cs.co/dwsblueprint</Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Row</Name></Row><Row><Name>Row</Name><Widget><WidgetId>widget_303</WidgetId><Name>Please follow installation guidance for your Divisible Workspace installation type with additional attention to instructions on when to connect specific accessories.</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Row</Name></Row><Row><Name/><Widget><WidgetId>dws_next_start</WidgetId><Name>Get Started</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><PageId>setup_start</PageId><Options>hideRowNames=1</Options></Page></Panel></Extensions>`;

let PANEL_COMMON = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Common Settings</Name><Row><Name>Divisible Room Type</Name><Widget><WidgetId>dws_setup_nway</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_nway</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Switch Type</Name><Widget><WidgetId>dws_setup_switchtype</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_switchtype</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Default Camera Automation</Name><Widget><WidgetId>dws_setup_automode</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_automode</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Common Node Username</Name><Widget><WidgetId>dws_setup_username</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_username</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Common Node Password</Name><Widget><WidgetId>dws_setup_password</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_password</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_next_common</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_common</PageId><Options>hideRowNames=0</Options></Page></Panel></Extensions>`;

let PANEL_PRIMARY = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Presenter Microphone</Name><Row><Name/><Widget><WidgetId>widget_273</WidgetId><Name>Please select the Presenter Microphone for your workspace.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Available Microphones</Name><Widget><WidgetId>widget_274</WidgetId><Type>GroupButton</Type><Options>size=4;columns=2</Options><ValueSpace><Value><Key>dws_setup_presmics_1</Key><Name>${SETUP_VARIABLES['dws_setup_mics1']}</Name></Value><Value><Key>dws_setup_presmics_2</Key><Name>${SETUP_VARIABLES['dws_setup_mics2']}</Name></Value><Value><Key>dws_setup_mics_usb</Key><Name>USB</Name></Value><Value><Key>dws_setup_mics_analog</Key><Name>Analog (All)</Name></Value></ValueSpace></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_primary</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_next_primary</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_primary</PageId><Options/></Page></Panel></Extensions>`;

let PANEL_NODE1 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 1 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 1. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 1 IP or FQDN</Name><Widget><WidgetId>dws_setup_node1_host</WidgetId><Name/><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 1 Alias</Name><Widget><WidgetId>dws_setup_node1_alias</WidgetId><Name/><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node1_configuration</WidgetId><Name/><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node1_presenter</WidgetId><Name/><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node1_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node1</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node1</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node1</PageId><Options/></Page></Panel></Extensions>`;

let PANEL_NODE1_DETAILS = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 1 Details</Name><Row><Name>Node 1 Codec Details</Name><Widget><WidgetId>dws_setup_node1_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_host']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Node 1 Microphones</Name><Widget><WidgetId>dws_setup_node1_mics</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_mics']}</Name>node1<Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Control Navigator</Name><Widget><WidgetId>dws_setup_node1_control</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_control']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Scheduler Navigator</Name><Widget><WidgetId>dws_setup_node1_scheduler</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node1_scheduler']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_155</WidgetId><Name>Please ensure all expected peripherals are detected before continuing.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node1_details</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_next_node1_details</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node1_details</PageId><Options/></Page></Panel></Extensions>`;

let PANEL_NODE2 = `<Extensions><Version>1.11</Version><Panel><Order>2</Order><PanelId>dws_wizard</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 2 Settings</Name><Row><Name/><Widget><WidgetId>widget_193</WidgetId><Name>Enter the details for Node 2. The Node Alias will be used on the room control panel to provide a user friendly way to ensure the correct rooms are selected.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Node 2 IP or FQDN</Name><Widget><WidgetId>dws_setup_node2_host</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Node 2 Alias</Name><Widget><WidgetId>dws_setup_node2_alias</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_alias</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Hardware Configuration</Name><Widget><WidgetId>dws_setup_node2_configuration</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_configuration</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Presenter PTZ Type</Name><Widget><WidgetId>dws_setup_node2_presenter</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_node2_presenter</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node2</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_connect_node2</WidgetId><Name>Connect</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node2</PageId><Options/></Page></Panel></Extensions>`;

let PANEL_NODE2_DETAILS = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Node 2 Details</Name><Row><Name>Node 2 Codec Details</Name><Widget><WidgetId>dws_setup_node2_host</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_host']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Node 2 Microphones</Name><Widget><WidgetId>dws_setup_node2_mics</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_mics']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Control Navigator</Name><Widget><WidgetId>dws_setup_node2_control</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_control']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name>Scheduler Navigator</Name><Widget><WidgetId>dws_setup_node2_scheduler</WidgetId><Name>${SETUP_VARIABLES['dws_setup_node2_scheduler']}</Name><Type>Text</Type><Options>size=4;fontSize=normal;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_155</WidgetId><Name>Please ensure all expected peripherals are detected before continuing.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_back_node2_details</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_next_node2_details</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_node2_details</PageId><Options/></Page></Panel></Extensions>`;

let PANEL_SETUP = `<Extensions><Version>1.11</Version><Panel><Order>1</Order><PanelId>dws_wizard_new</PanelId><Origin>local</Origin><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>4f0568a41894116ebce904f8b1004077281643ea28cba96d903078210e434757</Id></CustomIcon><Page><Name>Final Step</Name><Row><Name>Adv. Settings Lock PIN:</Name><Widget><WidgetId>dws_setup_advpin</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_advpin</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row></Row><Row><Name/><Widget><WidgetId>setup_text</WidgetId><Name>Click Begin Setup to finalize the installation of the Primary and Node codecs based on the details provided. </Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_begin</WidgetId><Name>Begin Setup</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><Row></Row><Row><Name/><Widget><WidgetId>dws_back_setup</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>widget_310</WidgetId><Type>Spacer</Type><Options>size=2</Options></Widget></Row><PageId>setup_finish</PageId><Options>hideRowNames=0</Options></Page></Panel></Extensions>`;

// START THE MACRO
init();