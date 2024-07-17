var r = require('rethinkdb')
var util = require('util')
const path = require('path')

var db = require('./')
var wireutil = require('../wire/util')

var dbapi = Object.create(null)

const uuid = require('uuid')
const apiutil = require('../util/apiutil')
const datautil = require('../util/datautil')
const Promise = require('bluebird')
const _ = require('lodash')

const geocoder = require('../util/geocoder')


dbapi.setDetachedModeStartCapture = async function (serial) {

  const id = util.format('%s', uuid.v4()).replace(/-/g, '')
  const processedLogs = [{
    logID: id
    , serial
    , isActive: true
    , startTime: new Date()

  }]

  result = await db.run(r.table('deviceDetachModeLogs').insert(processedLogs))

  return id

}

dbapi.getDetachedModeStartCapture = function (logID) {

  return db.run(r.table('deviceDetachModeLogs').filter({ logID })).then(function (cursor) {
    return cursor.toArray()
  })

}


dbapi.setDetachedModeStopCapture = function (serial) {
  return db.run(r.table('deviceDetachModeLogs').filter({ serial, isActive: true })).then(function (cursor) {
    return cursor.toArray().then(detachedModeCapturelOG => {
      detachedModeCapturelOG.forEach(arg => {
        return db.run(r.table('deviceDetachModeLogs').get(arg.id).update({ isActive: false }))

      })
      return detachedModeCapturelOG[0] ? detachedModeCapturelOG[0].logID : null
    })
  })
}

dbapi.callEventChangeMessage = function (serial, data) {
  console.log("🚀 ~ DeviceChangeMessageDeviceChangeMessageDeviceChangeMessage file: api.js:24 ~ serial,data:", serial, data)

  return db.run(r.table('devices').get(serial).update({ callingStatus: data.state }))

}

dbapi.isDetachedModeCaptureing = function (serial) {
  return db.run(r.table('deviceDetachModeLogs').filter({ serial, isActive: true })).then(function (cursor) {
    return cursor.toArray()
  })
}

dbapi.deleteAllUsers = function () {
  return db.run(r.table('users').filter({}).delete())
}


dbapi.getDeviceById = function (serial) {
  return db.run(r.table('devices').get(serial))
}

dbapi.canDoReboot = function (serial) {
  let resolver = Promise.defer()
  const now = new Date()
  db.run(r.table('devices').get(serial))
    .then(function (device) {
      return device.rebootTimestamp
    })
    .then(function (rebootTimestamp) {
      if (!rebootTimestamp) {
        resolver.resolve(true)
        return db.run(r.table('devices').get(serial).update({ 'rebootTimestamp': now }))
      }
      const timestamp = new Date(rebootTimestamp)
      timestamp.setSeconds(timestamp.getSeconds() + 100)
      if (now > timestamp) {
        resolver.resolve(true)
        return db.run(r.table('devices').get(serial).update({ 'rebootTimestamp': now }))
      } else {
        return resolver.resolve(false)
      }
    })

  return resolver.promise
}

dbapi.setDeviceAutomationAgent = function (serial, owner) {
  return db.run(r.table('devices').get(serial).update({
    owner: owner,
    usage: 'automation',
    usageChangedAt: r.now(),
    logs_enabled: false
  }))
}

dbapi.updateHubctlData = function (hubctldata) {
  hubctldata.forEach(element => {
    element.portsarr.forEach(portsDetails => {
      if (portsDetails.deviceserial) {
        dbapi.getDeviceById(portsDetails.deviceserial).then(device => {
          if (device) {
            device.canVirtualDisconnect = true;
            device.hubctl = {
              hubID: element.hubID,
              portID: portsDetails.portID
            }
            db.run(r.table('devices').get(device.serial).update({
              canVirtualDisconnect: true,
              hubctl: {
                hubID: element.hubID,
                portID: portsDetails.portID
              }
            }))
          }

        })
      }
    })

  });

}

dbapi.updateUserPrivilege = function (email, privilege) {
  return db.run(r.table('users').get(email).update({ privilege }))
}
