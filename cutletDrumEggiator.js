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

// how many notes should be played in a beat
// initialized and updated in ParameterChanged()
let notesPerBeat = 0;

let noteSendDelay = 0;

let timerStartTime = 0;

// maximum notes per beat
// initilized and updated by ParameterChanged()
//var beatDivision = null;

// how many notes were played in the previous beat
//var prevNotesPerBeat = null;

// set in ProcessMIDI() when note finishedPlayingNotes. reset to null in Reset().
var prevBeat = 0;

const END_CYCLE_THRESHOLD = 0.01;

const NEXT_BEAT_THRESHOLD = 0.995;

const DOWNBEAT_OFFSET = 0.001;

//**************************************************************************************************
// shufflfes array in place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// GET FUNCTIONS
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
// returns current beat as integer. keeps in cycle bounds if cycling.
function getCurrentBeat() {
  const info = GetTimingInfo();
  var position = info.blockStartBeat;
  var result = null;

  if (!info.cycling) {
    // cycle is off
    result = position;
  } else {
    // cycle is on
    // position is outside cycle boundaries
    if (position < info.leftCycleBeat || position > info.rightCycleBeat) {
      result = info.leftCycleBeat;
    } else {
      result = position;
    }
  }
  return Math.round(result * (60000 / info.tempo));
}

//**************************************************************************************************
// returns an offset from offsets array, or zero if offsets is empty
// function getOffset() {
//   return offsets.length > 0 ? getRandomFromArray(offsets) : 0;
// }

// removes and returns first offset in offsets
function getOffset() {
  return offsets.length > 0 ? offsets.shift() : null;
}

//**************************************************************************************************
// returns a float beat position to be assigned to a noteOn
// function getBeatPos() {
//   const position = GetTimingInfo().blockStartBeat;
//   const currentBeat = getCurrentBeat();
//   const offset = getOffset();

//   offsets.splice(offsets.indexOf(offset), 1);

//   return offset === 0 ? position + DOWNBEAT_OFFSET : currentBeat + offset;
// }

//**************************************************************************************************
// convertes ms noteLength to single beat percentage. returns value between 0 and 1.
// function getNoteOffDelay(noteLength) {
//   const info = GetTimingInfo();
//   const beatLength = 60000 / info.tempo;
//   return noteLength / beatLength;
// }

// RESET FUNCTIONS

//**************************************************************************************************
// resets notesPlayed global variable
// function resetNotesPlayed() {
//   notesPlayed = 0;
// }

