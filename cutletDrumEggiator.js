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
var activeNotes = [];

// array that will hold offset amounts, or 1 / beatDivision
var offsets = [];

// variable to track how many notes have been played
var notesPlayed = 0;

var notesPerBeat = null;

var beatDivision = null;

var prevNotesPerBeat = null;

const END_CYCLE_THRESHOLD = 0.02;

const NEXT_BEAT_THRESHOLD = 0.99;

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
} // getRandomFromArray

//**************************************************************************************************
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
  return Math.floor(result);
}

//**************************************************************************************************
function noteIsValid(note) {
  return note.pitch <= 127 && note.pitch >= 0;
}

//**************************************************************************************************
function getOffset() {
  return getRandomFromArray(offsets);
}
//**************************************************************************************************
function getBeatPos() {
  const currentBeat = getCurrentBeat();
  const offset = getOffset();
  return currentBeat + offset;
}
//**************************************************************************************************
function makeNote() {
  const selectedNote = getRandomFromArray(activeNotes);
  let newNote = new NoteOn(selectedNote);
  newNote.beatPos = getBeatPos();
  return newNote;
}
//**************************************************************************************************
// returns a random note from the active notes array
function sendNote(note) {
  if (noteIsValid(note)) {
    note.send();

    const noteLength = GetParameter("Note Length");
    let noteOff = new NoteOff(note);
    noteOff.beatPos = note.beatPos + noteLength;
    noteOff.send();

    notesPlayed += 1;
    // log()
  }
}

//**************************************************************************************************
// function getNoteOffDelay(noteLength) {
//   var info = GetTimingInfo();
//   var beatLength = 60000 / info.tempo;
//   return noteLength / beatLength;

//*******************************   *******************************************************************
function _allNotesOff() {
  MIDI.allNotesOff();
}

//**************************************************************************************************
function isCycleEnd() {
  const info = GetTimingInfo();
  const position = info.blockStartBeat;

  // cycle is off
  if (!info.cycling) {
    return false;
  }
  // cycle is on
  else {
    // cycle end
    if (info.rightCycleBeat - position < END_CYCLE_THRESHOLD) {
      _allNotesOff();
      return true;
      // still cycling
    } else {
      return false;
    }
  }
}

//**************************************************************************************************
// returns array of offset amounts
function resetOffsets() {
  beatDivision = GetParameter("Beat Division");

  // calculate offsets
  var offset = 1 / beatDivision;
  var value = 0;
  var result = [];
  for (let i = 0; i < beatDivision; i++) {
    if (value === 0) {
      result.push(value + 0.001);
      value += offset;
    } else {
      result.push(value);
      value += offset;
    }
  }

  offsets = result;

  return;
}

//**************************************************************************************************
function resetNotesPlayed() {
  notesPlayed = 0;
}

//**************************************************************************************************
function finishedPlayingNotes() {
  return activesNotes.length > 0 && notesPlayed < notesPerBeat;
}

//**************************************************************************************************
function isNextBeat() {
  const position = GetTimingInfo.blockBeatStart();
  const beat = Math.floor(position);
  return position - beat > NEXT_BEAT_THRESHOLD;
}

//**************************************************************************************************
function ProcessMIDI() {
  switch (true) {
    case isCycleEnd():
      resetOffsets();
      resetNotesPlayed();
      break;

    case !finishedPlayingNotes():
      const note = makeNote();
      sendNote(note);
      break;

    case isNextBeat():
      resetOffsets();
      resetNotesPlayed();

    default:
      Trace("ProcessMidi fail");
  }
}

//**************************************************************************************************
function HandleMIDI(note) {
  if (note instanceof NoteOn) {
    activeNotes.push(note);
  }

  if (note instanceof NoteOff) {
    for (var i in activeNotes) {
      if (activeNotes[i].pitch == note.pitch) {
        activeNotes.splice(i, 1);
      }
    }
  }
}

//**************************************************************************************************
function Reset() {
  MIDI.allNotesOff();
}

//**************************************************************************************************
function ParameterChanged(param, value) {
  var info = GetTimingInfo();
  //if beat division slider is moved ---------------------------------------------------------------
  if (param == 0) {
    //MIDI.allNotesOff();
    if (value < notesPerBeat) {
      beatDivision = value;
      SetParameter(1, value);
    } else {
      var info = GetTimingInfo();
      offsets = getOffsets();
    }
  }
  if (param == 1) {
    if (notesPerBeat == null) {
      notesPerBeat = value;
      return;
    }

    if (value > beatDivision) {
      MIDI.allNotesOff();
      currentBeat = Math.round(getCurrentBeat(info.blockStartBeat));
      Trace("NEW CURRENT BEAT " + currentBeat);
      SetParameter(0, value);
      notesPerBeat = value;
      notesPlayed = 0;
    } else {
      notesPlayed = 0;
      currentBeat = Math.round(getCurrentBeat(info.blockStartBeat));
      MIDI.allNotesOff();
      //prevNotesPerBeat = notesPerBeat;
      notesPerBeat = value;
    }
  }
}

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
