  app.get('/app/api/v1/state.js', function(req, res) {
    var state = {
      config: {
        websocketUrl: (function() {
          var wsUrl = url.parse(options.websocketUrl, true)
          wsUrl.query.uip = req.ip
          return url.format(wsUrl)
        })()
      }
    ,
     user: req.user

     

    }

    

    if (options.userProfileUrl) {
      state.config.userProfileUrl = (function() {
        return options.userProfileUrl
      })()
    }
res.type('application/javascript')
    res.send('var GLOBAL_APPSTATE = ' + JSON.stringify(state))
  })


    module.exports.command = 'app'

module.exports.describe = 'Start an app unit.'

module.exports.builder = function(yargs) {
  return yargs
    .env('TMSS_APP')
    .strict()
    .option('auth-url', {
      alias: 'a'
    , describe: 'URL to the auth unit.'
    , type: 'string'
    , demand: true
    })
    .option('port', {
      alias: 'p'
    , describe: 'The port to bind to.'
    , type: 'number'
    , default: process.env.PORT || 7105
    })
    .option('secret', {
      alias: 's'
    , describe: 'The secret to use for auth JSON Web Tokens. Anyone who ' +
        'knows this token can freely enter the system if they want, so keep ' +
        'it safe.'
    , type: 'string'
    , default: process.env.SECRET
    , demand: true
    })
    .option('ssid', {
      alias: 'i'
    , describe: 'The name of the session ID cookie.'
    , type: 'string'
    , default: process.env.SSID || 'ssid'
    })
    .option('user-profile-url', {
      describe: 'URL to an external user profile page.'
    , type: 'string'
    })
    .option('websocket-url', {
      alias: 'w'
    , describe: 'URL to the websocket unit.'
    , type: 'string'
    , demand: true
    })
    .epilog('Each option can be be overwritten with an environment variable ' +
      'by converting the option to uppercase, replacing dashes with ' +
      'underscores and prefixing it with `TMSS_APP_` (e.g. ' +
      '`TMSS_APP_AUTH_URL`).')
}

module.exports.handler = function(argv) {
  return require('../../units/app')({
    port: argv.port
  , secret: argv.secret
  , ssid: argv.ssid
  , authUrl: argv.authUrl
  , websocketUrl: argv.websocketUrl
  , userProfileUrl: argv.userProfileUrl
  })
}


    res.type('application/javascript')
    res.send('var GLOBAL_APPSTATE = ' + JSON.stringify(state))
  })
