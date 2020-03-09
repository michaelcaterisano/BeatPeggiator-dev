//--------------------------------------------------------------------------------------------------
// CutletDrumEggiator
//--------------------------------------------------------------------------------------------------

/* notes are generated in ProcessMIDI, and HandleMIDI only updates the note array (which is 
   activeNotes[]). ParameterChanged is called when a 
   slider is moved.
*/

// VARIABLES
//**************************************************************************************************
//set this flag to true, to access the host timing info
var NeedsTimingInfo = true;

// array that will hold currently active MIDI notes
var activeNotes = [];

// array that will hold offset amounts, or 1 / beatDivision
var offsets = [];

// the current beat map
var beatMap = [];

// contains two numbers, time and tempo, to be
// compared with currentTempoSample to calculate
// acceleration
var prevTempoSample = [];
var currentTempoSample = [];

// variable to track how many notes have been played
// updated by sendNote()
var notesPlayed = 0;

var manualNotesPerBeat = 0; // still need this?

// time in milliseconds that next note should be played
var noteSendDelay = 0;

// static time reset at each beat
var timerStartTime = 0;

// the previous beat, used to check if it's the next beat
var prevBlockBeat = 0;

// the previous tempo
var prevTempo = null; // need this?

// distance from right cycle beat to trigger isCycleEnd
var END_CYCLE_THRESHOLD = 0.01;

// PARAMETER DEFINITIONS
//**************************************************************************************************
//define the UI controls here
var PluginParameters = [
  {
    name: "Beat Division",
    type: "lin",
    minValue: 1,
    maxValue: 8,
    numberOfSteps: 7,
    defaultValue: 4
  },
  {
    name: "Notes Per Beat",
    type: "lin",
    minValue: 1,
    maxValue: 8,
    numberOfSteps: 7,
    defaultValue: 4
  },
  {
    name: "Note Length",
    type: "lin",
    unit: "ms",
    minValue: 10,
    maxValue: 100,
    numberOfSteps: 10,
    defaultValue: 10
  }
];

// LOGIC SCRIPTER FUNCTIONS
//**************************************************************************************************
function ProcessMIDI() {
  switch (true) {
    case isCycleEnd():
      // reset so that isNextBeat() fires on cycle beginning
      prevBlockBeat = 0;

      printCycleInfo();
      break;

    case isNextBeat():
      // generate beatMap and delays
      beatMap = getBeatMap();
      offsets = getNoteDelays();

      // set values for this beat
      manualNotesPerBeat = GetParameter("Notes Per Beat");
      notesPlayed = 0;
      prevBlockBeat = Math.floor(GetTimingInfo().blockStartBeat);
      timerStartTime = dateNow();
      noteSendDelay = offsets[notesPlayed];

      // log info
      printBeatInfo();
      break;

    case timeToSendNote():
      log();
      sendNote();
      noteSendDelay += offsets[notesPlayed];
      break;
  }
}

//**************************************************************************************************
function HandleMIDI(note) {
  if (note instanceof NoteOn) {
    activeNotes.push(note);
    if (activeNotes.length == 1) {
      timerStartTime = dateNow();
    }
  }

  if (note instanceof NoteOff) {
    for (var i in activeNotes) {
      if (activeNotes[i].pitch == note.pitch) {
        activeNotes.splice(i, 1);
      }
    }
  }

  if (activeNotes.length === 0) {
    timerStartTime = 0;
  }
}

//**************************************************************************************************
function Reset() {
  Trace("*********** RESET");
  MIDI.allNotesOff();
  activeNotes = [];
  initializeTempoSamples();

  prevBlockBeat = 0;
  noteSendDelay = 0;
}

//**************************************************************************************************
function ParameterChanged(param, value) {
  if (param == 0) {
    // Beat Division
    if (value < GetParameter("Notes Per Beat")) {
      SetParameter(1, value);
    } else {
    }
  }
  if (param == 1) {
    if (value > GetParameter("Beat Division")) {
      SetParameter("Beat Division", value);
    } else {
    }
  }
}

// OTHER FUNCTIONS
//**************************************************************************************************
// sends a noteOn, then creates and sends a noteOff after noteLength time
function sendNote() {
  var noteToSend = new NoteOn(getRandomFromArray(activeNotes));
  noteToSend.send();
  noteOffToSend = new NoteOff(noteToSend);
  noteOffToSend.sendAfterMilliseconds(GetParameter("Note Length"));

  notesPlayed += 1;
}
//**************************************************************************************************
// returns random beatmap array e.g. [0, 1, 1, 0] for 2 beats in 4 divisions
function generateBeatMap(numNotes, beatDivision) {
  // create array of size beatDivision and fill with index numbers
  var arr = new Array(beatDivision);
  for (var i = 0; i < beatDivision; i++) {
    arr[i] = i;
  }

  // randomly choose numNotes number of indices from array
  // these will be the beatDivisions that have a note
  var indices = [];
  for (var i = 0; i < numNotes; i++) {
    var index = getAndRemoveRandomItem(arr);
    indices.push(index);
  }

  // create output array like [1, 0, 1, 1] where 1 represents a note
  // 0 represents a rest, and the array length represents the number of
  // beat divisions
  var output = new Array(beatDivision).fill(0);
  for (var i = 0; i < indices.length; i++) {
    var index = indices[i];
    output[index] = 1;
  }
  return output;
}

