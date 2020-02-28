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
var noteCount = 0;

// variable to track the previous beat
var prevBeat = 0;

// variable to track the current beat
var currentBeat = null;

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
  var beatDivision = GetParameter("Beat Division");

  // calculate offsets
  var offset = 1 / beatDivision;
  var value = 0;
  var result = [];
  for (let i = 0; i < beatDivision; i++) {
    result.push(value);
    value += offset;
  }

  // return array of offset floats,
  return result;
}

//**************************************************************************************************
function ProcessMIDI() {
  // get timing info
  const info = GetTimingInfo();

  // check for playing
  if (!info.playing) {
    // cancel all midi notes
    MIDI.allNotesOff();
    Reset();
    return;
  }

  // if cycling
  if (info.cycling) {
    // if at cycle beginning
    var distanceFromCycleStart = info.blockStartBeat - info.leftCycleBeat;
    // check that blockStartBeat is very close to leftCycle position
    if (distanceFromCycleStart < 0.01) {
      // update currentBeat to left cycle beat
      currentBeat = info.leftCycleBeat;

      Reset();
    }
  }

  if (activeNotes.length > 0) {
    //generate and send out the note -------------------------------------------------------------

    // get random note
    noteToSend = new NoteOn(getRandomFromArray(activeNotes));

    // if note is valid
    if (noteToSend.pitch <= 127 && noteToSend.pitch >= 0) {
      // play noteCount number of notes per beat -------------------------------------------------------------
      // if noteCount notes have already been played
      if (noteCount == GetParameter("Notes Per Beat")) {
        // reset currentBeat to block start beat
        currentBeat = GetTimingInfo().blockStartBeat;
        // reset offseets array
        offsets = getOffsets();

        // if it's the next beat now
        if (Math.floor(currentBeat) > prevBeat) {
          // reset noteCount
          noteCount = 0;
          prevBeat = currentBeat;
        }
      } else if (noteCount < GetParameter("Notes Per Beat")) {
        noteSendDelay = getRandomFromArray(offsets);
        var noteTime = currentBeat + noteSendDelay;

        // if noteTime is downbeat, move later
        var currentTime = info.blockStartBeat;
        if (noteTime < currentTime) {
          noteTime = currentTime + 0.001;
        }

        // send note
        noteToSend.sendAtBeat(noteTime);

        // remove offest from options
        const offsetToRemove = offsets.indexOf(noteSendDelay);
        offsets.splice(offsetToRemove, 1);

        // increment noteCount
        noteCount += 1;
        // update prevBeat to current beat
        prevBeat = currentBeat;
      } // end sending notes

      // create noteOff events
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
  //activeNotes = [];
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
