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

// variable to track the previous beat
var prevBeat = 0;

// variable to track the current beat
var currentBeat = null;

var notesPerBeat = null;

var beatDivision = null;

//*************************************************************************************************
// returns a random number with in a range min-max
function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

//**************************************************************************************************
// returns a random item from an array
function getRandomFromArray(arr) {
  if (arr.length === 0) {
    return null;
  }
  var max = arr.length - 1;
  var index = getRandomInRange(0, max);
  return arr[index];
} // getRandomFromArray

//**************************************************************************************************
// returns array of offset amounts
function getOffsets() {
  // get subdivisions
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

  // return array of offset floats
  return result;
}

//**************************************************************************************************
function getNoteOffDelay(noteLength) {
  var info = GetTimingInfo();
  var beatLength = 60000 / info.tempo;
  return noteLength / beatLength;
}
//**************************************************************************************************

function getCurrentBeat(beatPosition) {
  var info = GetTimingInfo();
  var result = null;
  if (info.cycling) {
    if (
      beatPosition < info.leftCycleBeat ||
      beatPosition > info.rightCycleBeat
    ) {
      result = info.leftCycleBeat;
    } else {
      result = beatPosition;
    }
  } else {
    result = beatPosition;
  }

  return result;
}
//*******************************   *******************************************************************
function _allNotesOff() {
  MIDI.allNotesOff();
}

//**************************************************************************************************
function isCycleEnd() {
  var info = GetTimingInfo();
  if (info.cycling) {
    var distanceFromCycleEnd = info.rightCycleBeat - info.blockStartBeat;
    if (distanceFromCycleEnd < 0.01) {
      _allNotesOff();
      Trace("cycle end", info.blockStartBeat);
      return true;
    } else {
      return false;
    }
  }
}

//**************************************************************************************************
function ProcessMIDI() {
  // get timing info
  const info = GetTimingInfo();
  currentBeat = getCurrentBeat(info.blockStartBeat);
  // check for stopped state
  if (!info.playing) {
    MIDI.allNotesOff();
    Reset();
    return;
  }

  if (info.cycling) {
    notesPlayed = isCycleEnd() ? 0 : notesPlayed;
  }

  if (activeNotes.length > 0) {
    //generate and send out the note -------------------------------------------------------------

    // get random note
    noteToSend = new NoteOn(getRandomFromArray(activeNotes));
    //noteToSend.channel = 2;

    // if note is valid
    if (noteToSend.pitch <= 127 && noteToSend.pitch >= 0) {
      // play notesPerBeat number of notes per beat -------------------------------------------------------------

      if (notesPlayed < notesPerBeat && !isCycleEnd()) {
        Trace("SCHEDULE " + info.blockStartBeat);
        var noteSendDelay = getRandomFromArray(offsets);
        var noteTime = currentBeat + noteSendDelay;

        // send note
        if (noteTime > info.blockStartBeat) {
          noteToSend.sendAtBeat(noteTime);
          Trace([
            noteToSend.channel,
            " block: " + info.blockStartBeat.toFixed(4),
            " current: " + currentBeat.toFixed(4),
            " delay: " + noteSendDelay,
            " noteTime : " + noteTime.toFixed(4),
            " played : " + notesPlayed
          ]);

          // remove offest from options
          const offsetToRemove = offsets.indexOf(noteSendDelay);
          offsets.splice(offsetToRemove, 1);

          // increment notesPlayed
          notesPlayed += 1;

          // create noteOff events
          noteOffToSend = new NoteOff(noteToSend);
          var noteSendDelay = getNoteOffDelay(GetParameter("Note Length"));

          noteOffToSend.sendAtBeat(noteTime + noteSendDelay);
        }

        // update prevBeat to current beat
        prevBeat = Math.round(currentBeat);
      } else if (notesPlayed >= notesPerBeat) {
        // reset currentBeat to block start beat
        currentBeat = getCurrentBeat(GetTimingInfo().blockStartBeat);
        // reset offseets array
        offsets = getOffsets();

        // if it's the next beat now
        if (currentBeat - prevBeat > 0.99) {
          Trace("CURRENT: " + currentBeat + "PREV: " + prevBeat);
          // reset notesPlayed
          notesPlayed = 0;
          prevBeat = Math.floor(currentBeat);
        }
      } // end send notes
    } else {
      console.log("note is not valid");
    } // end check is note is valid
  } else {
    console.log("activeNotes empty");
  } // end
} //ProcessMIDI

//**************************************************************************************************
function HandleMIDI(note) {
  var info = GetTimingInfo();
  currentBeat = getCurrentBeat(note.beatPos);
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
  //MIDI.allNotesOff();
  notesPlayed = 0;
  //activeNotes = [];
}

//**************************************************************************************************
function ParameterChanged(param, value) {
  //if beat division slider is moved ---------------------------------------------------------------
  if (param == 0) {
    var info = GetTimingInfo();
    //stdFlam = 60000 / info.tempo / GetParameter("Beat Division");
    offsets = getOffsets();
  }
  if (param == 1) {
    if (value > beatDivision) {
      Trace("here");
      SetParameter(0, value);
      notesPerBeat = value;
      notesPlayed = 0;
    } else {
      notesPlayed = 0;
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
