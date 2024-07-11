module.exports = function ScreenRecordingCtrl($scope, $routeParams, $http, StorageService) {
  const serial = $routeParams.serial
  let interval = null

  $scope.pending = true
  $scope.isRecording = false
  $scope.isEncoding = false
  $scope.timer = ""
  $scope.encodingProgress = 0
  $scope.recordings = []
  $scope.framerates = [5, 15, 30]
  $scope.framerate = 30

  init()

  function init() {
    getScreenRecordingStatus()
      .then(getScreenRecordings)
      .finally(function () {
        $scope.$apply(function () {
          $scope.pending = false
        })
      })
  }

  $scope.clickFramerate = function (framerate) {
    $scope.framerate = framerate
  }

  function getScreenRecordingStatus() {
    return $scope.control.getScreenRecordingStatus().then(function (result) {
      if (result.body) {
        const { timestamp: startedOn } = result.body
        setRecordingInterval(startedOn)
      }
      return $scope.isRecording = result.lastData === "inprogress"
    })
  }

  function setRecordingInterval(startedOn) {
    interval = setInterval(function () {
      $scope.$apply(function () {
        $scope.timer = calculateDuration(new Date(startedOn), new Date())
      })
    }, 1000)
  }

  function calculateDuration(start, end) {
    const diff = Math.abs(end - start)
    const mins = Math.floor(diff / (1000 * 60))
    const secs = Math.floor(diff / 1000) % 60
    return `${(mins + "").padStart(2, "0")}:${(secs + "").padStart(2, "0")}`
  }

  $scope.startRecording = function () {
    interval = null
    $scope.pending = false
    $scope.control.startScreenRecording($scope.framerate).then(function (result) {
      if (result && result.body) {
        $scope.isRecording = true
        const { date, timestamp: startedOn } = result.body
        setRecordingInterval(startedOn)
      }
    }).catch(function (err) {
      console.log(`Error starting screen recording: ${err.message}`)
      clearInterval(interval)
    }).finally(function () {
      $scope.pending = false
    })
  }

  function setStoppedRecording() {
    if ($scope.isRecording) {
      $scope.$apply(function () {
        $scope.pending = false
        clearInterval(interval)
        interval = null
        $scope.isRecording = false
      })
    }
  }

  $scope.stopRecording = function () {
    $scope.pending = true
    $scope.control.stopScreenRecording()
      .progressed(function (result) {
        setStoppedRecording()
        $scope.$apply(function () {
          $scope.isEncoding = true
          $scope.encodingProgress = result.progress
        })
      }).then(function (result) {
        $scope.isEncoding = false
        getScreenRecordings()
      }).catch(function (err) {
        console.log(`Error stopping screen recording: ${err.message}`)
      }).finally(function () {
        setStoppedRecording()
      })
  }

  function getScreenRecordings() {
    return $http.get(`/api/v1/devices/${serial}/screen-recordings`).then(function (response) {
      $scope.recordings = response.data.recordings
    }).catch(function (error) {
      console.error("Error screen recordings" + error)
    })
  }

  $scope.download = function (recording) {
    StorageService.download(`video/screen-recording/${recording.recordingID}`, recording.videoFileName)
  }
}
