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

let WIZARD_QUESTIONS = [];
let SETUP_VARIABLES = [];

function init()
{
  WIZARD_QUESTIONS["dws_edit_username"] = { feedbackId: "dws_setup_username", text: "Enter the Username for the user created on the Secondary Codec:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Enter the username..."},
  WIZARD_QUESTIONS["dws_edit_password"] = { feedbackId: "dws_setup_password", text: "Enter the Password for the user created on the Secondary Codec:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Enter the password..."},
  WIZARD_QUESTIONS["dws_edit_advpin"] = { feedbackId: "dws_setup_advpin", text: "Please enter an Advanced Settings lock PIN", inputType: "Numeric", keyboardState: "Open", placeholder: "Enter your Numerical PIN" },
  WIZARD_QUESTIONS["dws_edit_sec_host"] = { feedbackId: "dws_setup_sec_host", text: "Enter the IP or FQDN of the Secondary Room:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. 192.168.1.10 or secondary.domain.com" },
  WIZARD_QUESTIONS["dws_edit_sec_control"] = { feedbackId: "dws_setup_sec_control", text: "Enter the MAC Address of the 'Control' mode Navigator for the Secondary Room:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. aabbcc112233 or aa:bb:cc:dd:ee:ff" },
  WIZARD_QUESTIONS["dws_edit_sec_scheduler"] = { feedbackId: "dws_setup_sec_scheduler", text: "Enter the MAC Address of the 'Scheduler' mode Navigator for the Secondary Room:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. aabbcc112233 or aa:bb:cc:dd:ee:ff" },
  WIZARD_QUESTIONS["dws_edit_primic_1"] = { feedbackId: "dws_setup_primic_1", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_primic_2"] = { feedbackId: "dws_setup_primic_2", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_primic_3"] = { feedbackId: "dws_setup_primic_3", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_secmic_1"] = { feedbackId: "dws_setup_secmic_1", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_secmic_2"] = { feedbackId: "dws_setup_secmic_2", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_secmic_3"] = { feedbackId: "dws_setup_secmic_3", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_secmic_4"] = { feedbackId: "dws_setup_secmic_4", text: "Enter the Serial Number of the Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_primic_pres"] = { feedbackId: "dws_setup_primic_pres", text: "Enter the Serial Number of the Presenter Microphone:", inputType: "SingleLine", keyboardState: "Open", placeholder: "Ex. FOC28xxxxxx"},
  WIZARD_QUESTIONS["dws_edit_switchtype"] = { feedbackId: "dws_setup_switchtype", text: "What Model Switch are you using?", options: { "Option.1": "Catalyst 9200CX 8 Port", "Option.2": "Catalyst 9200CX 12 Port", "Option.3": "Catalyst 9200/9300 24 Port" } }

  console.log ("DWS: Initializing Divisible Workspace Wizard.");

  // XML CONDENSED WIZARD PANEL
  let WIZARD_PANEL = `<Extensions><Version>1.11</Version><Panel><Order>3</Order><PanelId>dws_wizard</PanelId><Location>HomeScreen</Location><Icon>Custom</Icon><Name>Setup Wizard</Name><ActivityType>Custom</ActivityType><CustomIcon><Content>${WIZARD_ICON}</Content><Id>f281484f6f2ed61917826f1e020e8124dae8efd4016b364462b387f68fd67994</Id></CustomIcon><Page><Name>Step 1</Name><Row><Name>Switch Type</Name><Widget><WidgetId>dws_setup_switchtype</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_switchtype</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_130</WidgetId><Name>Please ensure you select the correct switch model and your cabling matches the diagrams provided.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Combined Camera Automation</Name><Widget><WidgetId>dws_edit_automode</WidgetId><Type>GroupButton</Type><Options>size=4;columns=2</Options><ValueSpace><Value><Key>off</Key><Name>Off</Name></Value><Value><Key>on</Key><Name>Audience Only</Name></Value><Value><Key>panda</Key><Name>Presenter and Audience</Name></Value></ValueSpace></Widget></Row><Row><Name/><Widget><WidgetId>widget_129</WidgetId><Name>This will set the default operation mode for automatic audience switching based on active microphones when in the combined state.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Adv. Settings PIN</Name><Widget><WidgetId>widget_108</WidgetId><Name>This PIN is used to lock the advanced settings panel.</Name><Type>Text</Type><Options>size=2;fontSize=small;align=left</Options></Widget><Widget><WidgetId>dws_setup_advpin</WidgetId><Name></Name><Type>Text</Type><Options>size=1;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_advpin</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_next1</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><Options>hideRowNames=0</Options><PageId>setup_credentials</PageId></Page><Page><Name>Step 2</Name><Row><Name>Primary Room Microphones</Name><Widget><WidgetId>dws_setup_primic_1</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_primic_1</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_setup_primic_2</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_primic_2</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_setup_primic_3</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_primic_3</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_112</WidgetId><Name>Enter the Serial Number(s) of all Primary Room Microphones above and the Serial Number of the Presenter Microphone below.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Presenter Microphone</Name><Widget><WidgetId>dws_setup_primic_pres</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_primic_pres</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_back2</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_setup_next2</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><Options/><PageId>setup_primary_mics</PageId></Page><Page><Name>Step 3</Name><Row><Name>Secondary Host IP/FQDN</Name><Widget><WidgetId>dws_setup_sec_host</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_sec_host</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Number of Secondary Displays</Name><Widget><WidgetId>dws_edit_sec_screens</WidgetId><Type>GroupButton</Type><Options>size=4;columns=2</Options><ValueSpace><Value><Key>1</Key><Name>One (1)</Name></Value><Value><Key>2</Key><Name>Two (2)</Name></Value></ValueSpace></Widget></Row><Row><Name>Secondary Username</Name><Widget><WidgetId>dws_setup_username</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_username</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name>Secondary Password</Name><Widget><WidgetId>dws_setup_password</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_password</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>widget_107</WidgetId><Name>Set these to the credentials created in Control Hub.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=left</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_back3</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_setup_next3</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><Options/><PageId>setup_secondary_codec</PageId></Page><Page><Name>Step 4</Name><Row><Name>Secondary Room Microphones</Name><Widget><WidgetId>dws_setup_secmic_1</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_secmic_1</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_setup_secmic_2</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_secmic_2</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_setup_secmic_3</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_secmic_3</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>dws_setup_secmic_4</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_secmic_4</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>widget_114</WidgetId><Name>Enter the Serial Number(s) of all Secondary Room Microphones</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_back4</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_setup_next4</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><Options/><PageId>setup_secondary_mics</PageId></Page><Page><Name>Step 5</Name><Row><Name>Control MAC Address</Name><Widget><WidgetId>dws_setup_sec_control</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_sec_control</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget></Row><Row><Name/><Widget><WidgetId>control_txt</WidgetId><Name>Enter the MAC Address of the Secondary Room Control Navigator (Ex. aabbccddeeff or aa:bb:cc:dd:ee:ff)</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name>Scheduler MAC Address</Name><Widget><WidgetId>dws_setup_sec_scheduler</WidgetId><Name></Name><Type>Text</Type><Options>size=3;fontSize=normal;align=center</Options></Widget><Widget><WidgetId>dws_edit_sec_scheduler</WidgetId><Name>Edit</Name><Type>Button</Type><Options>size=1</Options></Widget><Widget><WidgetId>widget_105</WidgetId><Name>Enter the MAC Address of the Secondary Room Scheduler Navigator. If you do not have a Scheduler, leave this blank.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/></Row><Row><Name/><Widget><WidgetId>dws_setup_back5</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget><Widget><WidgetId>dws_setup_next5</WidgetId><Name>Next</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_settings</PageId></Page><Page><Name>Finish</Name><Row><Name/></Row><Row><Name/><Widget><WidgetId>setup_text</WidgetId><Name>Clicking Begin Setup will finalize the installation of the Primary and Secondary Rooms based on the details provided. Please ensure the accuracy of your entries prior to continuing.</Name><Type>Text</Type><Options>size=4;fontSize=small;align=center</Options></Widget></Row><Row><Name/><Widget><WidgetId>dws_setup_begin</WidgetId><Name>Begin Setup</Name><Type>Button</Type><Options>size=4</Options></Widget></Row><Row><Name/></Row><Row><Name/></Row><Row><Name/><Widget><WidgetId>dws_setup_back6</WidgetId><Name>Back</Name><Type>Button</Type><Options>size=2</Options></Widget></Row><PageId>setup_finish</PageId></Page></Panel></Extensions>`;

  // DRAW SETUP WIZARD PANEL & BUTTON
  xapi.Command.UserInterface.Extensions.Panel.Save({PanelId: 'dws_wizard'}, WIZARD_PANEL)
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
    // MAC ADDRESS ENTRY CHECKS
    else if (event.FeedbackId == 'dws_setup_sec_control' || event.FeedbackId == 'dws_setup_sec_scheduler' ) 
    {
      const macAddress = event.Text.toLowerCase();

      // CHECK FOR COLONS IN SUBMITTED MAC ADDRESS AND ADD IF NOT PRESENT
      if(macAddress.length == 12)
      {
        const macArray = macAddress.split("");
        const newMac = macArray[0] + macArray[1] + ":" + macArray[2] + macArray[3] + ":" + macArray[4] + macArray[5] + ":" + macArray[6] + macArray[7] + ":" + macArray[8] + macArray[9]+ ":" + macArray[10] + macArray[11];

        // UPDATE PANEL DETAILS TO SHOW NEW VALUE
        updateWidget(event.FeedbackId, newMac);
      }
      // IF MAC IF FORMATTED ALREADY = ACCEPT
      else if (macAddress.length == 17 && macAddress.substring(2,1) == ':' && macAddress.substring(4,1) == ':' && macAddress.substring(6,1) == ':' && macAddress.substring(8,1) == ':' && macAddress.substring(10,1) == ':')  
      {
        // UPDATE PANEL DETAILS TO SHOW NEW VALUE
        updateWidget(event.FeedbackId, macAddress);
      }
      // REPEAT THE CONTROL QUESTION IF THE BOX IS EMPTY OR MAC WAS INVALID
      else if (event.FeedbackId == 'dws_setup_sec_control') 
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "Invalid Control MAC Address entered (cannot be blank). Please try again."});
      }
      // REPEAT THE SCHEDULER QUESTION IF THE MAC WAS ENTERED AND INVALID
      else if (event.FeedbackId == 'dws_setup_sec_scheduler' && event.Text.length != 0) 
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "Invalid Scheduler MAC Address entered. Please try again."});
      }
    }
    //  MICROPHONE INPUT CHECKS FOR PROPER LENGTH SERIAL NUMBERS
    else if (event.FeedbackId.startsWith('dws_setup_primic') || event.FeedbackId.startsWith('dws_setup_secmic'))
    {
      let serialNumber = event.Text;

      if (serialNumber.length != 11)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "The Serial Number entered was invalid. Please try again."});
      }
      else if (serialNumber.length == 11 && !(serialNumber.startsWith("FOC") || serialNumber.startsWith("Foc") || serialNumber.startsWith("foc")))
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Invalid Entry", Text: "The Serial Number entered was invalid. Please try again."});
      }
      else
      {
        // UPDATE PANEL DETAILS TO SHOW NEW VALUE
        updateWidget(event.FeedbackId, serialNumber.toUpperCase());
      }    
    }
    else{
      // UPDATE PANEL DETAILS TO SHOW NEW VALUE
      updateWidget(event.FeedbackId, event.Text);
    }
  });

  // HANDLE MULTIPLE CHOICE SWITCH TYPE RESPONSE
  xapi.Event.UserInterface.Message.Prompt.Response.on(event => {
    const selectedOption = event.OptionId;
    const optionText = WIZARD_QUESTIONS['dws_edit_switchtype'].options[`Option.${selectedOption}`];

    // UPDATE PANEL DETAILS TO SHOW NEW VALUE
    updateWidget(event.FeedbackId, optionText);
  })

  // LISTEN FOR BACK / NEXT AND SETUP BUTTON PRESSES
  xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
    // EDIT BUTTONS ON CREDENTIALS PAGE
    if (event.Type == 'released' && event.WidgetId.startsWith('dws_edit_') && event.WidgetId != 'dws_edit_sec_screens' && event.WidgetId != 'dws_edit_switchtype' && event.WidgetId != 'dws_edit_automode') 
    {
      editDetails(event.WidgetId);
    }
    else if (event.Type == 'released' && event.WidgetId == 'dws_edit_switchtype')
    {
      xapi.Command.UserInterface.Message.Prompt.Display({
            Title: `Select Switch Type`,
            Text: WIZARD_QUESTIONS[event.WidgetId].text,
            FeedbackId: WIZARD_QUESTIONS[event.WidgetId].feedbackId,
            ...WIZARD_QUESTIONS[event.WidgetId].options
        });
    }
    else if (event.Type == 'released' && event.WidgetId == 'dws_edit_sec_screens')
    {
      // STORE NUMBER OF SCREENS VALUE IN ARRAY
      SETUP_VARIABLES['dws_setup_sec_screens'] = event.Value;
    }
    else if (event.Type == 'released' && event.WidgetId == 'dws_edit_automode')
    {
      // STORE THE AUTO MODE DEFAULT SETTING IN ARRAY
      SETUP_VARIABLES['dws_setup_automode'] = event.Value;
    }

    // NEXT BUTTONS
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_next1' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_primary_mics', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_next2' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_secondary_codec', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_next3' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_secondary_mics', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_next4' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_settings', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_next5' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_finish', PanelId: 'dws_wizard' });
    }
    // BACK BUTTONS
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_back2' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_credentials', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_back3' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_primary_mics', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_back4' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_secondary_codec', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_back5' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_secondary_mics', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_back6' )
    {
      xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_settings', PanelId: 'dws_wizard' });
    }
    else if( event.Type == 'released' && event.WidgetId == 'dws_setup_begin' )
    {
      // CHECK SETUP IS SUFFICIENTLY COMPLETED BY PAGE
      if ( SETUP_VARIABLES['dws_setup_switchtype'] == undefined || SETUP_VARIABLES['dws_setup_automode'] == undefined || SETUP_VARIABLES['dws_setup_advpin'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Variables", Text: "Please ensure a Switch type, Automation Mode, and PIN are entered."});
        xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_credentials', PanelId: 'dws_wizard' });
        console.log("DWS: Missing Variables. Prompting User to enter required details.");
        return;
      }
      else if(SETUP_VARIABLES['dws_setup_primic_1'] == undefined || SETUP_VARIABLES['dws_setup_primic_pres'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Variables", Text: "Please configure at least one Primary Microphone and the Presenter Microphone Serial Number."});
        xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_primary_mics', PanelId: 'dws_wizard' });
        console.log("DWS: Missing Variables. Prompting User to enter required details.");
        return;
      }
      else if (SETUP_VARIABLES['dws_setup_sec_host'] == undefined || SETUP_VARIABLES['dws_setup_sec_screens'] == undefined || SETUP_VARIABLES['dws_setup_username'] == undefined || SETUP_VARIABLES['dws_setup_password'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Variables", Text: "Please set the Host, # of Displays, Username and Password"});
        xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_secondary_codec', PanelId: 'dws_wizard' });
        console.log("DWS: Missing Variables. Prompting User to enter required details.");
        return;
      }      
      else if(SETUP_VARIABLES['dws_setup_secmic_1'] == undefined)
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Variables", Text: "Please configure at least one Secondary Microphone Serial Number."});
        xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_secondary_mics', PanelId: 'dws_wizard' });
        console.log("DWS: Missing Variables. Prompting User to enter required details.");
        return;
      }
      else if (SETUP_VARIABLES['dws_setup_sec_control'] == undefined )
      {
        xapi.Command.UserInterface.Message.Alert.Display({ Duration: '5', Title:"Missing Variables", Text: "Please configure the Secondary Room Control Navigator."});
        xapi.Command.UserInterface.Extensions.Panel.Open( { PageId: 'setup_settings', PanelId: 'dws_wizard' });
        console.log("DWS: Missing Variables. Prompting User to enter required details.");
        return;
      }

      console.log ('DWS: Beginning Divisible Workspace Initilization.');
      
      // GET PRODUCT PLATFORM THEN CONTINUE
      xapi.Status.SystemUnit.ProductPlatform.get()
      .then ((productPlatform) => {

        // ALLOW FOR UNDEFINED SCHEDULER PANEL
        if(SETUP_VARIABLES['dws_setup_sec_scheduler'] == undefined)
        {
          SETUP_VARIABLES['dws_setup_sec_scheduler'] = '';
        }

        let COMBINED_PRI_MICS = [SETUP_VARIABLES['dws_setup_primic_1']];
        let COMBINED_SEC_MICS = [SETUP_VARIABLES['dws_setup_secmic_1']];

        // CHECK FOR BLANK MICROPHONE ENTRIES AND ENTER THEM AS ONE
        if (SETUP_VARIABLES['dws_setup_primic_2'] != null)
        {
          COMBINED_PRI_MICS.push(SETUP_VARIABLES['dws_setup_primic_2'])
        }
        if (SETUP_VARIABLES['dws_setup_primic_3'] != null)
        {
          COMBINED_PRI_MICS.push(SETUP_VARIABLES['dws_setup_primic_3'])
        }

        // CHECK FOR BLANK MICROPHONE ENTRIES AND ENTER THEM AS ONE
        if (SETUP_VARIABLES['dws_setup_secmic_2'] != null)
        {
          COMBINED_SEC_MICS.push(SETUP_VARIABLES['dws_setup_secmic_2'])
        }
        if (SETUP_VARIABLES['dws_setup_secmic_3'] != null)
        {
          COMBINED_SEC_MICS.push(SETUP_VARIABLES['dws_setup_secmic_3'])
        }
        if (SETUP_VARIABLES['dws_setup_secmic_4'] != null)
        {
          COMBINED_SEC_MICS.push(SETUP_VARIABLES['dws_setup_secmic_4'])
        }

        // CHECK AUTOMATION MODE FOR PANDA
        if (SETUP_VARIABLES['dws_setup_automode'] == 'panda')
        {
          SETUP_VARIABLES['dws_setup_automode'] = 'off';
          SETUP_VARIABLES['dws_setup_panda'] = 'on';
        }
        else{
          SETUP_VARIABLES['dws_setup_panda'] = 'off';
        }

        loadMacros()
        .then (result => {

          // LOAD SETUP MACRO FROM GITHUB
          if (result)
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

// ENABLE OR DISABLE ADDITIONAL "DEBUG" LEVEL CONSOLE OUTPUT
// ACCEPTED VALUES: 'true', 'false'

const DEBUG = 'true'; 

// ONLY CHANGE IF YOU ARE NOT USING THE DEFAULT U:P IN USB CONFIGURATION FILE
const SWITCH_USERNAME = 'dwsadmin';
const SWITCH_PASSWORD = 'D!vi$ible1';

// ONLY CHANGE TO TWEAK AZM TRIGGER LEVELS
const MICS_HIGH = '35';
const MICS_LOW = '30';

//=========================================================================//
//                     **** DO NOT EDIT BELOW HERE ****                    //
//=========================================================================*/

const SWITCH_TYPE = ${JSON.stringify(SETUP_VARIABLES['dws_setup_switchtype'], null, 2)};
const MACRO_USERNAME = ${JSON.stringify(SETUP_VARIABLES['dws_setup_username'], null, 2)};
const MACRO_PASSWORD = ${JSON.stringify(SETUP_VARIABLES['dws_setup_password'], null, 2)};
const SECONDARY_HOST = ${JSON.stringify(SETUP_VARIABLES['dws_setup_sec_host'], null, 2)};     
const SECONDARY_SCREENS = ${JSON.stringify(SETUP_VARIABLES['dws_setup_sec_screens'], null, 2)};            
const SECONDARY_NAV_CONTROL = ${JSON.stringify(SETUP_VARIABLES['dws_setup_sec_control'], null, 2)};
const SECONDARY_NAV_SCHEDULER = ${JSON.stringify(SETUP_VARIABLES['dws_setup_sec_scheduler'], null, 2)};
const PRESENTER_MIC = ${JSON.stringify(SETUP_VARIABLES['dws_setup_primic_pres'], null, 2)};
const PRIMARY_MICS = ${JSON.stringify(COMBINED_PRI_MICS, null, 2)};
const SECONDARY_MICS = ${JSON.stringify(COMBINED_SEC_MICS, null, 2)};
const AUTOMODE_DEFAULT = ${JSON.stringify(SETUP_VARIABLES['dws_setup_automode'], null, 2)};
const PANDA_DEFAULT = ${JSON.stringify(SETUP_VARIABLES['dws_setup_panda'], null, 2)};
const UNLOCK_PIN = ${JSON.stringify(SETUP_VARIABLES['dws_setup_advpin'], null, 2)};      
const PRIMARY_VLAN = '100';
const SECONDARY_VLAN = '200';
const PLATFORM = '${productPlatform}';

export default {
  DEBUG,
  SWITCH_USERNAME,
  SWITCH_PASSWORD, 
  MACRO_USERNAME, 
  MACRO_PASSWORD, 
  SWITCH_TYPE, 
  SECONDARY_HOST, 
  SECONDARY_NAV_CONTROL, 
  SECONDARY_NAV_SCHEDULER, 
  SECONDARY_SCREENS,
  PRESENTER_MIC, 
  PRIMARY_MICS, 
  SECONDARY_MICS,
  MICS_HIGH,
  MICS_LOW,
  AUTOMODE_DEFAULT,
  PANDA_DEFAULT,
  UNLOCK_PIN,  
  PRIMARY_VLAN, 
  SECONDARY_VLAN,
  PLATFORM
};`;
            // SAVE CONFIG MACRO
            xapi.Command.Macros.Macro.Save({ Name: 'DWS_Config', Overwrite: 'True' }, dataStr); 

            // INITILIAZE SETUP MACRO
            xapi.Command.Macros.Macro.Activate({ Name: "DWS_Setup" });        
            xapi.Command.Macros.Runtime.Restart();
          }
          else
          {
            console.error("DWS: Divisible Workspace Initilization Stopped due to Macro error.");
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

  // DOWNLOAD THE MACROS
  try {
    const getSetup = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Setup.js' })
      .then( result => {
        console.debug("DWS: Setup Macro Downloaded Successfully.");
        setupMacro = result.Body;
        setupLoaded = true;
      })
      .catch (e => {
        console.warn('DWS: Setup Macro URL not found.');
      });      
    
  } catch (e) {
    console.warn('DWS: Unable to reach GitHub for Setup Macro.');
  }

  // LOAD CORE MACRO FROM GITHUB
  try {
    const getCore = await xapi.Command.HttpClient.Get({ Url:'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_Core.js' })
      .then( result => {
        console.debug("DWS: Core Macro Downloaded Successfully.");
        coreMacro = result.Body;
        coreLoaded = true;
      })
      .catch (e => {
        console.warn('DWS: Core Macro URL not found.');
      });      
    
  } catch (e) {
    console.warn('DWS: Unable to reach GitHub for Core Macro.');
  }

  // LOAD AZM MACRO FROM GITHUB
  try {
    const getAZM = await xapi.Command.HttpClient.Get({ Url: 'https://raw.githubusercontent.com/DevicesCoe/DivisibleWorkspaceBlueprint/refs/heads/main/macros/DWS_AZM_Lib.js' })
      .then( result => {
        console.debug("DWS: AZM Macro Downloaded Successfully.");
        azmMacro = result.Body;
        azmLoaded = true;
      })
      .catch (e => {
        console.warn('DWS: AZM Macro URL not found.');
      });    
    
  } catch (e) {
    console.warn('DWS: Unable to reach GitHub for AZM Library.')
  }

  if (setupLoaded && coreLoaded && azmLoaded)
  {
    console.log("DWS: All Macros Downloaded Successfully from GitHub.");

    // LOAD THE SETUP MACRO
    xapi.Command.Macros.Macro.Save({ Name: 'DWS_Setup', Overwrite: 'True' }, setupMacro)
    .then (() => {
      console.debug ("DWS: Setup Macro saved to Primary successfully.");
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

// LONG VARIABLE STORAGE
const WIZARD_ICON = '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';

// START THE MACRO
init();
