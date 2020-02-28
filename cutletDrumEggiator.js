//--------------------------------------------------------------------------------------------------
// Harpeggiator
//--------------------------------------------------------------------------------------------------

/* notes are generated in ProcessMIDI, and HandleMIDI only updates the note array (which is 
   activeNotes[]) and triggers pointer/cursor initialization. ParameterChanged is called when a 
   slider is moved. If it is the octave slider octave and maximumNotesToSend are updated. If it is 
   the note division slider, stdFlam is updated.
*/

//set this flag to true, to access the host timing info
var NeedsTimingInfo = true;

activeNotes = [];

// index for the to-be-sent note.
var currPtr = 0;

// octave shifting value for the to-be-sent note.
var currOct = 0;

// time delay value for the to-be-sent note.
var noteSendDelay = 0;

/* a counter recording how many notes are sent. This is used to compute the noteSendDelay 
   when an accelerando is involved, and control the moving direction of currPtr.*/
var totalNoteSent = 0;

/* either 1 or -1, where 1 means the currPtr is moving right, 
 and -1 means it is moving left.*/
var direction = 0;

// standard flam value computed in initializeCursor().
var stdFlam = 0;

// the octave value directly read from the octave slider on the panel.
var octave = 0;

// the start time of sending the first note, set in initializeCursor().
var timerStartTime = 0;

//tracks the current channel pressure value
var currentPressure = 0;

/* the total number of notes that should be sent before changing the pointer moving direction.*/
var maximumNotesToSend = 0;

// reset before each note is sent
randomTimeShift = 0;

// to make it sound more like real person
maxRandomTimeShift = 0;

var offsets = [];

var noteCount = 0;

var splicing = false;

var prevBeat = null;

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

  // if it is time to send out the note
  if (activeNotes.length != 0) {
    randomTimeShift = 0;

    if (activeNotes.length > 0) {
      //generate and send out the note -------------------------------------------------------------

      /*** GET RANDOM NOTE ***/
      noteToSend = new NoteOn(getRandomFromArray(activeNotes));

      if (noteToSend.pitch <= 127 && noteToSend.pitch >= 0) {
        // the value 16 in the line below is a scalor and is arbiturary
        velocitySubtractor = Math.round(
          (GetParameter("Diminuendo") * totalNoteSent) / 16
        );

        //if "Velocity Follows Aftertouch" is set to on
        if (GetParameter("Velocity Follows Aftertouch") == 0) {
          //use pressure to define velocity
          noteToSend.velocity = MIDI.normalizeData(
            currentPressure - velocitySubtractor
          );
        } else {
          //use played velocity
          noteToSend.velocity = MIDI.normalizeData(
            noteToSend.velocity - velocitySubtractor
          );
        }

        // if noteCount > GetParameter("Note Count"), don't play
        // if Math.floor(beat) > prevBeat, reset noteCount to zero
        // play notes, increment counter
        // otherwise, if noteCount < count, play note and increment count

        // if finished playing the notes
        if (noteCount == GetParameter("Note Count")) {
          currentBeat = GetTimingInfo().blockStartBeat;
          offsets = getOffsets();
          // if it's the next beat now
          if (Math.floor(currentBeat) > prevBeat) {
            // reset noteCount
            noteCount = 0;
            prevBeat = currentBeat;
          }
        } else {
          //currentBeat = GetTimingInfo().blockStartBeat;

          prevBeat = currentBeat;
          noteSendDelay = getRandomFromArray(offsets);
          //noteToSend.sendAfterMilliseconds(noteSendDelay);
          noteToSend.beatPos = currentBeat + noteSendDelay;
          Trace("current beat" + currentBeat);
          Trace("beatPos " + noteToSend.beatPos);
          noteToSend.send();
          const offsetToRemove = offsets.indexOf(noteSendDelay);
          offsets.splice(offsetToRemove, 1);
          noteCount += 1;
        }

        /**
        if (noteCount == GetParameter("Note Count")) {
          offsets = getOffsets();
        }**/

        noteOffToSend = new NoteOff(noteToSend);
        noteOffToSend.sendAfterMilliseconds(GetParameter("Note Length"));
      }

      //update controller variables ----------------------------------------------------------------
      notesSentInCurrOct =
        octave >= 0 ? currPtr : activeNotes.length - currPtr - 1;
      signOfOctave = octave == 0 ? 1 : Math.sign(octave);
      totalNoteSent =
        currOct * signOfOctave * activeNotes.length + notesSentInCurrOct;

      noteSendDelaySubtractor = totalNoteSent * GetParameter("Accelerando");

      //noteSendDelay = 0;

      currPtr = currPtr + direction;
      if (currPtr >= activeNotes.length || currPtr < 0) {
        currPtr = direction >= 0 ? 0 : activeNotes.length - 1;
        currOct += direction;
      }
    } else {
      // currPtr is out of bound due to whatever reason.
      currPtr = activeNotes.length - 1;
    }

    // test and change direction -------------------------------------------------------------------
    if (totalNoteSent >= maximumNotesToSend - 1 || totalNoteSent <= 1) {
      octaveMultiplier = octave == 0 ? 1 : octave;
      if (
        (octaveMultiplier * direction > 0 &&
          totalNoteSent >= maximumNotesToSend - 1) ||
        (octaveMultiplier * direction < 0 && totalNoteSent <= 1)
      ) {
        direction *= -1;
      }
    } //end test and change direction
  } //end time to send out note
} //ProcessMIDI