//**************************************************************************************************
// resets notesPerBeat global variable
// function resetNotesPerBeat() {
//   notesPerBeat = GetParameter("Notes Per Beat");
// }

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
// tests is current beat is greater than the previous beat. returns boolean.
function isNextBeat() {
  const info = GetTimingInfo();
  const beatLength = 60000 / info.tempo;
  return dateNow() - prevBeat > beatLength;
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
function logNote(noteOn, noteOff) {
  Trace(" dateNow: " + dateNow());
}

//**************************************************************************************************
// creates a new NoteOn object from a randomly selected note from activeNotes
function makeNote() {
  const selectedNote = getRandomFromArray(activeNotes);
  let newNote = new NoteOn(selectedNote);
  newNote.beatPos = getBeatPos();
  return newNote;
}

//**************************************************************************************************
// sends a noteOn, then creates and sends a noteOff after noteLength time
function sendNote() {
  const noteToSend = new NoteOn(getRandomFromArray(activeNotes));
  noteToSend.send();
  noteOffToSend = new NoteOff(noteToSend);
  noteOffToSend.sendAfterMilliseconds(GetParameter("Note Length"));

  logNote(noteToSend, noteOffToSend);

  notesPlayed += 1;
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

function getBeatMap(numNotes, notesPerBeat) {
  let arr = new Array(notesPerBeat);
  for (let i = 0; i < notesPerBeat; i++) {
    arr[i] = i;
  }

  let indices = [];
  for (let i = 0; i < numNotes; i++) {
    let index = getAndRemoveRandomItem(arr);
    indices.push(index);
  }
  console.log(indices.sort());

  let output = new Array(notesPerBeat).fill(0);
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
// resets offsets global variable
function updateOffsets() {
  const info = GetTimingInfo();

  const beatDivision = GetParameter("Beat Division");
  const notesPerBeat = GetParameter("Notes Per Beat");

  const beatMap = getBeatMap(notesPerBeat, beatDivision);
  const offsetAmount = 60000 / info.tempo / beatDivision;
  offsets = getNoteDelays(beatMap, offsetAmount);

  return;
}

// LOGIC SCRIPTER FUNCTIONS
//**************************************************************************************************
function ProcessMIDI() {
  switch (true) {
    case isCycleEnd():
      prevBeat = getLeftCycleBeat();
      //updateOffsets();
      Trace("******** TOP " + prevBeat);
      break;

    case isNextBeat() && isPlaying():
      notesPlayed = 0;
      prevBeat = getCurrentBeat();
      timerStartTime = dateNow();
      updateOffsets();
      noteSendDelay = getOffset();
      Trace("******** NEXT " + prevBeat);
      break;

    case activeNotes.length !== 0 &&
      dateNow() - timerStartTime > noteSendDelay &&
      notesPlayed < GetParameter("Notes Per Beat"):
      sendNote();
      noteSendDelay += getOffset();

      break;
  }

  // switch (true) {
  //   case !isPlaying():
  //     Reset();
  //     break;

  //   // all notes off
  //   // reset offsets and notesPlayed count
  //   case isCycleEnd():
  //     Trace(" ************* CYCLE END");
  //     _allNotesOff();
  //     updateOffsets();
  //     resetNotesPlayed();
  //     break;

  //   // make a note, send it,
  //   // update notesPlayed count
  //   // update prevBeat
  //   case !finishedPlayingNotes():
  //     const note = makeNote();
  //     sendNote(note);
  //     prevBeat = getCurrentBeat();
  //     break;

  //   case noActiveNotes(): // can this move higher up the chain?
  //     break;

  //   // reset offsets and notesPlayed
  //   case isNextBeat():
  //     Trace(" ************* BEAT");
  //     updateOffsets();
  //     //resetNotesPerBeat();
  //     resetNotesPlayed();
  // }
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
  prevBeat = null;
}

//**************************************************************************************************
function ParameterChanged(param, value) {
  if (param == "Beat Division") {
    //updateOffsets();

    // Beat Division
    if (value < GetParameter("Notes Per Beat")) {
      //prevNotesPerBeat = notesPerBeat ? notesPerBeat : value;
      //notesPerBeat = value;
      SetParameter(1, value);
    } else {
      //updateOffsets();
      //resetNotesPlayed();
    }
  }
  if (param == "Notes Per Beat") {
    if (value > GetParameter("Beat Division")) {
      SetParameter("Beat Division", value);
      //prevNotesPerBeat = notesPerBeat ? notesPerBeat : value;
      //notesPerBeat = value;
      //updateOffsets();
      //resetNotesPlayed();
    } else {
      //prevNotesPerBeat = notesPerBeat ? notesPerBeat : value;
      //notesPerBeat = value;
      //updateOffsets();
      //resetNotesPlayed();
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
    maxValue: 16,
    numberOfSteps: 15,
    defaultValue: 8
  },
  {
    name: "Notes Per Beat",
    type: "lin",
    minValue: 1,
    maxValue: 8,
    numberOfSteps: 7,
    defaultValue: 2
  },
  {
    name: "Note Length",
    type: "lin",
    unit: "ms",
    minValue: 0.0,
    maxValue: 8000.0,
    numberOfSteps: 800,
    defaultValue: 500.0
  }
];
