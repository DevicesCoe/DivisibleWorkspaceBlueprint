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

const allowedTypes = ['Ethernet', 'USBInterface', 'Analog'];

const SAM = {
  Status: { Audio: { Zone: {} }, VoiceActivity: false }
};

function debug(...args) {
  console.debug('DWS: SAM', ...args);
}

function debugError(...args) {
  console.error('DWS: SAM', ...args);
}

const runtime = {
  config: undefined,
  zones: new Map(),
  buckets: new Map(),
  subscriptions: new Set(),
  callback: undefined,
  generation: 0,
  monitoring: false,
  voiceActivity: false,
  operation: Promise.resolve()
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function fail(message) {
  throw new Error(`SAM: ${message}`);
}

function canonicalType(type) {
  const value = String(type || '').toLowerCase();
  if (value == 'ethernet') return 'Ethernet';
  if (value == 'usbinterface') return 'USBInterface';
  if (value == 'analog') return 'Analog';
  fail(`Unsupported microphone type [${type}]. Allowed types: ${allowedTypes.join(', ')}`);
}

function xapiConnectorType(type) {
  return type == 'Ethernet' ? 'Ethernet' : type == 'USBInterface' ? 'USBMicrophone' : 'Microphone';
}

function sameValue(left, right) {
  return left !== undefined && right !== undefined &&
    String(left).trim().toLowerCase() == String(right).trim().toLowerCase();
}

function itemId(item) {
  if (!item) return undefined;
  if (item.id !== undefined) return item.id;
  if (item.Id !== undefined) return item.Id;
  return item.ID;
}

function connectedDeviceIdentifier(item) {
  if (!item) return undefined;
  if (item.ID !== undefined) return item.ID;
  if (item.Id !== undefined) return item.Id;
  return item.id;
}

function itemSerial(item) {
  if (!item) return undefined;
  if (item.SerialNumber !== undefined) return item.SerialNumber;
  if (item.serialNumber !== undefined) return item.serialNumber;
  if (item.Serial !== undefined) return item.Serial;
  return item.serial;
}

function itemStreamName(item) {
  if (!item) return undefined;
  if (item.StreamName !== undefined) return item.StreamName;
  return item.streamName;
}

function checkSetup(message) {
  if (!runtime.config) fail(message);
}

function thresholdsFor(zone) {
  const global = runtime.config.Settings.GlobalThreshold;
  const independent = zone.config.Independent_Threshold || {};
  return {
    High: independent.High !== undefined ? independent.High : global.High,
    Low: independent.Low !== undefined ? independent.Low : global.Low
  };
}

function zoneState(zone) {
  const states = zone.connectors.map(connector => connector.state);
  if (!states.length || states.includes('Unset')) {
    if (states.includes('High')) return 'High';
    if (states.includes('Low')) return 'Low';
    return 'Unset';
  }
  return states.includes('High') ? 'High' : 'Low';
}

function zoneInfo(zone) {
  return {
    Id: zone.id,
    Label: zone.label,
    Type: zone.type,
    Connectors: zone.connectors.map(connector => ({
      ConnectorId: connector.id,
      State: connector.state
    })),
    State: zoneState(zone)
  };
}

function makeZoneStatus(zone) {
  return {
    State: { get: () => zoneState(zone) },
    get: () => zoneInfo(zone),
    setConnectorState: (connectorId, newState) => {
      const connector = zone.connectors.find(item => String(item.id) == String(connectorId));
      if (connector) connector.state = newState;
      return Promise.resolve('Ok');
    }
  };
}

function inputKey(type, connectorId) {
  return `${type}:${connectorId}`;
}

function addBucket(bucket) {
  const key = inputKey(bucket.type, bucket.connectorId);
  if (!runtime.buckets.has(key)) runtime.buckets.set(key, []);
  runtime.buckets.get(key).push(bucket);
}

function collectSamples(samples, value) {
  samples.push(Number(value) || 0);
  if (samples.length < runtime.config.Settings.Sample.Size) return undefined;

  const result = samples.slice();
  samples.length = 0;
  return result;
}

function evaluateBucket(bucket, values, connectorData) {
  if (bucket.generation != runtime.generation || !runtime.config) return;

  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const thresholds = thresholdsFor(bucket.zone);
  if (average >= Number(thresholds.High)) {
    bucket.state = !runtime.voiceActivity ? 'Low' : 'High';
  }
  else if (average <= Number(thresholds.Low)) bucket.state = 'Low';

  bucket.connector.state = bucket.state;
  const callback = runtime.callback;
  if (!callback || bucket.generation != runtime.generation) return;

  const payload = {
    Zone: {
      Label: bucket.zone.label,
      State: zoneState(bucket.zone),
      Id: bucket.zone.id
    },
    Connector: {
      Type: bucket.type,
      State: bucket.state,
      Id: bucket.connectorId,
      ...connectorData
    },
    Assets: bucket.zone.assets,
    DataSet: {
      VuMeter: {
        Average: average,
        Peak: Math.max(...values),
        Sample: values.slice()
      }
    }
  };

  Promise.resolve().then(() => {
    if (bucket.generation == runtime.generation && runtime.config) callback(payload);
  }).catch(() => {});
}

function runStandardBucket(bucket, event) {
  if (bucket.generation != runtime.generation || !runtime.config) return;
  const values = collectSamples(bucket.samples, event.VuMeter);
  if (values) evaluateBucket(bucket, values);
}

function ethernetState(bucket) {
  const states = bucket.subIds.map(id => bucket.subStates[id]);
  if (states.includes('High')) return 'High';
  if (states.length && states.every(state => state == 'Low')) return 'Low';
  if (states.length && states.every(state => state == 'Unset')) return 'Unset';
  return 'Low';
}

function runEthernetBucket(bucket, event) {
  if (bucket.generation != runtime.generation || !runtime.config) return;
  const valuesBySubId = new Map();
  (event.SubId || []).forEach(item => valuesBySubId.set(String(item.id), item));

  bucket.subIds.forEach(subId => {
    const item = valuesBySubId.get(String(subId));
    if (!item) return;
    if (!bucket.samples.has(subId)) bucket.samples.set(subId, []);

    const values = collectSamples(bucket.samples.get(subId), item.VuMeter);
    if (!values) return;

    const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    const thresholds = thresholdsFor(bucket.zone);
    if (average >= Number(thresholds.High)) {
      bucket.subStates[subId] = !runtime.voiceActivity ? 'Low' : 'High';
    }
    else if (average <= Number(thresholds.Low)) bucket.subStates[subId] = 'Low';
    bucket.state = ethernetState(bucket);
    bucket.connector.state = bucket.state;

    const callback = runtime.callback;
    if (!callback || bucket.generation != runtime.generation) return;
    const payload = {
      Zone: { Label: bucket.zone.label, State: zoneState(bucket.zone), Id: bucket.zone.id },
      Connector: {
        Type: bucket.type,
        State: bucket.state,
        Id: bucket.connectorId,
        SubId: subId
      },
      Assets: bucket.zone.assets,
      DataSet: {
        VuMeter: {
          Average: average,
          Peak: Math.max(...values),
          Sample: values.slice()
        }
      }
    };
    Promise.resolve().then(() => {
      if (bucket.generation == runtime.generation && runtime.config) callback(payload);
    }).catch(() => {});
  });
}

function subscribe(node, handler) {
  const stop = node.on(handler);
  if (typeof stop == 'function') runtime.subscriptions.add(stop);
  return stop;
}

function unsubscribeAll() {
  for (const stop of runtime.subscriptions) {
    try { stop(); } catch (error) {}
  }
  runtime.subscriptions.clear();
}

function uniquePhysicalInputs(config) {
  const inputs = new Map();
  config.Zones.forEach(zone => {
    const type = canonicalType(zone.MicrophoneAssignment.Type);
    zone.MicrophoneAssignment.Connectors.forEach(connector => {
      const key = inputKey(type, connector.Id);
      inputs.set(key, { Id: connector.Id, Type: type });
    });
  });
  return [...inputs.values()];
}

async function stopMeters(config) {
  if (!config) return;
  const inputs = uniquePhysicalInputs(config);
  for (const input of inputs) {
    //debug('Stopping VU meter', input);
    await xapi.Command.Audio.VuMeter.Stop({
      ConnectorId: input.Id,
      ConnectorType: xapiConnectorType(input.Type)
    }).then(() => {
      //debug('Stopped VU meter', input);
    }).catch(error => {
      debugError('Unable to stop VU meter', input, error);
    });
  }
}

async function startMeters(config) {
  const inputs = uniquePhysicalInputs(config);
  for (const input of inputs) {
    //debug('Starting VU meter', input);
    await xapi.Command.Audio.VuMeter.Start({
      ConnectorId: input.Id,
      ConnectorType: xapiConnectorType(input.Type),
      IntervalMs: config.Settings.Sample.Rate_In_Ms,
      Source: 'AfterAEC'
    });
    //debug('Started VU meter', input);
  }
}

async function resolveEthernetIds(config) {
  if (!config.Zones.some(zone => canonicalType(zone.MicrophoneAssignment.Type) == 'Ethernet')) return;

  const available = await xapi.Status.Audio.Input.Connectors.Ethernet.get() || [];
  const peripherals = await xapi.Status.Peripherals.ConnectedDevice.get().catch(() => []) || [];
  //debug('Ethernet connectors reported by RoomOS', available);
  //debug('Connected peripherals reported by RoomOS', peripherals);

  for (const zone of config.Zones) {
    if (canonicalType(zone.MicrophoneAssignment.Type) != 'Ethernet') continue;
    for (const connector of zone.MicrophoneAssignment.Connectors) {
      let match;
      const serial = connector.Serial || connector.SerialNumber;
      /*debug('Resolving Ethernet connector', {
        Zone: zone.Label,
        Serial: serial,
        StreamName: connector.StreamName,
        Id: connector.Id
      });*/
      if (serial) {
        const peripheral = peripherals.find(item => sameValue(itemSerial(item), serial));
        if (peripheral) {
          const peripheralIdentifier = connectedDeviceIdentifier(peripheral);
          /*debug('Matched Ethernet serial to connected peripheral', {
            Serial: serial,
            Peripheral: peripheral,
            StreamName: peripheralIdentifier
          });*/
          match = available.find(item => sameValue(itemStreamName(item), peripheralIdentifier));
          if (!match) {
            match = available.find(item => sameValue(itemId(item), peripheralIdentifier));
          }
        }
        if (!match) {
          match = available.find(item => sameValue(itemStreamName(item), serial));
        }
      }
      if (!match && connector.StreamName) {
        match = available.find(item => sameValue(itemStreamName(item), connector.StreamName));
      }
      if (!match && connector.Id !== undefined) {
        match = available.find(item => sameValue(itemId(item), connector.Id)) || { id: connector.Id };
      }
      const id = itemId(match);
      if (id === undefined) fail(`Unable to resolve Ethernet connector [${serial || connector.StreamName || connector.Id}]`);
      connector.Id = Number(id);
      /*debug('Resolved Ethernet connector', {
        Zone: zone.Label,
        Serial: serial,
        StreamName: itemStreamName(match),
        Id: connector.Id
      });*/
    }
  }
}

function prepareConfiguration(input) {
  if (!input || !input.Settings || !Array.isArray(input.Zones)) {
    fail('Configuration requires Settings and a Zones array');
  }

  const config = clone(input);
  const settings = config.Settings;
  settings.Sample = settings.Sample || {};
  settings.Sample.Size = Number(settings.Sample.Size || 4);
  settings.Sample.Rate_In_Ms = Number(settings.Sample.Rate_In_Ms || 500);
  settings.GlobalThreshold = settings.GlobalThreshold || {};
  settings.GlobalThreshold.High = Number(settings.GlobalThreshold.High || 35);
  settings.GlobalThreshold.Low = Number(settings.GlobalThreshold.Low || 20);

  if (!Number.isInteger(settings.Sample.Size) || settings.Sample.Size < 1) fail('Sample.Size must be a positive integer');
  if (settings.Sample.Rate_In_Ms < 10 || settings.Sample.Rate_In_Ms > 1000) fail('Sample.Rate_In_Ms must be between 10 and 1000');

  config.Zones.forEach((zone, index) => {
    zone.id = index + 1;
    zone.Label = zone.Label || `Zone_${zone.id}`;
    zone.Assets = zone.Assets || {};
    if (!zone.MicrophoneAssignment || !Array.isArray(zone.MicrophoneAssignment.Connectors)) {
      fail(`Zone ${zone.id} requires MicrophoneAssignment.Connectors`);
    }
    zone.MicrophoneAssignment.Type = canonicalType(zone.MicrophoneAssignment.Type);
    zone.MicrophoneAssignment.Connectors.forEach(connector => {
      if (connector.Id === undefined && zone.MicrophoneAssignment.Type != 'Ethernet') {
        fail(`Zone ${zone.id} has a connector without an Id`);
      }
      if (zone.MicrophoneAssignment.Type == 'Ethernet') {
        connector.SubId = [...new Set((connector.SubId || []).map(String))];
        if (!connector.SubId.length) fail(`Zone ${zone.id} requires at least one Ethernet SubId`);
      }
    });
  });
  return config;
}

function buildRuntime(config) {
  runtime.config = config;
  runtime.zones.clear();
  runtime.buckets.clear();
  SAM.Status.Audio.Zone = {};

  config.Zones.forEach(zoneConfig => {
    const zone = {
      id: zoneConfig.id,
      label: zoneConfig.Label,
      type: zoneConfig.MicrophoneAssignment.Type,
      assets: zoneConfig.Assets,
      config: zoneConfig,
      connectors: []
    };
    runtime.zones.set(zone.id, zone);
    SAM.Status.Audio.Zone[zone.id] = makeZoneStatus(zone);

    zoneConfig.MicrophoneAssignment.Connectors.forEach(connectorConfig => {
      const connector = { id: connectorConfig.Id, state: 'Unset' };
      zone.connectors.push(connector);
      const bucket = {
        generation: runtime.generation,
        type: zone.type,
        connectorId: connector.id,
        connector,
        zone,
        state: 'Unset',
        samples: zone.type == 'Ethernet' ? new Map() : [],
        subIds: zone.type == 'Ethernet' ? connectorConfig.SubId : [],
        subStates: {}
      };
      bucket.subIds.forEach(subId => { bucket.subStates[subId] = 'Unset'; });
      addBucket(bucket);
    });
  });
}

function subscribeInputs() {
  if (!runtime.callback || !runtime.config) return;
  const generation = runtime.generation;
  const active = () => generation == runtime.generation && !!runtime.config;
  const types = new Set(runtime.config.Zones.map(zone => zone.MicrophoneAssignment.Type));

  if (types.has('Ethernet')) {
    subscribe(xapi.Event.Audio.Input.Connectors.Ethernet, event => {
      if (!active()) return;
      (runtime.buckets.get(inputKey('Ethernet', event.id)) || []).forEach(bucket => runEthernetBucket(bucket, event));
    });
    subscribe(xapi.Status.Audio.Input.Connectors.Ethernet['*'].StreamName, () => {
      if (active()) SAM.Setup(runtime.config);
    });
  }
  if (types.has('Analog')) {
    subscribe(xapi.Event.Audio.Input.Connectors.Microphone, event => {
      if (!active()) return;
      (runtime.buckets.get(inputKey('Analog', event.id)) || []).forEach(bucket => runStandardBucket(bucket, event));
    });
  }
  if (types.has('USBInterface')) {
    subscribe(xapi.Event.Audio.Input.Connectors.USBMicrophone, event => {
      if (!active()) return;
      (runtime.buckets.get(inputKey('USBInterface', event.id)) || []).forEach(bucket => runStandardBucket(bucket, event));
    });
  }
  subscribe(xapi.Status.Audio.Microphones.VoiceActivityDetector.Activity, event => {
    if (!active()) return;
    runtime.voiceActivity = String(event).toLowerCase() == 'true';
    SAM.Status.VoiceActivity = runtime.voiceActivity;
  });
}

async function purgeRuntime(preserveCallback) {
  const oldConfig = runtime.config;
  const wasMonitoring = runtime.monitoring;
  //debug('Purge started', { PreserveCallback: preserveCallback, WasMonitoring: wasMonitoring });
  runtime.generation++;
  runtime.monitoring = false;
  unsubscribeAll();
  if (wasMonitoring) await stopMeters(oldConfig);
  runtime.config = undefined;
  runtime.zones.clear();
  runtime.buckets.clear();
  runtime.voiceActivity = false;
  SAM.Status.Audio.Zone = {};
  SAM.Status.VoiceActivity = false;
  if (!preserveCallback) runtime.callback = undefined;
  //debug('Purge complete');
  return wasMonitoring;
}

async function setupConfiguration(input) {
  //debug('Setup started');
  try {
    const config = prepareConfiguration(input);
    /*debug('Configuration prepared', {
      Zones: config.Zones.length,
      Inputs: uniquePhysicalInputs(config)
    });*/
    await resolveEthernetIds(config);
    const wasMonitoring = await purgeRuntime(true);
    buildRuntime(config);
    subscribeInputs();
    if (wasMonitoring) {
      await startMeters(runtime.config);
      runtime.monitoring = true;
    }
    debug('Setup complete', {
      Zones: config.Zones.length,
      Monitoring: runtime.monitoring
    });
  } catch (error) {
    debugError('Setup failed', error);
    throw error;
  }
}

function enqueue(operation) {
  runtime.operation = runtime.operation.then(operation, operation);
  return runtime.operation;
}

SAM.Setup = configuration => {
  //debug('Setup requested');
  return enqueue(() => setupConfiguration(configuration));
};

SAM.Start = async function (callback) {
  //debug('Start requested');
  try {
    checkSetup('Unable to start Zone Monitor before Setup()');
    if (callback !== undefined) {
      if (typeof callback != 'function') fail('Start requires a callback function');
      unsubscribeAll();
      runtime.callback = callback;
      subscribeInputs();
      debug('Zone tracking subscribed');
    }
    if (typeof runtime.callback != 'function') fail('Start requires a callback function');
    if (!runtime.monitoring) {
      await startMeters(runtime.config);
      runtime.monitoring = true;
    }
    debug('Start complete', { Monitoring: runtime.monitoring });
  } catch (error) {
    debugError('Start failed', error);
    throw error;
  }
};

SAM.Stop = async function () {
  //debug('Stop requested');
  try {
    checkSetup('Unable to stop Zone Monitor before Setup()');
    if (runtime.monitoring) {
      await stopMeters(runtime.config);
      runtime.monitoring = false;
    }
    unsubscribeAll();
    runtime.callback = undefined;
    //debug('Zone tracking unsubscribed');
    debug('Stop complete', { Monitoring: runtime.monitoring });
  } catch (error) {
    debugError('Stop failed', error);
    throw error;
  }
};

SAM.List = function () {
  checkSetup('Unable to list Zones before Setup()');
  return [...runtime.zones.values()].map(zone => zoneInfo(zone));
};

export { SAM };