//**************************************************************************************************
function HandleMIDI(note) {
  var info = GetTimingInfo();
  currentBeat = info.blockStartBeat;
  /* if a note on is received, add the note in activeNotes[] and re-initialized the cursor, and 
      update the maximumNotesToSend --------------------------------------------------------------*/
  if (note instanceof NoteOn) {
    activeNotes.push(note);
    octave = GetParameter("Octave");
    if (activeNotes.length == 1) {
      initializeCursor(info);
    }

    /**** CUTLET CHANGE ****/
    //maximumNotesToSend = (Math.abs(octave) + 1) * activeNotes.length;
    maximumNotesToSend = 1;

    //set current pressure to current played velocity
    currentPressure = note.data2;
  }

  /* get ChannelPressure. If it is less than the min value set in the "Minimum Aftertouch", set it 
     to the minimum value. -----------------------------------------------------------------------*/
  if (note instanceof ChannelPressure) {
    currentPressure = note.value;

    var minAfterTouch = GetParameter("Minimum Aftertouch");
    if (currentPressure < minAfterTouch) {
      currentPressure = minAfterTouch;
    }
  }

  /* note off message removes the off-ed note from activeNotes, and clears all the controller 
     variables if all the notes are off-ed -------------------------------------------------------*/
  if (note instanceof NoteOff) {
    for (var i in activeNotes) {
      if (activeNotes[i].pitch == note.pitch) {
        activeNotes.splice(i, 1);
        maximumNotesToSend = (Math.abs(octave) + 1) * activeNotes.length;
      }
    }
    /**if (activeNotes.length == 0) {
      note.send();
      noteSendDelay = 0;
      stdFlam = 0;
      currPtr = 0;
      currOct = 0;
      totalNoteSent = 0;
      octave = 0;
      timerStartTime = 0;
      direction = 0;
    }**/
  }

  //------------------------------------------------------------------------------------------------
  if (!(note instanceof Note || note instanceof ChannelPressure)) {
    note.send();
  }
}

//**************************************************************************************************
function Reset() {}

//**************************************************************************************************
function ParameterChanged(param, value) {
  //if beat division slider is moved ---------------------------------------------------------------
  if (param == 1) {
    var info = GetTimingInfo();
    stdFlam = 60000 / info.tempo / GetParameter("Beat Division");
    offsets = getOffsets();
  }

  //if Octave slider is moved ----------------------------------------------------------------------
  if (param == 2) {
    octave = GetParameter("Octave");
    maximumNotesToSend = (Math.abs(octave) + 1) * activeNotes.length;
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
