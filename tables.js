var r = require('rethinkdb')

module.exports = {
  users: {
    primaryKey: 'email'
  , indexes: {
      adbKeys: {
        indexFunction: function(user) {
          return user('adbKeys')('fingerprint')
        }
      , options: {
          multi: true
        }
      }
    }
  },
  featureSettings: {
    primaryKey: 'id',
  },
  accessTokens: {
    primaryKey: 'id'
  , indexes: {
      email: null
    }
  }
, vncauth: {
    primaryKey: 'password'
  , indexes: {
      response: null
    , responsePerDevice: {
        indexFunction: function(row) {
          return [row('response'), row('deviceId')]
        }
      }
    }
  }
, devices: {
    primaryKey: 'serial'
  , indexes: {
      owner: {
        indexFunction: function(device) {
          return r.branch(
            device('present')
          , device('owner')('email')
          , r.literal()
          )
        }
      }
    , logs_enabled: false
    , present: null
    , providerChannel: {
        indexFunction: function(device) {
          return device('provider')('channel')
        }
      }
    , group: {
        indexFunction: function(device) {
          return device('group')('id')
        }
      }
    }
  }
, deviceInfoEventLogs: {
    primaryKey: 'id'
    , indexes: {
      logID: {
        indexFunction: function(log) {
          return log('logID')
        },
      }
      ,logStopTimestamp: {
        indexFunction: function(log) {
          return log('logStopTimestamp')
        },
      }
      ,serial: {
        indexFunction: function(log) {
          return log('serial')
        },
      }

    }
  }
  , deviceDetachModeLogs: {
    primaryKey: 'id'
    , indexes: {
      logID: {
        indexFunction: function(log) {
          return log('logID')
        },
      }
    }
  }
, logs: {
    primaryKey: 'id'
  }
, groups: {
    primaryKey: 'id'
  , indexes: {
        privilege: null
      , owner: {
          indexFunction: function(group) {
            return group('owner')('email')
          }
        }
      , startTime: {
          indexFunction: function(group) {
            return group('dates').nth(0)('start')
          }
        }
    }
  },
  deviceusagelogs:{
    primaryKey: 'id' 
  },
  deviceUpTimelogs:{
    primaryKey: 'id' 
  },
  locationCache: {
    primaryKey: 'id',
    indexes: {
      location: {
        indexFunction: function(locationCache) {
          return locationCache('location')
        },
        options: {
          geo: true
        }
      }
    }
  },
  deviceLocationHistory: {
    primaryKey: 'id'
  }, 
  cellNetwork: {
    primaryKey: 'id' //serial and class_name
  },
  testCaseResults: {
    primaryKey: 'id'
  },
  deviceQxdmLogs: {
    primaryKey: 'logId'
  },
  qxdmMaskFiles: {
    primaryKey: 'id'
  },
  bugReports: {
    primaryKey: 'id'
  },
  testAssistExecutions: {
    primaryKey: 'executionID'
  },
  testAssistEntries: {
    primaryKey: 'id',
    indexes: {
      executionID: {
        indexFunction: function (entry) {
          return entry('executionID')
        },
      },
      executionID_messageID: {
        indexFunction: function (entry) {
          return [entry('metadata')('executionID'), entry('metadata')('messageID')]
        },
      },
    }
  },
  screenRecordings: {
    primaryKey: 'recordingID'
  },
  audioRecordings: {
    primaryKey: 'recordingID'
  },
  audioInjections: {
    primaryKey: 'injectionID'
  },
}

 rpAudioModules: {
    primaryKey: 'id',
    indexes: {  
    name: null, 
    subroute: null,   
    localip: null,     
    port: null  
    }        
  },
