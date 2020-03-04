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

var prevBeat = null;

var prevNotesPerBeat = null;

const END_CYCLE_THRESHOLD = 0.02;

const NEXT_BEAT_THRESHOLD = 0.995;

const DOWNBEAT_OFFSET = 0.001;

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
  const position = GetTimingInfo().blockStartBeat;
  const currentBeat = getCurrentBeat();
  const offset = getOffset();

  offsets.splice(offsets.indexOf(offset), 1);

  return offset === 0 ? position + DOWNBEAT_OFFSET : currentBeat + offset;
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

    const noteLength = getNoteOffDelay(GetParameter("Note Length"));
    let noteOff = new NoteOff(note);
    noteOff.beatPos = note.beatPos + noteLength;
    noteOff.send();

    Trace(
      "time " +
        GetTimingInfo().blockStartBeat +
        " pitch: " +
        MIDI.noteName(note.pitch) +
        " noteOn.beatPos " +
        note.beatPos +
        " noteOff.beatPos " +
        noteOff.beatPos
    );

    notesPlayed += 1;
  }
}

//**************************************************************************************************
function getNoteOffDelay(noteLength) {
  const info = GetTimingInfo();
  const beatLength = 60000 / info.tempo;
  return noteLength / beatLength;
}

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
      result.push(value);
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
  return notesPlayed >= notesPerBeat;
}

//**************************************************************************************************
function noActiveNotes() {
  return activeNotes.length === 0;
}

//**************************************************************************************************
function isNextBeat() {
  const position = GetTimingInfo().blockStartBeat;
  const beat = Math.floor(position);
  return beat > prevBeat;
}

//**************************************************************************************************
function isPlaying() {
  return GetTimingInfo().playing;
}

//**************************************************************************************************
function ProcessMIDI() {
  if (!GetTimingInfo().playing) {
    _allNotesOff();
  }
  switch (true) {
    case !isPlaying():
      Reset();
      break;
    case isCycleEnd():
      Trace("cycle end");
      resetOffsets();
      resetNotesPlayed();
      break;

    case !finishedPlayingNotes():
      prevBeat = getCurrentBeat();
      const note = makeNote();
      sendNote(note);
      break;

    case noActiveNotes():
      break;

    case isNextBeat():
      Trace("next beat");
      resetOffsets();
      resetNotesPlayed();
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
  activeNotes = [];
  MIDI.allNotesOff();
  prevBeat = null;
}

//**************************************************************************************************
function ParameterChanged(param, value) {
  if (param == 0) {
    if (value < notesPerBeat) {
      SetParameter(1, value);
    } else {
      resetOffsets();
      resetNotesPlayed();
    }
  }
  if (param == 1) {
    if (value > beatDivision) {
      SetParameter(0, value);
      notesPerBeat = value;
      resetOffsets();
      resetNotesPlayed();
    } else {
      notesPerBeat = value;
      resetOffsets();
      resetNotesPlayed();
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
