var RecordRTC = require('recordrtc');

module.exports = function AudioCtrl($scope, $http, $interval, $timeout, UserService, StorageService, CommonService, GenericModalService, ReinjectAudioModalService, $window) {
  $scope.recordings = []
  $scope.injections = []
  $scope.newRecordingFound = true;
  $scope.newInjectionFound = true;
  $scope.isAdmin = UserService.currentUser.privilege == 'admin'
  $scope.addRecordClass = false;
  let isRecording = false;
  let socket;
  let bool = false;
  let recorderBrowserInput;
  let firstBuffer;
  let playrecord = false;
  let liveInjecting = false;
  $scope.audioUrl = "wss://tm-reddev03.oasisofsolution.com/audio-streaming-websocket/"
  const audioContext = new AudioContext();
  let scheduledTime = audioContext.currentTime;
  let recordingProcessId;

  $scope.executeAndSaveLocally = function () {
    $scope.control.shell('settings get secure bluetooth_address')
      .then(function (result) {
        let bluetooth_mac_address = result.data[0].replace(/\n/g, '').trim();
        let convertedString = bluetooth_mac_address.replaceAll(':', '_');
        $scope.shellCommandResult = convertedString;
      })
  };

  init();

  function init() {
    $scope.fileSelected = []
    $scope.pending = false;
    $scope.currentUser = CommonService.merge({}, UserService.currentUser);
    getBluetoothStatus()
    getAudioRecordings()
    getAudioInjections()
    if (!socket || socket.readyState == WebSocket.CLOSED) {
      setupsocket()
    }
  }

  $scope.executeAndSaveLocally();

  $scope.openFileSelector = function () {
    if ($scope.fileSelected.length) {
      $scope.inject()
    } else {
      document.getElementById('fileInput').click();
    }
  };

  $scope.uploadFile = function ($file) {
    $scope.fileSelected = $file
  }

  function capturemicrophone(callback) {
    $window.navigator.mediaDevices.getUserMedia({ audio: true }).then(function (microphone) {
      callback(microphone);
    }).catch(function (error) {
      $window.alert('Unable to capture your microphone. Please check console logs.');
      console.error(error);
    });
}

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  $scope.press = function (key) {
    if (!socket || socket.readyState == WebSocket.CLOSED) {
      setupsocket()
    }
    if (key == 'inject') {
      const commandMessage = {
        type: 'inject',
        mac_prefix: 'bluez_output.' + $scope.shellCommandResult
      };
      socket.send(JSON.stringify(commandMessage));
    }
    else {
      playrecord = !playrecord;
      if (playrecord) {
        const commandMessage = {
          type: 'record',
          command: 'bluez_input.' + $scope.shellCommandResult
        };
        socket.send(JSON.stringify(commandMessage));
      }
      else {
        const commandMessage = {
          type: 'stopProcess',
          processId: recordingProcessId
        };
        socket.send(JSON.stringify(commandMessage));
        setTimeout(function () {
          $scope.addRecordClass = false;
        }, 1000)
      }
    }
  }

  function setupsocket() {
    socket = new WebSocket($scope.audioUrl);
    socket.binaryType = 'arraybuffer';
    socket.onopen = (data) => {
    }
    socket.onerror = function errorListener(err) {
      console.log('websoket err listener', err)
      clearInterval(pingInterval);
    }

    // Set an interval to send a ping message every 30 seconds
    const pingInterval = setInterval(sendPing, 30000);

    socket.onclose = function closeListener(arg) {
      console.log('websoket on close listener', arg)
      bool = false;
      recording = false;
      playrecord = false;
      recorderBrowserInput.stopRecording(stopRecordingCallback);
      clearInterval(pingInterval);
    }

    let audioBuffers = [];
    firstBuffer = null;
    socket.onmessage = async function onMessageListener(arg) {
      let data = arg.data;
      if (data instanceof ArrayBuffer) {
        $scope.addRecordClass = true;
        if (!bool) {
          firstBuffer = Buffer.from(data);
          bool = true;
        }
        audioBuffers.push(Buffer.from(data));

        if (audioBuffers.length === 7) {
          if (audioContext.state === 'suspended') {
            await audioContext.resume();
          }
          for (let i = 0; i < 40; i++) {
            audioBuffers[0][i] = firstBuffer[i];
          }
          let concatenatedBuffer = Buffer.concat(audioBuffers);
          audioContext.decodeAudioData(concatenatedBuffer.buffer, function (decodedData) {
            const source = audioContext.createBufferSource();
 source.buffer = decodedData;
            source.connect(audioContext.destination);
            scheduledTime = Math.max(scheduledTime, audioContext.currentTime + 0.01);
            source.start(scheduledTime);
            scheduledTime += decodedData.duration;
          });
          audioBuffers = [];
        }
      }
      else if (typeof data == 'string') {
        let obj = JSON.parse(data);
        if (obj.type == 'error') {
          console.log('obj.type ',obj.type,obj);
          if(obj.subType == 'recordingFailed'){
            playrecord = false;
          }
          else if(obj.subType == 'injectionFailed'){
            liveInjecting = false;
            // Stop the recording process and release the microphone
            if (recorderBrowserInput) {
              recorderBrowserInput.stopRecording(() => {
                recorderBrowserInput.microphone.stop(); // Release the microphone
                recorderBrowserInput = null; // Clean up the recorder instance
              });
            }
            $scope.addInjectClass = false;
          }
          let errMsg = checkError(obj.message);
          GenericModalService.open({
            message: errMsg
            , type: 'Error'
            , size: 'lg'
            , cancel: false
          })
        }
        else if (obj.type == 'startInject') {
          liveInjecting = !liveInjecting;
          if(liveInjecting){
            $scope.addInjectClass = true;
            capturemicrophone(function (microphone) {
              recorderBrowserInput = RecordRTC(microphone, {
                recorderType: RecordRTC.StereoAudioRecorder,
                mimeType: 'audio/wav',
bufferSize: 2048,
                desiredSampRate: 96000,
                numberOfAudioChannels: 2,
                timeSlice: 1000,
                ondataavailable: async function (blob) {
                  if(liveInjecting){
                    console.log('blob ',blob);
                    const base64Data = await blobToBase64(blob);
                    const audioMessage = {
                      type: 'audio',
                      data: base64Data,
                      mac_prefix: 'bluez_output.' + $scope.shellCommandResult
                    };
                    socket.send(JSON.stringify(audioMessage));
                  }
                }
              });
              recorderBrowserInput.startRecording();
              recorderBrowserInput.microphone = microphone;
            });
            isRecording = true;
            $scope.addInjectClass = true;
          }
          else{
            // Stop the recording process and release the microphone
            if (recorderBrowserInput) {
              recorderBrowserInput.stopRecording(() => {
                recorderBrowserInput.microphone.stop(); // Release the microphone
                recorderBrowserInput = null; // Clean up the recorder instance
              });
            }
            $scope.addInjectClass = false;
          }
        }
        else if(obj.type == 'recordingProcessId'){
          recordingProcessId= obj.processId;
        }
      }
    };
  }

  $scope.record = function () {
    if (!$scope.seconds) {
      GenericModalService.open({
        message: 'You should enter a valid number of seconds'
        , type: 'Error'
        , size: 'lg'
        , cancel: false
})
    }
    else {
      $http({
        method: 'POST', url: '/audio-api/',
        headers: { 'Content-Type': undefined },
        params: { mac_address: 'bluez_input.' + $scope.shellCommandResult, serial: $scope.device.serial, useremail: $scope.currentUser.email, seconds: $scope.seconds }
      }).then(function (response) {
        $scope.recordprocessid = response.data.processid;
        $scope.filename = response.data.filename;
        $scope.recording = true;
        $scope.currentSecondsWhileRecording = 0;
        $scope.newRecordingFound = false;
        if (angular.isDefined($scope.timerInterval)) {
          $interval.cancel($scope.timerInterval);
        }
        $scope.timerInterval = $interval(function () {
          if ($scope.currentSecondsWhileRecording < $scope.seconds) {
            $scope.currentSecondsWhileRecording++;
          }
        }, 1000);
        $http.post(`/api/v1/devices/${$scope.device.serial}/audio-recording/start`).then(function (response) {
          setTimeout(function () {
            if (angular.isDefined($scope.timerInterval)) {
              $interval.cancel($scope.timerInterval);
            }
            checkForNewRecordings($scope.recordings.length);
          }, ($scope.seconds * 1000) + 1000);
        })
      }).catch(function (error) {
        let errMsg = checkError(error.data);
        GenericModalService.open({
          message: errMsg
          , type: 'Error'

, size: 'lg'
          , cancel: false
        })
        console.error('Error:', error);
      });
    }
  }

  $scope.stopProcess = function ($processid) {
    $http({
      method: 'POST',
      url: '/audio-api/stop-process',
      params: { processid: $processid },
      responseType: 'arraybuffer',
    }).then(function (response) {
      setTimeout(function () {
        $scope.recording = false;
        $scope.displayErrorMsg = false;
        getAudioRecordings();
      }, 1500);
    }).catch(function (error) {
      let errMsg = checkError(error.data);
      GenericModalService.open({
        message: errMsg
        , type: 'Error'
        , size: 'lg'
        , cancel: false
      })
      console.error('Error:', error);
    });
  }
 $scope.inject = function () {
    if (!$scope.injSec) {
      GenericModalService.open({
        message: 'You should enter a valid number of seconds'
        , type: 'Error'
        , size: 'lg'
        , cancel: false
      })
    }
    else {
      if ($scope.fileSelected.length) {
        const file = $scope.fileSelected[0];
        const audio = document.createElement('audio');
        audio.addEventListener('loadedmetadata', function () {
          $scope.$apply(function () {
            $scope.duration = audio.duration; // Duration in seconds
          });
        });
        audio.src = URL.createObjectURL(file);
        $scope.injecting = true;
        $scope.currentSecondsWhileInjecting = 0;
        $scope.newInjectionFound = false;
        if (angular.isDefined($scope.injectTimerInterval)) {
          $interval.cancel($scope.injectTimerInterval);
        }
        $scope.injectTimerInterval = $interval(function () {
          if ($scope.currentSecondsWhileInjecting < $scope.injSec) {
            $scope.currentSecondsWhileInjecting++;
          }
        }, 1000);
        return StorageService.storeFileLocal('audio/inject', [
          { file: file, field: "audio" },
        ], {
          serial: $scope.device.serial,
          mac_address: 'bluez_output.' + $scope.shellCommandResult,
          seconds: $scope.injSec,
        }, {
          filter: function (fileObj) {
            return /\.(wav|mp3)$/i.test(fileObj.file.name)
          }
        })
          .then(function (res) {
            if (res && res.data && res.data.success == true) {
   console.log(`Upload success: ${res.data.message}`)
            } else {
              throw new Error('Upload failed')
            }
          })
          .catch(function (err) {
            let errMsg = checkError(err.data.error);
            GenericModalService.open({
              message: errMsg
              , type: 'Error'
              , size: 'lg'
              , cancel: false
            })
            if (angular.isDefined($scope.injectTimerInterval)) {
              $interval.cancel($scope.injectTimerInterval);
            }
            $scope.currentSecondsWhileInjecting = 0;
            $scope.newInjectionFound = true;
            $scope.injecting = false;
            $scope.displayErrorMsg = false;
            $scope.injSec = null;
          })
          .finally(() => {
            setTimeout(function () {
              if (angular.isDefined($scope.injectTimerInterval)) {
                $interval.cancel($scope.injectTimerInterval);
              }
              checkForNewInjections($scope.injections.length);
            }, ($scope.injSec * 1000) + 1000);

          })
      }
    }
  }

  $scope.reinjectModal = function (injection) {
    ReinjectAudioModalService.open({ injection, title: "Re-inject Audio" }).then(function (newSeconds) {
      reinjectRequest(injection, newSeconds)
    })
  }

  function reinjectRequest(injection, seconds) {
    let url = `/api/v1/devices/${$scope.device.serial}/audio-injection/reinject?injectionID=${injection.injectionID}`
    if (seconds) {
      url += `&seconds=${seconds}`
}

    $scope.injecting = true;
    $scope.currentSecondsWhileInjecting = 0;
    $scope.newInjectionFound = false;
    $scope.injSec = seconds;
    if (angular.isDefined($scope.injectTimerInterval)) {
      $interval.cancel($scope.injectTimerInterval);
    }
    $scope.injectTimerInterval = $interval(function () {
      if ($scope.currentSecondsWhileInjecting < seconds) {
        $scope.currentSecondsWhileInjecting++;
      }
    }, 1000);

    return $http.post(url)
      .then(function (res) {
        if (res && res.data && res.data.success == true) {
          console.log(`Re-injection success: ${res.data.message}`)
          $scope.currentSecondsWhileInjecting = 0;
          $scope.newInjectionFound = true;
          $scope.injecting = false;
          $scope.displayErrorMsg = false;
          $scope.injSec = null;
        } else {
          throw new Error('Re-injection failed')
        }
      })
      .catch(function (error) {
        let errMsg = checkError(error.data.error);
        GenericModalService.open({
          message: errMsg
          , type: 'Error'
          , size: 'lg'
          , cancel: false
        })
        if (angular.isDefined($scope.injectTimerInterval)) {
          $interval.cancel($scope.injectTimerInterval);
        }
        $scope.currentSecondsWhileInjecting = 0;
        $scope.newInjectionFound = true;
        $scope.injecting = false;
        $scope.displayErrorMsg = false;
        $scope.injSec = null;
console.error("Error re-injecting audio " + error)
      })
  }

  $scope.deleteInjection = function (injection) {
    return $http.post(`/api/v1/devices/audio-injection/delete/${injection.injectionID}`)
      .then(function (res) {
        if (res && res.data && res.data.success == true) {
          console.log(`Deletion success: ${res.data.message}`)
          getAudioInjections()
        } else {
          throw new Error('Deletion failed')
        }
      })
      .catch(function (error) {
        console.error("Error deleting audio injection " + error)
      })
  }

  $scope.deleteRecording = function (recording) {
    return $http.post(`/api/v1/devices/audio-recording/delete/${recording.recordingID}`)
      .then(function (res) {
        if (res && res.data && res.data.success == true) {
          console.log(`Deletion success: ${res.data.message}`)
          getAudioRecordings()
        } else {
          throw new Error('Deletion failed')
        }
      })
      .catch(function (error) {
        console.error("Error deleting audio recording " + error)
      })
  }

  function getAudioRecordings() {
    return $http.get(`/api/v1/devices/${$scope.device.serial}/audio-recordings`).then(function (response) {
      $timeout(function () {
        $scope.recordings = response.data.recordings
      }, 0)
    }).catch(function (error) {
      let errMsg = checkError(error.data);
      GenericModalService.open({
        message: errMsg
 message: errMsg
        , type: 'Error'
        , size: 'lg'
        , cancel: false
      })
      console.error("Error Audio recordings " + error)
    })
  }

  function getBluetoothStatus() {
    console.length
    $http({
      method: `GET', url: '/bluetooth-api/api/check-connection`,
      headers: { 'Content-Type': undefined },
      params: { mac_address: $scope.shellCommandResult }
    }).then(function (response) {
      console.log('response ',response);
   }).catch(function (error) {
      let errMsg = checkError(error.data);
      GenericModalService.open({
        message: errMsg
        , type: 'Error'
        , size: 'lg'
        , cancel: false
      })
      console.error('Error:', error);
    });
  }

  function getAudioInjections() {
    return $http.get(`/api/v1/devices/${$scope.device.serial}/audio-injections`).then(function (response) {
      $timeout(function () {
        $scope.injections = response.data.injections
      }, 0)
    }).catch(function (error) {
      let errMsg = checkError(error.data);
      GenericModalService.open({
        message: errMsg
        , type: 'Error'
        , size: 'lg'
        , cancel: false
      })
      console.error("Error Fetching Audio Injections " + error)
    })
  }

  async function checkForNewRecordings(oldRecordingsLength) {
 await getAudioRecordings();
    if ($scope.recordings.length > oldRecordingsLength) {
      $scope.currentSecondsWhileRecording = 0;
      $scope.newRecordingFound = true;
      $scope.recording = false;
      $scope.displayErrorMsg = false;
      $scope.seconds = null;
    } else {
      setTimeout(function () {
        checkForNewRecordings(oldRecordingsLength);
      }, 2000);
    }
  }

  async function checkForNewInjections(oldInjectionsLength) {
    await getAudioInjections();
    if ($scope.injections.length > oldInjectionsLength) {
      $scope.currentSecondsWhileInjecting = 0;
      $scope.newInjectionFound = true;
      $scope.injecting = false;
      $scope.displayErrorMsg = false;
      $scope.injSec = null;
    } else {
      setTimeout(function () {
        checkForNewInjections(oldInjectionsLength);
      }, 2000);
    }
  }

  $scope.download = function (recording) {
    StorageService.download(`audio/${recording.recordingID}`, recording.audioFileName)
  }

  function checkError(errorString) {
    console.log(errorString);
    let msg = 'Unknown error';
    if (errorString.includes('Error checking node')) {
      if (errorString.includes('bluez_output')) {
        msg = 'There is no application opened to inject audio';
      }
      else {
        msg = 'There is no media playing on the device';
      }
    } else if (errorString.includes('502 Bad Gateway')) {
      msg = 'Please check that nodejs server is on and running';
    }
    return msg;
}

  // Function to send a ping message
  function sendPing() {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
    }
  }
}




//Bluetooth part

$scope.connectController = function(controller) {
    if ($scope.isBluetoothConnected) {
     
      $scope.disconnectCurrentController().then(function() {
        $scope.connectToController(controller);
      });
    } else {
      
      $scope.connectToController(controller);
    }
  };
 
  $scope.connectToController = function(controller) {
    
    connectBluetooth().then(function() {
      $scope.isBluetoothConnected = true;
      controller.connected = true;
      $scope.controllers = $scope.controllers.filter(c => c.connected);
    });
  };
 
  $scope.disconnectCurrentController = function() {
    return new Promise((resolve, reject) => {
      
      setTimeout(() => {
        $scope.controllers.forEach(controller => controller.connected = false);
        $scope.isBluetoothConnected = false;
        resolve();
      }, 1000);
    });
  };
 
  function connectBluetooth() {
    return new Promise((resolve, reject) => {
     
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  }
 
  $scope.toggleBluetoothConnection = function() {
    if ($scope.isBluetoothConnected) {
      $scope.disconnectCurrentController();
    } else {
      if ($scope.controllers.length > 0) {
        $scope.connectToController($scope.controllers[0]);
      }
    }
  };