//**************************************************************************************************
// returns array of note delays in milliseconds,
//e.g. [0, 255, 255, 255] for beatmap [1, 1, 1, 1] at 60bpm
function generateNoteDelays(beatMap, offsetAmount) {
  var sum = 0;

  var offsetReducer = (output, curr, index) => {
    switch (true) {
      case index === 0 && curr === 0:
        break;
      case index === 0 && curr === 1:
        output.push(sum);
        break;
      case curr === 0:
        sum += offsetAmount;
        break;
      case curr === 1:
        sum += offsetAmount;
        output.push(sum);
        sum = 0;
        break;
    }
    return output;
  };

  return beatMap.reduce(offsetReducer, []);
}

//**************************************************************************************************
// gets params and returns beatmap
function getBeatMap() {
  beatDivision = GetParameter("Beat Division");
  numNotes = GetParameter("Notes Per Beat");
  return generateBeatMap(numNotes, beatDivision);
}

//**************************************************************************************************
// calculates offset amount and returns note delays
function getNoteDelays() {
  var info = GetTimingInfo();
  var offsetAmount = 60000 / info.tempo / GetParameter("Beat Division");
  return generateNoteDelays(beatMap, offsetAmount);
}
//**************************************************************************************************

//**************************************************************************************************
// tests whether current position is very close to cycleEnd. returns Boolean.
function isCycleEnd() {
  var info = GetTimingInfo();
  // not cycling
  if (!info.cycling) {
    return false;
  }
  // cycle is on
  else {
    var position = info.blockStartBeat;
    // end of cycle
    if (info.rightCycleBeat - position < END_CYCLE_THRESHOLD) {
      return true;
      // cycle not at end
    } else {
      return false;
    }
  }
}

//**************************************************************************************************
// tests if position is on the beat, returns boolean
function isNextBeat() {
  return Math.floor(GetTimingInfo().blockStartBeat) > prevBlockBeat;
}

//**************************************************************************************************
// tests if transport is playing. returns boolean.
function isPlaying() {
  return GetTimingInfo().playing;
}

//**************************************************************************************************
// checks if it's time to play the next note. returns boolean.
function timeToSendNote() {
  return (
    activeNotes.length !== 0 &&
    dateNow() - timerStartTime > noteSendDelay &&
    notesPlayed < manualNotesPerBeat
  );
}

//**************************************************************************************************
// gets current moment in milliseconds
function dateNow() {
  var timingInfo = GetTimingInfo();
  return Math.round(timingInfo.blockStartBeat * (60000 / timingInfo.tempo));
}

//**************************************************************************************************
function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

//**************************************************************************************************
function getRandomFromArray(arr) {
  if (arr.length === 0) {
    return null;
  }
  var max = arr.length - 1;
  var index = getRandomInRange(0, max);
  return arr[index];
}

//**************************************************************************************************
function getAndRemoveRandomItem(arr) {
  if (arr.length !== 0) {
    var index = Math.floor(Math.random() * arr.length);
    return arr.splice(index, 1)[0];
  } else {
    console.log("empty array");
  }
}

// LOGGING
//**************************************************************************************************
function log() {
  var delay = noteSendDelay == 0 ? "000.00" : noteSendDelay.toFixed(2);
  Trace(
    "| beat: " +
      GetTimingInfo().blockStartBeat.toFixed(2) +
      " | tempo: " +
      GetTimingInfo().tempo.toFixed(2) +
      " | numPlayed: " +
      notesPlayed +
      " | noteSendDelay: " +
      delay +
      " | beatLength " +
      (60000 / GetTimingInfo().tempo).toFixed(2) +
      " | timerStartTime " +
      timerStartTime +
      " | now: " +
      dateNow() +
      " | diff: " +
      (dateNow() - timerStartTime)
  );
}

//**************************************************************************************************
// prints only if info.playing === true
function _trace(val) {
  if (GetTimingInfo().playing) {
    Trace(val);
  }
}

//**************************************************************************************************
// logs info for current beat
function printBeatInfo() {
  _trace(
    " \n NEXT BEATMAP: [" +
      beatMap +
      "] " +
      "  NEXT DELAYS: [" +
      offsets.map(o => o.toFixed(2)) +
      "]" +
      "  TIMER: " +
      timerStartTime
  );

  _trace(
    "------------------------------------------------------------------------------------------------"
  );
}

//**************************************************************************************************
// prints marker for cycle
function printCycleInfo() {
  Trace(
    "**************************************************************************************************" +
      dateNow()
  );
}

// UNUSED -- ACCELERATION FUNCTIONS
//**************************************************************************************************
function sampleTempo() {
  var info = GetTimingInfo();

  if (currentTempoSample.length === 0) {
    currentTempoSample = [info.blockStartBeat, info.tempo];
    prevTempoSample = currentTempoSample;
    return;
  }

  currentTempoSample = [info.blockStartBeat, info.tempo];

  if (currentTempoSample[0] - prevTempoSample[0] > 0.2) {
    printSamples();

    getAcceleration();

    currentTempoSample = [info.blockStartBeat, info.tempo];

    prevTempoSample = currentTempoSample;
  }
}

//**************************************************************************************************
function getAcceleration() {
  var tempo0 = prevTempoSample[1];
  var tempo1 = currentTempoSample[1];
  var time0 = prevTempoSample[0];
  var time1 = currentTempoSample[0];
  if (prevTempoSample.length === 0) {
    return 0;
  } else if (tempo1 - tempo0 <= 0) {
    return 0;
  } else {
    var acceleration = (tempo1 - tempo0) / (time1 - time0);
    return acceleration;
  }
}

//**************************************************************************************************
function printSamples() {
  if (isPlaying()) {
    Trace(
      "curr:  [" +
        currentTempoSample.map(el => el.toFixed(2)) +
        "]" +
        " prev: [" +
        prevTempoSample.map(el => el.toFixed(2)) +
        "]"
    );
  }
}

//**************************************************************************************************
function initializeTempoSamples() {
  prevTempoSample = [];
  currentTempoSample = [];
}
