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

//let prevBeat = 0;

let prevBlockBeat = 0;

let prevTempo = null;

let nextDelay = 0;

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
// shufflfes array in place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
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
    const index = Math.floor(Math.random() * arr.length);
    return arr.splice(index, 1)[0];
  } else {
    console.log("empty array");
  }
}

//**************************************************************************************************
function getBeatMap(numNotes, beatDivision) {
  let arr = new Array(beatDivision);
  for (let i = 0; i < beatDivision; i++) {
    arr[i] = i;
  }

  let indices = [];
  for (let i = 0; i < numNotes; i++) {
    let index = getAndRemoveRandomItem(arr);
    indices.push(index);
  }
  console.log(indices.sort());

  let output = new Array(beatDivision).fill(0);
  for (let i = 0; i < indices.length; i++) {
    let index = indices[i];
    output[index] = 1;
  }
  return output;
}

//**************************************************************************************************
function getNoteDelays(noteMap, offsetAmount) {
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
// returns current beat as integer. keeps in cycle bounds if cycling.
function getCurrentBeat() {
  const info = GetTimingInfo();
  // var position = info.blockStartBeat;
  // var result = null;

  // if (!info.cycling) {
  //   // cycle is off
  //   result = position;
  // } else {
  //   // cycle is on
  //   // position is outside cycle boundaries
  //   if (position < info.leftCycleBeat || position > info.rightCycleBeat) {
  //     result = info.leftCyceBeat;
  //   } else {
  //     result = position;
  //   }
  // }
  return Math.round(info.blockStartBeat * (60000 / info.tempo));
}

//**************************************************************************************************
// removes and returns first offset in offsets
function getOffset() {
  return offsets.length > 0 ? offsets.shift() : 0;
}

// BOOLEANS
//**************************************************************************************************
// tests if note is valid, returns boolean
function noteIsValid(note) {
  return note.pitch <= 127 && note.pitch >= 0;
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
function getLeftCycleBeat() {
  const info = GetTimingInfo();
  return info.leftCycleBeat * (60000 / info.tempo);
}

//**************************************************************************************************
//
function isNextBeat() {
  const info = GetTimingInfo();
  const beatLength = 60000 / info.tempo;
  //return dateNow() - prevBeat > beatLength; // beatLength = 0?
  //return (dateNow() - getCurrentBeat()) > beatLength;

  return Math.floor(GetTimingInfo().blockStartBeat) > prevBlockBeat;

  return;
}

//**************************************************************************************************
// tests if transport is playing. returns boolean.
function isPlaying() {
  return GetTimingInfo().playing;
}

//**************************************************************************************************
// tests if finished playing notes in current beat, returns boolean
function finishedPlayingNotes() {
  return notesPlayed >= GetParameter("Notes Per Beat");
}

//**************************************************************************************************
// tests if activeNotes[] has any notes. returns boolean.
function noActiveNotes() {
  return activeNotes.length === 0;
}

// NOTE FUNCTIONS
//**************************************************************************************************
// cancels all active MIDI notes
function _allNotesOff() {
  MIDI.allNotesOff();
}

//**************************************************************************************************
function logNote() {
  let delay = noteSendDelay == 0 ? "000.00" : noteSendDelay.toFixed(2);
  Trace(
    "| beat: " +
    GetTimingInfo().blockStartBeat.toFixed(2) +
    " | tempo: " +
    GetTimingInfo().tempo.toFixed(2) +
    " | delay: " +
    delay +
    " | beatLength " +
    (60000 / GetTimingInfo().tempo).toFixed(2) +
    " | numPlayed: " +
    notesPlayed +
    " | timer: " +
    timerStartTime +
    " | now: " +
    dateNow() /*" | prevBlockBeat: " +
      prevBlockBeat +
      " | blockStart: " +
      GetTimingInfo().blockStartBeat.toFixed(2)*/ +
      " | offsets: [" +
      offsets.map(o => o.toFixed(2)) +
      "]" +
      " | beatMap: " +
      "[" +
      beatMap +
      "]"
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

  logNote();

  notesPlayed += 1;
}

//**************************************************************************************************
// resets offsets global variable
function updateOffsets(numNotes) {
  const info = GetTimingInfo();
  beatDivision = GetParameter("Beat Division");

  if (!numNotes) {
    numNotes = GetParameter("Notes Per Beat");
  }

  beatMap = getBeatMap(numNotes, beatDivision);
  const offsetAmount = 60000 / info.tempo / beatDivision;

  // update offsets
  if (isPlaying()) {
    Trace(
      "[" + getNoteDelays(beatMap, offsetAmount).map(el => el.toFixed(2)) + "]"
    );
  }

  offsets = getNoteDelays(beatMap, offsetAmount);

  return;
}

function adjustOffsets() {
  const info = GetTimingInfo();
  const offsetAmount = 60000 / info.tempo / GetParameter("Beat Division");
  let newOffsets = getNoteDelays(beatMap, offsetAmount);
  newOffsets.splice(0, notesPlayed + 1);
  offsets = newOffsets;
}

//**************************************************************************************************
function tempoChanged() {
  return prevTempo !== null && GetTimingInfo().tempo !== prevTempo;
}

// LOGIC SCRIPTER FUNCTIONS
//**************************************************************************************************
function ProcessMIDI() {
  switch (true) {
    case isCycleEnd():
      prevBlockBeat = 0;
      notesPlayed = 0;
      Trace(
        "************************************************************************************************** "
      );
      break;

    case isNextBeat():
      updateOffsets();
      manualNotesPerBeat = GetParameter("Notes Per Beat");
      notesPlayed = 0;
      prevBlockBeat = Math.floor(GetTimingInfo().blockStartBeat);
      timerStartTime = dateNow();
      noteSendDelay = getOffset();
      if (isPlaying()) {
        Trace(
          "------------------------------------------------------------------------------------------------"
        );
      }
      break;

    // play notes
    case activeNotes.length !== 0 &&
      dateNow() - timerStartTime > noteSendDelay &&
      notesPlayed < manualNotesPerBeat &&
      isPlaying():
      //if (getOffset() === null ) break;
      sendNote();
      nextDelay = getOffset();
      noteSendDelay += nextDelay;
      break;

    case tempoChanged():
      //adjustOffsets();
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
  _allNotesOff();
  activeNotes = [];
  prevBlockBeat = 0;
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
