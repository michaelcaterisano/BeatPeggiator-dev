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

var manualBeatDivision = 0;

var manualActiveNotes = [];

// time in milliseconds that next note should be played
var noteSendDelay = 0;

// static time reset at each beat
var timerStartTime = 0;

// the previous beat, used to check if it's the next beat
var prevBlockBeat = 0;

var accelerating = false;

// distance from right cycle beat to trigger isCycleEnd
var END_CYCLE_THRESHOLD = 0.05;

var SAMPLE_THRESHOLD = 1;

// PARAMETER DEFINITIONS
//**************************************************************************************************
//define the UI controls here
var PluginParameters = [
  {
    name: "Beat Division",
    type: "lin",
    minValue: 1,
    maxValue: 64,
    numberOfSteps: 63,
    defaultValue: 4
  },
  {
    name: "Notes Per Beat",
    type: "lin",
    minValue: 1,
    maxValue: 64,
    numberOfSteps: 63,
    defaultValue: 4
  },
  {
    name: "Simultaneous Notes",
    type: "lin",
    minValue: 1,
    maxValue: 16,
    numberOfSteps: 15,
    defaultValue: 1
  },
  {
    name: "Note Length",
    type: "lin",
    unit: "ms",
    minValue: 10,
    maxValue: 2000,
    numberOfSteps: 100,
    defaultValue: 10
  }
];

// LOGIC SCRIPTER FUNCTIONS
//**************************************************************************************************
function ProcessMIDI() {
  offsets = getNoteDelays();
  sampleTempo();
  updateAcceleration();

  switch (true) {
    case isCycleEnd():
      timerStartTime = dateNow();
      // reset so that isNextBeat() fires on cycle beginning
      prevBlockBeat = 0;
      printCycleInfo();
      break;

    case isNextBeat():
      manualActiveNotes = [...activeNotes];
      timerStartTime = dateNow();
      noteSendDelay = offsets[notesPlayed];

      // set values for this beat
      manualNotesPerBeat = GetParameter("Notes Per Beat");
      manualBeatDivision = GetParameter("Beat Division");

      // generate beatMap and delays
      beatMap = getBeatMap(manualNotesPerBeat, manualBeatDivision);
      offsets = getNoteDelays();

      notesPlayed = 0;
      noteSendDelay = offsets[notesPlayed];
      prevBlockBeat = Math.floor(GetTimingInfo().blockStartBeat);

      // log info
      printBeatInfo();
      break;

    case timeToSendNote() && !isCycleEnd():
      if (isCycleEnd()) {
        break;
      }
      offsets = getNoteDelays();

      sendNote();

      notesPlayed += 1;

      timerStartTime = dateNow();
      noteSendDelay = offsets[notesPlayed];

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
    manualActiveNotes = [];
    timerStartTime = dateNow();
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
//************************ **************************************************************************
// sends a noteOn, then creates and sends a noteOff after noteLength time
function sendNote() {
  var availableNotes = [...manualActiveNotes];
  if (availableNotes.length !== 0) {
    var simultaneousNotes = GetParameter("Simultaneous Notes");
    var iterations =
      simultaneousNotes > manualActiveNotes.length
        ? manualActiveNotes.length
        : simultaneousNotes;
    for (var i = 0; i < iterations; i++) {
      var noteToSend = new NoteOn(getAndRemoveRandomItem(availableNotes));
      noteToSend.send();
      noteOffToSend = new NoteOff(noteToSend);
      noteOffToSend.sendAfterMilliseconds(GetParameter("Note Length"));

      Trace("[" + manualActiveNotes.map(note => note.pitch) + "]");

      log(noteToSend);
    }
  }
}

//**************************************************************************************************
// checks if it's time to play the next note. returns boolean.
function timeToSendNote() {
  var info = GetTimingInfo();

  // HACK: fix bad comparison when accelerating is wrongly false
  if (dateNow() - timerStartTime < 0) {
    _trace("now: " + dateNow() + " start: " + timerStartTime);
    timerStartTime = info.blockStartBeat * (60000 / info.tempo);
  }

  return (
    manualActiveNotes.length !== 0 &&
    dateNow() - timerStartTime > noteSendDelay &&
    info.blockStartBeat > info.leftCycleBeat &&
    notesPlayed < manualNotesPerBeat
  );
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
function getBeatMap(notesPerBeat, beatDivision) {
  return generateBeatMap(notesPerBeat, beatDivision);
}

//**************************************************************************************************
// calculates offset amount and returns note delays
function getNoteDelays() {
  var info = GetTimingInfo();
  var offsetAmount = 60000 / info.tempo / manualBeatDivision;
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
  var info = GetTimingInfo();

  return Math.floor(GetTimingInfo().blockStartBeat) > prevBlockBeat;
}

//**************************************************************************************************
// tests if transport is playing. returns boolean.
function isPlaying() {
  return GetTimingInfo().playing;
}

//**************************************************************************************************
// gets current moment in milliseconds
function dateNow() {
  var info = GetTimingInfo();
  if (accelerating) {
    return Date.now();
  } else {
    return info.blockStartBeat * (60000 / info.tempo);
  }
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
function log(note) {
  Trace(
    "note: " +
      MIDI.noteName(note.pitch) +
      " | beat: " +
      GetTimingInfo().blockStartBeat.toFixed(2) +
      " | tempo: " +
      GetTimingInfo().tempo.toFixed(2) +
      " | numPlayed: " +
      notesPlayed +
      " | division: " +
      GetParameter("Beat Division") +
      " | noteSendDelay: " +
      offsets[notesPlayed].toFixed(2) +
      " | offsets: [" +
      offsets.map(o => o.toFixed(2)) +
      "]" +
      " | start " +
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
      "blockStart: " +
      GetTimingInfo().blockStartBeat.toFixed(2) +
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
      timerStartTime
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

  if (currentTempoSample[0] - prevTempoSample[0] > SAMPLE_THRESHOLD) {
    currentTempoSample = [info.blockStartBeat, info.tempo];

    prevTempoSample = currentTempoSample;
  }
}

//**************************************************************************************************
function updateAcceleration() {
  var info = GetTimingInfo();

  var prevTempo = prevTempoSample[1];
  var currentTempo = currentTempoSample[1];

  if (prevTempo === currentTempo) {
    accelerating = false;
  } else {
    accelerating = true;
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
