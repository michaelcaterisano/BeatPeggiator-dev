//--------------------------------------------------------------------------------------------------
// CutletDrumEggiator
//--------------------------------------------------------------------------------------------------

/* notes are generated in ProcessMIDI, and HandleMIDI only updates the note array (which is 
   activeNotes[]). ParameterChanged is called when a 
   slider is moved.
*/

//set this flag to true, to access the host timing info
var NeedsTimingInfo = true;

// array that will hold currently active MIDI notes
let activeNotes = [];

// array that will hold offset amounts, or 1 / beatDivision
let offsets = [];

// variable to track how many notes have been played
// updated by sendNote()
let notesPlayed = 0;

let manualNotesPerBeat = 0;

let noteSendDelay = 0;

let timerStartTime = 0;

let prevBlockBeat = 0;

let prevTempo = null;

let nextDelay = 0;

let logTimer = 0;

let beatMap = [];

const END_CYCLE_THRESHOLD = 0.01;

const NEXT_BEAT_THRESHOLD = 0.995;

const DOWNBEAT_OFFSET = 0.001;

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
    const index = Math.floor(Math.random() * arr.length);
    return arr.splice(index, 1)[0];
  } else {
    console.log("empty array");
  }
}

//**************************************************************************************************
// returns current beat as integer
function getCurrentBeat() {
  return Math.round(info.blockStartBeat * (60000 / GetTimingInfo().tempo));
}

//**************************************************************************************************
// removes and returns first offset in offsets
function getOffset() {
  return offsets.length > 0 ? offsets.shift() : 0;
}

//**************************************************************************************************
// tests whether current position is very close to cycleEnd. returns Boolean.
function isCycleEnd() {
  const info = GetTimingInfo();
  // not cycling
  if (!info.cycling) {
    return false;
  }
  // cycle is on
  else {
    const position = info.blockStartBeat;
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
function log() {
  let delay = noteSendDelay == 0 ? "000.00" : noteSendDelay.toFixed(2);
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
      " | now: " +
      dateNow() +
      " | diff: " +
      (dateNow() - timerStartTime)
  );
}

//**************************************************************************************************
// sends a noteOn, then creates and sends a noteOff after noteLength time
function sendNote() {
  //if (getOffset() === null) { return }
  const noteToSend = new NoteOn(getRandomFromArray(activeNotes));
  noteToSend.send();
  noteOffToSend = new NoteOff(noteToSend);
  noteOffToSend.sendAfterMilliseconds(GetParameter("Note Length"));

  log();

  notesPlayed += 1;
}
//**************************************************************************************************

function logOffsets() {
  const offsetAmount =
    60000 / GetTimingInfo().tempo / GetParameter("Beat Division");
  if (isPlaying()) {
    Trace(
      "[" + getNoteDelays(beatMap, offsetAmount).map(el => el.toFixed(1)) + "]"
    );
  }
}

//**************************************************************************************************
function _trace(val) {
  if (GetTimingInfo().playing) {
    Trace(val);
  }
}

//**************************************************************************************************
function generateBeatMap(numNotes, beatDivision) {
  // create array of size beatDivision and fill with index numbers
  let arr = new Array(beatDivision);
  for (let i = 0; i < beatDivision; i++) {
    arr[i] = i;
  }

  // randomly choose numNotes number of indices from array
  // these will be the beatDivisions that have a note
  let indices = [];
  for (let i = 0; i < numNotes; i++) {
    let index = getAndRemoveRandomItem(arr);
    indices.push(index);
  }

  // create output array like [1, 0, 1, 1] where 1 represents a note
  // 0 represents a rest, and the array length represents the number of
  // beat divisions
  let output = new Array(beatDivision).fill(0);
  for (let i = 0; i < indices.length; i++) {
    let index = indices[i];
    output[index] = 1;
  }
  return output;
}

//**************************************************************************************************
function generateNoteDelays(noteMap, offsetAmount) {
  let sum = 0;

  const offsetReducer = (output, curr, index) => {
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

  return noteMap.reduce(offsetReducer, []);
}

//**************************************************************************************************
// resets offsets global variable
function getBeatMap() {
  beatDivision = GetParameter("Beat Division");
  numNotes = GetParameter("Notes Per Beat");
  return generateBeatMap(numNotes, beatDivision);
}

//**************************************************************************************************
function getNoteDelays() {
  const info = GetTimingInfo();
  const offsetAmount = 60000 / info.tempo / GetParameter("Beat Division");
  return generateNoteDelays(beatMap, offsetAmount);
}
//**************************************************************************************************
function timeToSendNote() {
  return (
    activeNotes.length !== 0 &&
    dateNow() - timerStartTime > noteSendDelay &&
    notesPlayed < manualNotesPerBeat &&
    isPlaying()
  );
}

// LOGIC SCRIPTER FUNCTIONS
//**************************************************************************************************
function ProcessMIDI() {
  const info = GetTimingInfo();

  switch (true) {
    case isCycleEnd():
      prevBlockBeat = 0;
      notesPlayed = 0;
      Trace(
        "**************************************************************************************************" +
          dateNow()
      );
      break;

    case isNextBeat():
      beatMap = getBeatMap();
      offsets = getNoteDelays();

      //offsets = [0, 232, 216.2, 201 ]

      let offsetAmount = 60000 / info.tempo / GetParameter("Beat Division");
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

      manualNotesPerBeat = GetParameter("Notes Per Beat");
      notesPlayed = 0;
      prevBlockBeat = Math.floor(GetTimingInfo().blockStartBeat);
      timerStartTime = dateNow();
      noteSendDelay = offsets[notesPlayed];
      if (isPlaying()) {
        Trace(
          "------------------------------------------------------------------------------------------------" +
            dateNow() +
            "ms " +
            GetTimingInfo().tempo.toFixed(2) +
            " bpm"
        );
      }
      break;

    case timeToSendNote():
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
