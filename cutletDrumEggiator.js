//--------------------------------------------------------------------------------------------------
// CutletDrumEggiator
//--------------------------------------------------------------------------------------------------

/* notes are generated in ProcessMIDI, and HandleMIDI only updates the note array (which is 
   activeNotes[]) and triggers pointer/cursor initialization. ParameterChanged is called when a 
   slider is moved. If it is the octave slider octave and maximumNotesToSend are updated. If it is 
   the note division slider, stdFlam is updated.
*/

//set this flag to true, to access the host timing info
var NeedsTimingInfo = true;

activeNotes = [];

var offsets = [];

var noteCount = 0;

var splicing = false;

var prevBeat = 0;

var currentBeat = null;

//**************************************************************************************************
function dateNow() {
  // extract timing infos
  var timingInfo = GetTimingInfo();

  // convert beat position to ms
  return Math.round(timingInfo.blockStartBeat * (60000 / timingInfo.tempo));
} // /dateNow

//*************************************************************************************************
function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

//**************************************************************************************************
function getRandomFromArray(arr) {
  var max = arr.length - 1;
  var index = getRandomInRange(0, max);
  return arr[index];
} // getRandomFromArray

//**************************************************************************************************
function getOffsets() {
  const info = GetTimingInfo();
  const beat_ms = 60000 / info.tempo;

  // get subdivisions
  var beatDivision = GetParameter("Beat Division");

  // calculate offsets
  //var offset = beat_ms / beatDivision;
  var offset = 1 / beatDivision;
  var value = 0;
  var result = [];
  for (let i = 0; i < beatDivision; i++) {
    result.push(value);
    value += offset;
  }

  // return array of offset floats,,
  return result;
}

//**************************************************************************************************
function ProcessMIDI() {
  //Trace(GetTimingInfo().blockStartBeat)

  const info = GetTimingInfo();

  // check for playing
  if (!info.playing) {
    MIDI.allNotesOff();
    Reset();
    return;
  }

  // check for cyling
  if (info.cycling) {
    if (Math.floor(info.blockStartBeat) == info.leftCycleBeat) {
      Reset();
    }
  }

  if (activeNotes.length > 0) {
    //generate and send out the note -------------------------------------------------------------

    // get random note
    noteToSend = new NoteOn(getRandomFromArray(activeNotes));

    // if note is valid
    if (noteToSend.pitch <= 127 && noteToSend.pitch >= 0) {
      /*** WHICH BEAT ***/

      // if noteCount notes have already been played
      if (noteCount == GetParameter("Note Count")) {
        // reset currentBeat to block start beat
        currentBeat = GetTimingInfo().blockStartBeat;
        // reset offseets array
        offsets = getOffsets();

        // if it's the next beat now
        if (Math.floor(currentBeat) > prevBeat) {
          // reset noteCount
          Trace("next beat " + currentBeat);
          noteCount = 0;
          prevBeat = currentBeat;
        }
      } else if (noteCount < GetParameter("Note Count")) {
        noteSendDelay = getRandomFromArray(offsets);
        var noteTime = currentBeat + noteSendDelay;

        // send note
        noteToSend.sendAtBeat(noteTime);
        Trace("note time " + noteTime);

        // remove position
        const offsetToRemove = offsets.indexOf(noteSendDelay);
        offsets.splice(offsetToRemove, 1);

        // increment noteCount
        noteCount += 1;

        prevBeat = currentBeat;
      }
      /*** END WHICH BEAT ***/

      noteOffToSend = new NoteOff(noteToSend);
      noteOffToSend.sendAfterMilliseconds(GetParameter("Note Length"));
    }
  } else {
    console.log("activeNotes empty");
  }
} //ProcessMIDI

//**************************************************************************************************
function HandleMIDI(note) {
  var info = GetTimingInfo();
  currentBeat = Math.ceil(info.blockStartBeat);
  /* if a note on is received, add the note in activeNotes[] and re-initialized the cursor, and 
      update the maximumNotesToSend --------------------------------------------------------------*/
  if (note instanceof NoteOn) {
    activeNotes.push(note);
  }

  /* note off message removes the off-ed note from activeNotes, and clears all the controller 
     variables if all the notes are off-ed -------------------------------------------------------*/
  if (note instanceof NoteOff) {
    for (var i in activeNotes) {
      if (activeNotes[i].pitch == note.pitch) {
        activeNotes.splice(i, 1);
        //maximumNotesToSend = (Math.abs(octave) + 1) * activeNotes.length;
      }
    }
  }
}

//**************************************************************************************************
function Reset() {
  noteCount = 0;
  activeNotes = [];
}

//**************************************************************************************************
function ParameterChanged(param, value) {
  //if beat division slider is moved ---------------------------------------------------------------
  if (param == 1) {
    var info = GetTimingInfo();
    stdFlam = 60000 / info.tempo / GetParameter("Beat Division");
    offsets = getOffsets();
  }
}

//**************************************************************************************************
// initialization of new elements in the controller variable arrays
initializeCursor = function(info) {
  noteSendDelay = 0;
  stdFlam = 60000 / info.tempo / GetParameter("Beat Division");
  currOct = 0;
  totalNoteSent = 0;
  currPtr = octave < 0 ? activeNotes.length - 1 : 0;
  timerStartTime = dateNow();
  direction = octave == 0 ? 1 : Math.sign(octave);
};

//**************************************************************************************************
Math.sign = function(num) {
  if (num > 0) return 1;
  if (num == 0) return 0;
  if (num < 0) return -1;
};

function sortByPitchAscending(a, b) {
  if (a.pitch < b.pitch) return -1;
  if (a.pitch > b.pitch) return 1;
  return 0;
}

//**************************************************************************************************
//define the UI controls here

var PluginParameters = [
  {
    name: "Note Length",
    type: "lin",
    unit: "ms",
    minValue: 0.0,
    maxValue: 8000.0,
    numberOfSteps: 800,
    defaultValue: 500.0
  },
  {
    name: "Beat Division",
    type: "lin",
    minValue: 1,
    maxValue: 16,
    numberOfSteps: 15,
    defaultValue: 8
  },
  {
    name: "Note Count",
    type: "lin",
    minValue: 1,
    maxValue: 8,
    numberOfSteps: 7,
    defaultValue: 2
  },
  {
    name: "Octave",
    type: "lin",
    minValue: -10,
    maxValue: 10,
    numberOfSteps: 20,
    defaultValue: 2
  },
  {
    name: "Accelerando",
    type: "lin",
    minValue: -100,
    maxValue: 10,
    numberOfSteps: 110,
    defaultValue: -5
  },
  {
    name: "Diminuendo",
    type: "lin",
    minValue: -127,
    maxValue: 127,
    numberOfSteps: 254,
    defaultValue: 32
  },
  {
    name: "Velocity Follows Aftertouch",
    type: "menu",
    valueStrings: ["On", "Off"],
    numberOfSteps: 2,
    defaultValue: 1
  },
  {
    name: "Minimum Aftertouch",
    type: "lin",
    minValue: 0,
    maxValue: 127,
    numberOfSteps: 127,
    defaultValue: 40
  }
];
